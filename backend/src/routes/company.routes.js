import express from "express";

import {
  getOwnedCompanyHandler,
  resendApprovalConfirmationHandler,
  submitOwnedCompanyHandler,
  updateOwnedCompanyHandler,
  uploadOwnedCompanyImageHandler,
} from "../controllers/company.controller.js";
import FILE_TYPE from "../constants/file-type.js";
import authenticateCompanySelfServiceAccess from "../middlewares/authenticate-company-self-service-access.js";
import authenticateOnboardingAccess from "../middlewares/authenticate-onboarding-access.js";
import fileUpload from "../middlewares/file-upload.js";
import validateCompanyActiveUpdate from "../middlewares/validate-company-active-update.js";
import validateCompanyDraftUpdate from "../middlewares/validate-company-draft-update.js";
import validateFileType from "../middlewares/validate-file-type.js";

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
  "/images/:kind",
  authenticateCompanySelfServiceAccess,
  fileUpload.single("file"),
  validateFileType(FILE_TYPE.IMAGE),
  uploadOwnedCompanyImageHandler,
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
