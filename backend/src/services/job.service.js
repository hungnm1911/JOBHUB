import mongoose from "mongoose";

import EMPLOYMENT_TYPE from "../constants/employment-type.js";
import JOB_STATUS, {
  OUTSTANDING_PRIMARY_JOB_STATUSES,
} from "../constants/job-status.js";
import LOCATION from "../constants/location.js";
import WORK_MODE from "../constants/work-mode.js";
import Job from "../models/job.model.js";
import {
  assertSameCompanyTenant,
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

  // BR-09: only current Primary Recruiter may edit DRAFT content.
  if (
    job.primaryRecruiterCompanyMemberId.toString() !==
    primaryRecruiterCompanyMemberId.toString()
  ) {
    throw new AppError(403, "Only the Primary Recruiter can edit this Job", {
      field: "primaryRecruiterCompanyMemberId",
    });
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

const findOutstandingPrimaryResponsibility = async ({
  companyId,
  primaryRecruiterCompanyMemberId,
} = {}) => {
  return Job.findOne({
    companyId,
    primaryRecruiterCompanyMemberId,
    status: {
      $in: OUTSTANDING_PRIMARY_JOB_STATUSES,
    },
  })
    .select("_id status")
    .lean();
};

const assertNoOutstandingPrimaryResponsibility = async ({
  companyId,
  primaryRecruiterCompanyMemberId,
} = {}) => {
  // BR-41: blocking statuses only; CLOSED/EXPIRED are not outstanding.
  const outstanding = await findOutstandingPrimaryResponsibility({
    companyId,
    primaryRecruiterCompanyMemberId,
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

export {
  assertNoOutstandingPrimaryResponsibility,
  createDraftJob,
  findOutstandingPrimaryResponsibility,
  toPublicJob,
  updateDraftJob,
};
