import express from "express";

import {
  createRecruiterHandler,
  getRecruiterDetailHandler,
  listRecruitersHandler,
} from "../controllers/recruiter.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";
import authorizeCompanyManagerBusinessAccess from "../middlewares/authorize-company-manager-business-access.js";
import validateCreateRecruiter from "../middlewares/validate-create-recruiter.js";

const router = express.Router();

router.get(
  "/",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  listRecruitersHandler,
);

router.get(
  "/:recruiterId",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  getRecruiterDetailHandler,
);

router.post(
  "/",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  validateCreateRecruiter,
  createRecruiterHandler,
);

export default router;
