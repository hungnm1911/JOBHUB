import CATEGORY_LEVEL from "../constants/category-level.js";
import Category from "../models/category.model.js";
import ExperienceLevel from "../models/experience-level.model.js";
import { isNotForbiddenLocationProvinceCode } from "../models/job.model.js";
import AppError from "../utils/app-error.js";
import logger from "../utils/logger.js";
import { isMongoDbAvailabilityError } from "../utils/mongodb-availability-error.js";
import {
  overlayPersistedValue,
  toPersistedIdString,
  toPersistedIdStrings,
} from "../utils/persisted-source.js";
import { aiKit } from "./ai-kit.service.js";
import { toPublicCategory } from "./category.service.js";
import { toPublicExperienceLevel } from "./experience-level.service.js";
import { loadInternalJob } from "./job.service.js";

// AI Kit's F01 refusal code and READY/FAILED result contract
// (docs/engineering/ai-kit-conventions.md, Composition and Backend integration).
const INVALID_JOB_INPUT = "INVALID_JOB_INPUT";
const FAILED_RESULT = Object.freeze({ status: "FAILED", profile: null });

const PROJECTION_ERROR_MESSAGE =
  "Job cannot be projected to the AI-V01 Job source";

const toProjectionError = (issues, cause) => {
  return new AppError(500, PROJECTION_ERROR_MESSAGE, { issues }, { cause });
};

// Lossless career-relevant projection of the persisted Job (Product AI-V01
// §6.1, §6.3). Values are checked and passed as stored so projection validation
// and the AI Kit shape gate refuse invalid sources instead of hydration or the
// public serializer silently coercing or nulling them.
const toJobNormalizationSource = (job, persistedJob) => {
  const source = overlayPersistedValue(persistedJob, job.toObject());
  const issues = [];
  const jobSource = {
    jobId: job._id.toString(),
    title: source.title,
    jobDescription: source.jobDescription,
    requiredSkills: source.requiredSkills,
    salary: source.salary,
    fieldCategoryIds: toPersistedIdStrings(
      source.fieldCategoryIds,
      "/fieldCategoryIds",
      issues,
    ),
    positionCategoryIds: toPersistedIdStrings(
      source.positionCategoryIds,
      "/positionCategoryIds",
      issues,
    ),
    experienceLevelId: toPersistedIdString(
      source.experienceLevelId,
      "/experienceLevelId",
      issues,
    ),
    employmentType: source.employmentType,
    workModes: source.workModes,
    location: source.location,
  };

  // AI Data §11.2 / Backend V4.1 Data §10.1: canonical local source
  // validity belongs here, before the AI Kit projection-shape gate. Reuse the
  // schema's provider-free rule without casting, repairing, or catalog lookup.
  if (!isNotForbiddenLocationProvinceCode(source.location?.provinceCode)) {
    issues.push("/location/provinceCode must not be FOREIGN");
  }

  if (issues.length > 0) {
    throw toProjectionError(issues);
  }

  return jobSource;
};

const toResolvedCategory = (category) => {
  const { id, name, level, parentCategoryId } = toPublicCategory(category);

  return { id, name, level, parentCategoryId };
};

// A DRAFT persists taxonomy IDs without catalog checks, so an unknown or
// wrong-level reference is refused here rather than mapped to empty values.
const resolveJobTaxonomy = async (jobSource) => {
  const references = [
    ...jobSource.fieldCategoryIds.map((id) => ({
      id,
      field: "fieldCategoryIds",
      level: CATEGORY_LEVEL.FIELD,
    })),
    ...jobSource.positionCategoryIds.map((id) => ({
      id,
      field: "positionCategoryIds",
      level: CATEGORY_LEVEL.POSITION,
    })),
  ];
  const [categories, experienceLevel] = await Promise.all([
    Category.find({ _id: { $in: references.map(({ id }) => id) } }),
    jobSource.experienceLevelId == null
      ? null
      : ExperienceLevel.findById(jobSource.experienceLevelId),
  ]);
  const categoriesById = new Map(
    categories.map((category) => [category._id.toString(), category]),
  );
  const resolvedCategories = [];

  for (const { id, field, level } of references) {
    const category = categoriesById.get(id);

    if (!category) {
      throw new AppError(400, `Job ${field} references unknown Category`, {
        field,
      });
    }

    if (category.level !== level) {
      throw new AppError(400, `Job ${field} must reference ${level} categories`, {
        field,
      });
    }

    resolvedCategories.push(toResolvedCategory(category));
  }

  if (jobSource.experienceLevelId != null && !experienceLevel) {
    throw new AppError(
      400,
      "Job experienceLevelId must reference a canonical ExperienceLevel",
      {
        field: "experienceLevelId",
      },
    );
  }

  return {
    categories: resolvedCategories,
    experienceLevel:
      experienceLevel == null ? null : toPublicExperienceLevel(experienceLevel),
  };
};

// AI-V01 F01 Backend entry: authorize an internal Job read, project the raw
// Job losslessly, resolve its taxonomy, and return AI Kit's runtime result.
// Sparse DRAFTs are accepted; no submit/completeness validation applies.
const normalizeInternalJob = async ({
  actorUser,
  jobId,
  clientCompanyId,
} = {}) => {
  let loadedSource;

  try {
    loadedSource = await loadInternalJob(
      { actorUser, jobId, clientCompanyId },
      { includePersistedSource: true },
    );
  } catch (error) {
    if (!isMongoDbAvailabilityError(error)) {
      throw error;
    }

    // Authorization may be incomplete: stop without projecting or using a source.
    // Driver diagnostics can contain source data; log only safe classification.
    logger.warn("AI-V01 Job source lookup failed; normalization FAILED", {
      jobId,
      errorType: error.name,
    });

    return FAILED_RESULT;
  }

  const { job, persistedJob } = loadedSource;
  const jobSource = toJobNormalizationSource(job, persistedJob);
  let taxonomy;

  try {
    taxonomy = await resolveJobTaxonomy(jobSource);
  } catch (error) {
    if (!isMongoDbAvailabilityError(error)) {
      throw error;
    }

    // Product AI-V01 §15 Dependency failure: FAILED, never a fabricated result.
    logger.warn("AI-V01 Job taxonomy lookup failed; normalization FAILED", {
      jobId: jobSource.jobId,
      errorType: error.name,
    });

    return FAILED_RESULT;
  }

  try {
    return aiKit.normalizeJob({ ...jobSource, taxonomy });
  } catch (error) {
    if (error?.code === INVALID_JOB_INPUT) {
      throw toProjectionError(error.details, error);
    }

    throw error;
  }
};

export { normalizeInternalJob };
