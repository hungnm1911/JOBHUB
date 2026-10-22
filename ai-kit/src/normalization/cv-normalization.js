import { isDeepStrictEqual } from "node:util";

import {
  EMPLOYMENT_TYPES,
  FAILED_RESULT,
  NON_EMPTY_TEXT_ITEM,
  NORMALIZATION_STATUS,
  WORK_MODES,
  buildCvMetadata,
  deepFreeze,
  findCvTaxonomyIssues,
  findCvTaxonomyReferenceIssues,
  findExactKeyIssues,
  findListIssues,
  findNullableTextIssues,
  findPreferredLocationIssues,
  isNonEmptyTrimmedString,
  isPlainObject,
  resolveSourcePath,
  sourcedList,
  sourcedOrNull,
} from "./normalization-support.js";

const CV_NORMALIZATION_ERROR_CODES = Object.freeze({
  INVALID_GENERATED_CV_INPUT: "INVALID_GENERATED_CV_INPUT",
});

const CV_NORMALIZATION_STATUS = NORMALIZATION_STATUS;

// Mirror the Backend CV_LANGUAGE_PROFICIENCY and HARVARD_CV_SECTION constants;
// AI Kit cannot import Backend, so they must be kept in step with those owners.
const LANGUAGE_PROFICIENCIES = Object.freeze([
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "FLUENT",
  "NATIVE",
]);
const HARVARD_CV_SECTIONS = Object.freeze([
  "professionalSummary",
  "educations",
  "skills",
  "workExperiences",
  "projects",
  "certifications",
  "languages",
]);

// Career-relevant CandidateCV fields only (Product AI-V01 §6.1, §6.3). CV
// library name, lifecycle, visibility, owner, and personalInfo contact data
// stay outside the AI boundary; only professional `personalInfo.links` cross.
const CV_SOURCE_FIELDS = Object.freeze([
  "candidateCvId",
  "categoryId",
  "experienceLevelId",
  "skillTags",
  "employmentTypes",
  "workModes",
  "preferredLocations",
  "generatedContent",
  "taxonomy",
]);
const GENERATED_CONTENT_FIELDS = Object.freeze([
  "personalInfo",
  "professionalSummary",
  "educations",
  "skills",
  "workExperiences",
  "projects",
  "certifications",
  "languages",
  "hiddenSections",
]);
const PERSONAL_INFO_FIELDS = Object.freeze(["links"]);

const FIELD_KIND = Object.freeze({
  TEXT: "TEXT",
  TEXT_LIST: "TEXT_LIST",
  DATE: "DATE",
  PROFICIENCY: "PROFICIENCY",
  FREE_TEXT: "FREE_TEXT",
  FREE_TEXT_LIST: "FREE_TEXT_LIST",
});
const FREE_TEXT_KINDS = Object.freeze([
  FIELD_KIND.FREE_TEXT,
  FIELD_KIND.FREE_TEXT_LIST,
]);
const LIST_KINDS = Object.freeze([
  FIELD_KIND.TEXT_LIST,
  FIELD_KIND.FREE_TEXT_LIST,
]);

// Item fields of the V7 GeneratedCvContent sections, in Backend schema order.
const SECTION_ITEM_FIELDS = Object.freeze({
  educations: Object.freeze({
    institutionName: FIELD_KIND.TEXT,
    degree: FIELD_KIND.TEXT,
    fieldOfStudy: FIELD_KIND.TEXT,
    startDate: FIELD_KIND.DATE,
    endDate: FIELD_KIND.DATE,
  }),
  workExperiences: Object.freeze({
    companyName: FIELD_KIND.TEXT,
    position: FIELD_KIND.TEXT,
    startDate: FIELD_KIND.DATE,
    endDate: FIELD_KIND.DATE,
    description: FIELD_KIND.FREE_TEXT,
    achievements: FIELD_KIND.FREE_TEXT_LIST,
  }),
  projects: Object.freeze({
    name: FIELD_KIND.TEXT,
    role: FIELD_KIND.TEXT,
    technologies: FIELD_KIND.TEXT_LIST,
    description: FIELD_KIND.FREE_TEXT,
    projectUrl: FIELD_KIND.TEXT,
  }),
  certifications: Object.freeze({
    name: FIELD_KIND.TEXT,
    issuer: FIELD_KIND.TEXT,
    issueDate: FIELD_KIND.DATE,
    expirationDate: FIELD_KIND.DATE,
    credentialId: FIELD_KIND.TEXT,
    credentialUrl: FIELD_KIND.TEXT,
  }),
  languages: Object.freeze({
    name: FIELD_KIND.TEXT,
    proficiency: FIELD_KIND.PROFICIENCY,
  }),
});

