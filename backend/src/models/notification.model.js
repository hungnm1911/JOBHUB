import mongoose from "mongoose";

import NOTIFICATION_TYPE from "../constants/notification-type.js";
import { SCHEDULE_NOTIFICATION_TYPES } from "./notification-event.model.js";

const { Schema, model } = mongoose;

const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPE);

const isNonEmptyTrimmedString = (value) => {
  return typeof value === "string" && value.trim() !== "";
};

const assertNotificationReferenceInvariant = (notification) => {
  const isChatNotification =
    notification.type === NOTIFICATION_TYPE.CHAT_MESSAGE_CREATED;
  const isScheduleNotification = SCHEDULE_NOTIFICATION_TYPES.has(
    notification.type,
  );

  if (isChatNotification && notification.messageId == null) {
    return "CHAT_MESSAGE_CREATED must have messageId";
  }

  if (!isChatNotification && notification.messageId != null) {
    return "messageId is only allowed for CHAT_MESSAGE_CREATED";
  }

  if (isScheduleNotification && notification.interviewScheduleId == null) {
    return "Schedule Notification types must have interviewScheduleId";
  }

  if (!isScheduleNotification && notification.interviewScheduleId != null) {
    return "interviewScheduleId is only allowed for Schedule Notification types";
  }

  return null;
};

const notificationSchema = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "NotificationEvent",
      required: true,
      immutable: true,
    },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      immutable: true,
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
    content: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
      validate: {
        validator: isNonEmptyTrimmedString,
        message: "content must be a non-empty string",
      },
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
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "notifications",
  },
);

notificationSchema.pre("validate", function enforceNotificationInvariants() {
  const referenceError = assertNotificationReferenceInvariant(this);

  if (referenceError) {
    this.invalidate("type", referenceError);
  }
});

notificationSchema.index({ recipientUserId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ recipientUserId: 1, readAt: 1 });
notificationSchema.index({ eventId: 1, recipientUserId: 1 }, { unique: true });

const Notification = model("Notification", notificationSchema);

const ensureNotificationCollection = async (connection = mongoose.connection) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ensuring Notification collection",
    );
  }

  await Notification.init();
};

export {
  assertNotificationReferenceInvariant,
  ensureNotificationCollection,
  notificationSchema,
};
export default Notification;
