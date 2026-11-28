import mongoose from "mongoose";
import { beforeAll, afterAll, afterEach, describe, it, expect } from "vitest";
import { connectTestDatabase, disconnectTestDatabase, clearDatabase, createTestAgent } from "../helpers/database.js";
import { createVerifiedUser, createCompanyStaffWithMembership, loginAndGetAccessToken } from "../helpers/auth-fixtures.js";
import Announcement from "../../src/models/announcement.model.js";
import AnnouncementRecipient from "../../src/models/announcement-recipient.model.js";
import Notification from "../../src/models/notification.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import User from "../../src/models/user.model.js";
import { recoverAdminNotifications } from "../../src/services/announcement.service.js";
import { recoverPendingNotificationEvents } from "../../src/services/notification.service.js";
import { submitOwnedCompany } from "../../src/services/company.service.js";

const setup = async () => {
  const agent = createTestAgent();
  const admin = await createVerifiedUser({ email: "admin@test.com", role: "PLATFORM_ADMIN" });
  const token = await loginAndGetAccessToken(agent, { email: admin.user.email, password: admin.password });
  return { agent, admin, token };
};
describe("V18 Admin notifications", () => {
  beforeAll(async () => { await connectTestDatabase(); await Promise.all([Announcement.init(), AnnouncementRecipient.init()]); });
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);
  it("snapshots ACTIVE audience, excludes sender, deduplicates retries and delivers offline through recovery", async () => {
    const { agent, admin, token } = await setup();
    const recipient = await createVerifiedUser({ email: "recipient@test.com" });
    await createVerifiedUser({ email: "locked@test.com", status: "LOCKED" });
    const body = { title: "Bảo trì", content: "Thông báo hệ thống", clientRequestId: "publish-1" };
    const publish = () => agent.post("/api/platform-admin/announcements").set("Authorization", `Bearer ${token}`).send(body);
    const response = await publish();
    expect(response.status).toBe(202);
    expect(response.body.announcement.totalRecipients).toBe(1);
    expect(response.body.announcement.status).toBe("PENDING");
    expect((await publish()).body.announcement.id).toBe(response.body.announcement.id);
    expect((await agent.post("/api/platform-admin/announcements").set("Authorization", `Bearer ${token}`).send({ ...body, content: "Changed" })).status).toBe(409);
    await createVerifiedUser({ email: "later@test.com" });
    await User.updateOne({ _id: recipient.user._id }, { $set: { status: "LOCKED" } });
    await recoverAdminNotifications({ limit: 1 });
    await recoverAdminNotifications({ limit: 1 });
    expect(await Notification.countDocuments({ recipientUserId: recipient.user._id })).toBe(1);
    expect(await Notification.countDocuments({ recipientUserId: admin.user._id })).toBe(0);
    expect(await NotificationEvent.countDocuments()).toBe(1);
    const detail = await agent.get(`/api/platform-admin/announcements/${response.body.announcement.id}`).set("Authorization", `Bearer ${token}`);
    expect(detail.body.announcement).toMatchObject({ status: "COMPLETE", deliveredCount: 1, failedCount: 0 });
  });
  it("rejects foreign actors/unsupported keys and returns strict paginated history", async () => {
    const { agent, token } = await setup();
    expect((await agent.post("/api/platform-admin/announcements").send({})).status).toBe(401);
    expect((await agent.post("/api/platform-admin/announcements").set("Authorization", `Bearer ${token}`).send({ title: "A", content: "B", clientRequestId: "c", recipientUserId: new mongoose.Types.ObjectId() })).status).toBe(400);
    expect((await agent.get("/api/platform-admin/announcements?limit=101").set("Authorization", `Bearer ${token}`)).status).toBe(400);
    const empty = await agent.get("/api/platform-admin/announcements?page=99&limit=5").set("Authorization", `Bearer ${token}`);
    expect(empty.body.pagination).toEqual({ page: 99, limit: 5, total: 0, totalPages: 0 });
  });
  it("Company submit persists an Admin obligation seed atomically and recovery materializes it once", async () => {
    const { admin } = await setup();
    const manager = await createCompanyStaffWithMembership({ company: { name: "Hồ sơ mới", businessRegistrationNumber: "1234567890" } });
    await submitOwnedCompany({ managerUserId: manager.user._id });
    await recoverAdminNotifications();
    await recoverPendingNotificationEvents();
    await recoverAdminNotifications();
    expect(await Notification.countDocuments({ recipientUserId: admin.user._id, type: "COMPANY_SUBMITTED", companyId: manager.company._id })).toBe(1);
  });
});
