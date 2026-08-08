import mongoose from "mongoose";

import AUTH_TOKEN_TYPE from "../constants/auth-token-type.js";
import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../constants/company-member-status.js";
import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import config from "../config/index.js";
import AuthToken from "../models/auth-token.model.js";
import CompanyMember from "../models/company-member.model.js";
import User from "../models/user.model.js";
import { resolveCompanyManagerRecruiterManagementContext } from "./company.service.js";
import sendMail from "./mail.service.js";
import AppError from "../utils/app-error.js";
import { generateAuthToken, hashAuthToken } from "../utils/hash-auth-token.js";
import { hashPassword } from "../utils/hash-password.js";
import buildRecruiterActivationEmail from "../utils/recruiter-activation-email.js";

const normalizeEmail = (email) => {
  return email.trim().toLowerCase();
};

const normalizeRequiredText = (value, field) => {
  const trimmed = value.trim();

  if (trimmed === "") {
    throw new AppError(400, `${field} is required`, {
      field,
    });
  }

  return trimmed;
};

const toPublicRecruiter = (user, membership) => {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    mustChangePassword: user.mustChangePassword,
    membership: {
      id: membership._id.toString(),
      companyId: membership.companyId.toString(),
      role: membership.role,
      status: membership.status,
      employeeCode: membership.employeeCode,
      jobTitle: membership.jobTitle,
    },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const assertDuplicateKey = (error, { emailFieldMessage, employeeCodeMessage }) => {
  if (error?.code !== 11000) {
    return false;
  }

  const keyPattern = error.keyPattern ?? {};

  if (keyPattern.email) {
    throw new AppError(409, emailFieldMessage, {
      field: "email",
    });
  }

  if (keyPattern.employeeCode || keyPattern.companyId) {
    throw new AppError(409, employeeCodeMessage, {
      field: "employeeCode",
    });
  }

  throw new AppError(409, emailFieldMessage, {
    field: "email",
  });
};

const createRecruiter = async ({
  managerUser,
  fullName,
  email,
  employeeCode,
  jobTitle,
  clientCompanyId,
}) => {
  const context = await resolveCompanyManagerRecruiterManagementContext({
    user: managerUser,
    clientCompanyId,
  });

  const normalizedFullName = normalizeRequiredText(fullName, "fullName");
  const normalizedEmail = normalizeEmail(
    normalizeRequiredText(email, "email"),
  );
  const normalizedEmployeeCode = normalizeRequiredText(
    employeeCode,
    "employeeCode",
  );
  const normalizedJobTitle = normalizeRequiredText(jobTitle, "jobTitle");

  const existingUser = await User.findOne({
    email: normalizedEmail,
  }).select("_id");

  if (existingUser) {
    throw new AppError(409, "Email is already registered", {
      field: "email",
    });
  }

  const existingEmployeeCode = await CompanyMember.findOne({
    companyId: context.companyId,
    role: COMPANY_MEMBER_ROLE.RECRUITER,
    employeeCode: normalizedEmployeeCode,
  }).select("_id");

  if (existingEmployeeCode) {
    throw new AppError(
      409,
      "Employee code is already used in this company",
      {
        field: "employeeCode",
      },
    );
  }

  // Bootstrap credential satisfies User.passwordHash persistence only.
  // It is never returned to the Company Manager or emailed as a login password.
  const bootstrapPasswordHash = await hashPassword(generateAuthToken());
  const session = await mongoose.startSession();

  let recruiterUser;
  let membership;

  try {
    await session.withTransaction(async () => {
      try {
        [recruiterUser] = await User.create(
          [
            {
              fullName: normalizedFullName,
              email: normalizedEmail,
              passwordHash: bootstrapPasswordHash,
              role: USER_ROLE.COMPANY_STAFF,
              status: USER_STATUS.ACTIVE,
              emailVerifiedAt: null,
              mustChangePassword: true,
            },
          ],
          { session },
        );
      } catch (error) {
        assertDuplicateKey(error, {
          emailFieldMessage: "Email is already registered",
          employeeCodeMessage: "Employee code is already used in this company",
        });
        throw error;
      }

      try {
        [membership] = await CompanyMember.create(
          [
            {
              userId: recruiterUser._id,
              companyId: context.companyId,
              role: COMPANY_MEMBER_ROLE.RECRUITER,
              status: COMPANY_MEMBER_STATUS.ACTIVE,
              employeeCode: normalizedEmployeeCode,
              jobTitle: normalizedJobTitle,
            },
          ],
          { session },
        );
      } catch (error) {
        assertDuplicateKey(error, {
          emailFieldMessage: "Email is already registered",
          employeeCodeMessage: "Employee code is already used in this company",
        });
        throw error;
      }
    });
  } finally {
    await session.endSession();
  }

  const rawToken = generateAuthToken();
  const tokenHash = hashAuthToken(rawToken);
  const expiresAt = new Date(
    Date.now() + config.authToken.emailVerificationExpiresInMs,
  );

  await AuthToken.create({
    userId: recruiterUser._id,
    type: AUTH_TOKEN_TYPE.RECRUITER_ACTIVATION,
    tokenHash,
    expiresAt,
  });

  const companyName = context.company.name ?? "your company";
  const { subject, text, html } = buildRecruiterActivationEmail({
    fullName: recruiterUser.fullName,
    companyName,
    rawToken,
  });

  try {
    await sendMail({
      to: recruiterUser.email,
      subject,
      text,
      html,
    });
  } catch {
    // TX-01 already committed User + CompanyMember. Token issuance is outside
    // TX-01; SMTP is not a distributed/exactly-once guarantee.
    throw new AppError(
      503,
      "Unable to send recruiter activation email. Please try again later.",
    );
  }

  return toPublicRecruiter(recruiterUser, membership);
};

export { createRecruiter, toPublicRecruiter };
