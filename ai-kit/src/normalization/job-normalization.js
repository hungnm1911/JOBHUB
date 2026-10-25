import { isDeepStrictEqual } from "node:util";

import {
  CATEGORY_FIELDS,
  CATEGORY_LEVELS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVEL_FIELDS,
  FAILED_RESULT,
  LOCATION_FIELDS,
  NORMALIZATION_STATUS,
  WORK_MODES,
  deepFreeze,
  findCategoryIssues,
  findExactKeyIssues,
  findExperienceLevelIssues,
  findExperienceLevelReferenceIssues,
  findListIssues,
  findNullableTextIssues,
  isNonEmptyTrimmedString,
  isPlainObject,
  pickFields,
  resolveSourcePath,
  sourced,
  sourcedList,
  sourcedOrNull,
} from "./normalization-support.js";

const JOB_NORMALIZATION_ERROR_CODES = Object.freeze({
  INVALID_JOB_INPUT: "INVALID_JOB_INPUT",
});

const JOB_NORMALIZATION_STATUS = NORMALIZATION_STATUS;

// Closed sets mirror the V4.2 Structured Salary SalaryType/SalaryPeriod
// constants of the Backend Job; AI Kit cannot import Backend, so they must be
// kept in step with that owner.
const SALARY_TYPES = Object.freeze([
  "FIXED",
  "RANGE",
  "FROM",
  "UP_TO",
  "NEGOTIABLE",
]);
const SALARY_PERIODS = Object.freeze([
  "HOUR",
  "DAY",
  "WEEK",
  "MONTH",
  "SHIFT",
  "ETC",
]);
const SALARY_FIELDS = Object.freeze([
  "type",
  "minAmount",
  "maxAmount",
  "period",
  "customPeriodLabel",
]);
const TAXONOMY_FIELDS = Object.freeze(["categories", "experienceLevel"]);

// Career-relevant Job fields only (Product AI-V01 §6.1, §6.3); tenant,
// recruiter, lifecycle, and deadline fields stay outside the AI boundary.
const JOB_SOURCE_FIELDS = Object.freeze([
  "jobId",
  "title",
  "jobDescription",
  "requiredSkills",
  "salary",
  "fieldCategoryIds",
  "positionCategoryIds",
  "experienceLevelId",
  "employmentType",
  "workModes",
  "location",
  "taxonomy",
]);

class JobNormalizationError extends Error {
  constructor(code, message, { details = [] } = {}) {
    super(message);
    this.name = "JobNormalizationError";
    this.code = code;
    this.details = details;
  }
}

const findLocationIssues = (location) => {
  if (location === null) {
    return [];
  }

  if (!isPlainObject(location)) {
    return ["/location must be null or a JobLocation object"];
  }

  const keyIssues = findExactKeyIssues(location, LOCATION_FIELDS, "/location");

  if (keyIssues.length > 0) {
    return keyIssues;
  }

  const { provinceCode, districtCode } = location;

  return [
    ...(isNonEmptyTrimmedString(provinceCode)
      ? []
      : ["/location/provinceCode must be a non-empty string"]),
    ...findNullableTextIssues(districtCode, "/location/districtCode"),
  ];
};

// Data V4.2 Structured Salary: VND integer amounts and the
// type/amount/period matrix enforced by the Backend Job model.
const findSalaryIssues = (salary) => {
  if (salary === null) {
    return [];
  }

  if (!isPlainObject(salary)) {
    return ["/salary must be null or a Structured Salary object"];
  }

  const keyIssues = findExactKeyIssues(salary, SALARY_FIELDS, "/salary");

  if (keyIssues.length > 0) {
    return keyIssues;
  }

  const { type, minAmount, maxAmount, period, customPeriodLabel } = salary;

  if (!SALARY_TYPES.includes(type)) {
    return ["/salary/type must be a canonical SalaryType value"];
  }

  const issues = [];

  for (const [field, amount] of [
    ["minAmount", minAmount],
    ["maxAmount", maxAmount],
  ]) {
    if (amount !== null && !Number.isSafeInteger(amount)) {
      issues.push(`/salary/${field} must be null or an integer VND amount`);
    }
  }

  if (type === "NEGOTIABLE") {
    if (
      minAmount !== null ||
      maxAmount !== null ||
      period !== null ||
      customPeriodLabel !== null
    ) {
      issues.push(
        "/salary NEGOTIABLE must not have amounts, period, or customPeriodLabel",
      );
    }

    return issues;
  }

  const amountsMatchType = {
    FIXED: minAmount !== null && minAmount === maxAmount,
    RANGE:
      minAmount !== null && maxAmount !== null && minAmount <= maxAmount,
    FROM: minAmount !== null && maxAmount === null,
    UP_TO: minAmount === null && maxAmount !== null,
  }[type];

  if (!amountsMatchType) {
    issues.push(`/salary amounts do not match salary type ${type}`);
  }

  if (!SALARY_PERIODS.includes(period)) {
    issues.push("/salary/period must be a canonical SalaryPeriod value");
  } else if (period === "ETC") {
    if (!isNonEmptyTrimmedString(customPeriodLabel)) {
      issues.push("/salary/customPeriodLabel is required for ETC period");
    }
  } else if (customPeriodLabel !== null) {
    issues.push("/salary/customPeriodLabel is only allowed for ETC period");
  }

  return issues;
};

