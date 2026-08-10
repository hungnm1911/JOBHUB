import mongoose from "mongoose";

import CATEGORY_LEVEL from "../constants/category-level.js";
import COMPANY_APPROVAL_STATUS from "../constants/company-approval-status.js";
import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../constants/company-operational-status.js";
import EMPLOYMENT_TYPE from "../constants/employment-type.js";
import JOB_STATUS, {
  COMPANY_MANAGER_INTERNAL_VISIBLE_JOB_STATUSES,
  OUTSTANDING_PRIMARY_JOB_STATUSES,
  PRE_PUBLICATION_DELETABLE_JOB_STATUSES,
} from "../constants/job-status.js";
import LOCATION from "../constants/location.js";
import USER_STATUS from "../constants/user-status.js";
import WORK_MODE from "../constants/work-mode.js";
import Category from "../models/category.model.js";
import CompanyMember from "../models/company-member.model.js";
import ExperienceLevel from "../models/experience-level.model.js";
import Job from "../models/job.model.js";
import User from "../models/user.model.js";
import {
  assertSameCompanyTenant,
  resolveCompanyManagerRecruiterManagementContext,
  resolveCompanyStaffBusinessContext,
  resolveRecruiterBusinessContext,
} from "./company.service.js";
import AppError from "../utils/app-error.js";

const LOCATION_VALUES = new Set(Object.values(LOCATION));
const EMPLOYMENT_TYPE_VALUES = new Set(Object.values(EMPLOYMENT_TYPE));
const WORK_MODE_VALUES = new Set(Object.values(WORK_MODE));

const DRAFT_CONTENT_FIELDS = Object.freeze([
  "title",
  "jobDescription",
  "requiredSkills",
  "salaryText",
  "fieldCategoryIds",
  "positionCategoryIds",
  "location",
  "employmentType",
  "workModes",
  "experienceLevelId",
  "applicationDeadline",
]);

// Minimal plain values for conditional Job writes. Array fields are copied so
// Mongoose array subtypes do not affect MongoDB equality matching.
const buildValidatedDraftContentMatch = (job) => {
  return {
    title: job.title,
    jobDescription: job.jobDescription,
    requiredSkills: [...job.requiredSkills],
    salaryText: job.salaryText,
    fieldCategoryIds: [...job.fieldCategoryIds],
    positionCategoryIds: [...job.positionCategoryIds],
    location: job.location,
    employmentType: job.employmentType,
    workModes: [...job.workModes],
    experienceLevelId: job.experienceLevelId,
    applicationDeadline: job.applicationDeadline,
  };
};

const toPublicJob = (job) => {
  return {
    id: job._id.toString(),
    companyId: job.companyId.toString(),
    createdByCompanyMemberId: job.createdByCompanyMemberId.toString(),
    primaryRecruiterCompanyMemberId:
      job.primaryRecruiterCompanyMemberId.toString(),
    title: job.title,
    jobDescription: job.jobDescription,
    requiredSkills: job.requiredSkills,
    salaryText: job.salaryText,
    fieldCategoryIds: job.fieldCategoryIds.map((id) => id.toString()),
    positionCategoryIds: job.positionCategoryIds.map((id) => id.toString()),
    location: job.location,
    employmentType: job.employmentType,
    workModes: job.workModes,
    experienceLevelId:
      job.experienceLevelId == null ? null : job.experienceLevelId.toString(),
    applicationDeadline: job.applicationDeadline,
    status: job.status,
    publishedAt: job.publishedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
};

const normalizeOptionalTrimmedString = (value) => {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new AppError(400, "Value must be a string when provided");
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  return trimmed;
};

const normalizeOptionalObjectId = (value, field) => {
  if (value == null || value === "") {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(400, `Invalid ${field}`, {
      field,
    });
  }

  return value;
};

const normalizeObjectIdArray = (values, field) => {
  if (values == null) {
    return [];
  }

  if (!Array.isArray(values)) {
    throw new AppError(400, `${field} must be an array`, {
      field,
    });
  }

  const normalized = [];
  const seen = new Set();

  for (const value of values) {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new AppError(400, `Invalid ${field} entry`, {
        field,
      });
    }

    const key = value.toString();

    if (seen.has(key)) {
      throw new AppError(400, `${field} must not contain duplicates`, {
        field,
      });
    }

    seen.add(key);
    normalized.push(value);
  }

  return normalized;
};

const normalizeRequiredSkills = (values) => {
  if (values == null) {
    return [];
  }

  if (!Array.isArray(values)) {
    throw new AppError(400, "requiredSkills must be an array", {
      field: "requiredSkills",
    });
  }

  return values.map((value) => {
    const normalized = normalizeOptionalTrimmedString(value);

    if (normalized == null) {
      throw new AppError(400, "Each required skill must be a non-empty string", {
        field: "requiredSkills",
      });
    }

    return normalized;
  });
};

const normalizeWorkModes = (values) => {
  if (values == null) {
    return [];
  }

  if (!Array.isArray(values)) {
    throw new AppError(400, "workModes must be an array", {
      field: "workModes",
    });
  }

  const normalized = [];
  const seen = new Set();

  for (const value of values) {
    if (!WORK_MODE_VALUES.has(value)) {
      throw new AppError(400, "workModes must use canonical WorkMode values", {
        field: "workModes",
      });
    }

    if (seen.has(value)) {
      throw new AppError(400, "workModes must not contain duplicates", {
        field: "workModes",
      });
    }

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
};

const normalizeOptionalLocation = (value) => {
  if (value == null || value === "") {
    return null;
  }

  if (!LOCATION_VALUES.has(value)) {
    throw new AppError(400, "location must be a canonical Location value", {
      field: "location",
    });
  }

  return value;
};

const normalizeOptionalEmploymentType = (value) => {
  if (value == null || value === "") {
    return null;
  }

  if (!EMPLOYMENT_TYPE_VALUES.has(value)) {
    throw new AppError(
      400,
      "employmentType must be a canonical EmploymentType value",
      {
        field: "employmentType",
      },
    );
  }

  return value;
};

const normalizeOptionalDeadline = (value) => {
  if (value == null || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "applicationDeadline must be a valid date", {
      field: "applicationDeadline",
    });
  }

  return date;
};

