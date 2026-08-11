import mongoose from "mongoose";

import AUTH_TOKEN_TYPE from "../constants/auth-token-type.js";
import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../constants/company-member-status.js";
import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import config from "../config/index.js";
import AuthSession from "../models/auth-session.model.js";
import AuthToken from "../models/auth-token.model.js";
import CompanyMember from "../models/company-member.model.js";
import User from "../models/user.model.js";
import { resolveCompanyManagerRecruiterManagementContext } from "./company.service.js";
import { issuePasswordReset } from "./auth.service.js";
import {
  assertNoOutstandingRecruiterTeamResponsibility,
} from "./job.service.js";
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

const listRecruiters = async ({ managerUser, clientCompanyId }) => {
  const context = await resolveCompanyManagerRecruiterManagementContext({
    user: managerUser,
    clientCompanyId,
  });

  const memberships = await CompanyMember.find({
    companyId: context.companyId,
    role: COMPANY_MEMBER_ROLE.RECRUITER,
  }).sort({ createdAt: 1 });

  if (memberships.length === 0) {
    return [];
  }

  const users = await User.find({
    _id: { $in: memberships.map((membership) => membership.userId) },
  });
  const usersById = new Map(
    users.map((user) => [user._id.toString(), user]),
  );

  return memberships.flatMap((membership) => {
    const user = usersById.get(membership.userId.toString());

    if (!user) {
      return [];
    }

    return [toPublicRecruiter(user, membership)];
  });
};

const getRecruiterDetail = async ({
  managerUser,
  recruiterId,
  clientCompanyId,
}) => {
  if (!mongoose.Types.ObjectId.isValid(recruiterId)) {
    throw new AppError(400, "Invalid recruiter id", {
      field: "recruiterId",
    });
  }

  const context = await resolveCompanyManagerRecruiterManagementContext({
    user: managerUser,
    clientCompanyId,
  });

  const membership = await CompanyMember.findOne({
    companyId: context.companyId,
    role: COMPANY_MEMBER_ROLE.RECRUITER,
    userId: recruiterId,
  });

  if (!membership) {
    throw new AppError(404, "Recruiter not found", {
      field: "recruiterId",
    });
  }

  const user = await User.findById(recruiterId);

  if (!user || user.role !== USER_ROLE.COMPANY_STAFF) {
    throw new AppError(404, "Recruiter not found", {
      field: "recruiterId",
    });
  }

  return toPublicRecruiter(user, membership);
};

const initiateRecruiterPasswordReset = async ({
  managerUser,
  recruiterId,
  clientCompanyId,
}) => {
  if (!mongoose.Types.ObjectId.isValid(recruiterId)) {
    throw new AppError(400, "Invalid recruiter id", {
      field: "recruiterId",
    });
  }

  const context = await resolveCompanyManagerRecruiterManagementContext({
    user: managerUser,
    clientCompanyId,
  });

  const membership = await CompanyMember.findOne({
    companyId: context.companyId,
    role: COMPANY_MEMBER_ROLE.RECRUITER,
    userId: recruiterId,
  });

  if (!membership) {
    throw new AppError(404, "Recruiter not found", {
      field: "recruiterId",
    });
  }

  if (membership.status === COMPANY_MEMBER_STATUS.TERMINATED) {
    throw new AppError(
      409,
      "Terminated Recruiters cannot receive password reset",
      {
        field: "membershipStatus",
      },
    );
  }

  const user = await User.findById(recruiterId);

  if (!user || user.role !== USER_ROLE.COMPANY_STAFF) {
    throw new AppError(404, "Recruiter not found", {
      field: "recruiterId",
    });
  }

  // Settled decision: CM cannot initiate reset before initial activation.
  if (user.mustChangePassword) {
    throw new AppError(
      409,
      "Recruiter must complete activation before password reset",
      {
        field: "mustChangePassword",
      },
    );
  }

  await issuePasswordReset(user);

  return {
    message: "Password reset initiated for recruiter.",
    recruiter: toPublicRecruiter(user, membership),
  };
};

