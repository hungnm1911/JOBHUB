import mongoose from "mongoose";

import AUTH_TOKEN_TYPE from "../constants/auth-token-type.js";
import COMPANY_APPROVAL_STATUS from "../constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../constants/company-operational-status.js";
import USER_STATUS from "../constants/user-status.js";
import config from "../config/index.js";
import AuthToken from "../models/auth-token.model.js";
import Company from "../models/company.model.js";
import User from "../models/user.model.js";
import sendMail from "./mail.service.js";
import AppError from "../utils/app-error.js";
import buildCompanyApprovalConfirmationEmail from "../utils/company-approval-confirmation-email.js";
import { generateAuthToken, hashAuthToken } from "../utils/hash-auth-token.js";

// Non-usable issuance marker: expiresAt <= now so partial failure cannot leave a
// new usable COMPANY_APPROVAL_CONFIRMATION before arbitration/mail complete.
const APPROVAL_CONFIRMATION_ISSUANCE_PLACEHOLDER_EXPIRES_AT = new Date(0);

const DRAFT_PROFILE_FIELDS = Object.freeze([
  "name",
  "logoUrl",
  "bannerUrl",
  "website",
  "address",
  "description",
  "contactInfo",
  "businessRegistrationNumber",
]);

const ACTIVE_PROFILE_FIELDS = Object.freeze([
  "logoUrl",
  "bannerUrl",
  "website",
  "address",
  "description",
  "contactInfo",
]);

