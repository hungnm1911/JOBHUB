import express from "express";

import {
  getCompanyManagerRecruiterManagementProbe,
  getRecruiterCandidateSearchAccessProbe,
  getCompanyStaffBusinessAccessProbe,
} from "../controllers/company-staff-access-probe.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";
import authorizeCompanyManagerBusinessAccess from "../middlewares/authorize-company-manager-business-access.js";
import authorizeCompanyStaffBusinessAccess from "../middlewares/authorize-company-staff-business-access.js";
import {
  authorizeRecruiterCandidateSearchAccess,
} from "../middlewares/authorize-recruiter-business-access.js";

const router = express.Router();

router.get(
  "/business",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  getCompanyStaffBusinessAccessProbe,
);

router.get(
  "/recruiter-management",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  getCompanyManagerRecruiterManagementProbe,
);

router.get(
  "/candidate-search",
  authenticateAccess,
  authorizeRecruiterCandidateSearchAccess,
  getRecruiterCandidateSearchAccessProbe,
);

export default router;