const loadSameTenantRecruiterMembership = async ({
  companyId,
  recruiterId,
}) => {
  if (!mongoose.Types.ObjectId.isValid(recruiterId)) {
    throw new AppError(400, "Invalid recruiter id", {
      field: "recruiterId",
    });
  }

  const membership = await CompanyMember.findOne({
    companyId,
    role: COMPANY_MEMBER_ROLE.RECRUITER,
    userId: recruiterId,
  });

  if (!membership) {
    throw new AppError(404, "Recruiter not found", {
      field: "recruiterId",
    });
  }

  const user = await User.findById(recruiterId);

  if (!user || user.role !== USER_ROLE.COMPANY_STAFF) {
    throw new AppError(404, "Recruiter not found", {
      field: "recruiterId",
    });
  }

  return {
    membership,
    user,
  };
};

const lockRecruiter = async ({
  managerUser,
  recruiterId,
  clientCompanyId,
}) => {
  const context = await resolveCompanyManagerRecruiterManagementContext({
    user: managerUser,
    clientCompanyId,
  });

  const { membership, user } = await loadSameTenantRecruiterMembership({
    companyId: context.companyId,
    recruiterId,
  });

  if (membership.status === COMPANY_MEMBER_STATUS.TERMINATED) {
    throw new AppError(409, "Terminated Recruiters cannot be locked", {
      field: "membershipStatus",
    });
  }

  if (membership.status !== COMPANY_MEMBER_STATUS.ACTIVE) {
    throw new AppError(409, "Only ACTIVE Recruiters can be locked", {
      field: "membershipStatus",
    });
  }

  // BR-41: outstanding Primary responsibility blocks lock completion.
  // Guard stays outside TX-04; no jobs↔company_members multi-document TX.
  await assertNoOutstandingRecruiterTeamResponsibility({
    companyId: context.companyId,
    recruiterCompanyMemberId: membership._id,
  });

  const session = await mongoose.startSession();
  let lockedMembership;

  try {
    await session.withTransaction(async () => {
      // TX-04: ACTIVE → LOCKED + revoke all AuthSession atomically.
      // Does not change User.status or Company lifecycle.
      lockedMembership = await CompanyMember.findOneAndUpdate(
        {
          _id: membership._id,
          companyId: context.companyId,
          role: COMPANY_MEMBER_ROLE.RECRUITER,
          status: COMPANY_MEMBER_STATUS.ACTIVE,
        },
        {
          $set: {
            status: COMPANY_MEMBER_STATUS.LOCKED,
          },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!lockedMembership) {
        throw new AppError(409, "Only ACTIVE Recruiters can be locked", {
          field: "membershipStatus",
        });
      }

      await AuthSession.deleteMany({ userId: user._id }).session(session);
    });
  } finally {
    await session.endSession();
  }

  return toPublicRecruiter(user, lockedMembership);
};

const unlockRecruiter = async ({
  managerUser,
  recruiterId,
  clientCompanyId,
}) => {
  // Actor CM context requires User ACTIVE + membership ACTIVE + Company
  // APPROVED/ACTIVE (BR-23 for the management action).
  const context = await resolveCompanyManagerRecruiterManagementContext({
    user: managerUser,
    clientCompanyId,
  });

  const { membership, user } = await loadSameTenantRecruiterMembership({
    companyId: context.companyId,
    recruiterId,
  });

  if (membership.status === COMPANY_MEMBER_STATUS.TERMINATED) {
    throw new AppError(409, "Terminated Recruiters cannot be unlocked", {
      field: "membershipStatus",
    });
  }

  if (membership.status !== COMPANY_MEMBER_STATUS.LOCKED) {
    throw new AppError(409, "Only LOCKED Recruiters can be unlocked", {
      field: "membershipStatus",
    });
  }

  // BR-22: platform User restriction outranks Company-level unlock.
  if (user.status === USER_STATUS.LOCKED) {
    throw new AppError(
      403,
      "Cannot unlock a platform-locked Recruiter account",
      {
        field: "status",
      },
    );
  }

  if (user.status === USER_STATUS.TERMINATED) {
    throw new AppError(
      403,
      "Cannot unlock a platform-terminated Recruiter account",
      {
        field: "status",
      },
    );
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(
      403,
      "Cannot unlock a Recruiter with restricted platform account status",
      {
        field: "status",
      },
    );
  }

  // F12 / BR-18: LOCKED → ACTIVE membership only; do not restore sessions.
  const unlockedMembership = await CompanyMember.findOneAndUpdate(
    {
      _id: membership._id,
      companyId: context.companyId,
      role: COMPANY_MEMBER_ROLE.RECRUITER,
      status: COMPANY_MEMBER_STATUS.LOCKED,
    },
    {
      $set: {
        status: COMPANY_MEMBER_STATUS.ACTIVE,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!unlockedMembership) {
    throw new AppError(409, "Only LOCKED Recruiters can be unlocked", {
      field: "membershipStatus",
    });
  }

  return toPublicRecruiter(user, unlockedMembership);
};

const TERMINATABLE_MEMBERSHIP_STATUSES = new Set([
  COMPANY_MEMBER_STATUS.ACTIVE,
  COMPANY_MEMBER_STATUS.LOCKED,
]);

const terminateRecruiter = async ({
  managerUser,
  recruiterId,
  clientCompanyId,
}) => {
  const context = await resolveCompanyManagerRecruiterManagementContext({
    user: managerUser,
    clientCompanyId,
  });

  const { membership, user } = await loadSameTenantRecruiterMembership({
    companyId: context.companyId,
    recruiterId,
  });

  if (membership.status === COMPANY_MEMBER_STATUS.TERMINATED) {
    throw new AppError(409, "Recruiter is already terminated", {
      field: "membershipStatus",
    });
  }

  if (!TERMINATABLE_MEMBERSHIP_STATUSES.has(membership.status)) {
    throw new AppError(
      409,
      "Only ACTIVE or LOCKED Recruiters can be terminated",
      {
        field: "membershipStatus",
      },
    );
  }

  // BR-41: outstanding Primary responsibility blocks terminate completion.
  // Guard stays outside TX-05; no jobs↔company_members multi-document TX.
  await assertNoOutstandingRecruiterTeamResponsibility({
    companyId: context.companyId,
    recruiterCompanyMemberId: membership._id,
  });

  const session = await mongoose.startSession();
  let terminatedMembership;

  try {
    await session.withTransaction(async () => {
      // TX-05: ACTIVE|LOCKED → TERMINATED + revoke AuthSession atomically.
      // Retains User/CompanyMember identity, email, employeeCode, jobTitle.
      // Does not change User.status or Company lifecycle.
      terminatedMembership = await CompanyMember.findOneAndUpdate(
        {
          _id: membership._id,
          companyId: context.companyId,
          role: COMPANY_MEMBER_ROLE.RECRUITER,
          status: {
            $in: [
              COMPANY_MEMBER_STATUS.ACTIVE,
              COMPANY_MEMBER_STATUS.LOCKED,
            ],
          },
        },
        {
          $set: {
            status: COMPANY_MEMBER_STATUS.TERMINATED,
          },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!terminatedMembership) {
        throw new AppError(
          409,
          "Only ACTIVE or LOCKED Recruiters can be terminated",
          {
            field: "membershipStatus",
          },
        );
      }

      await AuthSession.deleteMany({ userId: user._id }).session(session);
    });
  } finally {
    await session.endSession();
  }

  return toPublicRecruiter(user, terminatedMembership);
};

export {
  createRecruiter,
  getRecruiterDetail,
  initiateRecruiterPasswordReset,
  listRecruiters,
  lockRecruiter,
  terminateRecruiter,
  toPublicRecruiter,
  unlockRecruiter,
};