const findTaxonomyIssues = (taxonomy) => {
  if (!isPlainObject(taxonomy)) {
    return ["/taxonomy must be a resolved taxonomy object"];
  }

  const keyIssues = findExactKeyIssues(taxonomy, TAXONOMY_FIELDS, "/taxonomy");

  if (keyIssues.length > 0) {
    return keyIssues;
  }

  const { categories, experienceLevel } = taxonomy;

  if (!Array.isArray(categories)) {
    return ["/taxonomy/categories must be an array"];
  }

  const issues = [
    ...categories.flatMap((category, index) => {
      return findCategoryIssues(category, `/taxonomy/categories/${index}`);
    }),
    ...findExperienceLevelIssues(experienceLevel),
  ];

  const ids = categories.map((category) => category?.id);

  if (new Set(ids).size !== ids.length) {
    issues.push("/taxonomy/categories must not contain duplicate ids");
  }

  return issues;
};

// The resolved taxonomy must cover exactly the Job's references, at the
// level each reference list requires (Data Backend V8 §4.3, §4.4, §4.8).
const findTaxonomyReferenceIssues = (jobSource) => {
  const { categories, experienceLevel } = jobSource.taxonomy;
  const indexById = new Map(categories.map(({ id }, index) => [id, index]));
  const referenced = new Set();
  const issues = [];

  for (const [field, level] of [
    ["fieldCategoryIds", CATEGORY_LEVELS.FIELD],
    ["positionCategoryIds", CATEGORY_LEVELS.POSITION],
  ]) {
    jobSource[field].forEach((id, position) => {
      const index = indexById.get(id);

      if (index === undefined) {
        issues.push(`/${field}/${position} has no resolved Category`);
        return;
      }

      referenced.add(index);

      if (categories[index].level !== level) {
        issues.push(`/${field}/${position} must resolve to a ${level} Category`);
      }
    });
  }

  categories.forEach((_category, index) => {
    if (!referenced.has(index)) {
      issues.push(`/taxonomy/categories/${index} is not referenced by the Job`);
    }
  });

  issues.push(
    ...findExperienceLevelReferenceIssues(
      jobSource.experienceLevelId,
      experienceLevel,
    ),
  );

  return issues;
};

const findJobSourceIssues = (jobSource) => {
  if (!isPlainObject(jobSource)) {
    return ["Job source must be a plain object"];
  }

  const keyIssues = findExactKeyIssues(jobSource, JOB_SOURCE_FIELDS, "");

  if (keyIssues.length > 0) {
    return keyIssues;
  }

  const {
    jobId,
    title,
    jobDescription,
    requiredSkills,
    salary,
    fieldCategoryIds,
    positionCategoryIds,
    experienceLevelId,
    employmentType,
    workModes,
    location,
    taxonomy,
  } = jobSource;
  const reference = {
    isValidItem: isNonEmptyTrimmedString,
    itemRule: "a non-empty string",
  };

  const issues = [
    ...(isNonEmptyTrimmedString(jobId)
      ? []
      : ["/jobId must be a non-empty string"]),
    ...findNullableTextIssues(title, "/title"),
    ...findNullableTextIssues(jobDescription, "/jobDescription"),
    ...findListIssues(requiredSkills, "/requiredSkills", reference),
    ...findSalaryIssues(salary),
    ...findListIssues(fieldCategoryIds, "/fieldCategoryIds", {
      ...reference,
      distinct: true,
    }),
    ...findListIssues(positionCategoryIds, "/positionCategoryIds", {
      ...reference,
      distinct: true,
    }),
    ...findNullableTextIssues(experienceLevelId, "/experienceLevelId"),
    ...(employmentType === null || EMPLOYMENT_TYPES.includes(employmentType)
      ? []
      : ["/employmentType must be null or a canonical EmploymentType value"]),
    ...findListIssues(workModes, "/workModes", {
      isValidItem: (item) => WORK_MODES.includes(item),
      itemRule: "a canonical WorkMode value",
      distinct: true,
    }),
    ...findLocationIssues(location),
    ...findTaxonomyIssues(taxonomy),
  ];

  return issues.length > 0 ? issues : findTaxonomyReferenceIssues(jobSource);
};

// Ordered by the Job's ID list; each value is the Backend-resolved Category.
const resolvedCategories = (jobSource, field) => {
  const { categories } = jobSource.taxonomy;

  return jobSource[field].map((id) => {
    const index = categories.findIndex((category) => category.id === id);

    return sourced(
      pickFields(categories[index], CATEGORY_FIELDS),
      `/taxonomy/categories/${index}`,
    );
  });
};

