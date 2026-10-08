import mongoose from "mongoose";

import CATEGORY_LEVEL from "../constants/category-level.js";
import COMPANY_APPROVAL_STATUS from "../constants/company-approval-status.js";
import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../constants/company-operational-status.js";
import EMPLOYMENT_TYPE from "../constants/employment-type.js";
import JOB_DISCOVERY_SORT from "../constants/job-discovery-sort.js";
import JOB_DISCOVERY_VISIBILITY from "../constants/job-discovery-visibility.js";
import JOB_STATUS from "../constants/job-status.js";
import USER_ROLE from "../constants/user-role.js";
import WORK_MODE from "../constants/work-mode.js";
import Category from "../models/category.model.js";
import Company from "../models/company.model.js";
import CompanyMember from "../models/company-member.model.js";
import ExperienceLevel from "../models/experience-level.model.js";
import Job from "../models/job.model.js";
import {
  resolveJobDiscoveryVisibility,
  toPublicJobLocation,
  toPublicJobSalary,
} from "./job.service.js";
import { normalizeLocationFilterSelections } from "./location.service.js";
import AppError from "../utils/app-error.js";
import { escapeRegex } from "../utils/escape-regex.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const EMPLOYMENT_TYPE_VALUES = new Set(Object.values(EMPLOYMENT_TYPE));
const WORK_MODE_VALUES = new Set(Object.values(WORK_MODE));

const normalizeArray = (values, field, { allowedValues = null } = {}) => {
  if (values == null) {
    return [];
  }

  const rawValues = Array.isArray(values) ? values : [values];
  const normalized = [];
  const seen = new Set();

  for (const rawValue of rawValues) {
    if (typeof rawValue !== "string") {
      throw new AppError(400, `${field} must contain strings`, { field });
    }

    for (const entry of rawValue.split(",")) {
      const trimmed = entry.trim();

      if (trimmed === "" || seen.has(trimmed)) {
        continue;
      }

      if (allowedValues && !allowedValues.has(trimmed)) {
        throw new AppError(400, `Invalid ${field} entry`, { field });
      }

      seen.add(trimmed);
      normalized.push(trimmed);
    }
  }

  return normalized;
};

const normalizeObjectIds = (values, field) => {
  const normalized = normalizeArray(values, field);

  for (const value of normalized) {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new AppError(400, `Invalid ${field} entry`, { field });
    }
  }

  return normalized.map((value) => new mongoose.Types.ObjectId(value));
};

const normalizePageValue = (value, field, fallback, maximum = Infinity) => {
  if (value == null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new AppError(400, `${field} must be a positive integer`, { field });
  }

  return parsed;
};

const normalizeKeyword = (value) => {
  if (value == null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new AppError(400, "keyword must be a string", {
      field: "keyword",
    });
  }

  return value.trim();
};

const resolveCategoryBranches = async (categoryBranches) => {
  if (categoryBranches == null) {
    return [];
  }

  if (!Array.isArray(categoryBranches)) {
    throw new AppError(400, "categories must be an array", {
      field: "categories",
    });
  }

  if (categoryBranches.length === 0) {
    return [];
  }

  const normalizedEntries = categoryBranches.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new AppError(400, "Each categories entry must be an object", {
        field: "categories",
      });
    }

    const fieldId = entry.fieldId ?? entry.fieldCategoryId;
    const positionIds = entry.positionIds ?? entry.positionCategoryIds ?? [];

    if (!mongoose.Types.ObjectId.isValid(fieldId)) {
      throw new AppError(400, "categories entries require a valid fieldId", {
        field: "categories",
      });
    }

    if (!Array.isArray(positionIds)) {
      throw new AppError(400, "categories positionIds must be an array", {
        field: "categories",
      });
    }

    return {
      fieldId: new mongoose.Types.ObjectId(fieldId),
      positionIds: normalizeObjectIds(positionIds, "categories"),
    };
  });

  const allCategoryIds = [
    ...new Set(
      normalizedEntries.flatMap(({ fieldId, positionIds }) => [
        fieldId.toString(),
        ...positionIds.map((id) => id.toString()),
      ]),
    ),
  ];
  const categories = await Category.find({
    _id: { $in: allCategoryIds },
  })
    .select("_id level parentCategoryId")
    .lean();
  const categoryById = new Map(
    categories.map((category) => [category._id.toString(), category]),
  );

  if (categories.length !== allCategoryIds.length) {
    throw new AppError(400, "categories references unknown Category", {
      field: "categories",
    });
  }

  return normalizedEntries.map(({ fieldId, positionIds }) => {
    const field = categoryById.get(fieldId.toString());

    if (field.level !== CATEGORY_LEVEL.FIELD) {
      throw new AppError(400, "categories fieldId must reference FIELD", {
        field: "categories",
      });
    }

    for (const positionId of positionIds) {
      const position = categoryById.get(positionId.toString());

      if (
        position.level !== CATEGORY_LEVEL.POSITION ||
        position.parentCategoryId?.toString() !== fieldId.toString()
      ) {
        throw new AppError(
          400,
          "Each selected Position must belong to its Field",
          { field: "categories" },
        );
      }
    }

    return {
      fieldId,
      positionIds,
    };
  });
};

