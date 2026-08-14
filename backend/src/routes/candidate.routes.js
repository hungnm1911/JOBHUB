import express from "express";

import {
  directApplyToJobHandler,
  downloadCandidateApplicationSubmittedCvHandler,
  editCandidateAvailabilityHandler,
  getCandidateApplicationConversationHandler,
  getCandidateMyApplicationHandler,
  listCandidateMyApplicationsHandler,
  previewCandidateApplicationSubmittedCvHandler,
  replaceSubmittedCvHandler,
  sendCandidateApplicationConversationNormalMessageHandler,
  submitCandidateAvailabilityFirstTimeHandler,
  withdrawApplicationHandler,
} from "../controllers/application.controller.js";
import {
  activateOwnGeneratedCandidateCvHandler,
  archiveOwnCandidateCvHandler,
  createGeneratedDraftCandidateCvHandler,
  createUploadedCandidateCvHandler,
  downloadOwnCandidateCvHandler,
  getOwnActiveCandidateCvHandler,
  listOwnActiveCandidateCvsHandler,
  previewOwnCandidateCvHandler,
  replaceOwnUploadedCandidateCvPdfHandler,
  saveOwnGeneratedContentHandler,
  setOwnCandidateCvAsDefaultHandler,
  unsetOwnCandidateCvDefaultHandler,
  updateOwnCandidateCvMetadataHandler,
} from "../controllers/candidate-cv.controller.js";
import {
  getOwnCandidateProfileHandler,
  updateOwnCandidateProfileHandler,
} from "../controllers/candidate-profile.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";
import authorizeCandidate from "../middlewares/authorize-candidate.js";
import uploadCandidateCvPdf from "../middlewares/upload-candidate-cv-pdf.js";
import validateCandidateProfileUpdate from "../middlewares/validate-candidate-profile-update.js";
import validateCreateGeneratedDraftCv from "../middlewares/validate-create-generated-draft-cv.js";
import validateDirectApply from "../middlewares/validate-direct-apply.js";
import validateEditCandidateAvailability from "../middlewares/validate-edit-candidate-availability.js";
import validateCreateUploadedCv from "../middlewares/validate-create-uploaded-cv.js";
import validateReplaceSubmittedCv from "../middlewares/validate-replace-submitted-cv.js";
import validateSendConversationNormalMessage from "../middlewares/validate-send-conversation-normal-message.js";
import validateSubmitCandidateAvailability from "../middlewares/validate-submit-candidate-availability.js";
import validateWithdrawApplication from "../middlewares/validate-withdraw-application.js";
import validateSaveGeneratedDraftContent from "../middlewares/validate-save-generated-draft-content.js";
import validateUpdateCandidateCvMetadata from "../middlewares/validate-update-candidate-cv-metadata.js";

const router = express.Router();

router.get(
  "/profile",
  authenticateAccess,
  authorizeCandidate,
  getOwnCandidateProfileHandler,
);

router.patch(
  "/profile",
  authenticateAccess,
  authorizeCandidate,
  validateCandidateProfileUpdate,
  updateOwnCandidateProfileHandler,
);

router.get(
  "/cvs",
  authenticateAccess,
  authorizeCandidate,
  listOwnActiveCandidateCvsHandler,
);

router.post(
  "/cvs",
  authenticateAccess,
  authorizeCandidate,
  validateCreateGeneratedDraftCv,
  createGeneratedDraftCandidateCvHandler,
);

router.post(
  "/cvs/uploaded",
  authenticateAccess,
  authorizeCandidate,
  uploadCandidateCvPdf,
  validateCreateUploadedCv,
  createUploadedCandidateCvHandler,
);

router.get(
  "/cvs/:cvId",
  authenticateAccess,
  authorizeCandidate,
  getOwnActiveCandidateCvHandler,
);

router.patch(
  "/cvs/:cvId",
  authenticateAccess,
  authorizeCandidate,
  validateUpdateCandidateCvMetadata,
  updateOwnCandidateCvMetadataHandler,
);

router.get(
  "/cvs/:cvId/preview",
  authenticateAccess,
  authorizeCandidate,
  previewOwnCandidateCvHandler,
);

router.get(
  "/cvs/:cvId/download",
  authenticateAccess,
  authorizeCandidate,
  downloadOwnCandidateCvHandler,
);

router.put(
  "/cvs/:cvId/uploaded-file",
  authenticateAccess,
  authorizeCandidate,
  uploadCandidateCvPdf,
  replaceOwnUploadedCandidateCvPdfHandler,
);

router.put(
  "/cvs/:cvId/generated-content",
  authenticateAccess,
  authorizeCandidate,
  validateSaveGeneratedDraftContent,
  saveOwnGeneratedContentHandler,
);

router.post(
  "/cvs/:cvId/activate",
  authenticateAccess,
  authorizeCandidate,
  activateOwnGeneratedCandidateCvHandler,
);

router.put(
  "/cvs/:cvId/default",
  authenticateAccess,
  authorizeCandidate,
  setOwnCandidateCvAsDefaultHandler,
);

router.delete(
  "/cvs/:cvId/default",
  authenticateAccess,
  authorizeCandidate,
  unsetOwnCandidateCvDefaultHandler,
);

router.delete(
  "/cvs/:cvId",
  authenticateAccess,
  authorizeCandidate,
  archiveOwnCandidateCvHandler,
);

router.post(
  "/applications",
  authenticateAccess,
  authorizeCandidate,
  validateDirectApply,
  directApplyToJobHandler,
);

router.get(
  "/applications",
  authenticateAccess,
  authorizeCandidate,
  listCandidateMyApplicationsHandler,
);

router.get(
  "/applications/:applicationId",
  authenticateAccess,
  authorizeCandidate,
  getCandidateMyApplicationHandler,
);


router.post(
  "/applications/:applicationId/availability",
  authenticateAccess,
  authorizeCandidate,
  validateSubmitCandidateAvailability,
  submitCandidateAvailabilityFirstTimeHandler,
);

router.put(
  "/applications/:applicationId/availability",
  authenticateAccess,
  authorizeCandidate,
  validateEditCandidateAvailability,
  editCandidateAvailabilityHandler,
);

router.get(
  "/applications/:applicationId/conversation",
  authenticateAccess,
  authorizeCandidate,
  getCandidateApplicationConversationHandler,
);

router.post(
  "/applications/:applicationId/conversation/messages",
  authenticateAccess,
  authorizeCandidate,
  validateSendConversationNormalMessage,
  sendCandidateApplicationConversationNormalMessageHandler,
);

router.get(
  "/applications/:applicationId/submitted-cv/preview",
  authenticateAccess,
  authorizeCandidate,
  previewCandidateApplicationSubmittedCvHandler,
);

router.get(
  "/applications/:applicationId/submitted-cv/download",
  authenticateAccess,
  authorizeCandidate,
  downloadCandidateApplicationSubmittedCvHandler,
);

router.put(
  "/applications/:applicationId/submitted-cv",
  authenticateAccess,
  authorizeCandidate,
  validateReplaceSubmittedCv,
  replaceSubmittedCvHandler,
);

router.post(
  "/applications/:applicationId/withdraw",
  authenticateAccess,
  authorizeCandidate,
  validateWithdrawApplication,
  withdrawApplicationHandler,
);

export default router;
