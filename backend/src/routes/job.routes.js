import express from "express";

import {
  approveAndPublishJobHandler,
  closePublishedJobHandler,
  createDraftJobHandler,
  deletePrePublicationJobHandler,
  getInternalJobHandler,
  listInternalJobsHandler,
  reassignPrimaryRecruiterHandler,
  rejectPendingJobHandler,
  submitDraftJobHandler,
  updateDraftJobHandler,
} from "../controllers/job.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";
import authorizeCompanyManagerBusinessAccess from "../middlewares/authorize-company-manager-business-access.js";
import authorizeCompanyStaffBusinessAccess from "../middlewares/authorize-company-staff-business-access.js";
import authorizeRecruiterBusinessAccess from "../middlewares/authorize-recruiter-business-access.js";
import validateCreateDraftJob from "../middlewares/validate-create-draft-job.js";
import validateReassignPrimaryRecruiter from "../middlewares/validate-reassign-primary-recruiter.js";
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

router.post(
  "/:jobId/approve",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  approveAndPublishJobHandler,
);

router.post(
  "/:jobId/reject",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  rejectPendingJobHandler,
);

router.post(
  "/:jobId/reassign-primary",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  validateReassignPrimaryRecruiter,
  reassignPrimaryRecruiterHandler,
);

router.post(
  "/:jobId/close",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  closePublishedJobHandler,
);

router.delete(
  "/:jobId",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  deletePrePublicationJobHandler,
);

router.patch(
  "/:jobId",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  validateUpdateDraftJob,
  updateDraftJobHandler,
);

export default router;