class CvNormalizationError extends Error {
  constructor(code, message, { details = [] } = {}) {
    super(message);
    this.name = "CvNormalizationError";
    this.code = code;
    this.details = details;
  }
}

// Dates cross the boundary as the `Date.prototype.toISOString()` form of the
// persisted Date so the profile stays plain, frozen, and exactly comparable.
const isIsoDateString = (value) => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return false;
  }

  return new Date(value).toISOString() === value;
};

const findFieldIssues = (value, kind, path) => {
  switch (kind) {
    case FIELD_KIND.TEXT:
    case FIELD_KIND.FREE_TEXT:
      return findNullableTextIssues(value, path);
    case FIELD_KIND.TEXT_LIST:
    case FIELD_KIND.FREE_TEXT_LIST:
      return findListIssues(value, path, NON_EMPTY_TEXT_ITEM);
    case FIELD_KIND.DATE:
      return value === null || isIsoDateString(value)
        ? []
        : [`${path} must be null or an ISO 8601 date string`];
    case FIELD_KIND.PROFICIENCY:
      return value === null || LANGUAGE_PROFICIENCIES.includes(value)
        ? []
        : [`${path} must be null or a canonical language proficiency value`];
    default:
      return [`${path} has an unsupported field kind`];
  }
};

const findSectionIssues = (items, section) => {
  const path = `/generatedContent/${section}`;
  const itemFields = SECTION_ITEM_FIELDS[section];

  if (!Array.isArray(items)) {
    return [`${path} must be an array`];
  }

  return items.flatMap((item, index) => {
    const itemPath = `${path}/${index}`;

    if (!isPlainObject(item)) {
      return [`${itemPath} must be an object`];
    }

    const keyIssues = findExactKeyIssues(item, Object.keys(itemFields), itemPath);

    if (keyIssues.length > 0) {
      return keyIssues;
    }

    return Object.entries(itemFields).flatMap(([field, kind]) => {
      return findFieldIssues(item[field], kind, `${itemPath}/${field}`);
    });
  });
};

// Links are copied as source strings; they are neither parsed nor verified.
const findPersonalInfoIssues = (personalInfo) => {
  const path = "/generatedContent/personalInfo";

  if (!isPlainObject(personalInfo)) {
    return [`${path} must be an object containing only links`];
  }

  const keyIssues = findExactKeyIssues(personalInfo, PERSONAL_INFO_FIELDS, path);

  return keyIssues.length > 0
    ? keyIssues
    : findListIssues(personalInfo.links, `${path}/links`, NON_EMPTY_TEXT_ITEM);
};

const findGeneratedContentIssues = (generatedContent) => {
  const path = "/generatedContent";

  if (!isPlainObject(generatedContent)) {
    return [`${path} must be a GeneratedCvContent object`];
  }

  const keyIssues = findExactKeyIssues(
    generatedContent,
    GENERATED_CONTENT_FIELDS,
    path,
  );

  if (keyIssues.length > 0) {
    return keyIssues;
  }

  return [
    ...findPersonalInfoIssues(generatedContent.personalInfo),
    ...findNullableTextIssues(
      generatedContent.professionalSummary,
      `${path}/professionalSummary`,
    ),
    ...findListIssues(
      generatedContent.skills,
      `${path}/skills`,
      NON_EMPTY_TEXT_ITEM,
    ),
    ...Object.keys(SECTION_ITEM_FIELDS).flatMap((section) => {
      return findSectionIssues(generatedContent[section], section);
    }),
    ...findListIssues(generatedContent.hiddenSections, `${path}/hiddenSections`, {
      isValidItem: (item) => HARVARD_CV_SECTIONS.includes(item),
      itemRule: "a canonical Harvard section value",
    }),
  ];
};