const normalizeDraftContentField = (field, value) => {
  switch (field) {
    case "title":
    case "jobDescription":
    case "salaryText":
      return normalizeOptionalTrimmedString(value);
    case "requiredSkills":
      return normalizeRequiredSkills(value);
    case "fieldCategoryIds":
    case "positionCategoryIds":
      return normalizeObjectIdArray(value, field);
    case "location":
      return normalizeOptionalLocation(value);
    case "employmentType":
      return normalizeOptionalEmploymentType(value);
    case "workModes":
      return normalizeWorkModes(value);
    case "experienceLevelId":
      return normalizeOptionalObjectId(value, field);
    case "applicationDeadline":
      return normalizeOptionalDeadline(value);
    default:
      throw new AppError(400, `Unsupported Job content field: ${field}`, {
        field,
      });
  }
};

const buildDraftContent = (content = {}) => {
  const draftContent = {};

  for (const field of DRAFT_CONTENT_FIELDS) {
    draftContent[field] = normalizeDraftContentField(
      field,
      Object.hasOwn(content, field) ? content[field] : undefined,
    );
  }

  return draftContent;
};

const buildDraftContentPatch = (content = {}) => {
  const patch = {};

  for (const field of DRAFT_CONTENT_FIELDS) {
    if (!Object.hasOwn(content, field)) {
      continue;
    }

    patch[field] = normalizeDraftContentField(field, content[field]);
  }

  return patch;
};

const createDraftJob = async ({
  recruiterUser,
  clientCompanyId,
  content = {},
} = {}) => {
  // BR-01 / BR-03 / BR-38: trusted Recruiter membership resolves Company.
  const context = await resolveRecruiterBusinessContext({
    user: recruiterUser,
    clientCompanyId,
  });

  const draftContent = buildDraftContent(content);

  // BR-04 / BR-05 / BR-06 / BR-08 / BR-42: DRAFT with creator = Primary; no
  // Supporting Recruiter representation.
  const job = await Job.create({
    companyId: context.companyId,
    createdByCompanyMemberId: context.membership._id,
    primaryRecruiterCompanyMemberId: context.membership._id,
    status: JOB_STATUS.DRAFT,
    publishedAt: null,
    ...draftContent,
  });

  return toPublicJob(job);
};

const loadJobForRecruiterMutation = async ({
  jobId,
  companyId,
  primaryRecruiterCompanyMemberId,
}) => {
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new AppError(400, "Invalid Job id", {
      field: "jobId",
    });
  }

  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  // BR-38: knowing Job id does not authorize cross-tenant access.
  assertSameCompanyTenant({
    resourceCompanyId: job.companyId,
    tenantCompanyId: companyId,
  });

  // BR-09 / BR-18: only current Primary Recruiter may mutate/submit.
  if (
    job.primaryRecruiterCompanyMemberId.toString() !==
    primaryRecruiterCompanyMemberId.toString()
  ) {
    throw new AppError(
      403,
      "Only the Primary Recruiter can perform this operation on the Job",
      {
        field: "primaryRecruiterCompanyMemberId",
      },
    );
  }

  return job;
};

const assertJobDraftContentMutable = (job) => {
  if (job.status === JOB_STATUS.DRAFT) {
    return;
  }

  // BR-19 / BR-24 / BR-25: non-DRAFT Jobs reject content mutation.
  throw new AppError(
    409,
    "Job content can only be edited while the Job is DRAFT",
    {
      field: "status",
      status: job.status,
    },
  );
};

const updateDraftJob = async ({
  recruiterUser,
  jobId,
  clientCompanyId,
  content = {},
} = {}) => {
  const context = await resolveRecruiterBusinessContext({
    user: recruiterUser,
    clientCompanyId,
  });

  const job = await loadJobForRecruiterMutation({
    jobId,
    companyId: context.companyId,
    primaryRecruiterCompanyMemberId: context.membership._id,
  });

  assertJobDraftContentMutable(job);

  const contentPatch = buildDraftContentPatch(content);

  if (Object.keys(contentPatch).length === 0) {
    return toPublicJob(job);
  }

  // Content-mutation boundary: only DRAFT content fields; ownership,
  // creator, Primary, status, and publishedAt stay outside this operation.
  const updatedJob = await Job.findOneAndUpdate(
    {
      _id: job._id,
      companyId: context.companyId,
      primaryRecruiterCompanyMemberId: context.membership._id,
      status: JOB_STATUS.DRAFT,
    },
    {
      $set: contentPatch,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedJob) {
    throw new AppError(
      409,
      "Job content can only be edited while the Job is DRAFT",
      {
        field: "status",
      },
    );
  }

  return toPublicJob(updatedJob);
};

const assertRequiredSubmitString = (value, field) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(400, `Job ${field} is required before submit`, {
      field,
    });
  }
};

