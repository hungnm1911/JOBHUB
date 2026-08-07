import express from "express";

import { lockAccountHandler, terminateAccountHandler } from "../controllers/platform-admin.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";
import authorizePlatformAdmin from "../middlewares/authorize-platform-admin.js";

const router = express.Router();

router.post(
  "/accounts/:userId/lock",
  authenticateAccess,
  authorizePlatformAdmin,
  lockAccountHandler,
);

router.post(
  "/accounts/:userId/terminate",
  authenticateAccess,
  authorizePlatformAdmin,
  terminateAccountHandler,
);

export default router;
