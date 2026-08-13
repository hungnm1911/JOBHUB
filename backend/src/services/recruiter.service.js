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
import Job from "../models/job.model.js";
import User from "../models/user.model.js";
import { resolveCompanyManagerRecruiterManagementContext } from "./company.service.js";
import { issuePasswordReset } from "./auth.service.js";
import {
  acquireActiveRecruiterMembershipForTeamResponsibilityTx,
  assertNoOutstandingRecruiterTeamResponsibility,
  executeForcedPrimaryTransfer,
  executeForcedSupportingRemoval,
  findAllUnfinishedJobsAsPrimary,
  findAllUnfinishedJobsAsSupporting,
} from "./job.service.js";
import {
  assertNoOutstandingRecruiterApplicationResponsibility,
  executeTrustedPreLifecycleApplicationHandoff,
  findNonTerminalApplicationsAssignedToRecruiter,
} from "./application.service.js";
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

const buildLifecycleTransferMap = (transfers = []) => {
  const transferMap = new Map();

  for (const transfer of transfers) {
    if (
      !transfer.jobId ||
      !mongoose.Types.ObjectId.isValid(transfer.jobId)
    ) {
      throw new AppError(400, "Each transfer must specify a valid jobId", {
        field: "transfers",
      });
    }

    if (
      !transfer.replacementCompanyMemberId ||
      !mongoose.Types.ObjectId.isValid(transfer.replacementCompanyMemberId)
    ) {
      throw new AppError(
        400,
        "Each transfer must specify a valid replacementCompanyMemberId",
        { field: "transfers" },
      );
    }

    transferMap.set(
      transfer.jobId.toString(),
      transfer.replacementCompanyMemberId.toString(),
    );
  }

  return transferMap;
};

// Replacement context for Application handoff during LOCK/TERMINATE:
// 1) explicit transfers[jobId] from the existing V6 lifecycle request; or
// 2) Supporting-only departure → current Primary (Take over context).
// Do not invent another selector when neither context exists.
const resolveApplicationHandoffReplacementCompanyMemberId = ({
  job,
  outgoingCompanyMemberId,
  transferMap,
}) => {
  const jobIdStr = job._id.toString();
  const outgoingIdStr = outgoingCompanyMemberId.toString();

  if (transferMap.has(jobIdStr)) {
    return transferMap.get(jobIdStr);
  }

  const isPrimary =
    job.primaryRecruiterCompanyMemberId.toString() === outgoingIdStr;
  const isSupporting = (job.supportingRecruiterCompanyMemberIds ?? []).some(
    (id) => id.toString() === outgoingIdStr,
  );

  if (isSupporting && !isPrimary) {
    return job.primaryRecruiterCompanyMemberId.toString();
  }

  throw new AppError(
    409,
    "Recruiter has outstanding Application responsibility and no replacement was specified",
    {
      field: "transfers",
      jobId: jobIdStr,
      jobStatus: job.status,
    },
  );
};

const assertZeroActiveRecruiterResponsibility = async ({
  companyId,
  recruiterCompanyMemberId,
  session,
} = {}) => {
  await assertNoOutstandingRecruiterTeamResponsibility({
    companyId,
    recruiterCompanyMemberId,
    session,
  });

  await assertNoOutstandingRecruiterApplicationResponsibility({
    recruiterCompanyMemberId,
    session,
  });
};

