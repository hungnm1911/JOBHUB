import mongoose from "mongoose";

import AUTH_TOKEN_TYPE from "../constants/auth-token-type.js";
import COMPANY_APPROVAL_STATUS from "../constants/company-approval-status.js";
import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
import COMPANY_OPERATIONAL_STATUS from "../constants/company-operational-status.js";
import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import config from "../config/index.js";
import AuthSession from "../models/auth-session.model.js";
import AuthToken from "../models/auth-token.model.js";
import Company from "../models/company.model.js";
import CompanyMember from "../models/company-member.model.js";
import User from "../models/user.model.js";
import sendMail from "./mail.service.js";
import {
  findCompanyManagerMembership,
  toPublicCompany,
} from "./company.service.js";
import AppError from "../utils/app-error.js";
import buildCompanyApprovalConfirmationEmail from "../utils/company-approval-confirmation-email.js";
import { generateAuthToken, hashAuthToken } from "../utils/hash-auth-token.js";


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

const toPublicManagerSummary = (user) => {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
  };
};

const toPublicReviewSnapshot = (reviewSnapshot) => {
  if (!reviewSnapshot) {
    return null;
  }

  return {
    name: reviewSnapshot.name,
    logoUrl: reviewSnapshot.logoUrl,
    bannerUrl: reviewSnapshot.bannerUrl,
    website: reviewSnapshot.website,
    address: reviewSnapshot.address,
    description: reviewSnapshot.description,
    contactInfo: reviewSnapshot.contactInfo,
    businessRegistrationNumber: reviewSnapshot.businessRegistrationNumber,
  };
};

const isSubmittedCompanyRegistration = (company) => {
  return (
    company.approvalStatus !== COMPANY_APPROVAL_STATUS.NOT_SUBMITTED &&
    company.reviewSnapshot != null &&
    company.submittedAt != null
  );
};

const PENDING_INACTIVE_SUBMITTED_FILTER = {
  approvalStatus: COMPANY_APPROVAL_STATUS.PENDING,
  operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
  reviewSnapshot: { $ne: null },
  submittedAt: { $ne: null },
};

const assertApproveRejectManagerSourceState = (manager) => {
  if (manager.role !== USER_ROLE.COMPANY_STAFF) {
    throw new AppError(
      409,
      "Company Manager for submitted registration must have role COMPANY_STAFF",
      {
        field: "role",
      },
    );
  }

  if (manager.status !== USER_STATUS.PENDING_ACTIVATION) {
    throw new AppError(
      409,
      "Company Manager must be PENDING_ACTIVATION to approve or reject Company",
      {
        field: "status",
      },
    );
  }
};

const assertLockManagerSourceState = (manager) => {
  if (manager.role !== USER_ROLE.COMPANY_STAFF) {
    throw new AppError(
      409,
      "Company Manager for Company must have role COMPANY_STAFF",
      {
        field: "role",
      },
    );
  }

  if (manager.status !== USER_STATUS.ACTIVE) {
    throw new AppError(
      409,
      "Company Manager must be ACTIVE to lock Company",
      {
        field: "status",
      },
    );
  }
};

const loadManagerForCompany = async ({ companyId, session } = {}) => {
  const membership = await findCompanyManagerMembership({
    companyId,
    session,
  });

  if (!membership) {
    return null;
  }

  let query = User.findById(membership.userId);

  if (session) {
    query = query.session(session);
  }

  return query;
};

const loadManagersByCompanyIds = async (companyIds) => {
  const memberships = await CompanyMember.find({
    companyId: { $in: companyIds },
    role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
  });

  const managers = await User.find({
    _id: { $in: memberships.map((membership) => membership.userId) },
  });

  const managersById = new Map(
    managers.map((manager) => [manager._id.toString(), manager]),
  );

  return new Map(
    memberships.map((membership) => [
      membership.companyId.toString(),
      managersById.get(membership.userId.toString()),
    ]),
  );
};

const toCompanyRegistrationSummary = (company, manager) => {
  return {
    id: company._id.toString(),
    approvalStatus: company.approvalStatus,
    operationalStatus: company.operationalStatus,
    submittedAt: company.submittedAt,
    companyName: company.reviewSnapshot.name,
    businessRegistrationNumber:
      company.reviewSnapshot.businessRegistrationNumber,
    manager: toPublicManagerSummary(manager),
  };
};

