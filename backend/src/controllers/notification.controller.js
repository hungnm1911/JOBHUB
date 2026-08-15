import {
  countUnreadNotificationsForRecipient,
  findNotificationForRecipient,
  listNotificationsForRecipient,
  openNotificationForRecipient,
} from "../services/notification.service.js";

const listOwnNotificationsHandler = async (request, response, next) => {
  try {
    const notifications = await listNotificationsForRecipient({
      recipientUserId: request.auth.user._id,
    });
    const unreadCount = await countUnreadNotificationsForRecipient({
      recipientUserId: request.auth.user._id,
    });

    return response.status(200).json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    return next(error);
  }
};

const getOwnNotificationHandler = async (request, response, next) => {
  try {
    const notification = await findNotificationForRecipient({
      notificationId: request.params.notificationId,
      recipientUserId: request.auth.user._id,
    });

    return response.status(200).json({ notification });
  } catch (error) {
    return next(error);
  }
};

const openOwnNotificationHandler = async (request, response, next) => {
  try {
    const notification = await openNotificationForRecipient({
      notificationId: request.params.notificationId,
      recipientUserId: request.auth.user._id,
    });

    return response.status(200).json({ notification });
  } catch (error) {
    return next(error);
  }
};

const getOwnUnreadNotificationCountHandler = async (
  request,
  response,
  next,
) => {
  try {
    const unreadCount = await countUnreadNotificationsForRecipient({
      recipientUserId: request.auth.user._id,
    });

    return response.status(200).json({ unreadCount });
  } catch (error) {
    return next(error);
  }
};

export {
  getOwnNotificationHandler,
  getOwnUnreadNotificationCountHandler,
  listOwnNotificationsHandler,
  openOwnNotificationHandler,
};
