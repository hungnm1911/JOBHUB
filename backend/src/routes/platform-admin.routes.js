import express from "express";

import {
  createFieldCategoryHandler,
  createPositionCategoryHandler,
} from "../controllers/category.controller.js";
import {
  listAccountsHandler, getAccountHandler, listCompaniesHandler, getCompanyHandler,
  getCompanyRegistrationSummaryHandler,
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
import validateCreateFieldCategory from "../middlewares/validate-create-field-category.js";
import validateCreatePositionCategory from "../middlewares/validate-create-position-category.js";

import { listCompanyRecruitersHandler } from "../controllers/recruiter.controller.js";

import { listAnnouncementsHandler, getAnnouncementHandler, publishAnnouncementHandler } from "../controllers/announcement.controller.js";
import { validateCommunicationBody } from "../middlewares/validate-admin-communication.js";

const router = express.Router();
router.get("/announcements", authenticateAccess, authorizePlatformAdmin, listAnnouncementsHandler);
router.get("/announcements/:announcementId", authenticateAccess, authorizePlatformAdmin, getAnnouncementHandler);
router.post("/announcements", authenticateAccess, authorizePlatformAdmin, validateCommunicationBody(["title", "content", "clientRequestId"]), publishAnnouncementHandler);

router.post(
  "/categories/fields",
  authenticateAccess,
  authorizePlatformAdmin,
  validateCreateFieldCategory,
  createFieldCategoryHandler,
);

router.post(
  "/categories/fields/:fieldId/positions",
  authenticateAccess,
  authorizePlatformAdmin,
  validateCreatePositionCategory,
  createPositionCategoryHandler,
);

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
  "/company-registrations/summary",
  authenticateAccess,
  authorizePlatformAdmin,
  getCompanyRegistrationSummaryHandler,
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

router.get("/accounts", authenticateAccess, authorizePlatformAdmin, listAccountsHandler);
router.get("/accounts/:userId", authenticateAccess, authorizePlatformAdmin, getAccountHandler);
router.get("/companies", authenticateAccess, authorizePlatformAdmin, listCompaniesHandler);
router.get("/companies/:companyId", authenticateAccess, authorizePlatformAdmin, getCompanyHandler);

router.get("/companies/:companyId/recruiters", authenticateAccess, authorizePlatformAdmin, listCompanyRecruitersHandler);

export default router;
