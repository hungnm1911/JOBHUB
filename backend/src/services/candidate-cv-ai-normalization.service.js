import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CATEGORY_LEVEL from "../constants/category-level.js";
import CandidateCV, {
  findPreferredLocationSelectionsViolation,
} from "../models/candidate-cv.model.js";
import Category from "../models/category.model.js";
import ExperienceLevel from "../models/experience-level.model.js";
import { isNotForbiddenLocationProvinceCode } from "../models/job.model.js";
import AppError from "../utils/app-error.js";
import logger from "../utils/logger.js";
import { isMongoDbAvailabilityError } from "../utils/mongodb-availability-error.js";
import {
  overlayPersistedValue,
  toPersistedIdString,
  toPersistedIsoDate,
} from "../utils/persisted-source.js";
import { aiKit } from "./ai-kit.service.js";
import { loadOwnActiveCandidateCv } from "./candidate-cv.service.js";
import { toPublicCategory } from "./category.service.js";
import { toPublicExperienceLevel } from "./experience-level.service.js";

// AI Kit's F02 refusal code and READY/FAILED result contract
// (docs/engineering/ai-kit-conventions.md, Composition and Backend integration).
const INVALID_GENERATED_CV_INPUT = "INVALID_GENERATED_CV_INPUT";
const FAILED_RESULT = Object.freeze({ status: "FAILED", profile: null });
const CATEGORY_LEVEL_VALUES = new Set(Object.values(CATEGORY_LEVEL));

// Date fields of the V7 GeneratedCvContent sections.
const SECTION_DATE_FIELDS = Object.freeze({
  educations: Object.freeze(["startDate", "endDate"]),
  workExperiences: Object.freeze(["startDate", "endDate"]),
  projects: Object.freeze([]),
  certifications: Object.freeze(["issueDate", "expirationDate"]),
  languages: Object.freeze([]),
});

const PROJECTION_ERROR_MESSAGE =
  "Generated CV cannot be projected to the AI-V01 Generated CV source";

const toProjectionError = (issues, cause) => {
  return new AppError(500, PROJECTION_ERROR_MESSAGE, { issues }, { cause });
};

// The authorized CV as stored, without Mongoose casting; scoped to the same
// owner and active state so a concurrent change cannot widen what was authorized.
const loadPersistedCandidateCv = async (candidateCv) => {
  const persistedCandidateCv = await CandidateCV.findOne({
    _id: candidateCv._id,
    candidateUserId: candidateCv.candidateUserId,
    archivedAt: null,
  }).lean();

  if (!persistedCandidateCv) {
    throw new AppError(404, "Candidate CV not found");
  }

  return persistedCandidateCv;
};

const toSectionItemsSource = (items, path, dateFields, issues) => {
  if (!Array.isArray(items)) {
    return items;
  }

  return items.map((item, index) => {
    if (item == null || typeof item !== "object") {
      return item;
    }

    const itemSource = { ...item };

    for (const field of dateFields) {
      itemSource[field] = toPersistedIsoDate(
        item[field],
        `${path}/${index}/${field}`,
        issues,
      );
    }

    return itemSource;
  });
};

// personalInfo contact and identity fields stay outside the AI boundary
// (Product AI-V01 §6.3); only professional `links` cross.
const toGeneratedContentSource = (generatedContent, issues) => {
  if (generatedContent == null || typeof generatedContent !== "object") {
    return generatedContent;
  }

  const { personalInfo, ...content } = generatedContent;
  const sections = Object.fromEntries(
    Object.entries(SECTION_DATE_FIELDS).map(([section, dateFields]) => {
      return [
        section,
        toSectionItemsSource(
          content[section],
          `/generatedContent/${section}`,
          dateFields,
          issues,
        ),
      ];
    }),
  );

  return {
    ...content,
    ...sections,
    personalInfo:
      personalInfo == null || typeof personalInfo !== "object"
        ? personalInfo
        : { links: personalInfo.links },
  };
};

