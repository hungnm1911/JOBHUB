import express from "express";

import {
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  refreshAccessHandler,
  registerCandidateHandler,
  resetPasswordHandler,
  verifyEmailHandler,
} from "../controllers/auth.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";
import validateCandidateRegistration from "../middlewares/validate-candidate-registration.js";
import validateForgotPassword from "../middlewares/validate-forgot-password.js";
import validateLogin from "../middlewares/validate-login.js";
import validateRefreshAccess from "../middlewares/validate-refresh-access.js";
import validateResetPassword from "../middlewares/validate-reset-password.js";
import validateVerifyEmail from "../middlewares/validate-verify-email.js";

const router = express.Router();

router.post(
  "/register/candidate",
  validateCandidateRegistration,
  registerCandidateHandler,
);

router.post(
  "/verify-email",
  validateVerifyEmail,
  verifyEmailHandler,
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
  authenticateAccess,
  logoutHandler,
);

router.post(
  "/forgot-password",
  validateForgotPassword,
  forgotPasswordHandler,
);

router.post(
  "/reset-password",
  validateResetPassword,
  resetPasswordHandler,
);

export default router;
