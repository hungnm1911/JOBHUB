import express from "express";

import { createDraftJobHandler } from "../controllers/job.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";
import authorizeRecruiterBusinessAccess from "../middlewares/authorize-recruiter-business-access.js";
import validateCreateDraftJob from "../middlewares/validate-create-draft-job.js";

const router = express.Router();

router.post(
  "/",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  validateCreateDraftJob,
  createDraftJobHandler,
);

export default router;
