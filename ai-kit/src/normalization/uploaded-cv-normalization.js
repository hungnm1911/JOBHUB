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
} from "./normalization-support.js";

const UPLOADED_CV_NORMALIZATION_ERROR_CODES = Object.freeze({
  INVALID_UPLOADED_CV_INPUT: "INVALID_UPLOADED_CV_INPUT",
});

// Canonical CandidateCV metadata Backend supplies for the Uploaded CV (Data
// AI-V02 §6.1). Name, ownership, lifecycle, visibility, and file metadata stay
// outside: they serve source checks only and are never career claims.
const UPLOADED_CV_SOURCE_FIELDS = Object.freeze([
  "candidateCvId",
  "categoryId",
  "experienceLevelId",
  "skillTags",
  "employmentTypes",
  "workModes",
  "preferredLocations",
  "taxonomy",
]);

const nullableText = Object.freeze({ type: ["string", "null"] });
const textList = Object.freeze({ type: "array", items: { type: "string" } });

const strictObject = (properties) => {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
};

// Every claim and item carries verbatim excerpts of the extracted PDF text as
// its evidence; values stay as stated, without dates, enums, or taxonomy.
const claimList = {
  type: "array",
  items: strictObject({ value: { type: "string" }, evidence: textList }),
};
const itemList = (fields) => {
  return {
    type: "array",
    items: strictObject({ ...fields, evidence: textList }),
  };
};

// Strict structured-output schema for the PDF interpretation only. Restricted
// to keywords accepted by provider strict modes (type, properties, required,
// additionalProperties: false, items, nullable type unions): every property is
// required and absence is expressed as null or an empty array. Rules the
// providers cannot enforce are checked by `findPdfExtractionIssues`.
const UPLOADED_CV_PDF_EXTRACTION_SCHEMA = deepFreeze(
  strictObject({
    careerPositioning: claimList,
    professionalSummary: claimList,
    skills: claimList,
    workExperiences: itemList({
      companyName: nullableText,
      position: nullableText,
      period: nullableText,
      description: nullableText,
      achievements: textList,
    }),
    projects: itemList({
      name: nullableText,
      role: nullableText,
      period: nullableText,
      technologies: textList,
      description: nullableText,
    }),
    educations: itemList({
      institutionName: nullableText,
      degree: nullableText,
      fieldOfStudy: nullableText,
      period: nullableText,
    }),
    certifications: itemList({
      name: nullableText,
      issuer: nullableText,
      date: nullableText,
      credentialId: nullableText,
    }),
    languages: itemList({
      name: nullableText,
      statedProficiency: nullableText,
    }),
    otherCareerClaims: claimList,
    unresolvedContent: claimList,
  }),
);

class UploadedCvNormalizationError extends Error {
  constructor(code, message, { details = [] } = {}) {
    super(message);
    this.name = "UploadedCvNormalizationError";
    this.code = code;
    this.details = details;
  }
}

const findSchemaIssues = (value, schema, path) => {
  const types = [schema.type].flat();

  if (value === null) {
    return types.includes("null") ? [] : [`${path} must not be null`];
  }

  if (types.includes("string")) {
    return isNonEmptyTrimmedString(value) ? [] : [`${path} must be a non-empty string`];
  }

  if (types.includes("array")) {
    return Array.isArray(value)
      ? value.flatMap((item, index) => {
          return findSchemaIssues(item, schema.items, `${path}/${index}`);
        })
      : [`${path} must be an array`];
  }

  if (!isPlainObject(value)) {
    return [`${path} must be an object`];
  }

  const keyIssues = findExactKeyIssues(value, schema.required, path);

  return keyIssues.length > 0
    ? keyIssues
    : Object.entries(schema.properties).flatMap(([field, fieldSchema]) => {
        return findSchemaIssues(value[field], fieldSchema, `${path}/${field}`);
      });
};

const collapseWhitespace = (text) => text.replace(/\s+/g, " ").trim();