const assertJobDiscoveryActor = async (user) => {
  if (!user) {
    return;
  }

  if (
    ![
      USER_ROLE.CANDIDATE,
      USER_ROLE.COMPANY_STAFF,
      USER_ROLE.PLATFORM_ADMIN,
    ].includes(user.role)
  ) {
    throw new AppError(403, "Job Discovery access is not available for this actor", {
      field: "role",
    });
  }

  if (user.role !== USER_ROLE.COMPANY_STAFF) {
    return;
  }

  const managerMembership = await CompanyMember.findOne({
    userId: user._id,
    role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    status: COMPANY_MEMBER_STATUS.ACTIVE,
  })
    .select("_id")
    .lean();

  if (managerMembership) {
    throw new AppError(403, "Company Manager access is not available in V8", {
      field: "role",
    });
  }

  const recruiterMembership = await CompanyMember.findOne({
    userId: user._id,
    role: COMPANY_MEMBER_ROLE.RECRUITER,
    status: COMPANY_MEMBER_STATUS.ACTIVE,
  })
    .select("_id")
    .lean();

  if (!recruiterMembership) {
    throw new AppError(403, "Recruiter access is required for Job Discovery", {
      field: "role",
    });
  }
};

const buildPublicCompany = (company) => {
  return {
    id: company._id.toString(),
    name: company.name,
    logoUrl: company.logoUrl,
    bannerUrl: company.bannerUrl,
    website: company.website,
    address: company.address,
    description: company.description,
    contactInfo: company.contactInfo,
  };
};

const buildPublicCompanySummary = (company) => {
  return {
    id: company._id.toString(),
    name: company.name,
    logoUrl: company.logoUrl,
  };
};

const buildPublicCategory = (category) => {
  if (!category) {
    return null;
  }

  return {
    id: category._id.toString(),
    name: category.name,
    level: category.level,
    parentCategoryId:
      category.parentCategoryId == null
        ? null
        : category.parentCategoryId.toString(),
  };
};

const buildPublicExperienceLevel = (experienceLevel) => {
  if (!experienceLevel) {
    return null;
  }

  return {
    id: experienceLevel._id.toString(),
    code: experienceLevel.code,
  };
};

const buildPublicJob = ({
  job,
  company,
  categoryById,
  experienceLevelById,
  visibility,
  detail = false,
}) => {
  const publicJob = {
    id: job._id.toString(),
    title: job.title,
    company: detail
      ? buildPublicCompany(company)
      : buildPublicCompanySummary(company),
    fieldCategories: job.fieldCategoryIds
      .map((id) => buildPublicCategory(categoryById.get(id.toString())))
      .filter(Boolean),
    positionCategories: job.positionCategoryIds
      .map((id) => buildPublicCategory(categoryById.get(id.toString())))
      .filter(Boolean),
    location: toPublicJobLocation(job.location),
    workModes: job.workModes,
    employmentType: job.employmentType,
    experienceLevel: buildPublicExperienceLevel(
      experienceLevelById.get(job.experienceLevelId?.toString()),
    ),
    salary: toPublicJobSalary(job.salary),
    publishedAt: job.publishedAt,
    applicationDeadline: job.applicationDeadline,
    status: job.status,
    effectiveState: visibility,
    isHistoricalReadOnly:
      visibility === JOB_DISCOVERY_VISIBILITY.HISTORICAL_READ_ONLY,
    isAcceptingApplications:
      visibility === JOB_DISCOVERY_VISIBILITY.DISCOVERABLE,
  };

  if (detail) {
    publicJob.jobDescription = job.jobDescription;
    publicJob.requiredSkills = job.requiredSkills;
  }

  return publicJob;
};

const buildRelevanceRank = ({ job, company, keyword }) => {
  const pattern = new RegExp(escapeRegex(keyword), "i");

  if (pattern.test(job.title ?? "")) {
    return 4;
  }

  if (job.requiredSkills?.some((skill) => pattern.test(skill))) {
    return 3;
  }

  if (pattern.test(company.name ?? "")) {
    return 2;
  }

  if (pattern.test(job.jobDescription ?? "")) {
    return 1;
  }

  return 0;
};