const assertJobContentCompleteForLifecycle = (job) => {
  // BR-10: business completeness gate (not schema-required on DRAFT).
  assertRequiredSubmitString(job.title, "title");
  assertRequiredSubmitString(job.jobDescription, "jobDescription");
  assertRequiredSubmitString(job.salaryText, "salaryText");

  if (!Array.isArray(job.requiredSkills) || job.requiredSkills.length === 0) {
    throw new AppError(400, "Job requiredSkills is required before submit", {
      field: "requiredSkills",
    });
  }

  // BR-11: at least one FIELD and one POSITION.
  if (
    !Array.isArray(job.fieldCategoryIds) ||
    job.fieldCategoryIds.length === 0
  ) {
    throw new AppError(400, "Job fieldCategoryIds is required before submit", {
      field: "fieldCategoryIds",
    });
  }

  if (
    !Array.isArray(job.positionCategoryIds) ||
    job.positionCategoryIds.length === 0
  ) {
    throw new AppError(
      400,
      "Job positionCategoryIds is required before submit",
      {
        field: "positionCategoryIds",
      },
    );
  }

  // BR-12 / BR-13: exactly one Location and one Employment Type.
  if (job.location == null || job.location === "") {
    throw new AppError(400, "Job location is required before submit", {
      field: "location",
    });
  }

  if (job.employmentType == null || job.employmentType === "") {
    throw new AppError(400, "Job employmentType is required before submit", {
      field: "employmentType",
    });
  }

  // BR-14: at least one Work Mode.
  if (!Array.isArray(job.workModes) || job.workModes.length === 0) {
    throw new AppError(400, "Job workModes is required before submit", {
      field: "workModes",
    });
  }

  // BR-15: exactly one ExperienceLevel.
  if (job.experienceLevelId == null) {
    throw new AppError(400, "Job experienceLevelId is required before submit", {
      field: "experienceLevelId",
    });
  }

  if (job.applicationDeadline == null) {
    throw new AppError(
      400,
      "Job applicationDeadline is required before submit",
      {
        field: "applicationDeadline",
      },
    );
  }
};

const assertJobFixedVocabularyIntegrity = (job) => {
  // BR-12 / BR-16: Location is the fixed platform vocabulary (REMOTE excluded).
  if (!LOCATION_VALUES.has(job.location)) {
    throw new AppError(400, "Job location must be a canonical Location value", {
      field: "location",
    });
  }

  // BR-13 / BR-16.
  if (!EMPLOYMENT_TYPE_VALUES.has(job.employmentType)) {
    throw new AppError(
      400,
      "Job employmentType must be a canonical EmploymentType value",
      {
        field: "employmentType",
      },
    );
  }

  // BR-14 / BR-16.
  for (const workMode of job.workModes) {
    if (!WORK_MODE_VALUES.has(workMode)) {
      throw new AppError(
        400,
        "Job workModes must use canonical WorkMode values",
        {
          field: "workModes",
        },
      );
    }
  }
};

const assertJobCategoryIntegrity = async (job) => {
  const fieldIds = job.fieldCategoryIds.map((id) => id.toString());
  const positionIds = job.positionCategoryIds.map((id) => id.toString());
  const allIds = [...new Set([...fieldIds, ...positionIds])];

  const categories = await Category.find({
    _id: {
      $in: allIds,
    },
  });
  const categoriesById = new Map(
    categories.map((category) => [category._id.toString(), category]),
  );

  const fieldIdSet = new Set();

  for (const fieldId of fieldIds) {
    const category = categoriesById.get(fieldId);

    if (!category) {
      throw new AppError(400, "Job fieldCategoryIds references unknown Category", {
        field: "fieldCategoryIds",
      });
    }

    if (category.level !== CATEGORY_LEVEL.FIELD) {
      throw new AppError(
        400,
        "Job fieldCategoryIds must reference FIELD categories",
        {
          field: "fieldCategoryIds",
        },
      );
    }

    fieldIdSet.add(fieldId);
  }

  for (const positionId of positionIds) {
    const category = categoriesById.get(positionId);

    if (!category) {
      throw new AppError(
        400,
        "Job positionCategoryIds references unknown Category",
        {
          field: "positionCategoryIds",
        },
      );
    }

    if (category.level !== CATEGORY_LEVEL.POSITION) {
      throw new AppError(
        400,
        "Job positionCategoryIds must reference POSITION categories",
        {
          field: "positionCategoryIds",
        },
      );
    }

    // BR-11: each POSITION parent must be in the Job's selected FIELD set.
    const parentId =
      category.parentCategoryId == null
        ? null
        : category.parentCategoryId.toString();

    if (parentId == null || !fieldIdSet.has(parentId)) {
      throw new AppError(
        400,
        "Each Job POSITION Category must belong to a selected FIELD Category",
        {
          field: "positionCategoryIds",
        },
      );
    }
  }
};

const assertJobExperienceLevelIntegrity = async (job) => {
  // BR-15 / BR-16: ExperienceLevel must exist in the canonical V4 dataset.
  const experienceLevel = await ExperienceLevel.findById(job.experienceLevelId);

  if (!experienceLevel) {
    throw new AppError(
      400,
      "Job experienceLevelId must reference a canonical ExperienceLevel",
      {
        field: "experienceLevelId",
      },
    );
  }
};

const assertJobApplicationDeadlineActive = (job, now = new Date()) => {
  // BR-17: now < applicationDeadline.
  const deadline =
    job.applicationDeadline instanceof Date
      ? job.applicationDeadline
      : new Date(job.applicationDeadline);

  if (Number.isNaN(deadline.getTime()) || !(now.getTime() < deadline.getTime())) {
    throw new AppError(
      400,
      "Job applicationDeadline must be in the future",
      {
        field: "applicationDeadline",
      },
    );
  }
};