// Lossless career-relevant projection of the persisted Generated CV (Product
// AI-V01 §6.1, §6.3). Values are passed as stored, not through hydration or the
// public detail serializer, so non-canonical data is refused, not hidden.
const toGeneratedCvNormalizationSource = (candidateCv, persistedCandidateCv) => {
  const source = overlayPersistedValue(
    persistedCandidateCv,
    candidateCv.toObject(),
  );
  const issues = [];
  const cvSource = {
    candidateCvId: candidateCv._id.toString(),
    categoryId: toPersistedIdString(source.categoryId, "/categoryId", issues),
    experienceLevelId: toPersistedIdString(
      source.experienceLevelId,
      "/experienceLevelId",
      issues,
    ),
    skillTags: source.skillTags,
    employmentTypes: source.employmentTypes,
    workModes: source.workModes,
    preferredLocations: source.preferredLocations,
    generatedContent: toGeneratedContentSource(source.generatedContent, issues),
  };

  // AI Data §11.2 / Backend V4.1 Data §10.1: reuse the canonical local
  // validators on the uncast source. Shape/type refusal stays with AI Kit;
  // local domain violations fail projection without deduplication or lookup.
  if (Array.isArray(source.preferredLocations)) {
    const violation = findPreferredLocationSelectionsViolation(
      source.preferredLocations,
    );

    if (violation) {
      issues.push(`/preferredLocations: ${violation}`);
    }

    source.preferredLocations.forEach((location, index) => {
      if (!isNotForbiddenLocationProvinceCode(location?.provinceCode)) {
        issues.push(`/preferredLocations/${index}/provinceCode must not be FOREIGN`);
      }
    });
  }

  if (issues.length > 0) {
    throw toProjectionError(issues);
  }

  return cvSource;
};

const toResolvedCategory = (category) => {
  const { id, name, level, parentCategoryId } = toPublicCategory(category);

  return { id, name, level, parentCategoryId };
};

// Taxonomy IDs are persisted references, so an unknown or non-FIELD/POSITION
// reference is refused here rather than mapped to an empty value.
const resolveGeneratedCvTaxonomy = async (cvSource) => {
  const [category, experienceLevel] = await Promise.all([
    cvSource.categoryId == null ? null : Category.findById(cvSource.categoryId),
    cvSource.experienceLevelId == null
      ? null
      : ExperienceLevel.findById(cvSource.experienceLevelId),
  ]);

  if (cvSource.categoryId != null && !category) {
    throw new AppError(400, "CandidateCV categoryId must reference a Category", {
      field: "categoryId",
    });
  }

  if (category && !CATEGORY_LEVEL_VALUES.has(category.level)) {
    throw new AppError(
      400,
      "CandidateCV categoryId must reference a FIELD or POSITION Category",
      {
        field: "categoryId",
      },
    );
  }

  if (cvSource.experienceLevelId != null && !experienceLevel) {
    throw new AppError(
      400,
      "CandidateCV experienceLevelId must reference a canonical ExperienceLevel",
      {
        field: "experienceLevelId",
      },
    );
  }

  return {
    category: category == null ? null : toResolvedCategory(category),
    experienceLevel:
      experienceLevel == null ? null : toPublicExperienceLevel(experienceLevel),
  };
};

// AI-V01 F02 Backend entry: authorize an own active CV read, refuse non-Generated
// sources, project the raw Generated CV losslessly, resolve its taxonomy, and
// return AI Kit's runtime result. DRAFT and PRIVATE CVs are accepted; no
// completeness, default, or PUBLIC gate applies.
const normalizeOwnGeneratedCandidateCv = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
} = {}) => {
  let candidateCv;
  let persistedCandidateCv;

  try {
    candidateCv = await loadOwnActiveCandidateCv({
      candidateUserId,
      actorUser,
      candidateCvId,
    });

    if (candidateCv.sourceType !== CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
      throw new AppError(
        409,
        "Only Generated Candidate CVs support this operation",
        {
          field: "sourceType",
        },
      );
    }

    persistedCandidateCv = await loadPersistedCandidateCv(candidateCv);
  } catch (error) {
    if (!isMongoDbAvailabilityError(error)) {
      throw error;
    }

    // Authorization may be incomplete: stop without projecting or using a source.
    // Driver diagnostics can contain source data; log only safe classification.
    logger.warn("AI-V01 Generated CV source lookup failed; normalization FAILED", {
      candidateCvId,
      errorType: error.name,
    });

    return FAILED_RESULT;
  }

  const cvSource = toGeneratedCvNormalizationSource(
    candidateCv,
    persistedCandidateCv,
  );
  let taxonomy;

  try {
    taxonomy = await resolveGeneratedCvTaxonomy(cvSource);
  } catch (error) {
    if (!isMongoDbAvailabilityError(error)) {
      throw error;
    }

    // Product AI-V01 §15 Dependency failure: FAILED, never a fabricated result.
    logger.warn(
      "AI-V01 Generated CV taxonomy lookup failed; normalization FAILED",
      {
        candidateCvId: cvSource.candidateCvId,
        errorType: error.name,
      },
    );

    return FAILED_RESULT;
  }

  try {
    return aiKit.normalizeGeneratedCv({ ...cvSource, taxonomy });
  } catch (error) {
    if (error?.code === INVALID_GENERATED_CV_INPUT) {
      throw toProjectionError(error.details, error);
    }

    throw error;
  }
};

export { normalizeOwnGeneratedCandidateCv };