const compareObjectIdsDescending = (left, right) => {
  return right._id.toString().localeCompare(left._id.toString());
};

const sortDiscoveryJobs = ({ jobs, companyById, sort, keyword }) => {
  return [...jobs].sort((left, right) => {
    if (sort === JOB_DISCOVERY_SORT.RELEVANCE && keyword !== "") {
      const rankDifference =
        buildRelevanceRank({
          job: right,
          company: companyById.get(right.companyId.toString()),
          keyword,
        }) -
        buildRelevanceRank({
          job: left,
          company: companyById.get(left.companyId.toString()),
          keyword,
        });

      if (rankDifference !== 0) {
        return rankDifference;
      }
    } else if (sort === JOB_DISCOVERY_SORT.EXPIRING_SOON) {
      const deadlineDifference =
        left.applicationDeadline.getTime() - right.applicationDeadline.getTime();

      if (deadlineDifference !== 0) {
        return deadlineDifference;
      }
    } else {
      const publishedDifference =
        right.publishedAt.getTime() - left.publishedAt.getTime();

      if (publishedDifference !== 0) {
        return publishedDifference;
      }
    }

    return compareObjectIdsDescending(left, right);
  });
};

const getDiscoveryCatalogData = async (jobs) => {
  const categoryIds = [
    ...new Set(
      jobs.flatMap((job) => [
        ...job.fieldCategoryIds,
        ...job.positionCategoryIds,
      ]).map((id) => id.toString()),
    ),
  ];
  const experienceLevelIds = [
    ...new Set(
      jobs
        .map((job) => job.experienceLevelId)
        .filter(Boolean)
        .map((id) => id.toString()),
    ),
  ];

  const [categories, experienceLevels] = await Promise.all([
    Category.find({ _id: { $in: categoryIds } })
      .select("_id name level parentCategoryId")
      .lean(),
    ExperienceLevel.find({ _id: { $in: experienceLevelIds } })
      .select("_id code")
      .lean(),
  ]);

  return {
    categoryById: new Map(
      categories.map((category) => [category._id.toString(), category]),
    ),
    experienceLevelById: new Map(
      experienceLevels.map((level) => [level._id.toString(), level]),
    ),
  };
};

const buildDiscoveryFilter = ({
  activeCompanyIds,
  keyword,
  companyIdsMatchingKeyword,
  fieldFilters,
  locationSelections,
  workModes,
  employmentTypes,
  experienceLevelIds,
  now,
}) => {
  const conditions = [
    {
      status: JOB_STATUS.PUBLISHED,
      publishedAt: { $ne: null },
      applicationDeadline: { $gt: now },
      companyId: { $in: activeCompanyIds },
    },
  ];

  if (keyword !== "") {
    conditions.push({
      $or: [
        { title: { $regex: escapeRegex(keyword), $options: "i" } },
        { requiredSkills: { $regex: escapeRegex(keyword), $options: "i" } },
        { jobDescription: { $regex: escapeRegex(keyword), $options: "i" } },
        { companyId: { $in: companyIdsMatchingKeyword } },
      ],
    });
  }

  if (fieldFilters.length > 0) {
    conditions.push({
      $or: fieldFilters.map(({ fieldId, positionIds }) => ({
        fieldCategoryIds: fieldId,
        ...(positionIds.length > 0
          ? { positionCategoryIds: { $in: positionIds } }
          : {}),
      })),
    });
  }

  if (locationSelections.length > 0) {
    conditions.push({
      $or: locationSelections.map(({ provinceCode, districtCodes }) => ({
        "location.provinceCode": provinceCode,
        ...(districtCodes.length > 0
          ? { "location.districtCode": { $in: districtCodes } }
          : {}),
      })),
    });
  }

  if (workModes.length > 0) {
    conditions.push({ workModes: { $in: workModes } });
  }

  if (employmentTypes.length > 0) {
    conditions.push({ employmentType: { $in: employmentTypes } });
  }

  if (experienceLevelIds.length > 0) {
    conditions.push({ experienceLevelId: { $in: experienceLevelIds } });
  }

  return conditions.length === 1 ? conditions[0] : { $and: conditions };
};

