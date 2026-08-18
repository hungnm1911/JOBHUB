import NotificationEvent from "../models/notification-event.model.js";
import Notification from "../models/notification.model.js";
import AppError from "../utils/app-error.js";
import { emitNotificationToRecipient } from "./realtime-distribution.service.js";

const DEFAULT_RECOVERY_BATCH_SIZE = 100;

const isDuplicateKeyError = (error) => error?.code === 11000;

const emitMaterializedNotification = (notification) => {
  try {
    emitNotificationToRecipient({
      recipientUserId: notification.recipientUserId,
      notification,
    });
  } catch {
    // Realtime fan-out is best-effort and must not fail materialization.
  }
};

const findNotificationForRecipient = async ({
  notificationId,
  recipientUserId,
}) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    recipientUserId,
  });

  if (!notification) {
    throw new AppError(404, "Notification not found");
  }

  return notification;
};

const listNotificationsForRecipient = async ({ recipientUserId }) => {
  return Notification.find({ recipientUserId }).sort({ createdAt: -1, _id: -1 });
};

const countUnreadNotificationsForRecipient = async ({ recipientUserId }) => {
  return Notification.countDocuments({
    recipientUserId,
    readAt: null,
  });
};

const openNotificationForRecipient = async ({
  notificationId,
  recipientUserId,
  now = new Date(),
}) => {
  const newlyReadNotification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipientUserId,
      readAt: null,
    },
    {
      $set: { readAt: now },
    },
    {
      returnDocument: "after",
    },
  );

  if (newlyReadNotification) {
    return newlyReadNotification;
  }

  return findNotificationForRecipient({ notificationId, recipientUserId });
};

const createNotificationEvent = async ({
  eventKey,
  type,
  actorUserId = null,
  applicationId,
  messageId = null,
  interviewScheduleId = null,
  recipients,
  session = null,
}) => {
  const eventAttributes = {
    eventKey,
    type,
    actorUserId,
    applicationId,
    messageId,
    interviewScheduleId,
    recipients,
  };

  try {
    const [event] = await NotificationEvent.create([eventAttributes], {
      session,
    });

    return { event, created: true };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const event = await NotificationEvent.findOne({ eventKey }).session(session);

    if (!event) {
      throw error;
    }

    return { event, created: false };
  }
};

const materializeNotificationEvent = async ({
  eventId,
  session = null,
  now = new Date(),
}) => {
  const event = await NotificationEvent.findById(eventId).session(session);

  if (!event) {
    return null;
  }

  for (const recipient of event.recipients) {
    try {
      const writeResult = await Notification.updateOne(
        {
          eventId: event._id,
          recipientUserId: recipient.recipientUserId,
        },
        {
          $setOnInsert: {
            eventId: event._id,
            recipientUserId: recipient.recipientUserId,
            actorUserId: event.actorUserId,
            type: event.type,
            content: recipient.content,
            applicationId: event.applicationId,
            messageId: event.messageId,
            interviewScheduleId: event.interviewScheduleId,
            readAt: null,
          },
        },
        {
          upsert: true,
          session,
          setDefaultsOnInsert: true,
        },
      );

      if (!session && writeResult.upsertedCount === 1) {
        const durableNotification = await Notification.findOne({
          eventId: event._id,
          recipientUserId: recipient.recipientUserId,
        });

        if (durableNotification) {
          emitMaterializedNotification(durableNotification);
        }
      }
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  const recipientUserIds = event.recipients.map(
    ({ recipientUserId }) => recipientUserId,
  );
  const durableNotificationCount = await Notification.countDocuments({
    eventId: event._id,
    recipientUserId: { $in: recipientUserIds },
  }).session(session);

  if (durableNotificationCount !== recipientUserIds.length) {
    return event;
  }

  await NotificationEvent.updateOne(
    {
      _id: event._id,
      materializedAt: null,
    },
    {
      $set: { materializedAt: now },
    },
    { session },
  );

  return NotificationEvent.findById(event._id).session(session);
};

const recoverPendingNotificationEvents = async ({
  limit = DEFAULT_RECOVERY_BATCH_SIZE,
  now = new Date(),
} = {}) => {
  const pendingEvents = await NotificationEvent.find({ materializedAt: null })
    .sort({ createdAt: 1, _id: 1 })
    .limit(limit);
  const recoveredEventIds = [];
  const failedEventIds = [];

  for (const event of pendingEvents) {
    try {
      await materializeNotificationEvent({
        eventId: event._id,
        now,
      });
      recoveredEventIds.push(event._id);
    } catch {
      failedEventIds.push(event._id);
    }
  }

  return {
    recoveredEventIds,
    failedEventIds,
  };
};

export {
  DEFAULT_RECOVERY_BATCH_SIZE,
  countUnreadNotificationsForRecipient,
  createNotificationEvent,
  findNotificationForRecipient,
  listNotificationsForRecipient,
  materializeNotificationEvent,
  openNotificationForRecipient,
  recoverPendingNotificationEvents,
};
