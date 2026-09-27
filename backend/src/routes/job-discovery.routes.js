import express from "express";

import {
  listDiscoverableJobsHandler,
  getDiscoverableJobDetailHandler,
  getPublicCompanyInfoHandler,
} from "../controllers/job-discovery.controller.js";
import authenticateOptionalAccess from "../middlewares/authenticate-optional-access.js";
import rejectAuthenticatedCompanyManagerJobDiscovery from "../middlewares/reject-authenticated-company-manager-job-discovery.js";

const router = express.Router();

const jobDiscoveryAccess = [
  authenticateOptionalAccess,
  rejectAuthenticatedCompanyManagerJobDiscovery,
];

router.get("/", ...jobDiscoveryAccess, listDiscoverableJobsHandler);

router.get(
  "/companies/:companyId",
  ...jobDiscoveryAccess,
  getPublicCompanyInfoHandler,
);

router.get("/:jobId", ...jobDiscoveryAccess, getDiscoverableJobDetailHandler);

export default router;