const findCvSourceIssues = (cvSource) => {
  if (!isPlainObject(cvSource)) {
    return ["Generated CV source must be a plain object"];
  }

  const keyIssues = findExactKeyIssues(cvSource, CV_SOURCE_FIELDS, "");

  if (keyIssues.length > 0) {
    return keyIssues;
  }

  const issues = [
    ...(isNonEmptyTrimmedString(cvSource.candidateCvId)
      ? []
      : ["/candidateCvId must be a non-empty string"]),
    ...(isNonEmptyTrimmedString(cvSource.categoryId)
      ? []
      : ["/categoryId must be a non-empty string"]),
    ...findNullableTextIssues(cvSource.experienceLevelId, "/experienceLevelId"),
    ...findListIssues(cvSource.skillTags, "/skillTags", NON_EMPTY_TEXT_ITEM),
    ...findListIssues(cvSource.employmentTypes, "/employmentTypes", {
      isValidItem: (item) => EMPLOYMENT_TYPES.includes(item),
      itemRule: "a canonical EmploymentType value",
      distinct: true,
    }),
    ...findListIssues(cvSource.workModes, "/workModes", {
      isValidItem: (item) => WORK_MODES.includes(item),
      itemRule: "a canonical WorkMode value",
      distinct: true,
    }),
    ...findPreferredLocationIssues(cvSource.preferredLocations),
    ...findGeneratedContentIssues(cvSource.generatedContent),
    ...findCvTaxonomyIssues(cvSource.taxonomy),
  ];

  return issues.length > 0 ? issues : findCvTaxonomyReferenceIssues(cvSource);
};

const sourcedField = (value, kind, sourcePath) => {
  return LIST_KINDS.includes(kind)
    ? sourcedList(value, sourcePath)
    : sourcedOrNull(value, sourcePath);
};

// Each item keeps its position and source path; structured fields stay at the
// item level and free text is grouped under `freeText`, both verbatim.
const buildSectionItems = (generatedContent, section) => {
  const itemFields = Object.entries(SECTION_ITEM_FIELDS[section]);
  const hasFreeText = itemFields.some(([, kind]) => FREE_TEXT_KINDS.includes(kind));

  return generatedContent[section].map((item, index) => {
    const itemPath = `/generatedContent/${section}/${index}`;
    const entry = { sourcePath: itemPath };
    const freeText = {};

    for (const [field, kind] of itemFields) {
      const target = FREE_TEXT_KINDS.includes(kind) ? freeText : entry;

      target[field] = sourcedField(item[field], kind, `${itemPath}/${field}`);
    }

    return hasFreeText ? { ...entry, freeText } : entry;
  });
};

// Values are copied as provided: free text is verbatim; skillTags, content
// skills, and project technologies stay separate in source order with
// duplicates; no skill, seniority, duration, alias, or taxonomy is derived.
const buildCvMatchProfile = (cvSource) => {
  const { generatedContent } = cvSource;

  return {
    source: { type: "GENERATED_CV", candidateCvId: cvSource.candidateCvId },
    freeText: {
      professionalSummary: sourcedOrNull(
        generatedContent.professionalSummary,
        "/generatedContent/professionalSummary",
      ),
    },
    metadata: buildCvMetadata(cvSource),
    content: {
      skills: sourcedList(generatedContent.skills, "/generatedContent/skills"),
      ...Object.fromEntries(
        Object.keys(SECTION_ITEM_FIELDS).map((section) => {
          return [section, buildSectionItems(generatedContent, section)];
        }),
      ),
      hiddenSections: sourcedList(
        generatedContent.hiddenSections,
        "/generatedContent/hiddenSections",
      ),
      links: sourcedList(
        generatedContent.personalInfo.links,
        "/generatedContent/personalInfo/links",
      ),
    },
  };
};

