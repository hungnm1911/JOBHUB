import express from "express";

import {
  createRecruiterHandler,
  getRecruiterDetailHandler,
  initiateRecruiterPasswordResetHandler,
  listRecruitersHandler,
  lockRecruiterHandler,
  unlockRecruiterHandler,
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

router.post(
  "/:recruiterId/password-reset",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  initiateRecruiterPasswordResetHandler,
);

router.post(
  "/:recruiterId/lock",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  lockRecruiterHandler,
);

router.post(
  "/:recruiterId/unlock",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  unlockRecruiterHandler,
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
