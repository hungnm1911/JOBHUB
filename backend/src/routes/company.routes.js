import express from "express";

import {
  getOwnedCompanyHandler,
  resendApprovalConfirmationHandler,
  submitOwnedCompanyHandler,
  updateOwnedCompanyHandler,
} from "../controllers/company.controller.js";
import authenticateCompanySelfServiceAccess from "../middlewares/authenticate-company-self-service-access.js";
import authenticateOnboardingAccess from "../middlewares/authenticate-onboarding-access.js";
import validateCompanyActiveUpdate from "../middlewares/validate-company-active-update.js";
import validateCompanyDraftUpdate from "../middlewares/validate-company-draft-update.js";

const router = express.Router();

const validateCompanySelfServiceUpdate = (request, response, next) => {
  if (request.companySelfServiceMode === "active") {
    return validateCompanyActiveUpdate(request, response, next);
  }

  return validateCompanyDraftUpdate(request, response, next);
};

router.get(
  "/",
  authenticateCompanySelfServiceAccess,
  getOwnedCompanyHandler,
);

router.patch(
  "/",
  authenticateCompanySelfServiceAccess,
  validateCompanySelfServiceUpdate,
  updateOwnedCompanyHandler,
);

router.post(
  "/submit",
  authenticateOnboardingAccess,
  submitOwnedCompanyHandler,
);

router.post(
  "/resend-approval-confirmation",
  authenticateOnboardingAccess,
  resendApprovalConfirmationHandler,
);

export default router;
