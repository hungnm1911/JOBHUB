import express from "express";

import {
  getOwnNotificationHandler,
  getOwnUnreadNotificationCountHandler,
  listOwnNotificationsHandler,
  openOwnNotificationHandler,
} from "../controllers/notification.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";

const router = express.Router();

router.get("/", authenticateAccess, listOwnNotificationsHandler);
router.get(
  "/unread-count",
  authenticateAccess,
  getOwnUnreadNotificationCountHandler,
);
router.get("/:notificationId", authenticateAccess, getOwnNotificationHandler);
router.post(
  "/:notificationId/open",
  authenticateAccess,
  openOwnNotificationHandler,
);

export default router;
