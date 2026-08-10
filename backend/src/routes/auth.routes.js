import express from "express";

import {
  activateRecruiterHandler,
  activateRecruiterLinkHandler,
  confirmCompanyApprovalHandler,
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  refreshAccessHandler,
  registerCandidateHandler,
  registerCompanyManagerHandler,
  resetPasswordHandler,
  resetPasswordLinkHandler,
  verifyEmailHandler,
} from "../controllers/auth.controller.js";
import authenticateSessionAccess from "../middlewares/authenticate-session-access.js";
import validateActivateRecruiter from "../middlewares/validate-activate-recruiter.js";
import validateActivateRecruiterLink from "../middlewares/validate-activate-recruiter-link.js";
import validateCandidateRegistration from "../middlewares/validate-candidate-registration.js";
import validateCompanyManagerRegistration from "../middlewares/validate-company-manager-registration.js";
import validateConfirmCompanyApproval from "../middlewares/validate-confirm-company-approval.js";
import validateForgotPassword from "../middlewares/validate-forgot-password.js";
import validateLogin from "../middlewares/validate-login.js";
import validateRefreshAccess from "../middlewares/validate-refresh-access.js";
import validateResetPassword from "../middlewares/validate-reset-password.js";
import validateResetPasswordLink from "../middlewares/validate-reset-password-link.js";
import validateVerifyEmail from "../middlewares/validate-verify-email.js";

const router = express.Router();

router.post(
  "/register/candidate",
  validateCandidateRegistration,
  registerCandidateHandler,
);

router.post(
  "/register/company-manager",
  validateCompanyManagerRegistration,
  registerCompanyManagerHandler,
);

router.get(
  "/verify-email",
  validateVerifyEmail,
  verifyEmailHandler,
);

router.post(
  "/verify-email",
  validateVerifyEmail,
  verifyEmailHandler,
);

router.get(
  "/confirm-company-approval",
  validateConfirmCompanyApproval,
  confirmCompanyApprovalHandler,
);

router.post(
  "/confirm-company-approval",
  validateConfirmCompanyApproval,
  confirmCompanyApprovalHandler,
);

router.post(
  "/login",
  validateLogin,
  loginHandler,
);

router.post(
  "/refresh",
  validateRefreshAccess,
  refreshAccessHandler,
);

router.post(
  "/logout",
  authenticateSessionAccess,
  logoutHandler,
);

router.post(
  "/forgot-password",
  validateForgotPassword,
  forgotPasswordHandler,
);

router.get(
  "/reset-password",
  validateResetPasswordLink,
  resetPasswordLinkHandler,
);

router.post(
  "/reset-password",
  validateResetPassword,
  resetPasswordHandler,
);

router.get(
  "/activate-recruiter",
  validateActivateRecruiterLink,
  activateRecruiterLinkHandler,
);

router.post(
  "/activate-recruiter",
  validateActivateRecruiter,
  activateRecruiterHandler,
);

export default router;
