import express from "express";

import {
  getPublicCompanyHandler,
  getPublicJobHandler,
  getPublicJobsHandler,
} from "../controllers/job-discovery.controller.js";
import authenticateOptionalAccess from "../middlewares/authenticate-optional-access.js";

const router = express.Router();

router.use(authenticateOptionalAccess);

router.get("/jobs", getPublicJobsHandler);
router.get("/jobs/:jobId", getPublicJobHandler);
router.get("/companies/:companyId", getPublicCompanyHandler);

export default router;
