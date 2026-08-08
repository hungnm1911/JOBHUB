import express from "express";

import { createRecruiterHandler } from "../controllers/recruiter.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";
import authorizeCompanyManagerBusinessAccess from "../middlewares/authorize-company-manager-business-access.js";
import validateCreateRecruiter from "../middlewares/validate-create-recruiter.js";

const router = express.Router();

router.post(
  "/",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  validateCreateRecruiter,
  createRecruiterHandler,
);

export default router;