const toPublicCompany = (company) => {
  return {
    id: company._id.toString(),
    managerUserId: company.managerUserId.toString(),
    name: company.name,
    logoUrl: company.logoUrl,
    bannerUrl: company.bannerUrl,
    website: company.website,
    address: company.address,
    description: company.description,
    contactInfo: company.contactInfo,
    businessRegistrationNumber: company.businessRegistrationNumber,
    approvalStatus: company.approvalStatus,
    operationalStatus: company.operationalStatus,
    reviewSnapshot: company.reviewSnapshot
      ? {
          name: company.reviewSnapshot.name,
          logoUrl: company.reviewSnapshot.logoUrl,
          bannerUrl: company.reviewSnapshot.bannerUrl,
          website: company.reviewSnapshot.website,
          address: company.reviewSnapshot.address,
          description: company.reviewSnapshot.description,
          contactInfo: company.reviewSnapshot.contactInfo,
          businessRegistrationNumber:
            company.reviewSnapshot.businessRegistrationNumber,
        }
      : null,
    submittedAt: company.submittedAt,
    reviewedByUserId: company.reviewedByUserId
      ? company.reviewedByUserId.toString()
      : null,
    reviewedAt: company.reviewedAt,
    activatedAt: company.activatedAt,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
};

const resolveOwnedCompany = async ({ managerUserId }) => {
  const company = await Company.findOne({
    managerUserId,
  });

  if (!company) {
    throw new AppError(404, "Company not found for the authenticated manager");
  }

  return company;
};

const assertCompanyDraftEditable = (company) => {
  if (
    company.approvalStatus !== COMPANY_APPROVAL_STATUS.NOT_SUBMITTED ||
    company.operationalStatus !== COMPANY_OPERATIONAL_STATUS.INACTIVE
  ) {
    throw new AppError(
      409,
      "Company profile can only be updated while NOT_SUBMITTED and INACTIVE",
      {
        field: "approvalStatus",
      },
    );
  }
};

const assertCompanyDraftAccessible = (company) => {
  if (
    company.approvalStatus !== COMPANY_APPROVAL_STATUS.NOT_SUBMITTED ||
    company.operationalStatus !== COMPANY_OPERATIONAL_STATUS.INACTIVE
  ) {
    throw new AppError(
      409,
      "Company profile can only be accessed while NOT_SUBMITTED and INACTIVE",
      {
        field: "approvalStatus",
      },
    );
  }
};

const assertCompanyActiveAccessible = (company) => {
  if (
    company.approvalStatus !== COMPANY_APPROVAL_STATUS.APPROVED ||
    company.operationalStatus !== COMPANY_OPERATIONAL_STATUS.ACTIVE
  ) {
    throw new AppError(
      409,
      "Company profile can only be accessed while APPROVED and ACTIVE",
      {
        field: "approvalStatus",
      },
    );
  }
};

const assertCompanySubmittable = (company) => {
  if (
    company.approvalStatus !== COMPANY_APPROVAL_STATUS.NOT_SUBMITTED ||
    company.operationalStatus !== COMPANY_OPERATIONAL_STATUS.INACTIVE ||
    company.reviewSnapshot != null ||
    company.submittedAt != null
  ) {
    throw new AppError(
      409,
      "Company can only be submitted once while NOT_SUBMITTED and INACTIVE",
      {
        field: "approvalStatus",
      },
    );
  }

  if (company.name == null) {
    throw new AppError(400, "Company name is required before submit", {
      field: "name",
    });
  }

  if (company.businessRegistrationNumber == null) {
    throw new AppError(
      400,
      "Business registration number is required before submit",
      {
        field: "businessRegistrationNumber",
      },
    );
  }
};

const getOwnedCompany = async ({ managerUserId }) => {
  const company = await resolveOwnedCompany({ managerUserId });

  assertCompanyDraftAccessible(company);

  return toPublicCompany(company);
};

const getOwnedActiveCompany = async ({ managerUserId }) => {
  const company = await resolveOwnedCompany({ managerUserId });

  assertCompanyActiveAccessible(company);

  return toPublicCompany(company);
};

const normalizeOptionalString = (value) => {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
};

const updateOwnedCompanyDraft = async ({ managerUserId, profile }) => {
  const company = await resolveOwnedCompany({ managerUserId });

  assertCompanyDraftEditable(company);

  const profileUpdate = {};

  for (const fieldName of DRAFT_PROFILE_FIELDS) {
    if (Object.hasOwn(profile, fieldName)) {
      profileUpdate[fieldName] = normalizeOptionalString(profile[fieldName]);
    }
  }

  if (Object.keys(profileUpdate).length === 0) {
    return toPublicCompany(company);
  }

  let updatedCompany;

  try {
    updatedCompany = await Company.findOneAndUpdate(
      {
        _id: company._id,
        approvalStatus: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
        operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
      },
      {
        $set: profileUpdate,
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(
        409,
        "Business registration number is already registered",
        {
          field: "businessRegistrationNumber",
        },
      );
    }

    throw error;
  }

  if (!updatedCompany) {
    throw new AppError(
      409,
      "Company profile can only be updated while NOT_SUBMITTED and INACTIVE",
      {
        field: "approvalStatus",
      },
    );
  }

  return toPublicCompany(updatedCompany);
};

const updateOwnedCompanyActiveProfile = async ({ managerUserId, profile }) => {
  const company = await resolveOwnedCompany({ managerUserId });

  assertCompanyActiveAccessible(company);

  const profileUpdate = {};

  for (const fieldName of ACTIVE_PROFILE_FIELDS) {
    if (Object.hasOwn(profile, fieldName)) {
      profileUpdate[fieldName] = normalizeOptionalString(profile[fieldName]);
    }
  }

  if (Object.keys(profileUpdate).length === 0) {
    return toPublicCompany(company);
  }

  const updatedCompany = await Company.findOneAndUpdate(
    {
      _id: company._id,
      managerUserId,
      approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
    },
    {
      $set: profileUpdate,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedCompany) {
    throw new AppError(
      409,
      "Company profile can only be updated while APPROVED and ACTIVE",
      {
        field: "approvalStatus",
      },
    );
  }

  return toPublicCompany(updatedCompany);
};

const submitOwnedCompany = async ({ managerUserId }) => {
  const company = await resolveOwnedCompany({ managerUserId });

  assertCompanySubmittable(company);

  const duplicateBusinessRegistrationNumber = await Company.findOne({
    _id: { $ne: company._id },
    businessRegistrationNumber: company.businessRegistrationNumber,
  }).select("_id");

  if (duplicateBusinessRegistrationNumber) {
    throw new AppError(
      409,
      "Business registration number is already registered",
      {
        field: "businessRegistrationNumber",
      },
    );
  }

  const updatedCompany = await Company.findOneAndUpdate(
    {
      _id: company._id,
      approvalStatus: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
      reviewSnapshot: null,
      submittedAt: null,
      name: { $type: "string" },
      businessRegistrationNumber: { $type: "string" },
    },
    [
      {
        $set: {
          reviewSnapshot: {
            name: "$name",
            logoUrl: "$logoUrl",
            bannerUrl: "$bannerUrl",
            website: "$website",
            address: "$address",
            description: "$description",
            contactInfo: "$contactInfo",
            businessRegistrationNumber: "$businessRegistrationNumber",
          },
          submittedAt: "$$NOW",
          approvalStatus: COMPANY_APPROVAL_STATUS.PENDING,
          operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
        },
      },
    ],
    {
      returnDocument: "after",
      updatePipeline: true,
    },
  );

  if (!updatedCompany) {
    throw new AppError(
      409,
      "Company can only be submitted once while NOT_SUBMITTED and INACTIVE",
      {
        field: "approvalStatus",
      },
    );
  }

  return toPublicCompany(updatedCompany);
};

const resendApprovalConfirmation = async ({ managerUserId }) => {
  const manager = await User.findById(managerUserId);

  if (!manager || manager.status !== USER_STATUS.PENDING_ACTIVATION) {
    throw new AppError(
      409,
      "Only PENDING_ACTIVATION Company Managers can resend approval confirmation",
      {
        field: "status",
      },
    );
  }

  const company = await resolveOwnedCompany({ managerUserId });

  if (
    company.approvalStatus !== COMPANY_APPROVAL_STATUS.APPROVED ||
    company.operationalStatus !== COMPANY_OPERATIONAL_STATUS.INACTIVE
  ) {
    throw new AppError(
      409,
      "Approval confirmation can only be resent while Company is APPROVED and INACTIVE",
      {
        field: "approvalStatus",
      },
    );
  }

  const now = new Date();

  const usableConfirmation = await AuthToken.findOne({
    userId: manager._id,
    type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    expiresAt: { $gt: now },
  }).select("_id");

  if (usableConfirmation) {
    throw new AppError(
      409,
      "A valid approval confirmation already exists",
      {
        field: "token",
      },
    );
  }

  const rawToken = generateAuthToken();
  const tokenHash = hashAuthToken(rawToken);

  const createdToken = await AuthToken.create({
    userId: manager._id,
    type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    tokenHash,
    expiresAt: APPROVAL_CONFIRMATION_ISSUANCE_PLACEHOLDER_EXPIRES_AT,
  });

  const competingUsable = await AuthToken.findOne({
    userId: manager._id,
    type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    expiresAt: { $gt: new Date() },
  }).select("_id");

  if (competingUsable) {
    await AuthToken.deleteOne({ _id: createdToken._id });

    throw new AppError(
      409,
      "A valid approval confirmation already exists",
      {
        field: "token",
      },
    );
  }

  // Exclusive claim among non-usable issuance rows (placeholders + expired leftovers).
  // Newest wins so a fresh resend displaces stale crash leftovers without reviving them.
  const issuanceCandidates = await AuthToken.find({
    userId: manager._id,
    type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    expiresAt: { $lte: new Date() },
  })
    .sort({ createdAt: -1, _id: -1 })
    .select("_id");

  const winner = issuanceCandidates[0];
  const duplicateIds = issuanceCandidates.slice(1).map((token) => token._id);

  if (duplicateIds.length > 0) {
    await AuthToken.deleteMany({
      _id: { $in: duplicateIds },
    });
  }

  if (!winner || !winner._id.equals(createdToken._id)) {
    throw new AppError(
      409,
      "A valid approval confirmation already exists",
      {
        field: "token",
      },
    );
  }

  const companyName = company.reviewSnapshot?.name ?? company.name ?? "your company";
  const { subject, text, html } = buildCompanyApprovalConfirmationEmail({
    fullName: manager.fullName,
    companyName,
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
    try {
      await AuthToken.deleteOne({
        _id: createdToken._id,
        expiresAt: APPROVAL_CONFIRMATION_ISSUANCE_PLACEHOLDER_EXPIRES_AT,
      });
    } catch {
      // Placeholder remains non-usable; do not leave a usable credential.
    }

    throw new AppError(
      503,
      "Unable to send approval confirmation email. Please try again later.",
    );
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const otherUsable = await AuthToken.findOne({
        userId: manager._id,
        type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
        expiresAt: { $gt: new Date() },
      })
        .select("_id")
        .session(session);

      if (otherUsable) {
        await AuthToken.deleteOne({ _id: createdToken._id }).session(session);

        throw new AppError(
          409,
          "A valid approval confirmation already exists",
          {
            field: "token",
          },
        );
      }

      const promoted = await AuthToken.findOneAndUpdate(
        {
          _id: createdToken._id,
          expiresAt: APPROVAL_CONFIRMATION_ISSUANCE_PLACEHOLDER_EXPIRES_AT,
        },
        {
          $set: {
            expiresAt: new Date(
              Date.now() +
                config.authToken.companyApprovalConfirmationExpiresInMs,
            ),
          },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!promoted) {
        throw new AppError(
          409,
          "A valid approval confirmation already exists",
          {
            field: "token",
          },
        );
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    await AuthToken.deleteOne({
      _id: createdToken._id,
      expiresAt: APPROVAL_CONFIRMATION_ISSUANCE_PLACEHOLDER_EXPIRES_AT,
    });

    throw error;
  } finally {
    await session.endSession();
  }

  return toPublicCompany(company);
};

export {
  getOwnedActiveCompany,
  getOwnedCompany,
  resendApprovalConfirmation,
  submitOwnedCompany,
  toPublicCompany,
  updateOwnedCompanyActiveProfile,
  updateOwnedCompanyDraft,
};