// BR-30: deadline is the source of truth for expiration semantics.
const getJobApplicationDeadline = (job) => {
  if (job == null || job.applicationDeadline == null) {
    return null;
  }

  const deadline =
    job.applicationDeadline instanceof Date
      ? job.applicationDeadline
      : new Date(job.applicationDeadline);

  if (Number.isNaN(deadline.getTime())) {
    return null;
  }

  return deadline;
};

const hasJobApplicationDeadlinePassed = (job, now = new Date()) => {
  const deadline = getJobApplicationDeadline(job);

  if (deadline == null) {
    return false;
  }

  return now.getTime() >= deadline.getTime();
};

// BR-30 / BR-31: persisted PUBLISHED past deadline is effectively EXPIRED even
// before lifecycle processing persists the transition.
const resolveEffectiveJobStatus = (job, now = new Date()) => {
  if (job == null) {
    return null;
  }

  if (
    job.status === JOB_STATUS.PUBLISHED &&
    hasJobApplicationDeadlinePassed(job, now)
  ) {
    return JOB_STATUS.EXPIRED;
  }

  return job.status;
};

const isJobEffectivelyPublished = (job, now = new Date()) => {
  return resolveEffectiveJobStatus(job, now) === JOB_STATUS.PUBLISHED;
};

// BR-30 / BR-31: same deadline rule as isJobEffectivelyPublished, evaluated by
// MongoDB at the conditional-write decision via $$NOW — not an application
// timestamp captured before async validation.
const APPLICATION_DEADLINE_STILL_FUTURE_AT_MUTATION = Object.freeze({
  $expr: Object.freeze({
    $gt: Object.freeze(["$applicationDeadline", "$$NOW"]),
  }),
});

// BR-35: owning Company must still be operationally active.
const isOwningCompanyActiveForPublicEligibility = (company) => {
  if (company == null) {
    return false;
  }

  return (
    company.approvalStatus === COMPANY_APPROVAL_STATUS.APPROVED &&
    company.operationalStatus === COMPANY_OPERATIONAL_STATUS.ACTIVE
  );
};

// F11 / BR-35 / BR-40: reusable public-eligibility boundary only. Not a
// discovery/search/Application surface.
const isJobPubliclyEligible = ({
  job,
  company,
  now = new Date(),
} = {}) => {
  if (job == null) {
    return false;
  }

  if (company == null) {
    return false;
  }

  // BR-35 / BR-38: only the Job's owning Company may establish eligibility.
  // A foreign APPROVED+ACTIVE Company must never make another tenant's Job
  // publicly eligible.
  const providedCompanyId = company._id ?? company.id;

  if (
    job.companyId == null ||
    providedCompanyId == null ||
    job.companyId.toString() !== providedCompanyId.toString()
  ) {
    return false;
  }

  // Effective PUBLISHED already requires now < applicationDeadline (BR-30/31).
  if (!isJobEffectivelyPublished(job, now)) {
    return false;
  }

  return isOwningCompanyActiveForPublicEligibility(company);
};

