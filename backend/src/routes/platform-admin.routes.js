import express from "express";

import {
  createFieldCategoryHandler,
  createPositionCategoryHandler,
} from "../controllers/category.controller.js";
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
import validateCreateFieldCategory from "../middlewares/validate-create-field-category.js";
import validateCreatePositionCategory from "../middlewares/validate-create-position-category.js";

const router = express.Router();

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
