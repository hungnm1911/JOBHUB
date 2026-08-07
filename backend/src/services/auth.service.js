import mongoose from "mongoose";

import AUTH_TOKEN_TYPE from "../constants/auth-token-type.js";
import COMPANY_APPROVAL_STATUS from "../constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../constants/company-operational-status.js";
import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import config from "../config/index.js";
import AuthSession from "../models/auth-session.model.js";
import AuthToken from "../models/auth-token.model.js";
import Company from "../models/company.model.js";
import User from "../models/user.model.js";
import { toPublicCompany } from "./company.service.js";
import sendMail from "./mail.service.js";
import AppError from "../utils/app-error.js";
import { generateAuthToken, hashAuthToken } from "../utils/hash-auth-token.js";
import { hashPassword, verifyPassword } from "../utils/hash-password.js";
import { generateAccessToken } from "../utils/jwt.js";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 64;

const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "If an account exists for that email, password reset instructions have been sent.";

const normalizeEmail = (email) => {
  return email.trim().toLowerCase();
};

const assertPasswordPolicy = (password) => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new AppError(
      400,
      "Password must be at least 8 characters",
      { field: "password" },
    );
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new AppError(
      400,
      "Password must not exceed 64 characters",
      { field: "password" },
    );
  }
};

const buildVerificationEmail = ({ fullName, rawToken }) => {
  const verificationUrl =
    `${config.appBaseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;

  const subject = "Verify your JOBHUB email address";
  const text =
    `Hello ${fullName},\n\n` +
    "Please verify your email address by opening the link below:\n\n" +
    `${verificationUrl}\n\n` +
    "This link expires and can only be used once.\n";

  const html =
    `<p>Hello ${fullName},</p>` +
    "<p>Please verify your email address by opening the link below:</p>" +
    `<p><a href="${verificationUrl}">Verify email</a></p>` +
    "<p>This link expires and can only be used once.</p>";

  return { subject, text, html };
};

const buildPasswordResetEmail = ({ fullName, rawToken }) => {
  const resetUrl =
    `${config.appBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

  const subject = "Reset your JOBHUB password";
  const text =
    `Hello ${fullName},\n\n` +
    "You requested to reset your password. Open the link below to continue:\n\n" +
    `${resetUrl}\n\n` +
    "This link expires and can only be used once.\n";

  const html =
    `<p>Hello ${fullName},</p>` +
    "<p>You requested to reset your password. Open the link below to continue:</p>" +
    `<p><a href="${resetUrl}">Reset password</a></p>` +
    "<p>This link expires and can only be used once.</p>";

  return { subject, text, html };
};

const toPublicUser = (user) => {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const isCompanyManagerOnboarding = (user) => {
  return (
    user.role === USER_ROLE.COMPANY_MANAGER &&
    user.status === USER_STATUS.PENDING_ACTIVATION
  );
};

const registerCandidate = async ({ fullName, email, password }) => {
  assertPasswordPolicy(password);

  const normalizedEmail = normalizeEmail(email);

  const existingUser = await User.findOne({
    email: normalizedEmail,
  }).select("_id");

  if (existingUser) {
    throw new AppError(409, "Email is already registered", {
      field: "email",
    });
  }

  const passwordHash = await hashPassword(password);

  let user;

  try {
    user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      passwordHash,
      role: USER_ROLE.CANDIDATE,
      status: USER_STATUS.ACTIVE,
      emailVerifiedAt: null,
      mustChangePassword: false,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, "Email is already registered", {
        field: "email",
      });
    }

    throw error;
  }

  const rawToken = generateAuthToken();
  const tokenHash = hashAuthToken(rawToken);
  const expiresAt = new Date(
    Date.now() + config.authToken.emailVerificationExpiresInMs,
  );

  try {
    await AuthToken.create({
      userId: user._id,
      type: AUTH_TOKEN_TYPE.EMAIL_VERIFICATION,
      tokenHash,
      expiresAt,
    });
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }

  const { subject, text, html } = buildVerificationEmail({
    fullName: user.fullName,
    rawToken,
  });

  try {
    await sendMail({
      to: user.email,
      subject,
      text,
      html,
    });
  } catch {
    await AuthToken.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
    throw new AppError(
      503,
      "Unable to send verification email. Please try again later.",
    );
  }

  return toPublicUser(user);
};

