import REALTIME_EVENT from "../constants/realtime-event.js";
import logger from "../utils/logger.js";
import {
  emitRealtimeEventToUser,
  isRealtimeDistributionAttached,
} from "./realtime-server.socket.js";

const logFanOutFailure = ({ eventName, recipientUserId, error }) => {
  logger.warn("Realtime fan-out failed", {
    eventName,
    recipientUserId,
    error,
  });
};

const toPlainNotification = (notification) => {
  if (notification && typeof notification.toJSON === "function") {
    return notification.toJSON();
  }

  return notification;
};

const toPlainMessage = (message) => {
  if (message == null) {
    return message;
  }

  const source =
    typeof message.toJSON === "function" ? message.toJSON() : message;
  const messageId = source._id ?? source.id;

  return {
    id: messageId == null ? null : String(messageId),
    type: source.type,
    senderUserId:
      source.senderUserId == null ? null : String(source.senderUserId),
    senderCompanyMemberId:
      source.senderCompanyMemberId == null
        ? null
        : String(source.senderCompanyMemberId),
    content: source.content,
    createdAt: source.createdAt,
  };
};

const emitNotificationToRecipient = ({
  recipientUserId,
  notification,
}) => {
  if (
    !isRealtimeDistributionAttached() ||
    recipientUserId == null ||
    notification == null
  ) {
    return;
  }

  const recipientId = String(recipientUserId);
  const notificationRecipientId = notification.recipientUserId == null
    ? null
    : String(notification.recipientUserId);

  if (notificationRecipientId !== recipientId) {
    return;
  }

  try {
    emitRealtimeEventToUser({
      recipientUserId: recipientId,
      eventName: REALTIME_EVENT.NOTIFICATION,
      payload: {
        notification: toPlainNotification(notification),
      },
    });
  } catch (error) {
    // Socket fan-out is best-effort and must not fail the caller.
    logFanOutFailure({
      eventName: REALTIME_EVENT.NOTIFICATION,
      recipientUserId: recipientId,
      error,
    });
  }
};

const emitMessageToRecipients = ({
  recipientUserIds,
  message,
  applicationId,
} = {}) => {
  if (
    !isRealtimeDistributionAttached() ||
    message == null ||
    applicationId == null
  ) {
    return;
  }

  const conversationId =
    message.conversationId == null ? null : String(message.conversationId);
  const payload = {
    message: toPlainMessage(message),
    conversationId,
    applicationId: String(applicationId),
  };
  const uniqueRecipientIds = [
    ...new Set(
      (recipientUserIds ?? [])
        .map((recipientUserId) =>
          recipientUserId == null ? null : String(recipientUserId),
        )
        .filter(Boolean),
    ),
  ];

  for (const recipientId of uniqueRecipientIds) {
    try {
      emitRealtimeEventToUser({
        recipientUserId: recipientId,
        eventName: REALTIME_EVENT.MESSAGE,
        payload,
      });
    } catch (error) {
      // Socket fan-out is best-effort and must not fail the caller.
      logFanOutFailure({
        eventName: REALTIME_EVENT.MESSAGE,
        recipientUserId: recipientId,
        error,
      });
    }
  }
};

const emitConversationStateToRecipients = ({
  recipientUserIds,
  conversationId,
  applicationId,
  mode,
} = {}) => {
  if (
    !isRealtimeDistributionAttached() ||
    conversationId == null ||
    applicationId == null ||
    mode == null
  ) {
    return;
  }

  const payload = {
    conversationId: String(conversationId),
    applicationId: String(applicationId),
    mode,
  };
  const uniqueRecipientIds = [
    ...new Set(
      (recipientUserIds ?? [])
        .map((recipientUserId) =>
          recipientUserId == null ? null : String(recipientUserId),
        )
        .filter(Boolean),
    ),
  ];

  for (const recipientId of uniqueRecipientIds) {
    try {
      emitRealtimeEventToUser({
        recipientUserId: recipientId,
        eventName: REALTIME_EVENT.CONVERSATION_STATE,
        payload,
      });
    } catch (error) {
      // Socket fan-out is best-effort and must not fail the caller.
      logFanOutFailure({
        eventName: REALTIME_EVENT.CONVERSATION_STATE,
        recipientUserId: recipientId,
        error,
      });
    }
  }
};

export {
  emitConversationStateToRecipients,
  emitMessageToRecipients,
  emitNotificationToRecipient,
};