const listJobDiscoveryJobs = async ({
  actorUser,
  filters = {},
  now = new Date(),
} = {}) => {
  await assertJobDiscoveryActor(actorUser);

  const keyword = normalizeKeyword(filters.keyword);
  const locationSelections = normalizeLocationFilterSelections(
    filters.locations,
    { field: "locations" },
  );
  const workModes = normalizeArray(filters.workModes, "workModes", {
    allowedValues: WORK_MODE_VALUES,
  });
  const employmentTypes = normalizeArray(
    filters.employmentTypes,
    "employmentTypes",
    { allowedValues: EMPLOYMENT_TYPE_VALUES },
  );
  const experienceLevelIds = normalizeObjectIds(
    filters.experienceLevels,
    "experienceLevels",
  );
  const fieldFilters = await resolveCategoryBranches(filters.categories);
  const requestedSort = filters.sort ?? null;
  const sort =
    requestedSort == null || requestedSort === ""
      ? keyword === ""
        ? JOB_DISCOVERY_SORT.NEWEST
        : JOB_DISCOVERY_SORT.RELEVANCE
      : requestedSort === JOB_DISCOVERY_SORT.RELEVANCE && keyword === ""
        ? JOB_DISCOVERY_SORT.NEWEST
        : requestedSort;

  if (!Object.values(JOB_DISCOVERY_SORT).includes(sort)) {
    throw new AppError(400, "Invalid sort", { field: "sort" });
  }

  if (experienceLevelIds.length > 0) {
    const existingExperienceLevels = await ExperienceLevel.countDocuments({
      _id: { $in: experienceLevelIds },
    });

    if (existingExperienceLevels !== experienceLevelIds.length) {
      throw new AppError(
        400,
        "experienceLevels references unknown ExperienceLevel",
        { field: "experienceLevels" },
      );
    }
  }

  const activeCompanies = await Company.find({
    approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
  })
    .select(
      "_id name logoUrl bannerUrl website address description contactInfo",
    )
    .lean();

  const page = normalizePageValue(filters.page, "page", DEFAULT_PAGE);
  const limit = normalizePageValue(
    filters.limit,
    "limit",
    DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  if (activeCompanies.length === 0) {
    return {
      jobs: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
      sort,
    };
  }

  const activeCompanyIds = activeCompanies.map((company) => company._id);
  const companyById = new Map(
    activeCompanies.map((company) => [company._id.toString(), company]),
  );
  const companyIdsMatchingKeyword =
    keyword === ""
      ? []
      : activeCompanies
          .filter((company) =>
            new RegExp(escapeRegex(keyword), "i").test(company.name ?? ""),
          )
          .map((company) => company._id);

  const discoveryFilter = buildDiscoveryFilter({
    activeCompanyIds,
    keyword,
    companyIdsMatchingKeyword,
    fieldFilters,
    locationSelections,
    workModes,
    employmentTypes,
    experienceLevelIds,
    now,
  });
  const jobs = await Job.find(discoveryFilter).lean();
  const sortedJobs = sortDiscoveryJobs({
    jobs,
    companyById,
    sort,
    keyword,
  });
  const total = sortedJobs.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const pageJobs = sortedJobs.slice((page - 1) * limit, page * limit);
  const catalogData = await getDiscoveryCatalogData(pageJobs);

  return {
    jobs: pageJobs.map((job) =>
      buildPublicJob({
        job,
        company: companyById.get(job.companyId.toString()),
        ...catalogData,
        visibility: JOB_DISCOVERY_VISIBILITY.DISCOVERABLE,
      }),
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    sort,
  };
};

const getPublicJobDiscoveryDetail = async ({
  actorUser,
  jobId,
  now = new Date(),
} = {}) => {
  await assertJobDiscoveryActor(actorUser);

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new AppError(400, "Invalid Job id", { field: "jobId" });
  }

  const job = await Job.findById(jobId).lean();

  if (!job) {
    throw new AppError(404, "Job not found");
  }

  const company = await Company.findById(job.companyId)
    .select(
      "_id name logoUrl bannerUrl website address description contactInfo approvalStatus operationalStatus",
    )
    .lean();
  const visibility = resolveJobDiscoveryVisibility({ job, company, now });

  if (visibility === JOB_DISCOVERY_VISIBILITY.INACCESSIBLE) {
    throw new AppError(404, "Job not found");
  }

  const catalogData = await getDiscoveryCatalogData([job]);

  return buildPublicJob({
    job,
    company,
    ...catalogData,
    visibility,
    detail: true,
  });
};

const getPublicCompanyInformation = async ({ actorUser, companyId } = {}) => {
  await assertJobDiscoveryActor(actorUser);

  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new AppError(400, "Invalid Company id", { field: "companyId" });
  }

  const company = await Company.findOne({
    _id: companyId,
    approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
  })
    .select(
      "_id name logoUrl bannerUrl website address description contactInfo",
    )
    .lean();

  if (!company) {
    throw new AppError(404, "Company not found");
  }

  return buildPublicCompany(company);
};

export {
  assertJobDiscoveryActor,
  getPublicCompanyInformation,
  getPublicJobDiscoveryDetail,
  listJobDiscoveryJobs,
};
