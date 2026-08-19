import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import Notification from "../../src/models/notification.model.js";
import {
  createNotificationEvent,
  materializeNotificationEvent,
  recoverPendingNotificationEvents,
} from "../../src/services/notification.service.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const objectId = () => new mongoose.Types.ObjectId();

const eventInput = (overrides = {}) => ({
  eventKey: `event:${objectId()}`,
  type: NOTIFICATION_TYPE.APPLICATION_UNASSIGNED,
  applicationId: objectId(),
  recipients: [
    {
      recipientUserId: objectId(),
      content: "The application is awaiting a new assignee.",
    },
  ],
  ...overrides,
});

describe("V13 Slice 01 durable Notification kernel", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("enforces the canonical enum, references, and recipient snapshot invariants", async () => {
    const invalidType = new NotificationEvent(
      eventInput({ type: "JOB_INVITATION_EXPIRED" }),
    );
    const missingChatReference = new NotificationEvent(
      eventInput({ type: NOTIFICATION_TYPE.CHAT_MESSAGE_CREATED }),
    );
    const duplicateRecipientId = objectId();
    const duplicateRecipients = new NotificationEvent(
      eventInput({
        recipients: [
          { recipientUserId: duplicateRecipientId, content: "One" },
          { recipientUserId: duplicateRecipientId, content: "Two" },
        ],
      }),
    );
    const missingEventNotification = new Notification({
      recipientUserId: objectId(),
      type: NOTIFICATION_TYPE.APPLICATION_UNASSIGNED,
      content: "A durable notification",
      applicationId: objectId(),
    });

    await expect(invalidType.validate()).rejects.toThrow();
    await expect(missingChatReference.validate()).rejects.toThrow(
      "CHAT_MESSAGE_CREATED must have messageId",
    );
    await expect(duplicateRecipients.validate()).rejects.toThrow(
      "recipients must not contain duplicate recipientUserId values",
    );
    await expect(missingEventNotification.validate()).rejects.toThrow();

    expect(Object.values(NOTIFICATION_TYPE)).not.toContain(
      "JOB_INVITATION_EXPIRED",
    );
    expect(Object.values(NOTIFICATION_TYPE)).not.toContain(
      "CONVERSATION_BECAME_READ_ONLY",
    );
    expect(Object.values(NOTIFICATION_TYPE)).not.toContain(
      "INTERVIEW_SCHEDULE_COMPLETED",
    );
  });

  it("enforces unique eventKey and unique eventId plus recipientUserId", async () => {
    const event = await NotificationEvent.create(eventInput({ eventKey: "same-event" }));

    await expect(
      NotificationEvent.create(eventInput({ eventKey: "same-event" })),
    ).rejects.toMatchObject({ code: 11000 });

    const notification = {
      eventId: event._id,
      recipientUserId: event.recipients[0].recipientUserId,
      type: event.type,
      content: event.recipients[0].content,
      applicationId: event.applicationId,
    };
    await Notification.create(notification);

    await expect(Notification.create(notification)).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("creates one immutable logical obligation for an idempotent eventKey", async () => {
    const input = eventInput({ eventKey: "stable-logical-event" });
    const first = await createNotificationEvent(input);
    const second = await createNotificationEvent({
      ...input,
      recipients: [
        {
          recipientUserId: objectId(),
          content: "This retry payload must not replace the snapshot.",
        },
      ],
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.event._id.toString()).toBe(first.event._id.toString());
    expect(second.event.recipients[0].content).toBe(input.recipients[0].content);

    first.event.recipients[0].content = "Mutated after event time";
    await first.event.save();

    const persistedEvent = await NotificationEvent.findById(first.event._id);
    expect(persistedEvent.recipients[0].content).toBe(input.recipients[0].content);
  });

  it("materializes idempotently and retries without duplicate Notifications", async () => {
    const { event } = await createNotificationEvent(
      eventInput({
        recipients: [
          { recipientUserId: objectId(), content: "Candidate content" },
          { recipientUserId: objectId(), content: "Recruiter content" },
        ],
      }),
    );

    await materializeNotificationEvent({ eventId: event._id });
    await materializeNotificationEvent({ eventId: event._id });

    expect(await Notification.countDocuments({ eventId: event._id })).toBe(2);

    const materializedEvent = await NotificationEvent.findById(event._id);
    expect(materializedEvent.materializedAt).toBeInstanceOf(Date);
  });

  it("keeps a partial event pending and recovers the missing persisted snapshot", async () => {
    const recipientA = objectId();
    const recipientB = objectId();
    const { event } = await createNotificationEvent(
      eventInput({
        recipients: [
          { recipientUserId: recipientA, content: "Original recipient A content" },
          { recipientUserId: recipientB, content: "Original recipient B content" },
        ],
      }),
    );

    await Notification.create({
      eventId: event._id,
      recipientUserId: recipientA,
      type: event.type,
      content: event.recipients[0].content,
      applicationId: event.applicationId,
    });

    expect((await NotificationEvent.findById(event._id)).materializedAt).toBeNull();

    await recoverPendingNotificationEvents();

    const notifications = await Notification.find({ eventId: event._id }).sort({
      recipientUserId: 1,
    });
    const recoveredEvent = await NotificationEvent.findById(event._id);

    expect(notifications).toHaveLength(2);
    expect(
      notifications.find(
        (notification) =>
          notification.recipientUserId.toString() === recipientB.toString(),
      ).content,
    ).toBe("Original recipient B content");
    expect(recoveredEvent.materializedAt).toBeInstanceOf(Date);
  });

  it("does not mark an event materialized while a required Notification is missing", async () => {
    const { event } = await createNotificationEvent(
      eventInput({
        recipients: [
          { recipientUserId: objectId(), content: "First recipient" },
          { recipientUserId: objectId(), content: "Second recipient" },
        ],
      }),
    );
    const originalUpdateOne = Notification.updateOne.bind(Notification);
    let updateAttempts = 0;

    vi.spyOn(Notification, "updateOne").mockImplementation((...arguments_) => {
      updateAttempts += 1;

      if (updateAttempts === 2) {
        return Promise.reject(new Error("temporary persistence failure"));
      }

      return originalUpdateOne(...arguments_);
    });

    try {
      await expect(
        materializeNotificationEvent({ eventId: event._id }),
      ).rejects.toThrow("temporary persistence failure");
    } finally {
      vi.restoreAllMocks();
    }

    expect(await Notification.countDocuments({ eventId: event._id })).toBe(1);
    expect((await NotificationEvent.findById(event._id)).materializedAt).toBeNull();
  });

  it("recovers using the persisted recipient and content snapshot only", async () => {
    const snapshottedRecipient = objectId();
    const { event } = await createNotificationEvent(
      eventInput({
        recipients: [
          {
            recipientUserId: snapshottedRecipient,
            content: "Content fixed at the business event time",
          },
        ],
      }),
    );

    await recoverPendingNotificationEvents();

    const notification = await Notification.findOne({ eventId: event._id });
    expect(notification.recipientUserId.toString()).toBe(
      snapshottedRecipient.toString(),
    );
    expect(notification.content).toBe("Content fixed at the business event time");
  });

  it("rolls back an event obligation with its source database transaction", async () => {
    const session = await mongoose.startSession();
    const input = eventInput({ eventKey: "rolled-back-source-event" });

    try {
      await expect(
        session.withTransaction(async () => {
          await createNotificationEvent({ ...input, session });
          throw new Error("source mutation rollback");
        }),
      ).rejects.toThrow("source mutation rollback");
    } finally {
      await session.endSession();
    }

    await expect(
      NotificationEvent.findOne({ eventKey: input.eventKey }),
    ).resolves.toBeNull();
  });
});
