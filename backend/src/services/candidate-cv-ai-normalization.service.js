import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../constants/category-level.js";
import EMPLOYMENT_TYPE from "../constants/employment-type.js";
import EXPERIENCE_LEVEL from "../constants/experience-level.js";
import WORK_MODE from "../constants/work-mode.js";
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
const UPLOADED_PROJECTION_ERROR_MESSAGE =
  "Uploaded CV cannot be projected to the AI-V02 Uploaded CV source";

const toProjectionError = (issues, cause, message = PROJECTION_ERROR_MESSAGE) => {
  return new AppError(500, message, { issues }, { cause });
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
const toCvMetadataSource = (candidateCv, persistedCandidateCv, issues) => {
  const source = overlayPersistedValue(
    persistedCandidateCv,
    candidateCv.toObject(),
  );
  const metadata = {
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
  };

  return { source, metadata };
};

// AI Data §11.2 / Backend V4.1 Data §10.1: reuse the canonical local
// validators on the uncast source without deduplication or catalog lookup.
const appendPreferredLocationIssues = (source, issues) => {
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

};

const toGeneratedCvNormalizationSource = (candidateCv, persistedCandidateCv) => {
  const issues = [];
  const { source, metadata } = toCvMetadataSource(
    candidateCv,
    persistedCandidateCv,
    issues,
  );
  const cvSource = {
    ...metadata,
    generatedContent: toGeneratedContentSource(source.generatedContent, issues),
  };
  appendPreferredLocationIssues(source, issues);

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
const resolveCandidateCvTaxonomy = async (cvSource) => {
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

const isNonEmptyText = (value) =>
  typeof value === "string" && value.trim() !== "";

const findUploadedSourceIssues = (source, metadata, persistedCandidateCv) => {
  const issues = [];
  const file = source.uploadedFile;

  for (const field of [
    "sourceType", "status", "name", "visibility", "categoryId",
    "experienceLevelId", "skillTags", "employmentTypes", "workModes",
    "preferredLocations", "uploadedFile",
  ]) {
    if (!Object.hasOwn(persistedCandidateCv, field)) {
      issues.push(`/${field} must be persisted`);
    }
  }

  if (metadata.categoryId === null) {
    issues.push("/categoryId must reference a Category");
  }

  if (source.sourceType !== CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
    issues.push("/sourceType must be UPLOADED");
  }
  if (source.status !== CANDIDATE_CV_STATUS.ACTIVE) {
    issues.push("/status must be ACTIVE");
  }
  if (source.archivedAt != null) {
    issues.push("/archivedAt must be null");
  }
  if (!isNonEmptyText(source.name)) {
    issues.push("/name must be a non-empty string");
  }
  if (!Object.values(CANDIDATE_CV_VISIBILITY).includes(source.visibility)) {
    issues.push("/visibility must be canonical");
  }
  if (source.generatedContent != null) {
    issues.push("/generatedContent must be absent");
  }
  if (file == null || typeof file !== "object" || Array.isArray(file)) {
    issues.push("/uploadedFile must be current PDF metadata");
  } else {
    for (const field of ["storageKey", "originalFileName", "mimeType", "sizeBytes", "pageCount", "uploadedAt"]) {
      if (!Object.hasOwn(persistedCandidateCv.uploadedFile ?? {}, field)) {
        issues.push(`/uploadedFile/${field} must be persisted`);
      }
    }
    for (const field of ["storageKey", "originalFileName"]) {
      if (!isNonEmptyText(file[field])) {
        issues.push(`/uploadedFile/${field} must be a non-empty string`);
      }
    }
    if (file.mimeType !== "application/pdf") {
      issues.push("/uploadedFile/mimeType must be application/pdf");
    }
    if (!Number.isInteger(file.sizeBytes) || file.sizeBytes <= 0 || file.sizeBytes > 10 * 1024 * 1024) {
      issues.push("/uploadedFile/sizeBytes must be a valid PDF size");
    }
    if (!Number.isInteger(file.pageCount) || file.pageCount < 1 || file.pageCount > 20) {
      issues.push("/uploadedFile/pageCount must be within 1–20");
    }
    if (!(file.uploadedAt instanceof Date) || Number.isNaN(file.uploadedAt.getTime())) {
      issues.push("/uploadedFile/uploadedAt must be a persisted Date");
    }
  }

  for (const field of ["skillTags", "employmentTypes", "workModes", "preferredLocations"]) {
    if (!Array.isArray(metadata[field])) {
      issues.push(`/${field} must be an array`);
    }
  }
  if (Array.isArray(metadata.skillTags)) {
    metadata.skillTags.forEach((value, index) => {
      if (!isNonEmptyText(value)) {
        issues.push(`/skillTags/${index} must be a non-empty string`);
      }
    });
  }
  for (const [field, vocabulary] of [
    ["employmentTypes", EMPLOYMENT_TYPE],
    ["workModes", WORK_MODE],
  ]) {
    if (Array.isArray(metadata[field])) {
      metadata[field].forEach((value, index) => {
        if (!Object.values(vocabulary).includes(value)) {
          issues.push(`/${field}/${index} must be canonical`);
        }
      });
      if (new Set(metadata[field]).size !== metadata[field].length) {
        issues.push(`/${field} must not contain duplicates`);
      }
    }
  }
  if (Array.isArray(metadata.preferredLocations)) {
    metadata.preferredLocations.forEach((location, index) => {
      if (location == null || typeof location !== "object" || Array.isArray(location)
        || !isNonEmptyText(location.provinceCode)
        || !(location.districtCode === null || isNonEmptyText(location.districtCode))) {
        issues.push(`/preferredLocations/${index} must be a canonical selection`);
      }
    });
  }

  return issues;
};

// Projection only: callers must first authorize access with the canonical
// CandidateCV service. No Uploaded normalization consumer is approved here.
const projectAuthorizedUploadedCandidateCvSource = async (candidateCv) => {
  if (candidateCv?.sourceType !== CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
    throw new AppError(409, "Only Uploaded Candidate CVs support this projection", {
      field: "sourceType",
    });
  }
  if (candidateCv.archivedAt != null) {
    throw new AppError(404, "Candidate CV not found");
  }

  const persistedCandidateCv = await loadPersistedCandidateCv(candidateCv);
  const issues = [];
  const { source, metadata } = toCvMetadataSource(
    candidateCv,
    persistedCandidateCv,
    issues,
  );
  appendPreferredLocationIssues(source, issues);
  issues.push(...findUploadedSourceIssues(source, metadata, persistedCandidateCv));

  if (issues.length > 0) {
    throw toProjectionError(issues, undefined, UPLOADED_PROJECTION_ERROR_MESSAGE);
  }

  const taxonomy = await resolveCandidateCvTaxonomy(metadata);
  if (
    (taxonomy.category.level === CATEGORY_LEVEL.FIELD && taxonomy.category.parentCategoryId !== null)
    || (taxonomy.category.level === CATEGORY_LEVEL.POSITION && !isNonEmptyText(taxonomy.category.parentCategoryId))
    || !isNonEmptyText(taxonomy.category.name)
    || (taxonomy.experienceLevel !== null
      && !Object.values(EXPERIENCE_LEVEL).includes(taxonomy.experienceLevel.code))
  ) {
    throw toProjectionError(["/taxonomy must resolve canonical Category and ExperienceLevel"], undefined, UPLOADED_PROJECTION_ERROR_MESSAGE);
  }

  return { ...metadata, taxonomy };
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
    taxonomy = await resolveCandidateCvTaxonomy(cvSource);
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

export { normalizeOwnGeneratedCandidateCv, projectAuthorizedUploadedCandidateCvSource };
