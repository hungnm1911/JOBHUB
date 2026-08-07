import express from "express";

import {
  approveCompanyRegistrationHandler,
  getCompanyRegistrationHandler,
  listCompanyRegistrationsHandler,
  lockAccountHandler,
  lockCompanyHandler,
  rejectCompanyRegistrationHandler,
  terminateAccountHandler,
} from "../controllers/platform-admin.controller.js";
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

router.get(
  "/company-registrations",
  authenticateAccess,
  authorizePlatformAdmin,
  listCompanyRegistrationsHandler,
);

router.post(
  "/company-registrations/:companyId/approve",
  authenticateAccess,
  authorizePlatformAdmin,
  approveCompanyRegistrationHandler,
);

router.post(
  "/company-registrations/:companyId/reject",
  authenticateAccess,
  authorizePlatformAdmin,
  rejectCompanyRegistrationHandler,
);

router.get(
  "/company-registrations/:companyId",
  authenticateAccess,
  authorizePlatformAdmin,
  getCompanyRegistrationHandler,
);

router.post(
  "/companies/:companyId/lock",
  authenticateAccess,
  authorizePlatformAdmin,
  lockCompanyHandler,
);

export default router;