const toCompanyRegistrationDetail = (company, manager) => {
  return {
    id: company._id.toString(),
    approvalStatus: company.approvalStatus,
    operationalStatus: company.operationalStatus,
    submittedAt: company.submittedAt,
    reviewedByUserId: company.reviewedByUserId
      ? company.reviewedByUserId.toString()
      : null,
    reviewedAt: company.reviewedAt,
    activatedAt: company.activatedAt,
    manager: toPublicManagerSummary(manager),
    reviewSnapshot: toPublicReviewSnapshot(company.reviewSnapshot),
  };
};

const listCompanyRegistrations = async () => {
  const companies = await Company.find({
    approvalStatus: { $ne: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED },
    reviewSnapshot: { $ne: null },
    submittedAt: { $ne: null },
  });

  const managersByCompanyId = await loadManagersByCompanyIds(
    companies.map((company) => company._id),
  );

  return companies.map((company) => {
    const manager = managersByCompanyId.get(company._id.toString());

    if (!manager) {
      throw new AppError(
        500,
        "Company Manager for submitted registration is missing",
      );
    }

    return toCompanyRegistrationSummary(company, manager);
  });
};

const getCompanyRegistration = async ({ companyId }) => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new AppError(400, "Invalid company id", {
      field: "companyId",
    });
  }

  const company = await Company.findById(companyId);

  if (!company || !isSubmittedCompanyRegistration(company)) {
    throw new AppError(404, "Company registration not found", {
      field: "companyId",
    });
  }

  const manager = await loadManagerForCompany({ companyId: company._id });

  if (!manager) {
    throw new AppError(
      500,
      "Company Manager for submitted registration is missing",
    );
  }

  return toCompanyRegistrationDetail(company, manager);
};