// F10 / TX-02: optional atomic persist of lifecycle expiration. Correctness of
// business expiration does not depend on this write having already occurred.
const expirePublishedJobIfDue = async ({
  jobId,
  now = new Date(),
} = {}) => {
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new AppError(400, "Invalid Job id", {
      field: "jobId",
    });
  }

  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  if (job.status !== JOB_STATUS.PUBLISHED) {
    throw new AppError(
      409,
      "Only PUBLISHED Jobs may transition to EXPIRED",
      {
        field: "status",
        status: job.status,
      },
    );
  }

  if (!hasJobApplicationDeadlinePassed(job, now)) {
    throw new AppError(
      409,
      "Job applicationDeadline has not been reached",
      {
        field: "applicationDeadline",
      },
    );
  }

  // TX-02 / BR-32: status-only atomic transition. Ownership, creator, Primary,
  // publishedAt, and content remain unchanged. EXPIRED is retained (no
  // hard-delete) and terminal in V5 (no reopen).
  const updatedJob = await Job.findOneAndUpdate(
    {
      _id: job._id,
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: {
        $ne: null,
        $lte: now,
      },
    },
    {
      $set: {
        status: JOB_STATUS.EXPIRED,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedJob) {
    throw new AppError(
      409,
      "Only PUBLISHED Jobs past applicationDeadline may transition to EXPIRED",
      {
        field: "status",
      },
    );
  }

  return toPublicJob(updatedJob);
};

// Canonical lifecycle readiness gate: submit and approve/publish revalidation.
// Completeness is separate from create/edit DRAFT validation.
const assertJobReadyForApprovalLifecycle = async (
  job,
  {
    now = new Date(),
  } = {},
) => {
  assertJobContentCompleteForLifecycle(job);
  assertJobFixedVocabularyIntegrity(job);
  await assertJobCategoryIntegrity(job);
  await assertJobExperienceLevelIntegrity(job);
  assertJobApplicationDeadlineActive(job, now);
};

// BR-07: Recruiter membership must be operational and same-Company as the Job.
const assertRecruiterMembershipValidForJobPrimary = async ({
  membershipId,
  jobCompanyId,
  field = "primaryRecruiterCompanyMemberId",
  invalidMessage = "Primary Recruiter must be a valid active Recruiter of the Job Company",
} = {}) => {
  const membership = await CompanyMember.findById(membershipId);

  if (!membership) {
    throw new AppError(409, invalidMessage, {
      field,
    });
  }

  if (membership.role !== COMPANY_MEMBER_ROLE.RECRUITER) {
    throw new AppError(409, invalidMessage, {
      field,
    });
  }

  if (membership.companyId.toString() !== jobCompanyId.toString()) {
    throw new AppError(
      409,
      "Job Primary Recruiter must belong to the Job Company",
      {
        field,
      },
    );
  }

  if (membership.status !== COMPANY_MEMBER_STATUS.ACTIVE) {
    throw new AppError(409, invalidMessage, {
      field,
      status: membership.status,
    });
  }

  const user = await User.findById(membership.userId);

  if (!user || user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(409, invalidMessage, {
      field,
    });
  }

  return membership;
};

// BR-07 / BR-22: current Primary must remain an operational Recruiter of Job.companyId.
const assertJobPrimaryRecruiterValidForLifecycle = async (job) => {
  await assertRecruiterMembershipValidForJobPrimary({
    membershipId: job.primaryRecruiterCompanyMemberId,
    jobCompanyId: job.companyId,
    invalidMessage: "Job Primary Recruiter is no longer valid",
  });
};

const assertJobDraftSubmittable = (job) => {
  if (job.status === JOB_STATUS.DRAFT) {
    return;
  }

  throw new AppError(409, "Job can only be submitted while DRAFT", {
    field: "status",
    status: job.status,
  });
};

const submitDraftJob = async ({
  recruiterUser,
  jobId,
  clientCompanyId,
  now = new Date(),
} = {}) => {
  // BR-01 / BR-18 / BR-38: trusted Recruiter membership + Company ACTIVE.
  const context = await resolveRecruiterBusinessContext({
    user: recruiterUser,
    clientCompanyId,
  });

  const job = await loadJobForRecruiterMutation({
    jobId,
    companyId: context.companyId,
    primaryRecruiterCompanyMemberId: context.membership._id,
  });

  assertJobDraftSubmittable(job);
  await assertJobReadyForApprovalLifecycle(job, {
    now,
  });

  // Persist only the lifecycle transition; content/ownership/creator/Primary
  // remain unchanged. Bind the write to the validated submit-relevant content
  // snapshot (plus updatedAt as a cheap revision hint). Content equality is
  // required because timestamp resolution alone cannot prove content identity.
  const updatedJob = await Job.findOneAndUpdate(
    {
      _id: job._id,
      companyId: context.companyId,
      primaryRecruiterCompanyMemberId: context.membership._id,
      status: JOB_STATUS.DRAFT,
      updatedAt: job.updatedAt,
      ...buildValidatedDraftContentMatch(job),
    },
    {
      $set: {
        status: JOB_STATUS.PENDING_APPROVAL,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedJob) {
    const currentJob = await Job.findById(job._id).select("status").lean();

    if (currentJob?.status === JOB_STATUS.DRAFT) {
      throw new AppError(
        409,
        "Job content changed before submit could complete",
        {
          field: "content",
        },
      );
    }

    throw new AppError(409, "Job can only be submitted while DRAFT", {
      field: "status",
    });
  }

  return toPublicJob(updatedJob);
};

const findOutstandingPrimaryResponsibility = async ({
  companyId,
  primaryRecruiterCompanyMemberId,
  now = new Date(),
} = {}) => {
  // BR-41 with BR-30/BR-31: DRAFT/PENDING always block; PUBLISHED blocks only
  // while still effectively published (deadline not yet reached). Persisted
  // PUBLISHED past deadline is treated as finished even before EXPIRED write.
  return Job.findOne({
    companyId,
    primaryRecruiterCompanyMemberId,
    status: {
      $in: OUTSTANDING_PRIMARY_JOB_STATUSES,
    },
    $nor: [
      {
        status: JOB_STATUS.PUBLISHED,
        applicationDeadline: {
          $ne: null,
          $lte: now,
        },
      },
    ],
  })
    .select("_id status applicationDeadline")
    .lean();
};

const assertNoOutstandingPrimaryResponsibility = async ({
  companyId,
  primaryRecruiterCompanyMemberId,
  now = new Date(),
} = {}) => {
  // BR-41: CLOSED/EXPIRED (persisted or effective) are not outstanding.
  const outstanding = await findOutstandingPrimaryResponsibility({
    companyId,
    primaryRecruiterCompanyMemberId,
    now,
  });

  if (outstanding) {
    throw new AppError(
      409,
      "Recruiter has outstanding Primary Job responsibility",
      {
        field: "primaryRecruiterCompanyMemberId",
        jobId: outstanding._id.toString(),
        jobStatus: outstanding.status,
      },
    );
  }
};

// BR-36 / BR-37: canonical Company-scoped internal visibility filter. Creator
// / historical Primary are intentionally absent (BR-43). Not for public
// discovery. DRAFT remains private to the current Primary Recruiter.
const buildInternalJobVisibilityFilter = ({
  companyId,
  companyRole,
  membershipId,
} = {}) => {
  if (companyRole === COMPANY_MEMBER_ROLE.COMPANY_MANAGER) {
    return {
      companyId,
      status: {
        $in: [...COMPANY_MANAGER_INTERNAL_VISIBLE_JOB_STATUSES],
      },
    };
  }

  if (companyRole === COMPANY_MEMBER_ROLE.RECRUITER) {
    return {
      companyId,
      $or: [
        {
          primaryRecruiterCompanyMemberId: membershipId,
        },
        {
          status: JOB_STATUS.PUBLISHED,
        },
      ],
    };
  }

  throw new AppError(403, "Job internal visibility is not available", {
    field: "role",
  });
};

const isJobInternallyVisible = ({
  job,
  companyRole,
  membershipId,
} = {}) => {
  if (companyRole === COMPANY_MEMBER_ROLE.COMPANY_MANAGER) {
    return COMPANY_MANAGER_INTERNAL_VISIBLE_JOB_STATUSES.includes(job.status);
  }

  if (companyRole === COMPANY_MEMBER_ROLE.RECRUITER) {
    if (
      job.primaryRecruiterCompanyMemberId.toString() ===
      membershipId.toString()
    ) {
      return true;
    }

    return job.status === JOB_STATUS.PUBLISHED;
  }

  return false;
};

const assertJobInternallyVisible = ({
  job,
  companyRole,
  membershipId,
} = {}) => {
  if (
    isJobInternallyVisible({
      job,
      companyRole,
      membershipId,
    })
  ) {
    return;
  }

  // BR-36 / BR-43: same-Company peer DRAFT/PENDING/CLOSED/EXPIRED and
  // historical creator/old-Primary association do not authorize visibility.
  throw new AppError(403, "Job is not visible to the current actor", {
    field: "jobId",
  });
};

// BR-20 / F05: approval-decision authority only. Does not persist approve,
// reject, or any review/marker state — F06/F07 own those transitions.
const assertCompanyManagerJobApprovalAuthority = ({
  job,
  companyRole,
  tenantCompanyId,
} = {}) => {
  if (companyRole !== COMPANY_MEMBER_ROLE.COMPANY_MANAGER) {
    throw new AppError(
      403,
      "Only the Company Manager can approve or reject the Job",
      {
        field: "role",
      },
    );
  }

  // BR-38: Job id / foreign company association alone do not authorize.
  assertSameCompanyTenant({
    resourceCompanyId: job.companyId,
    tenantCompanyId,
  });

  if (job.status !== JOB_STATUS.PENDING_APPROVAL) {
    throw new AppError(
      409,
      "Job must be PENDING_APPROVAL for approval decisions",
      {
        field: "status",
        status: job.status,
      },
    );
  }
};

// BR-33 / BR-34 / F12: manual hard-delete authority depends on lifecycle state.
// Distinct from F07 reject (PENDING_APPROVAL outcome) but shares TX-04 delete.
// Historical creator / former Primary do not authorize (BR-43).
const assertPrePublicationDeleteAuthority = ({
  job,
  companyRole,
  membershipId,
  tenantCompanyId,
} = {}) => {
  // BR-38: Job id / foreign company association alone do not authorize.
  assertSameCompanyTenant({
    resourceCompanyId: job.companyId,
    tenantCompanyId,
  });

  if (!PRE_PUBLICATION_DELETABLE_JOB_STATUSES.includes(job.status)) {
    // BR-32: publication establishes a historical boundary; CLOSED/EXPIRED
    // remain non-deletable terminal historical states.
    throw new AppError(
      409,
      "Only DRAFT or PENDING_APPROVAL Jobs that have never been published may be deleted",
      {
        field: "status",
        status: job.status,
      },
    );
  }

  if (job.status === JOB_STATUS.DRAFT) {
    if (
      companyRole === COMPANY_MEMBER_ROLE.RECRUITER &&
      job.primaryRecruiterCompanyMemberId.toString() ===
        membershipId.toString()
    ) {
      return;
    }

    throw new AppError(
      403,
      "Only the current Primary Recruiter can delete a DRAFT Job",
      {
        field: "role",
      },
    );
  }

  // PENDING_APPROVAL: manual hard-delete is Company Manager only. Recruiter
  // (including current Primary) is denied. F07 reject remains a separate
  // CM-only path that also uses TX-04.
  if (companyRole === COMPANY_MEMBER_ROLE.COMPANY_MANAGER) {
    return;
  }

  throw new AppError(
    403,
    "Only the Company Manager can delete a PENDING_APPROVAL Job",
    {
      field: "role",
    },
  );
};

// TX-04: single-document physical delete. Shared by F07 reject and F12 manual
// delete — no separate soft-delete / deletion-record persistence layer.
const hardDeleteJobDocument = async ({
  jobId,
  companyId,
  statuses,
  primaryRecruiterCompanyMemberId = undefined,
} = {}) => {
  const filter = {
    _id: jobId,
    companyId,
    status: {
      $in: statuses,
    },
  };

  if (primaryRecruiterCompanyMemberId != null) {
    filter.primaryRecruiterCompanyMemberId = primaryRecruiterCompanyMemberId;
  }

  return Job.findOneAndDelete(filter);
};

const approveAndPublishJob = async ({
  managerUser,
  jobId,
  clientCompanyId,
  now = new Date(),
} = {}) => {
  // BR-20 / BR-38 / Company validity: trusted CM membership + APPROVED/ACTIVE.
  const context = await resolveCompanyManagerRecruiterManagementContext({
    user: managerUser,
    clientCompanyId,
  });

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new AppError(400, "Invalid Job id", {
      field: "jobId",
    });
  }

  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  assertCompanyManagerJobApprovalAuthority({
    job,
    companyRole: context.companyRole,
    tenantCompanyId: context.companyId,
  });

  // BR-22: revalidate conditions that can change after submit.
  await assertJobPrimaryRecruiterValidForLifecycle(job);
  await assertJobReadyForApprovalLifecycle(job, {
    now,
  });

  // TX-01 / BR-21: single-document atomic PUBLISHED + publishedAt. No
  // intermediate APPROVED state. Content/ownership/creator/Primary unchanged.
  // BR-24 / BR-32: publish freezes content and establishes historical boundary.
  const updatedJob = await Job.findOneAndUpdate(
    {
      _id: job._id,
      companyId: context.companyId,
      status: JOB_STATUS.PENDING_APPROVAL,
      publishedAt: null,
    },
    {
      $set: {
        status: JOB_STATUS.PUBLISHED,
        publishedAt: now,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedJob) {
    throw new AppError(
      409,
      "Job must be PENDING_APPROVAL for approval decisions",
      {
        field: "status",
      },
    );
  }

  return toPublicJob(updatedJob);
};

const rejectPendingJob = async ({
  managerUser,
  jobId,
  clientCompanyId,
} = {}) => {
  // BR-20 / BR-38: trusted CM membership; Job id / client companyId do not
  // authorize.
  const context = await resolveCompanyManagerRecruiterManagementContext({
    user: managerUser,
    clientCompanyId,
  });

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new AppError(400, "Invalid Job id", {
      field: "jobId",
    });
  }

  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  assertCompanyManagerJobApprovalAuthority({
    job,
    companyRole: context.companyRole,
    tenantCompanyId: context.companyId,
  });

  // TX-04 / BR-23: physical delete only while still PENDING_APPROVAL. No
  // REJECTED state, rejection metadata, soft-delete flags, or cascade writes
  // to Company / CompanyMember / Category / ExperienceLevel.
  const deletedJob = await hardDeleteJobDocument({
    jobId: job._id,
    companyId: context.companyId,
    statuses: [JOB_STATUS.PENDING_APPROVAL],
  });

  if (!deletedJob) {
    throw new AppError(
      409,
      "Job must be PENDING_APPROVAL for approval decisions",
      {
        field: "status",
      },
    );
  }

  return {
    id: deletedJob._id.toString(),
  };
};

const deletePrePublicationJob = async ({
  actorUser,
  jobId,
  clientCompanyId,
} = {}) => {
  // BR-33 / BR-34 / BR-38: membership-derived tenant; client companyId / Job id
  // alone do not authorize. Authority is lifecycle-state dependent.
  const context = await resolveCompanyStaffBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new AppError(400, "Invalid Job id", {
      field: "jobId",
    });
  }

  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  assertPrePublicationDeleteAuthority({
    job,
    companyRole: context.companyRole,
    membershipId: context.membership._id,
    tenantCompanyId: context.companyId,
  });

  // TX-04 / BR-32 / BR-33: conditional physical delete for the authorized
  // lifecycle state at mutation time. Stale requests after submit/publish/
  // authority change cannot delete. No DELETED state, isDeleted, deletedAt,
  // or cascade into Company / CompanyMember / Category / ExperienceLevel.
  const deleteFilter =
    job.status === JOB_STATUS.DRAFT
      ? {
          jobId: job._id,
          companyId: context.companyId,
          statuses: [JOB_STATUS.DRAFT],
          primaryRecruiterCompanyMemberId: context.membership._id,
        }
      : {
          jobId: job._id,
          companyId: context.companyId,
          statuses: [JOB_STATUS.PENDING_APPROVAL],
        };

  const deletedJob = await hardDeleteJobDocument(deleteFilter);

  if (!deletedJob) {
    throw new AppError(
      409,
      "Only DRAFT or PENDING_APPROVAL Jobs that have never been published may be deleted",
      {
        field: "status",
      },
    );
  }

  return {
    id: deletedJob._id.toString(),
  };
};

// BR-26 / F08: CM may reassign Primary only while the Job is effectively
// PUBLISHED (BR-30/BR-31: persisted PUBLISHED past deadline is EXPIRED).
const assertCompanyManagerPrimaryReassignmentAuthority = ({
  job,
  companyRole,
  tenantCompanyId,
  now = new Date(),
} = {}) => {
  if (companyRole !== COMPANY_MEMBER_ROLE.COMPANY_MANAGER) {
    throw new AppError(
      403,
      "Only the Company Manager can reassign the Job Primary Recruiter",
      {
        field: "role",
      },
    );
  }

  // BR-38 / BR-43: Job id, creator, or former-Primary association alone do not
  // authorize reassignment.
  assertSameCompanyTenant({
    resourceCompanyId: job.companyId,
    tenantCompanyId,
  });

  if (!isJobEffectivelyPublished(job, now)) {
    throw new AppError(
      409,
      "Job Primary Recruiter can only be reassigned while PUBLISHED",
      {
        field: "status",
        status: resolveEffectiveJobStatus(job, now),
      },
    );
  }
};

const reassignPrimaryRecruiter = async ({
  managerUser,
  jobId,
  clientCompanyId,
  primaryRecruiterCompanyMemberId,
  now = new Date(),
} = {}) => {
  // BR-38: trusted CM membership; client companyId / Job id do not authorize.
  const context = await resolveCompanyManagerRecruiterManagementContext({
    user: managerUser,
    clientCompanyId,
  });

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new AppError(400, "Invalid Job id", {
      field: "jobId",
    });
  }

  if (!mongoose.Types.ObjectId.isValid(primaryRecruiterCompanyMemberId)) {
    throw new AppError(400, "Invalid Primary Recruiter CompanyMember id", {
      field: "primaryRecruiterCompanyMemberId",
    });
  }

  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  // Early rejection only; mutation-boundary $$NOW is the final deadline guard.
  assertCompanyManagerPrimaryReassignmentAuthority({
    job,
    companyRole: context.companyRole,
    tenantCompanyId: context.companyId,
    now,
  });

  // BR-06 / BR-07 / BR-27: new Primary must be one valid same-Company Recruiter.
  // Cross-tenant membership ids are rejected here; they do not authorize.
  await assertRecruiterMembershipValidForJobPrimary({
    membershipId: primaryRecruiterCompanyMemberId,
    jobCompanyId: job.companyId,
  });

  // TX-03 / BR-05 / BR-26 / BR-30 / BR-31: atomic single-field update only while
  // still effectively PUBLISHED. $$NOW is evaluated when MongoDB decides the
  // write so a deadline-crossing race after this operation started cannot
  // reassign. Creator, company ownership, content, status, and publishedAt
  // remain unchanged. No CompanyMember mutation or Primary history document.
  const updatedJob = await Job.findOneAndUpdate(
    {
      _id: job._id,
      companyId: context.companyId,
      status: JOB_STATUS.PUBLISHED,
      ...APPLICATION_DEADLINE_STILL_FUTURE_AT_MUTATION,
    },
    {
      $set: {
        primaryRecruiterCompanyMemberId,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedJob) {
    throw new AppError(
      409,
      "Job Primary Recruiter can only be reassigned while PUBLISHED",
      {
        field: "status",
      },
    );
  }

  return toPublicJob(updatedJob);
};

// BR-28 / F09: close authority is current Primary Recruiter or owning Company
// Manager. Peer Recruiters, creators, and former Primaries do not authorize.
// BR-30 / BR-31: effectively expired PUBLISHED Jobs are not closeable.
const assertManualCloseJobAuthority = ({
  job,
  companyRole,
  membershipId,
  tenantCompanyId,
  now = new Date(),
} = {}) => {
  // BR-38: Job id / client companyId alone do not authorize.
  assertSameCompanyTenant({
    resourceCompanyId: job.companyId,
    tenantCompanyId,
  });

  if (!isJobEffectivelyPublished(job, now)) {
    throw new AppError(409, "Job can only be closed while PUBLISHED", {
      field: "status",
      status: resolveEffectiveJobStatus(job, now),
    });
  }

  if (companyRole === COMPANY_MEMBER_ROLE.COMPANY_MANAGER) {
    return;
  }

  if (
    companyRole === COMPANY_MEMBER_ROLE.RECRUITER &&
    job.primaryRecruiterCompanyMemberId.toString() === membershipId.toString()
  ) {
    return;
  }

  throw new AppError(
    403,
    "Only the current Primary Recruiter or Company Manager can close the Job",
    {
      field: "role",
    },
  );
};

const closePublishedJob = async ({
  actorUser,
  jobId,
  clientCompanyId,
  now = new Date(),
} = {}) => {
  // BR-38: membership-derived tenant; client companyId cannot expand authority.
  const context = await resolveCompanyStaffBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new AppError(400, "Invalid Job id", {
      field: "jobId",
    });
  }

  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  // Early rejection only; mutation-boundary $$NOW is the final deadline guard.
  assertManualCloseJobAuthority({
    job,
    companyRole: context.companyRole,
    membershipId: context.membership._id,
    tenantCompanyId: context.companyId,
    now,
  });

  // TX-02 / BR-29 / BR-30 / BR-31 / BR-32: atomic effectively-PUBLISHED → CLOSED.
  // $$NOW is evaluated when MongoDB decides the write so a deadline-crossing
  // race after this operation started cannot turn an expired Job into CLOSED.
  // Ownership, creator, current Primary, publishedAt, and content stay
  // unchanged. CLOSED is retained (no hard-delete) and is terminal in V5
  // (no reopen).
  const updatedJob = await Job.findOneAndUpdate(
    {
      _id: job._id,
      companyId: context.companyId,
      status: JOB_STATUS.PUBLISHED,
      ...APPLICATION_DEADLINE_STILL_FUTURE_AT_MUTATION,
    },
    {
      $set: {
        status: JOB_STATUS.CLOSED,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedJob) {
    throw new AppError(409, "Job can only be closed while PUBLISHED", {
      field: "status",
    });
  }

  return toPublicJob(updatedJob);
};

const listInternalJobs = async ({ actorUser, clientCompanyId } = {}) => {
  const context = await resolveCompanyStaffBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  const filter = buildInternalJobVisibilityFilter({
    companyId: context.companyId,
    companyRole: context.companyRole,
    membershipId: context.membership._id,
  });

  const jobs = await Job.find(filter).sort({
    createdAt: 1,
    _id: 1,
  });

  return jobs.map((job) => toPublicJob(job));
};

const getInternalJob = async ({
  actorUser,
  jobId,
  clientCompanyId,
} = {}) => {
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new AppError(400, "Invalid Job id", {
      field: "jobId",
    });
  }

  const context = await resolveCompanyStaffBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  // BR-38: Job id alone does not authorize cross-tenant access.
  assertSameCompanyTenant({
    resourceCompanyId: job.companyId,
    tenantCompanyId: context.companyId,
  });

  assertJobInternallyVisible({
    job,
    companyRole: context.companyRole,
    membershipId: context.membership._id,
  });

  return toPublicJob(job);
};

export {
  approveAndPublishJob,
  assertCompanyManagerJobApprovalAuthority,
  assertCompanyManagerPrimaryReassignmentAuthority,
  assertJobInternallyVisible,
  assertJobPrimaryRecruiterValidForLifecycle,
  assertJobReadyForApprovalLifecycle,
  assertManualCloseJobAuthority,
  assertNoOutstandingPrimaryResponsibility,
  assertPrePublicationDeleteAuthority,
  assertRecruiterMembershipValidForJobPrimary,
  buildInternalJobVisibilityFilter,
  closePublishedJob,
  createDraftJob,
  deletePrePublicationJob,
  expirePublishedJobIfDue,
  findOutstandingPrimaryResponsibility,
  getInternalJob,
  getJobApplicationDeadline,
  hasJobApplicationDeadlinePassed,
  isJobEffectivelyPublished,
  isJobInternallyVisible,
  isJobPubliclyEligible,
  isOwningCompanyActiveForPublicEligibility,
  listInternalJobs,
  reassignPrimaryRecruiter,
  rejectPendingJob,
  resolveEffectiveJobStatus,
  submitDraftJob,
  toPublicJob,
  updateDraftJob,
};
