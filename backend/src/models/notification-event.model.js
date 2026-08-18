import mongoose from "mongoose";

import NOTIFICATION_TYPE from "../constants/notification-type.js";

const { Schema, model } = mongoose;

const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPE);
const SCHEDULE_NOTIFICATION_TYPES = new Set([
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CREATED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CHANGED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CONFIRMED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_DECLINED,
]);

const isNonEmptyTrimmedString = (value) => {
  return typeof value === "string" && value.trim() !== "";
};

const assertNotificationReferenceInvariant = (event) => {
  const isChatEvent = event.type === NOTIFICATION_TYPE.CHAT_MESSAGE_CREATED;
  const isScheduleEvent = SCHEDULE_NOTIFICATION_TYPES.has(event.type);

  if (isChatEvent && event.messageId == null) {
    return "CHAT_MESSAGE_CREATED must have messageId";
  }

  if (!isChatEvent && event.messageId != null) {
    return "messageId is only allowed for CHAT_MESSAGE_CREATED";
  }

  if (isScheduleEvent && event.interviewScheduleId == null) {
    return "Schedule Notification types must have interviewScheduleId";
  }

  if (!isScheduleEvent && event.interviewScheduleId != null) {
    return "interviewScheduleId is only allowed for Schedule Notification types";
  }

  return null;
};

const notificationRecipientSnapshotSchema = new Schema(
  {
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
      validate: {
        validator: isNonEmptyTrimmedString,
        message: "recipient content must be a non-empty string",
      },
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

const notificationEventSchema = new Schema(
  {
    eventKey: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
      validate: {
        validator: isNonEmptyTrimmedString,
        message: "eventKey must be a non-empty string",
      },
    },
    type: {
      type: String,
      required: true,
      immutable: true,
      enum: {
        values: NOTIFICATION_TYPE_VALUES,
        message: "type must use canonical Notification values",
      },
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      immutable: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      immutable: true,
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
      immutable: true,
    },
    interviewScheduleId: {
      type: Schema.Types.ObjectId,
      ref: "InterviewSchedule",
      default: null,
      immutable: true,
    },
    recipients: {
      type: [notificationRecipientSnapshotSchema],
      required: true,
      immutable: true,
      validate: {
        validator: (recipients) => Array.isArray(recipients) && recipients.length > 0,
        message: "recipients must contain at least one recipient snapshot",
      },
    },
    materializedAt: {
      type: Date,
      default: null,
      immutable: function isMaterializedAtImmutable() {
        return this.materializedAt != null;
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "notification_events",
  },
);

notificationEventSchema.pre(
  "validate",
  function enforceNotificationEventInvariants() {
    const referenceError = assertNotificationReferenceInvariant(this);

    if (referenceError) {
      this.invalidate("type", referenceError);
    }

    const recipientIds = new Set();

    for (const recipient of this.recipients ?? []) {
      const recipientId = recipient.recipientUserId?.toString();

      if (recipientId && recipientIds.has(recipientId)) {
        this.invalidate(
          "recipients",
          "recipients must not contain duplicate recipientUserId values",
        );
        return;
      }

      recipientIds.add(recipientId);
    }
  },
);

notificationEventSchema.index({ eventKey: 1 }, { unique: true });
notificationEventSchema.index({ materializedAt: 1, createdAt: 1 });

const NotificationEvent = model("NotificationEvent", notificationEventSchema);

const ensureNotificationEventCollection = async (
  connection = mongoose.connection,
) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ensuring NotificationEvent collection",
    );
  }

  await NotificationEvent.init();
};

export {
  SCHEDULE_NOTIFICATION_TYPES,
  assertNotificationReferenceInvariant,
  ensureNotificationEventCollection,
  notificationEventSchema,
  notificationRecipientSnapshotSchema,
};
export default NotificationEvent;