// Values are copied as provided: free text is kept verbatim, requiredSkills
// keep source order and duplicates, and no priority, alias, or label is added.
const buildJobMatchProfile = (jobSource) => ({
  source: { type: "JOB", jobId: jobSource.jobId },
  freeText: {
    title: sourcedOrNull(jobSource.title, "/title"),
    jobDescription: sourcedOrNull(jobSource.jobDescription, "/jobDescription"),
  },
  metadata: {
    requiredSkills: sourcedList(jobSource.requiredSkills, "/requiredSkills"),
    salary:
      jobSource.salary === null
        ? null
        : sourced(pickFields(jobSource.salary, SALARY_FIELDS), "/salary"),
    employmentType: sourcedOrNull(jobSource.employmentType, "/employmentType"),
    workModes: sourcedList(jobSource.workModes, "/workModes"),
    location:
      jobSource.location === null
        ? null
        : sourced(pickFields(jobSource.location, LOCATION_FIELDS), "/location"),
    fieldCategoryIds: sourcedList(
      jobSource.fieldCategoryIds,
      "/fieldCategoryIds",
    ),
    positionCategoryIds: sourcedList(
      jobSource.positionCategoryIds,
      "/positionCategoryIds",
    ),
    experienceLevelId: sourcedOrNull(
      jobSource.experienceLevelId,
      "/experienceLevelId",
    ),
    fieldCategories: resolvedCategories(jobSource, "fieldCategoryIds"),
    positionCategories: resolvedCategories(jobSource, "positionCategoryIds"),
    experienceLevel:
      jobSource.taxonomy.experienceLevel === null
        ? null
        : sourced(
            pickFields(
              jobSource.taxonomy.experienceLevel,
              EXPERIENCE_LEVEL_FIELDS,
            ),
            "/taxonomy/experienceLevel",
          ),
  },
});

// Rejects a profile that drops, adds, or alters any source value, so READY is
// never reported for a lossy or fabricated profile (BR-AI-07, BR-AI-14).
const findProfileIssues = (profile, jobSource) => {
  const entries = [
    ...Object.values(profile.freeText),
    ...Object.values(profile.metadata),
  ]
    .flat()
    .filter((entry) => entry !== null);
  const { categories, experienceLevel } = jobSource.taxonomy;
  const expectedCount = JOB_SOURCE_FIELDS.filter((field) => {
    return field !== "jobId" && field !== "taxonomy";
  })
    .map((field) => jobSource[field])
    .concat([categories, experienceLevel])
    .reduce((count, value) => {
      if (Array.isArray(value)) {
        return count + value.length;
      }

      return value === null ? count : count + 1;
    }, 0);
  const { metadata } = profile;
  const resolvedIdsMatch =
    isDeepStrictEqual(
      metadata.fieldCategories.map(({ value }) => value.id),
      jobSource.fieldCategoryIds,
    ) &&
    isDeepStrictEqual(
      metadata.positionCategories.map(({ value }) => value.id),
      jobSource.positionCategoryIds,
    ) &&
    (metadata.experienceLevel?.value.id ?? null) === jobSource.experienceLevelId;
  const issues = entries
    .filter(({ value, sourcePath }) => {
      return !isDeepStrictEqual(
        value,
        resolveSourcePath(jobSource, sourcePath),
      );
    })
    .map(({ sourcePath }) => `${sourcePath} does not match the Job source`);

  if (entries.length !== expectedCount) {
    issues.push("profile does not preserve every Job source value");
  }

  if (!resolvedIdsMatch) {
    issues.push("resolved taxonomy does not match the Job source IDs");
  }

  if (profile.source.jobId !== jobSource.jobId) {
    issues.push("profile source does not identify the Job");
  }

  return issues;
};

// F01: deterministic Job → JobMatchProfile normalization. No LLM, no
// free-text interpretation, no persistence; the result is runtime-only.
const normalizeJob = (jobSource, { strictFailures = false } = {}) => {
  const inputIssues = findJobSourceIssues(jobSource);

  if (inputIssues.length > 0) {
    throw new JobNormalizationError(
      JOB_NORMALIZATION_ERROR_CODES.INVALID_JOB_INPUT,
      "Job input does not satisfy the AI-V01 Job source contract",
      { details: inputIssues },
    );
  }

  try {
    const profile = buildJobMatchProfile(jobSource);

    if (findProfileIssues(profile, jobSource).length > 0) {
      if (strictFailures) throw new Error("Job profile preservation check failed");
      return FAILED_RESULT;
    }

    return deepFreeze({ status: JOB_NORMALIZATION_STATUS.READY, profile });
  } catch (error) {
    if (strictFailures) throw error;
    return FAILED_RESULT;
  }
};

export {
  JOB_NORMALIZATION_ERROR_CODES,
  JOB_NORMALIZATION_STATUS,
  JobNormalizationError,
  normalizeJob,
};