const isSourcedEntry = (value) => {
  return (
    isPlainObject(value) &&
    isDeepStrictEqual(Object.keys(value), ["value", "sourcePath"])
  );
};

const collectProfileNodes = (node, nodes = { entries: [], items: [] }) => {
  if (Array.isArray(node)) {
    node.forEach((child) => collectProfileNodes(child, nodes));
  } else if (isSourcedEntry(node)) {
    nodes.entries.push(node);
  } else if (isPlainObject(node)) {
    if (typeof node.sourcePath === "string") {
      nodes.items.push(node.sourcePath);
    }

    Object.entries(node)
      .filter(([key]) => key !== "sourcePath")
      .forEach(([, child]) => collectProfileNodes(child, nodes));
  }

  return nodes;
};

const countSourceValues = (value) => {
  if (value === null) {
    return 0;
  }

  if (Array.isArray(value)) {
    return value.reduce((count, item) => count + countSourceValues(item), 0);
  }

  if (isPlainObject(value)) {
    return Object.values(value).reduce((count, item) => {
      return count + countSourceValues(item);
    }, 0);
  }

  return 1;
};

// Rejects a profile that drops, adds, or alters any source value or item, so
// READY is never reported for a lossy or fabricated profile (BR-AI-07, BR-AI-14).
const findProfileIssues = (profile, cvSource) => {
  const { entries, items } = collectProfileNodes([
    profile.freeText,
    profile.metadata,
    profile.content,
  ]);
  const { generatedContent, taxonomy } = cvSource;
  const expectedEntryCount =
    2 +
    (cvSource.experienceLevelId === null ? 0 : 1) +
    (taxonomy.experienceLevel === null ? 0 : 1) +
    cvSource.skillTags.length +
    cvSource.employmentTypes.length +
    cvSource.workModes.length +
    cvSource.preferredLocations.length +
    countSourceValues(generatedContent);
  const expectedItemCount = Object.keys(SECTION_ITEM_FIELDS).reduce(
    (count, section) => count + generatedContent[section].length,
    0,
  );
  const issues = entries
    .filter(({ value, sourcePath }) => {
      return !isDeepStrictEqual(value, resolveSourcePath(cvSource, sourcePath));
    })
    .map(({ sourcePath }) => `${sourcePath} does not match the CV source`);

  if (entries.length !== expectedEntryCount) {
    issues.push("profile does not preserve every Generated CV source value");
  }

  if (
    items.length !== expectedItemCount ||
    items.some((path) => !isPlainObject(resolveSourcePath(cvSource, path)))
  ) {
    issues.push("profile does not preserve every Generated CV section item");
  }

  if (
    profile.metadata.category.value.id !== cvSource.categoryId ||
    (profile.metadata.experienceLevel?.value.id ?? null) !==
      cvSource.experienceLevelId
  ) {
    issues.push("resolved taxonomy does not match the CV source IDs");
  }

  if (profile.source.candidateCvId !== cvSource.candidateCvId) {
    issues.push("profile source does not identify the Generated CV");
  }

  return issues;
};

// F02: deterministic Generated CV → CVMatchProfile normalization. No LLM, no
// free-text interpretation, no persistence; the result is runtime-only.
const normalizeGeneratedCv = (cvSource) => {
  const inputIssues = findCvSourceIssues(cvSource);

  if (inputIssues.length > 0) {
    throw new CvNormalizationError(
      CV_NORMALIZATION_ERROR_CODES.INVALID_GENERATED_CV_INPUT,
      "Generated CV input does not satisfy the AI-V01 Generated CV source contract",
      { details: inputIssues },
    );
  }

  try {
    const profile = buildCvMatchProfile(cvSource);

    if (findProfileIssues(profile, cvSource).length > 0) {
      return FAILED_RESULT;
    }

    return deepFreeze({ status: CV_NORMALIZATION_STATUS.READY, profile });
  } catch {
    return FAILED_RESULT;
  }
};

export {
  CV_NORMALIZATION_ERROR_CODES,
  CV_NORMALIZATION_STATUS,
  CvNormalizationError,
  normalizeGeneratedCv,
};
