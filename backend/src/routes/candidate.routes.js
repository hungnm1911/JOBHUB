import express from "express";

import {
  getOwnCandidateProfileHandler,
  updateOwnCandidateProfileHandler,
} from "../controllers/candidate-profile.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";
import authorizeCandidate from "../middlewares/authorize-candidate.js";
import validateCandidateProfileUpdate from "../middlewares/validate-candidate-profile-update.js";

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

export default router;
