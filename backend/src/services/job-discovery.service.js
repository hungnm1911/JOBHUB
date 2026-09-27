import mongoose from "mongoose";
import Job from "../models/job.model.js";
import Company from "../models/company.model.js";
import Category from "../models/category.model.js";
import ExperienceLevel from "../models/experience-level.model.js";
import AppError from "../utils/app-error.js";
import COMPANY_OPERATIONAL_STATUS from "../constants/company-operational-status.js";
import JOB_STATUS from "../constants/job-status.js";

const PUBLIC_JOB_PROJECTION = {
  _id: 1,
  companyId: 1,
  title: 1,
  jobDescription: 1,
  requiredSkills: 1,
  salaryText: 1,
  fieldCategoryIds: 1,
  positionCategoryIds: 1,
  location: 1,
  employmentType: 1,
  workModes: 1,
  experienceLevelId: 1,
  applicationDeadline: 1,
  status: 1,
  publishedAt: 1,
  createdAt: 1,
  updatedAt: 1,
};

const PUBLIC_COMPANY_PROJECTION = {
  _id: 1,
  name: 1,
  logoUrl: 1,
  bannerUrl: 1,
  website: 1,
  address: 1,
  description: 1,
  contactInfo: 1,
};

const assertCompanyActiveForPublicAccess = async (companyId) => {
  const companyRecord = await Company.findById(companyId)
    .select({ operationalStatus: 1 })
    .lean();

  if (
    !companyRecord ||
    companyRecord.operationalStatus !== COMPANY_OPERATIONAL_STATUS.ACTIVE
  ) {
    throw new AppError(404, "Job not accessible");
  }
};

const buildJobDiscoveryPipeline = ({
  keyword,
  categoryConditions,
  location,
  employmentType,
  workModes,
  experienceLevelIds,
  sort,
  now,
}) => {
  const matchStage = {
    status: JOB_STATUS.PUBLISHED,
    applicationDeadline: { $gt: now },
  };

  if (categoryConditions?.length > 0) {
    matchStage.$or = categoryConditions;
  }
  
  if (location?.length) {
    matchStage.location = { $in: location };
  }
  
  if (employmentType?.length) {
    matchStage.employmentType = { $in: employmentType };
  }
  
  if (workModes?.length) {
    matchStage.workModes = { $in: workModes };
  }
  
  if (experienceLevelIds?.length) {
    matchStage.experienceLevelId = { $in: experienceLevelIds.map(id => new mongoose.Types.ObjectId(id)) };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: "companies",
        localField: "companyId",
        foreignField: "_id",
        as: "company",
      },
    },
    { $unwind: "$company" },
    {
      $match: {
        "company.operationalStatus": COMPANY_OPERATIONAL_STATUS.ACTIVE,
      },
    },
  ];

  if (keyword && typeof keyword === "string") {
    const trimmed = keyword.trim();
    if (trimmed) {
      const regex = new RegExp(trimmed, "i");
      pipeline.push({
        $match: {
          $or: [
            { title: regex },
            { requiredSkills: regex },
            { "company.name": regex },
            { jobDescription: regex },
          ],
        },
      });

      pipeline.push({
        $addFields: {
          relevanceScore: {
            $add: [
              { $cond: [{ $regexMatch: { input: { $ifNull: ["$title", ""] }, regex: regex } }, 4, 0] },
              {
                $cond: [
                  {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: "$requiredSkills",
                            as: "skill",
                            cond: { $regexMatch: { input: "$$skill", regex: regex } },
                          },
                        },
                      },
                      0,
                    ],
                  },
                  3,
                  0,
                ],
              },
              { $cond: [{ $regexMatch: { input: { $ifNull: ["$company.name", ""] }, regex: regex } }, 2, 0] },
              { $cond: [{ $regexMatch: { input: { $ifNull: ["$jobDescription", ""] }, regex: regex } }, 1, 0] },
            ],
          },
        },
      });
    }
  }

  let actualSort = sort;
  if (!keyword && sort === "RELEVANCE") {
    actualSort = "NEWEST";
  } else if (!sort) {
    actualSort = keyword ? "RELEVANCE" : "NEWEST";
  }

  let sortStage;
  if (actualSort === "RELEVANCE" && keyword) {
    sortStage = { relevanceScore: -1, publishedAt: -1 };
  } else if (actualSort === "EXPIRING_SOON") {
    sortStage = { applicationDeadline: 1, publishedAt: -1 };
  } else {
    sortStage = { publishedAt: -1, _id: 1 };
  }

  pipeline.push({ $sort: sortStage });

  if (keyword && typeof keyword === "string" && keyword.trim()) {
    pipeline.push({ $unset: "relevanceScore" });
  }

  pipeline.push({
    $project: {
      ...PUBLIC_JOB_PROJECTION,
      company: PUBLIC_COMPANY_PROJECTION,
    },
  });

  return pipeline;
};