const registerCompanyManager = async ({ fullName, email, password }) => {
  assertPasswordPolicy(password);

  const normalizedEmail = normalizeEmail(email);

  const existingUser = await User.findOne({
    email: normalizedEmail,
  }).select("_id");

  if (existingUser) {
    throw new AppError(409, "Email is already registered", {
      field: "email",
    });
  }

  const passwordHash = await hashPassword(password);
  const session = await mongoose.startSession();

  let user;
  let company;

  try {
    await session.withTransaction(async () => {
      try {
        [user] = await User.create(
          [
            {
              fullName: fullName.trim(),
              email: normalizedEmail,
              passwordHash,
              role: USER_ROLE.COMPANY_MANAGER,
              status: USER_STATUS.PENDING_ACTIVATION,
              emailVerifiedAt: null,
              mustChangePassword: false,
            },
          ],
          { session },
        );
      } catch (error) {
        if (error.code === 11000) {
          throw new AppError(409, "Email is already registered", {
            field: "email",
          });
        }

        throw error;
      }

      [company] = await Company.create(
        [
          {
            managerUserId: user._id,
            approvalStatus: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
            operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
            reviewSnapshot: null,
            submittedAt: null,
            reviewedByUserId: null,
            reviewedAt: null,
            activatedAt: null,
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return {
    user: toPublicUser(user),
    company: toPublicCompany(company),
  };
};

const verifyEmail = async ({ token }) => {
  const tokenHash = hashAuthToken(token);
  const authToken = await AuthToken.findOne({
    type: AUTH_TOKEN_TYPE.EMAIL_VERIFICATION,
    tokenHash,
    expiresAt: { $gt: new Date() },
  }).select("+tokenHash");

  if (!authToken) {
    throw new AppError(400, "Invalid or expired email verification token", {
      field: "token",
    });
  }

  const user = await User.findById(authToken.userId);

  if (!user) {
    throw new AppError(400, "Invalid or expired email verification token", {
      field: "token",
    });
  }

  if (user.emailVerifiedAt) {
    throw new AppError(409, "Email is already verified", {
      field: "email",
    });
  }

  const consumedToken = await AuthToken.findOneAndDelete({
    _id: authToken._id,
    type: AUTH_TOKEN_TYPE.EMAIL_VERIFICATION,
    tokenHash,
    expiresAt: { $gt: new Date() },
  }).select("+tokenHash");

  if (!consumedToken) {
    throw new AppError(400, "Invalid or expired email verification token", {
      field: "token",
    });
  }

  user.emailVerifiedAt = new Date();
  await user.save();

  return toPublicUser(user);
};

const confirmCompanyApproval = async ({ token }) => {
  const tokenHash = hashAuthToken(token);
  const session = await mongoose.startSession();
  let user;
  let company;

  try {
    await session.withTransaction(async () => {
      const authToken = await AuthToken.findOne({
        type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
        tokenHash,
        expiresAt: { $gt: new Date() },
      })
        .select("+tokenHash")
        .session(session);

      if (!authToken) {
        throw new AppError(
          400,
          "Invalid or expired company approval confirmation token",
          {
            field: "token",
          },
        );
      }

      user = await User.findById(authToken.userId).session(session);

      if (!user || user.role !== USER_ROLE.COMPANY_MANAGER) {
        throw new AppError(
          400,
          "Invalid or expired company approval confirmation token",
          {
            field: "token",
          },
        );
      }

      if (user.status !== USER_STATUS.PENDING_ACTIVATION) {
        throw new AppError(
          409,
          "Only PENDING_ACTIVATION Company Managers can confirm approval",
          {
            field: "status",
          },
        );
      }

      company = await Company.findOne({
        managerUserId: user._id,
      }).session(session);

      if (!company) {
        throw new AppError(
          500,
          "Company for Company Manager is missing",
        );
      }

      if (
        company.approvalStatus !== COMPANY_APPROVAL_STATUS.APPROVED ||
        company.operationalStatus !== COMPANY_OPERATIONAL_STATUS.INACTIVE
      ) {
        throw new AppError(
          409,
          "Only APPROVED and INACTIVE Companies can be activated",
          {
            field: "approvalStatus",
          },
        );
      }

      const now = new Date();

      user.status = USER_STATUS.ACTIVE;
      user.emailVerifiedAt = now;
      await user.save({ session });

      company.operationalStatus = COMPANY_OPERATIONAL_STATUS.ACTIVE;
      company.activatedAt = now;
      await company.save({ session });

      const consumedToken = await AuthToken.findOneAndDelete({
        _id: authToken._id,
        type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
        tokenHash,
        expiresAt: { $gt: new Date() },
      })
        .session(session)
        .select("+tokenHash");

      if (!consumedToken) {
        throw new AppError(
          400,
          "Invalid or expired company approval confirmation token",
          {
            field: "token",
          },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return {
    user: toPublicUser(user),
    company: toPublicCompany(company),
  };
};

const login = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+passwordHash");

  if (!user) {
    throw new AppError(401, "Invalid email or password", {
      field: "credentials",
    });
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, "Invalid email or password", {
      field: "credentials",
    });
  }

  const onboardingCompanyManager = isCompanyManagerOnboarding(user);

  if (!onboardingCompanyManager && !user.emailVerifiedAt) {
    throw new AppError(403, "Email verification is required before login", {
      field: "email",
    });
  }

  if (user.status === USER_STATUS.LOCKED) {
    throw new AppError(403, "Account is locked", {
      field: "status",
    });
  }

  if (user.status === USER_STATUS.TERMINATED) {
    throw new AppError(403, "Account is terminated", {
      field: "status",
    });
  }

  if (!onboardingCompanyManager && user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, "Account is not active", {
      field: "status",
    });
  }

  const rawRefreshToken = generateAuthToken();
  const refreshTokenHash = hashAuthToken(rawRefreshToken);
  const expiresAt = new Date(
    Date.now() + config.authSession.expiresInMs,
  );

  const session = await AuthSession.create({
    userId: user._id,
    refreshTokenHash,
    expiresAt,
  });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
    sessionId: session._id.toString(),
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    session: {
      id: session._id.toString(),
      expiresAt: session.expiresAt,
    },
    user: toPublicUser(user),
  };
};

const refreshAccess = async ({ refreshToken }) => {
  const refreshTokenHash = hashAuthToken(refreshToken);

  const session = await AuthSession.findOne({
    refreshTokenHash,
    expiresAt: { $gt: new Date() },
  }).select("+refreshTokenHash");

  if (!session) {
    throw new AppError(401, "Invalid or expired refresh token", {
      field: "refreshToken",
    });
  }

  const user = await User.findById(session.userId);

  if (!user) {
    throw new AppError(401, "Invalid or expired refresh token", {
      field: "refreshToken",
    });
  }

  if (user.status === USER_STATUS.LOCKED) {
    throw new AppError(403, "Account is locked", {
      field: "status",
    });
  }

  if (user.status === USER_STATUS.TERMINATED) {
    throw new AppError(403, "Account is terminated", {
      field: "status",
    });
  }

  if (
    !isCompanyManagerOnboarding(user) &&
    user.status !== USER_STATUS.ACTIVE
  ) {
    throw new AppError(403, "Account is not active", {
      field: "status",
    });
  }

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
    sessionId: session._id.toString(),
  });

  return {
    accessToken,
    session: {
      id: session._id.toString(),
      expiresAt: session.expiresAt,
    },
  };
};

const logoutCurrentSession = async ({ sessionId }) => {
  const deletedSession = await AuthSession.findByIdAndDelete(sessionId);

  if (!deletedSession) {
    throw new AppError(401, "Invalid or expired access token", {
      field: "accessToken",
    });
  }

  return {
    sessionId: deletedSession._id.toString(),
  };
};

const requestPasswordReset = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({
    email: normalizedEmail,
    role: USER_ROLE.CANDIDATE,
  });

  if (!user) {
    return {
      message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
    };
  }

  await AuthToken.deleteMany({
    userId: user._id,
    type: AUTH_TOKEN_TYPE.PASSWORD_RESET,
  });

  const rawToken = generateAuthToken();
  const tokenHash = hashAuthToken(rawToken);
  const expiresAt = new Date(
    Date.now() + config.authToken.passwordResetExpiresInMs,
  );

  let createdToken;

  createdToken = await AuthToken.create({
    userId: user._id,
    type: AUTH_TOKEN_TYPE.PASSWORD_RESET,
    tokenHash,
    expiresAt,
  });

  const { subject, text, html } = buildPasswordResetEmail({
    fullName: user.fullName,
    rawToken,
  });

  try {
    await sendMail({
      to: user.email,
      subject,
      text,
      html,
    });
  } catch {
    await AuthToken.deleteOne({ _id: createdToken._id });
    throw new AppError(
      503,
      "Unable to send password reset email. Please try again later.",
    );
  }

  return {
    message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
  };
};

const resetPassword = async ({ token, password }) => {
  assertPasswordPolicy(password);

  const tokenHash = hashAuthToken(token);
  const authToken = await AuthToken.findOne({
    type: AUTH_TOKEN_TYPE.PASSWORD_RESET,
    tokenHash,
    expiresAt: { $gt: new Date() },
  }).select("+tokenHash");

  if (!authToken) {
    throw new AppError(400, "Invalid or expired password reset token", {
      field: "token",
    });
  }

  const user = await User.findById(authToken.userId).select("+passwordHash");

  if (!user) {
    throw new AppError(400, "Invalid or expired password reset token", {
      field: "token",
    });
  }

  const consumedToken = await AuthToken.findOneAndDelete({
    _id: authToken._id,
    type: AUTH_TOKEN_TYPE.PASSWORD_RESET,
    tokenHash,
    expiresAt: { $gt: new Date() },
  }).select("+tokenHash");

  if (!consumedToken) {
    throw new AppError(400, "Invalid or expired password reset token", {
      field: "token",
    });
  }

  user.passwordHash = await hashPassword(password);
  user.mustChangePassword = false;
  await user.save();

  await AuthSession.deleteMany({ userId: user._id });

  return {
    message: "Password reset successful.",
  };
};

export {
  confirmCompanyApproval,
  login,
  logoutCurrentSession,
  refreshAccess,
  registerCandidate,
  registerCompanyManager,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
};
