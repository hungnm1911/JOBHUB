import express from "express";

import {
  activateOwnGeneratedCandidateCvHandler,
  createGeneratedDraftCandidateCvHandler,
  getOwnActiveCandidateCvHandler,
  listOwnActiveCandidateCvsHandler,
  saveOwnGeneratedContentHandler,
} from "../controllers/candidate-cv.controller.js";
import {
  getOwnCandidateProfileHandler,
  updateOwnCandidateProfileHandler,
} from "../controllers/candidate-profile.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";
import authorizeCandidate from "../middlewares/authorize-candidate.js";
import validateCandidateProfileUpdate from "../middlewares/validate-candidate-profile-update.js";
import validateCreateGeneratedDraftCv from "../middlewares/validate-create-generated-draft-cv.js";
import validateSaveGeneratedDraftContent from "../middlewares/validate-save-generated-draft-content.js";

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

router.get(
  "/cvs/:cvId",
  authenticateAccess,
  authorizeCandidate,
  getOwnActiveCandidateCvHandler,
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

export default router;