// Rejects claims without evidence, evidence that is not an excerpt of the
// extracted text, and items that state nothing (BR-AI-17, BR-AI-18).
const findEvidenceIssues = (extraction, extractedText) => {
  const source = collapseWhitespace(extractedText);

  return Object.entries(extraction).flatMap(([group, entries]) => {
    return entries.flatMap((entry, index) => {
      const path = `/${group}/${index}`;
      const { evidence, ...fields } = entry;
      const issues = evidence
        .map((excerpt, excerptIndex) => [excerpt, excerptIndex])
        .filter(([excerpt]) => !source.includes(collapseWhitespace(excerpt)))
        .map(([, excerptIndex]) => {
          return `${path}/evidence/${excerptIndex} is not an excerpt of the extracted text`;
        });

      if (evidence.length === 0) {
        issues.push(`${path}/evidence must contain at least one excerpt`);
      }

      const statesValue = Object.values(fields).some((value) => {
        return Array.isArray(value) ? value.length > 0 : value !== null;
      });

      if (!statesValue) {
        issues.push(`${path} must state at least one value`);
      }

      return issues;
    });
  });
};

const findPdfExtractionIssues = (extraction, extractedText) => {
  const schemaIssues = findSchemaIssues(
    extraction,
    UPLOADED_CV_PDF_EXTRACTION_SCHEMA,
    "",
  );

  return schemaIssues.length > 0
    ? schemaIssues
    : findEvidenceIssues(extraction, extractedText);
};

const findUploadedCvSourceIssues = (cvSource) => {
  if (!isPlainObject(cvSource)) {
    return ["Uploaded CV source must be a plain object"];
  }

  const keyIssues = findExactKeyIssues(cvSource, UPLOADED_CV_SOURCE_FIELDS, "");

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
    ...findCvTaxonomyIssues(cvSource.taxonomy),
  ];

  return issues.length > 0 ? issues : findCvTaxonomyReferenceIssues(cvSource);
};

const assertUploadedCvSource = (cvSource) => {
  const issues = findUploadedCvSourceIssues(cvSource);

  if (issues.length > 0) {
    throw new UploadedCvNormalizationError(
      UPLOADED_CV_NORMALIZATION_ERROR_CODES.INVALID_UPLOADED_CV_INPUT,
      "Uploaded CV input does not satisfy the AI-V02 Uploaded CV source contract",
      { details: issues },
    );
  }
};

const parsePdfExtractionOutput = (pdfExtractionOutput) => {
  if (typeof pdfExtractionOutput !== "string") {
    return undefined;
  }

  try {
    return JSON.parse(pdfExtractionOutput);
  } catch {
    return undefined;
  }
};

// F01 composition: validated PDF interpretation plus Backend metadata into the
// Uploaded CV variant of CVMatchProfile. Metadata keeps its Backend values and
// JSON Pointer provenance; PDF claims keep their own evidence. Neither side
// overrides, merges, or deduplicates the other (BR-AI-15, BR-AI-19, BR-AI-20).
// Runtime-only: no provider call, persistence, or cache.
const composeUploadedCvProfile = ({
  cvSource,
  extractedText,
  pdfExtractionOutput,
} = {}) => {
  const inputIssues = [
    ...findUploadedCvSourceIssues(cvSource),
    ...(isNonEmptyTrimmedString(extractedText)
      ? []
      : ["extractedText must be non-empty extracted PDF text"]),
  ];

  if (inputIssues.length > 0) {
    throw new UploadedCvNormalizationError(
      UPLOADED_CV_NORMALIZATION_ERROR_CODES.INVALID_UPLOADED_CV_INPUT,
      "Uploaded CV input does not satisfy the AI-V02 Uploaded CV source contract",
      { details: inputIssues },
    );
  }

  const extraction = parsePdfExtractionOutput(pdfExtractionOutput);

  try {
    if (
      extraction === undefined ||
      findPdfExtractionIssues(extraction, extractedText).length > 0
    ) {
      return FAILED_RESULT;
    }

    return deepFreeze({
      status: NORMALIZATION_STATUS.READY,
      profile: {
        source: { type: "UPLOADED_CV", candidateCvId: cvSource.candidateCvId },
        metadata: buildCvMetadata(cvSource),
        pdfContent: structuredClone(extraction),
      },
    });
  } catch {
    return FAILED_RESULT;
  }
};

export {
  UPLOADED_CV_NORMALIZATION_ERROR_CODES,
  UPLOADED_CV_PDF_EXTRACTION_SCHEMA,
  UploadedCvNormalizationError,
  composeUploadedCvProfile,
  assertUploadedCvSource,
};