// V10 Slice 08 / BR-28 / TX-05: unify Job-team forced transfer and Application
// pre-lifecycle handoff before LOCK/TERMINATE completion. Per-resource commits
// may progress independently; final lifecycle commit still requires zero active
// responsibility on both dimensions.
const executeUnifiedResponsibilityHandoffBeforeLifecycleCompletion = async ({
  companyId,
  outgoingCompanyMemberId,
  transferMap,
} = {}) => {
  const primaryJobs = await findAllUnfinishedJobsAsPrimary({
    companyId,
    primaryRecruiterCompanyMemberId: outgoingCompanyMemberId,
  });

  const supportingJobs = await findAllUnfinishedJobsAsSupporting({
    companyId,
    supportingRecruiterCompanyMemberId: outgoingCompanyMemberId,
  });

  // BR-27: unfinished Primary Jobs still require an explicit replacement.
  for (const job of primaryJobs) {
    const jobIdStr = job._id.toString();

    if (!transferMap.has(jobIdStr)) {
      throw new AppError(
        409,
        "Recruiter has outstanding Primary Job responsibility and no replacement was specified",
        {
          field: "primaryRecruiterCompanyMemberId",
          jobId: jobIdStr,
          jobStatus: job.status,
        },
      );
    }
  }

  // 1) Job-team Primary transfers first so Application targets that become the
  // new Primary are on the Recruitment Team before A→B handoff.
  for (const job of primaryJobs) {
    const jobIdStr = job._id.toString();
    const replacementId = transferMap.get(jobIdStr);

    await executeForcedPrimaryTransfer({
      jobId: job._id,
      companyId,
      oldPrimaryCompanyMemberId: outgoingCompanyMemberId,
      replacementCompanyMemberId: replacementId,
    });
  }

  // 2) Application responsibility handoff for every non-terminal Application
  // still assigned to the outgoing Recruiter (PUBLISHED/CLOSED/EXPIRED alike).
  const assignedApplications =
    await findNonTerminalApplicationsAssignedToRecruiter({
      assigneeCompanyMemberId: outgoingCompanyMemberId,
    });

  const applicationsByJobId = new Map();

  for (const application of assignedApplications) {
    const jobIdStr = application.jobId.toString();

    if (!applicationsByJobId.has(jobIdStr)) {
      applicationsByJobId.set(jobIdStr, []);
    }

    applicationsByJobId.get(jobIdStr).push(application);
  }

  for (const [jobIdStr, applications] of applicationsByJobId) {
    const job = await Job.findById(jobIdStr);

    if (!job) {
      throw new AppError(404, "Job not found", {
        field: "jobId",
        jobId: jobIdStr,
      });
    }

    if (job.companyId.toString() !== companyId.toString()) {
      throw new AppError(403, "Job does not belong to the expected Company", {
        field: "companyId",
      });
    }

    const replacementId = resolveApplicationHandoffReplacementCompanyMemberId({
      job,
      outgoingCompanyMemberId,
      transferMap,
    });

    for (const application of applications) {
      await executeTrustedPreLifecycleApplicationHandoff({
        companyId,
        jobId: application.jobId.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: replacementId,
        expectedAssigneeCompanyMemberId: outgoingCompanyMemberId.toString(),
        expectedVersion: application.version,
        verifiedOutgoingSubjectCompanyMemberId:
          outgoingCompanyMemberId.toString(),
      });
    }
  }

  // 3) Supporting removals after Application handoff so Take-over-to-Primary
  // remains eligible while the outgoing Supporting is still on the team.
  for (const job of supportingJobs) {
    await executeForcedSupportingRemoval({
      jobId: job._id,
      companyId,
      supportingCompanyMemberId: outgoingCompanyMemberId,
    });
  }

  await assertZeroActiveRecruiterResponsibility({
    companyId,
    recruiterCompanyMemberId: outgoingCompanyMemberId,
  });
};

const lockRecruiter = async ({
  managerUser,
  recruiterId,
  clientCompanyId,
  transfers = [],
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

  const transferMap = buildLifecycleTransferMap(transfers);

  await executeUnifiedResponsibilityHandoffBeforeLifecycleCompletion({
    companyId: context.companyId,
    outgoingCompanyMemberId: membership._id,
    transferMap,
  });

  const session = await mongoose.startSession();
  let lockedMembership;

  try {
    await session.withTransaction(async () => {
      const stillActive =
        await acquireActiveRecruiterMembershipForTeamResponsibilityTx({
          recruiterCompanyMemberId: membership._id,
          companyId: context.companyId,
          session,
        });

      if (!stillActive) {
        throw new AppError(409, "Only ACTIVE Recruiters can be locked", {
          field: "membershipStatus",
        });
      }

      // TX-02 / PI-24: re-evaluate zero Job-team + Application responsibility
      // inside the terminal serialization boundary.
      await assertZeroActiveRecruiterResponsibility({
        companyId: context.companyId,
        recruiterCompanyMemberId: membership._id,
        session,
      });

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
  transfers = [],
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

  const transferMap = buildLifecycleTransferMap(transfers);

  // Same unified Job-team + Application handoff foundation as LOCK (TX-05).
  await executeUnifiedResponsibilityHandoffBeforeLifecycleCompletion({
    companyId: context.companyId,
    outgoingCompanyMemberId: membership._id,
    transferMap,
  });

  const session = await mongoose.startSession();
  let terminatedMembership;
  const membershipStatusAtStart = membership.status;

  try {
    await session.withTransaction(async () => {
      if (membershipStatusAtStart === COMPANY_MEMBER_STATUS.ACTIVE) {
        const stillActive =
          await acquireActiveRecruiterMembershipForTeamResponsibilityTx({
            recruiterCompanyMemberId: membership._id,
            companyId: context.companyId,
            session,
          });

        if (!stillActive) {
          throw new AppError(
            409,
            "Only ACTIVE or LOCKED Recruiters can be terminated",
            {
              field: "membershipStatus",
            },
          );
        }
      } else {
        const stillLocked = await CompanyMember.findOne({
          _id: membership._id,
          companyId: context.companyId,
          role: COMPANY_MEMBER_ROLE.RECRUITER,
          status: COMPANY_MEMBER_STATUS.LOCKED,
        }).session(session);

        if (!stillLocked) {
          throw new AppError(
            409,
            "Only ACTIVE or LOCKED Recruiters can be terminated",
            {
              field: "membershipStatus",
            },
          );
        }
      }

      // TX-02 / PI-24: dual zero-responsibility guard at completion boundary.
      await assertZeroActiveRecruiterResponsibility({
        companyId: context.companyId,
        recruiterCompanyMemberId: membership._id,
        session,
      });

      // TX-05: ACTIVE|LOCKED → TERMINATED + revoke AuthSession atomically.
      // Retains User/CompanyMember identity, email, employeeCode, jobTitle.
      // Does not change User.status or Company lifecycle.
      terminatedMembership = await CompanyMember.findOneAndUpdate(
        {
          _id: membership._id,
          companyId: context.companyId,
          role: COMPANY_MEMBER_ROLE.RECRUITER,
          status: membershipStatusAtStart,
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