const listDiscoverableJobs = async ({
  keyword,
  fieldCategoryIds,
  positionCategoryIds,
  location,
  employmentType,
  workModes,
  experienceLevelIds,
  sort,
  page = 1,
  limit = 20,
}) => {
  const now = new Date();

  let categoryConditions = [];

  const fields = (fieldCategoryIds ?? []).map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  const positions = (positionCategoryIds ?? []).map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  if (fields.length === 0 && positions.length > 0) {
  return {
    jobs: [],
    pagination: {
      page,
      limit,
      total: 0,
      totalPages: 0,
    },
  };
}

  if (fields.length > 0) {
    if (positions.length > 0) {
      const positionRecords = await Category.find({
        _id: { $in: positions },
        level: "POSITION",
      })
        .select({
          _id: 1,
          parentCategoryId: 1,
        })
        .lean();

      const positionsByField = new Map();

      for (const position of positionRecords) {
        const parentFieldId = position.parentCategoryId?.toString();

        if (!parentFieldId) {
          continue;
        }

        if (!positionsByField.has(parentFieldId)) {
          positionsByField.set(parentFieldId, []);
        }

        positionsByField.get(parentFieldId).push(position._id);
      }

      categoryConditions = fields.map((fieldId) => {
        const fieldIdString = fieldId.toString();
        const validPositions = positionsByField.get(fieldIdString);

        if (validPositions?.length) {
          return {
            fieldCategoryIds: fieldId,
            positionCategoryIds: {
              $in: validPositions,
            },
          };
        }

        return {
          fieldCategoryIds: fieldId,
        };
      });
    } else {
      categoryConditions = fields.map((fieldId) => ({
        fieldCategoryIds: fieldId,
      }));
    }
  }

  const pipeline = buildJobDiscoveryPipeline({
    keyword,
    categoryConditions,
    location,
    employmentType,
    workModes,
    experienceLevelIds,
    sort,
    now,
  });

  const skip = (page - 1) * limit;

  const [metadata, results] = await Promise.all([
    Job.aggregate([...pipeline, { $count: "total" }]),
    Job.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
  ]);

  const total = metadata.length > 0 ? metadata[0].total : 0;
  const totalPages = Math.ceil(total / limit);

  return {
    jobs: results,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

const getDiscoverableJobDetail = async ({ jobId }) => {
  const job = await Job.findById(jobId).select(PUBLIC_JOB_PROJECTION).lean();

  if (!job) {
    throw new AppError(404, "Job not found", { field: "jobId" });
  }

  await assertCompanyActiveForPublicAccess(job.companyId);

  const company = await Company.findById(job.companyId)
    .select(PUBLIC_COMPANY_PROJECTION)
    .lean();

  const now = new Date();
  let effectiveVisibility = "INACCESSIBLE";

  if (job.status === JOB_STATUS.PUBLISHED && job.applicationDeadline > now) {
    effectiveVisibility = "DISCOVERABLE";
  } else if (
    job.status === JOB_STATUS.CLOSED ||
    job.status === JOB_STATUS.EXPIRED ||
    (job.status === JOB_STATUS.PUBLISHED && job.applicationDeadline <= now)
  ) {
    // Must have been public at some point. publishedAt serves as evidence.
    if (job.publishedAt) {
      effectiveVisibility = "HISTORICAL_READ_ONLY";
    }
  }

  if (effectiveVisibility === "INACCESSIBLE") {
    throw new AppError(404, "Job not accessible");
  }

  const PUBLIC_CATEGORY_PROJECTION = {
    _id: 1,
    name: 1,
    level: 1,
    parentCategoryId: 1,
  };

  const PUBLIC_EXPERIENCE_LEVEL_PROJECTION = {
    _id: 1,
    code: 1,
    name: 1,
  };

  const [fieldCategories, positionCategories, experienceLevel] =
    await Promise.all([
      Category.find({
        _id: { $in: job.fieldCategoryIds },
      })
        .select(PUBLIC_CATEGORY_PROJECTION)
        .lean(),

      Category.find({
        _id: { $in: job.positionCategoryIds },
      })
        .select(PUBLIC_CATEGORY_PROJECTION)
        .lean(),

      job.experienceLevelId
        ? ExperienceLevel.findById(job.experienceLevelId)
            .select(PUBLIC_EXPERIENCE_LEVEL_PROJECTION)
            .lean()
        : null,
    ]);

  return {
    job: {
      ...job,
      company,
      fieldCategories,
      positionCategories,
      experienceLevel,
    },
    effectiveVisibility,
  };
};

const getPublicCompanyInfo = async ({ companyId }) => {
  await assertCompanyActiveForPublicAccess(companyId);

  const company = await Company.findById(companyId)
    .select(PUBLIC_COMPANY_PROJECTION)
    .lean();

  if (!company) {
    throw new AppError(404, "Company not accessible", { field: "companyId" });
  }

  return company;
};

export {
  listDiscoverableJobs,
  getDiscoverableJobDetail,
  getPublicCompanyInfo,
};