const rejectCompanyRegistration = async ({ companyId, actorUserId }) => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new AppError(400, "Invalid company id", {
      field: "companyId",
    });
  }

  const pendingCompany = await Company.findOne({
    _id: companyId,
    ...PENDING_INACTIVE_SUBMITTED_FILTER,
  });

  if (!pendingCompany) {
    const existingCompany = await Company.findById(companyId);

    if (!existingCompany) {
      throw new AppError(404, "Company registration not found", {
        field: "companyId",
      });
    }

    throw new AppError(
      409,
      "Only PENDING and INACTIVE submitted Companies can be rejected",
      {
        field: "approvalStatus",
      },
    );
  }

  const manager = await loadManagerForCompany({
    companyId: pendingCompany._id,
  });

  if (!manager) {
    throw new AppError(
      500,
      "Company Manager for submitted registration is missing",
    );
  }

  assertApproveRejectManagerSourceState(manager);

  const company = await Company.findOneAndUpdate(
    {
      _id: companyId,
      ...PENDING_INACTIVE_SUBMITTED_FILTER,
    },
    {
      $set: {
        approvalStatus: COMPANY_APPROVAL_STATUS.REJECTED,
        operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
        activatedAt: null,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!company) {
    throw new AppError(
      409,
      "Only PENDING and INACTIVE submitted Companies can be rejected",
      {
        field: "approvalStatus",
      },
    );
  }

  return toCompanyRegistrationDetail(company, manager);
};

const approveCompanyRegistration = async ({ companyId, actorUserId }) => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new AppError(400, "Invalid company id", {
      field: "companyId",
    });
  }

  const session = await mongoose.startSession();
  let company;
  let manager;
  let rawToken;

  try {
    await session.withTransaction(async () => {
      company = await Company.findOneAndUpdate(
        {
          _id: companyId,
          ...PENDING_INACTIVE_SUBMITTED_FILTER,
        },
        {
          $set: {
            approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
            operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
            reviewedByUserId: actorUserId,
            reviewedAt: new Date(),
            activatedAt: null,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!company) {
        const existingCompany = await Company.findById(companyId).session(
          session,
        );

        if (!existingCompany) {
          throw new AppError(404, "Company registration not found", {
            field: "companyId",
          });
        }

        throw new AppError(
          409,
          "Only PENDING and INACTIVE submitted Companies can be approved",
          {
            field: "approvalStatus",
          },
        );
      }

      manager = await loadManagerForCompany({
        companyId: company._id,
        session,
      });

      if (!manager) {
        throw new AppError(
          500,
          "Company Manager for submitted registration is missing",
        );
      }

      assertApproveRejectManagerSourceState(manager);

      rawToken = generateAuthToken();
      const tokenHash = hashAuthToken(rawToken);
      const expiresAt = new Date(
        Date.now() + config.authToken.companyApprovalConfirmationExpiresInMs,
      );

      await AuthToken.create(
        [
          {
            userId: manager._id,
            type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
            tokenHash,
            expiresAt,
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  const { subject, text, html } = buildCompanyApprovalConfirmationEmail({
    fullName: manager.fullName,
    companyName: company.reviewSnapshot.name,
    rawToken,
  });

  try {
    await sendMail({
      to: manager.email,
      subject,
      text,
      html,
    });
  } catch {
    // TX-02 already committed APPROVED+INACTIVE with confirmation capability.
    // Do not compensate with separate writes that can break that invariant or
    // invent a non-canonical APPROVED → PENDING reverse transition.
    throw new AppError(
      503,
      "Unable to send approval confirmation email. Please try again later.",
    );
  }

  return toCompanyRegistrationDetail(company, manager);
};

const VALID_COMPANY_MANAGER_LIFECYCLES = new Set([
  `${USER_STATUS.PENDING_ACTIVATION}:${COMPANY_APPROVAL_STATUS.NOT_SUBMITTED}:${COMPANY_OPERATIONAL_STATUS.INACTIVE}`,
  `${USER_STATUS.PENDING_ACTIVATION}:${COMPANY_APPROVAL_STATUS.PENDING}:${COMPANY_OPERATIONAL_STATUS.INACTIVE}`,
  `${USER_STATUS.PENDING_ACTIVATION}:${COMPANY_APPROVAL_STATUS.REJECTED}:${COMPANY_OPERATIONAL_STATUS.INACTIVE}`,
  `${USER_STATUS.PENDING_ACTIVATION}:${COMPANY_APPROVAL_STATUS.APPROVED}:${COMPANY_OPERATIONAL_STATUS.INACTIVE}`,
  `${USER_STATUS.ACTIVE}:${COMPANY_APPROVAL_STATUS.APPROVED}:${COMPANY_OPERATIONAL_STATUS.ACTIVE}`,
  `${USER_STATUS.TERMINATED}:${COMPANY_APPROVAL_STATUS.APPROVED}:${COMPANY_OPERATIONAL_STATUS.LOCKED}`,
]);

const assertAccountStatusPreservesCompanyLifecycle = async ({
  targetUser,
  nextStatus,
}) => {
  if (targetUser.role !== USER_ROLE.COMPANY_STAFF) {
    return;
  }

  const membership = await findCompanyManagerMembership({
    userId: targetUser._id,
  });

  if (!membership) {
    return;
  }

  const company = await Company.findById(membership.companyId);

  if (!company) {
    return;
  }

  const lifecycleKey = `${nextStatus}:${company.approvalStatus}:${company.operationalStatus}`;

  if (VALID_COMPANY_MANAGER_LIFECYCLES.has(lifecycleKey)) {
    return;
  }

  throw new AppError(
    409,
    "Company Manager account status cannot be changed through this operation while it would break Company lifecycle; use Company lock instead",
    {
      field: "userId",
    },
  );
};

// V10 Slice 09 / F11 / BR-08 / BR-48 / BR-52 / TX-05:
// After V1 User LOCK/TERMINATE commits, system consequence is automatic
// Unassign of current non-terminal Applications still assigned to the
// Recruiter named by persisted CompanyMember. Not Platform Admin assignment
// authority: no replacement, no Job-team mutation, no CompanyMember sync,
// no final-zero guard, no global Application transaction. Partial detach
// progress is kept; retry rereads current persisted responsibilities.
const automaticallyUnassignRecruiterApplicationsAfterPlatformUserEligibilityLoss =
  async ({ targetUser }) => {
    if (targetUser.role !== USER_ROLE.COMPANY_STAFF) {
      return;
    }

    const recruiterMembership = await CompanyMember.findOne({
      userId: targetUser._id,
      role: COMPANY_MEMBER_ROLE.RECRUITER,
    }).select("_id");

    if (!recruiterMembership) {
      return;
    }

    const { automaticallyUnassignCurrentResponsibilitiesOfRecruiter } =
      await import("./application.service.js");

    await automaticallyUnassignCurrentResponsibilitiesOfRecruiter({
      outgoingRecruiterCompanyMemberId: recruiterMembership._id,
    });
  };

const lockAccount = async ({ targetUserId, actorUserId }) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new AppError(400, "Invalid account id", {
      field: "userId",
    });
  }

  if (targetUserId === actorUserId.toString()) {
    throw new AppError(403, "Platform Admin cannot lock their own account", {
      field: "userId",
    });
  }

  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    throw new AppError(404, "Account not found", {
      field: "userId",
    });
  }

  if (targetUser.role === USER_ROLE.PLATFORM_ADMIN) {
    throw new AppError(
      403,
      "Platform Admin accounts cannot be locked through this operation",
      {
        field: "userId",
      },
    );
  }

  if (targetUser.status !== USER_STATUS.ACTIVE) {
    throw new AppError(409, "Only ACTIVE accounts can be locked", {
      field: "status",
    });
  }

  await assertAccountStatusPreservesCompanyLifecycle({
    targetUser,
    nextStatus: USER_STATUS.LOCKED,
  });

  targetUser.status = USER_STATUS.LOCKED;
  await targetUser.save();

  await AuthSession.deleteMany({ userId: targetUser._id });

  // BR-47 / BR-48 / TX-05: User lifecycle already committed; Application
  // detach follows from current responsibilities without blocking or
  // rolling back account lifecycle / Job-team state.
  await automaticallyUnassignRecruiterApplicationsAfterPlatformUserEligibilityLoss(
    { targetUser },
  );

  return toPublicUser(targetUser);
};

const lockCompany = async ({ companyId }) => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new AppError(400, "Invalid company id", {
      field: "companyId",
    });
  }

  const session = await mongoose.startSession();
  let company;
  let manager;

  try {
    await session.withTransaction(async () => {
      company = await Company.findById(companyId).session(session);

      if (!company) {
        throw new AppError(404, "Company not found", {
          field: "companyId",
        });
      }

      if (
        company.approvalStatus !== COMPANY_APPROVAL_STATUS.APPROVED ||
        company.operationalStatus !== COMPANY_OPERATIONAL_STATUS.ACTIVE
      ) {
        throw new AppError(
          409,
          "Only APPROVED and ACTIVE Companies can be locked",
          {
            field: "approvalStatus",
          },
        );
      }

      manager = await loadManagerForCompany({
        companyId: company._id,
        session,
      });

      if (!manager) {
        throw new AppError(500, "Company Manager for Company is missing");
      }

      assertLockManagerSourceState(manager);

      company.operationalStatus = COMPANY_OPERATIONAL_STATUS.LOCKED;
      await company.save({ session });

      manager.status = USER_STATUS.TERMINATED;
      await manager.save({ session });

      await AuthSession.deleteMany({ userId: manager._id }).session(session);
    });
  } finally {
    await session.endSession();
  }

  return {
    company: toPublicCompany(company, manager._id),
    manager: toPublicUser(manager),
  };
};

const TERMINATABLE_STATUSES = new Set([
  USER_STATUS.ACTIVE,
  USER_STATUS.LOCKED,
]);

const terminateAccount = async ({ targetUserId, actorUserId }) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new AppError(400, "Invalid account id", {
      field: "userId",
    });
  }

  if (targetUserId === actorUserId.toString()) {
    throw new AppError(
      403,
      "Platform Admin cannot terminate their own account",
      {
        field: "userId",
      },
    );
  }

  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    throw new AppError(404, "Account not found", {
      field: "userId",
    });
  }

  if (targetUser.role === USER_ROLE.PLATFORM_ADMIN) {
    throw new AppError(
      403,
      "Platform Admin accounts cannot be terminated through this operation",
      {
        field: "userId",
      },
    );
  }

  if (!TERMINATABLE_STATUSES.has(targetUser.status)) {
    throw new AppError(409, "Only ACTIVE or LOCKED accounts can be terminated", {
      field: "status",
    });
  }

  await assertAccountStatusPreservesCompanyLifecycle({
    targetUser,
    nextStatus: USER_STATUS.TERMINATED,
  });

  targetUser.status = USER_STATUS.TERMINATED;
  await targetUser.save();

  await AuthSession.deleteMany({ userId: targetUser._id });

  // BR-47 / BR-48 / TX-05: same post-commit automatic Unassign as lock.
  // Also covers remaining Application refs when terminating an already LOCKED
  // Recruiter User (retry/reconciliation from current persisted state).
  await automaticallyUnassignRecruiterApplicationsAfterPlatformUserEligibilityLoss(
    { targetUser },
  );

  return toPublicUser(targetUser);
};

export {
  approveCompanyRegistration,
  getCompanyRegistration,
  listCompanyRegistrations,
  lockAccount,
  lockCompany,
  rejectCompanyRegistration,
  terminateAccount,
};
