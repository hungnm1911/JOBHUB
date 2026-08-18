import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import Notification from "../../src/models/notification.model.js";
import {
  createNotificationEvent,
  materializeNotificationEvent,
} from "../../src/services/notification.service.js";
import User from "../../src/models/user.model.js";
import {
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const objectId = () => new mongoose.Types.ObjectId();

const createNotificationFor = async ({
  recipientUserId,
  applicationId = objectId(),
  content = "A durable historical notification",
}) => {
  const { event } = await createNotificationEvent({
    eventKey: `slice02:${objectId()}`,
    type: NOTIFICATION_TYPE.APPLICATION_UNASSIGNED,
    applicationId,
    recipients: [{ recipientUserId, content }],
  });

  await materializeNotificationEvent({ eventId: event._id });

  return Notification.findOne({
    eventId: event._id,
    recipientUserId,
  });
};

const login = async (agent, email, password) => {
  return loginAndGetAccessToken(agent, { email, password });
};

describe("V13 Slice 02 Notification Inbox + Read State", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("returns only the authenticated recipient's inbox and durable unread total", async () => {
    const agent = createTestAgent();
    const owner = await createVerifiedUser({ email: "notification-owner@example.com" });
    const other = await createVerifiedUser({ email: "notification-other@example.com" });
    const ownerNotification = await createNotificationFor({
      recipientUserId: owner.user._id,
    });
    await createNotificationFor({ recipientUserId: other.user._id });
    const accessToken = await login(agent, owner.user.email, owner.password);

    const response = await agent
      .get("/api/notifications")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.unreadCount).toBe(1);
    expect(response.body.notifications).toHaveLength(1);
    expect(response.body.notifications[0]._id).toBe(ownerNotification._id.toString());
    expect((await Notification.findById(ownerNotification._id)).readAt).toBeNull();
  });

  it("allows fetch without changing readAt, but opening transitions only the recipient's unread Notification", async () => {
    const agent = createTestAgent();
    const owner = await createVerifiedUser({ email: "notification-open-owner@example.com" });
    const other = await createVerifiedUser({ email: "notification-open-other@example.com" });
    const notification = await createNotificationFor({
      recipientUserId: owner.user._id,
    });
    const ownerAccessToken = await login(agent, owner.user.email, owner.password);
    const otherAccessToken = await login(agent, other.user.email, other.password);

    const fetched = await agent
      .get(`/api/notifications/${notification._id}`)
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    const deniedFetch = await agent
      .get(`/api/notifications/${notification._id}`)
      .set("Authorization", `Bearer ${otherAccessToken}`);
    const deniedOpen = await agent
      .post(`/api/notifications/${notification._id}/open`)
      .set("Authorization", `Bearer ${otherAccessToken}`);

    expect(fetched.status).toBe(200);
    expect((await Notification.findById(notification._id)).readAt).toBeNull();
    expect(deniedFetch.status).toBe(404);
    expect(deniedOpen.status).toBe(404);
    expect((await Notification.findById(notification._id)).readAt).toBeNull();

    const opened = await agent
      .post(`/api/notifications/${notification._id}/open`)
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    const firstReadAt = (await Notification.findById(notification._id)).readAt;

    expect(opened.status).toBe(200);
    expect(firstReadAt).toBeInstanceOf(Date);

    const reopened = await agent
      .post(`/api/notifications/${notification._id}/open`)
      .set("Authorization", `Bearer ${ownerAccessToken}`);
    const markUnread = await agent
      .patch(`/api/notifications/${notification._id}`)
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ readAt: null });
    const persisted = await Notification.findById(notification._id);

    expect(reopened.status).toBe(200);
    expect(markUnread.status).toBe(404);
    expect(persisted.readAt.getTime()).toBe(firstReadAt.getTime());
  });

  it("derives unread totals from readAt and decreases the total exactly once", async () => {
    const agent = createTestAgent();
    const owner = await createVerifiedUser({ email: "notification-count-owner@example.com" });
    const first = await createNotificationFor({ recipientUserId: owner.user._id });
    await createNotificationFor({ recipientUserId: owner.user._id });
    const accessToken = await login(agent, owner.user.email, owner.password);

    const before = await agent
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${accessToken}`);
    await agent
      .post(`/api/notifications/${first._id}/open`)
      .set("Authorization", `Bearer ${accessToken}`);
    const afterFirstOpen = await agent
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${accessToken}`);
    await agent
      .post(`/api/notifications/${first._id}/open`)
      .set("Authorization", `Bearer ${accessToken}`);
    const afterSecondOpen = await agent
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(before.body.unreadCount).toBe(2);
    expect(afterFirstOpen.body.unreadCount).toBe(1);
    expect(afterSecondOpen.body.unreadCount).toBe(1);
  });

  it("keeps historical Notifications readable without modifying their event or granting resource access", async () => {
    const agent = createTestAgent();
    const owner = await createVerifiedUser({ email: "notification-history-owner@example.com" });
    const missingApplicationId = objectId();
    const notification = await createNotificationFor({
      recipientUserId: owner.user._id,
      applicationId: missingApplicationId,
    });
    const eventBeforeRead = await NotificationEvent.findById(notification.eventId).lean();
    const accessToken = await login(agent, owner.user.email, owner.password);

    const response = await agent
      .post(`/api/notifications/${notification._id}/open`)
      .set("Authorization", `Bearer ${accessToken}`);
    const eventAfterRead = await NotificationEvent.findById(notification.eventId).lean();

    expect(response.status).toBe(200);
    expect(response.body.notification.applicationId).toBe(
      missingApplicationId.toString(),
    );
    expect(eventAfterRead).toEqual(eventBeforeRead);
    expect(await Notification.countDocuments({ eventId: notification.eventId })).toBe(1);
    expect(User.schema.path("unreadNotificationCount")).toBeUndefined();
    expect(Notification.schema.path("isRead")).toBeUndefined();
  });
});
