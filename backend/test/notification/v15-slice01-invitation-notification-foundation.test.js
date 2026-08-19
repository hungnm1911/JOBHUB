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
import NotificationEvent, {
  JOB_INVITATION_NOTIFICATION_TYPES,
  PURE_JOB_INVITATION_NOTIFICATION_TYPES,
} from "../../src/models/notification-event.model.js";
import Notification from "../../src/models/notification.model.js";
import {
  createNotificationEvent,
  materializeNotificationEvent,
} from "../../src/services/notification.service.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const objectId = () => new mongoose.Types.ObjectId();

const V15_NOTIFICATION_TYPES = [
  NOTIFICATION_TYPE.JOB_INVITATION_RECEIVED,
  NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED,
  NOTIFICATION_TYPE.JOB_INVITATION_REJECTED,
  NOTIFICATION_TYPE.JOB_INVITATION_REVOKED,
  NOTIFICATION_TYPE.JOB_INVITATION_INVALIDATED,
  NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED,
];

const eventInput = (overrides = {}) => ({
  eventKey: `event:${objectId()}`,
  type: NOTIFICATION_TYPE.JOB_INVITATION_RECEIVED,
  jobInvitationId: objectId(),
  applicationId: null,
  recipients: [
    {
      recipientUserId: objectId(),
      content: "You received a Job Invitation.",
    },
  ],
  ...overrides,
});

describe("V15 Slice 01 — Invitation Notification foundation", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("extends the canonical V13 vocabulary without JOB_INVITATION_EXPIRED", () => {
    for (const type of V15_NOTIFICATION_TYPES) {
      expect(Object.values(NOTIFICATION_TYPE)).toContain(type);
    }
    expect(Object.values(NOTIFICATION_TYPE)).not.toContain(
      "JOB_INVITATION_EXPIRED",
    );
    expect(PURE_JOB_INVITATION_NOTIFICATION_TYPES.size).toBe(5);
    expect(JOB_INVITATION_NOTIFICATION_TYPES.size).toBe(6);
  });

  it("enforces the Invitation vs Application reference matrix", async () => {
    for (const type of PURE_JOB_INVITATION_NOTIFICATION_TYPES) {
      await expect(
        new NotificationEvent(
          eventInput({
            type,
            jobInvitationId: null,
            applicationId: objectId(),
          }),
        ).validate(),
      ).rejects.toThrow("Job Invitation Notification types must have jobInvitationId");

      await expect(
        new NotificationEvent(
          eventInput({
            type,
            jobInvitationId: objectId(),
            applicationId: objectId(),
          }),
        ).validate(),
      ).rejects.toThrow(
        "pure Job Invitation Notification types must not have applicationId",
      );
    }

    await expect(
      new NotificationEvent(
        eventInput({
          type: NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED,
          jobInvitationId: objectId(),
          applicationId: null,
        }),
      ).validate(),
    ).rejects.toThrow("INVITED_APPLICATION_CREATED must have applicationId");

    await new NotificationEvent(
      eventInput({
        type: NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED,
        jobInvitationId: objectId(),
        applicationId: objectId(),
      }),
    ).validate();

    await expect(
      new NotificationEvent(
        eventInput({
          type: NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED,
          jobInvitationId: objectId(),
          applicationId: objectId(),
        }),
      ).validate(),
    ).rejects.toThrow(
      "jobInvitationId is only allowed for Job Invitation Notification types",
    );

    await expect(
      new NotificationEvent(
        eventInput({
          type: NOTIFICATION_TYPE.APPLICATION_UNASSIGNED,
          jobInvitationId: null,
          applicationId: null,
        }),
      ).validate(),
    ).rejects.toThrow(
      "Application-scoped Notification types must have applicationId",
    );
  });

  it("materializes Invitation events with jobInvitationId and keeps eventKey dedupe", async () => {
    const jobInvitationId = objectId();
    const input = eventInput({
      eventKey: "invitation:received:stable",
      jobInvitationId,
    });
    const first = await createNotificationEvent(input);
    const second = await createNotificationEvent({
      ...input,
      recipients: [
        {
          recipientUserId: objectId(),
          content: "Retry must not replace the snapshot.",
        },
      ],
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.event._id.toString()).toBe(first.event._id.toString());
    expect(first.event.applicationId).toBeNull();
    expect(first.event.jobInvitationId.toString()).toBe(
      jobInvitationId.toString(),
    );

    await materializeNotificationEvent({ eventId: first.event._id });
    await materializeNotificationEvent({ eventId: first.event._id });

    const notifications = await Notification.find({ eventId: first.event._id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].jobInvitationId.toString()).toBe(
      jobInvitationId.toString(),
    );
    expect(notifications[0].applicationId).toBeNull();
    expect(notifications[0].type).toBe(NOTIFICATION_TYPE.JOB_INVITATION_RECEIVED);
  });

  it("materializes INVITED_APPLICATION_CREATED with both references", async () => {
    const jobInvitationId = objectId();
    const applicationId = objectId();
    const { event } = await createNotificationEvent(
      eventInput({
        type: NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED,
        jobInvitationId,
        applicationId,
        recipients: [
          {
            recipientUserId: objectId(),
            content: "An invited Application was created.",
          },
        ],
      }),
    );

    await materializeNotificationEvent({ eventId: event._id });
    const notification = await Notification.findOne({ eventId: event._id });

    expect(notification.jobInvitationId.toString()).toBe(
      jobInvitationId.toString(),
    );
    expect(notification.applicationId.toString()).toBe(applicationId.toString());
  });
});
