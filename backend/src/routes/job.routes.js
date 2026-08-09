import express from "express";

import {
  createDraftJobHandler,
  getInternalJobHandler,
  listInternalJobsHandler,
  submitDraftJobHandler,
  updateDraftJobHandler,
} from "../controllers/job.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";
import authorizeCompanyStaffBusinessAccess from "../middlewares/authorize-company-staff-business-access.js";
import authorizeRecruiterBusinessAccess from "../middlewares/authorize-recruiter-business-access.js";
import validateCreateDraftJob from "../middlewares/validate-create-draft-job.js";
import validateUpdateDraftJob from "../middlewares/validate-update-draft-job.js";

const router = express.Router();

router.get(
  "/",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  listInternalJobsHandler,
);

router.get(
  "/:jobId",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  getInternalJobHandler,
);

router.post(
  "/",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  validateCreateDraftJob,
  createDraftJobHandler,
);

router.post(
  "/:jobId/submit",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  submitDraftJobHandler,
);

router.patch(
  "/:jobId",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  validateUpdateDraftJob,
  updateDraftJobHandler,
);

export default router;
