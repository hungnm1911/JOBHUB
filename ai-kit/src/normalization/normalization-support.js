const NORMALIZATION_STATUS = Object.freeze({
  READY: "READY",
  FAILED: "FAILED",
});

const FAILED_RESULT = Object.freeze({
  status: NORMALIZATION_STATUS.FAILED,
  profile: null,
});

// Closed sets mirror the Backend EmploymentType and WorkMode constants shared
// by Job and CandidateCV; AI Kit cannot import Backend, so they must be kept
// in step with those owners.
const EMPLOYMENT_TYPES = Object.freeze([
  "FULL_TIME",
  "PART_TIME",
  "INTERNSHIP",
  "CONTRACT",
  "TEMPORARY",
  "FREELANCE",
  "SEASONAL",
  "APPRENTICESHIP",
]);
const WORK_MODES = Object.freeze(["ONSITE", "HYBRID", "REMOTE"]);

// Mirror the Backend CATEGORY_LEVEL and EXPERIENCE_LEVEL constants and the
// Category/ExperienceLevel catalog fields. Backend resolves the source's
// taxonomy references; AI Kit only validates the resolved values against the IDs.
const CATEGORY_LEVELS = Object.freeze({ FIELD: "FIELD", POSITION: "POSITION" });
const EXPERIENCE_LEVEL_CODES = Object.freeze([
  "NO_EXPERIENCE",
  "UNDER_1_YEAR",
  "ONE_TO_THREE_YEARS",
  "THREE_TO_FIVE_YEARS",
  "FIVE_TO_TEN_YEARS",
  "OVER_TEN_YEARS",
]);
const CATEGORY_FIELDS = Object.freeze(["id", "name", "level", "parentCategoryId"]);
const EXPERIENCE_LEVEL_FIELDS = Object.freeze(["id", "code"]);
const LOCATION_FIELDS = Object.freeze(["provinceCode", "districtCode"]);

const isPlainObject = (value) => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

const isNonEmptyTrimmedString = (value) => {
  return typeof value === "string" && value.trim() !== "";
};

const findExactKeyIssues = (value, fields, path) => {
  const keys = Object.keys(value);

  return [
    ...keys
      .filter((key) => !fields.includes(key))
      .map((key) => `${path}/${key} is not an allowed field`),
    ...fields
      .filter((field) => !keys.includes(field))
      .map((field) => `${path}/${field} is required`),
  ];
};

const findNullableTextIssues = (value, path) => {
  return value === null || isNonEmptyTrimmedString(value)
    ? []
    : [`${path} must be null or a non-empty string`];
};

const findListIssues = (
  values,
  path,
  { isValidItem, itemRule, distinct = false },
) => {
  if (!Array.isArray(values)) {
    return [`${path} must be an array`];
  }

  const issues = values.flatMap((item, index) => {
    return isValidItem(item) ? [] : [`${path}/${index} must be ${itemRule}`];
  });

  if (distinct && new Set(values).size !== values.length) {
    issues.push(`${path} must not contain duplicates`);
  }

  return issues;
};

// Data Backend V8 §4.2: FIELD has no parent; POSITION has a FIELD parent.
const findCategoryIssues = (category, path) => {
  if (!isPlainObject(category)) {
    return [`${path} must be a resolved Category object`];
  }

  const keyIssues = findExactKeyIssues(category, CATEGORY_FIELDS, path);

  if (keyIssues.length > 0) {
    return keyIssues;
  }

  const { id, name, level, parentCategoryId } = category;
  const issues = [
    ...(isNonEmptyTrimmedString(id) ? [] : [`${path}/id must be a non-empty string`]),
    ...(isNonEmptyTrimmedString(name)
      ? []
      : [`${path}/name must be a non-empty string`]),
  ];

  if (level === CATEGORY_LEVELS.FIELD) {
    if (parentCategoryId !== null) {
      issues.push(`${path} FIELD Category must not have a parent`);
    }
  } else if (level === CATEGORY_LEVELS.POSITION) {
    if (!isNonEmptyTrimmedString(parentCategoryId)) {
      issues.push(`${path} POSITION Category must have a parent`);
    }
  } else {
    issues.push(`${path}/level must be a canonical CategoryLevel value`);
  }

  return issues;
};

const findExperienceLevelIssues = (experienceLevel) => {
  const path = "/taxonomy/experienceLevel";

  if (experienceLevel === null) {
    return [];
  }

  if (!isPlainObject(experienceLevel)) {
    return [`${path} must be null or a resolved ExperienceLevel object`];
  }

  const keyIssues = findExactKeyIssues(
    experienceLevel,
    EXPERIENCE_LEVEL_FIELDS,
    path,
  );

  if (keyIssues.length > 0) {
    return keyIssues;
  }

  return [
    ...(isNonEmptyTrimmedString(experienceLevel.id)
      ? []
      : [`${path}/id must be a non-empty string`]),
    ...(EXPERIENCE_LEVEL_CODES.includes(experienceLevel.code)
      ? []
      : [`${path}/code must be a canonical ExperienceLevel code`]),
  ];
};

const findExperienceLevelReferenceIssues = (experienceLevelId, experienceLevel) => {
  if (experienceLevelId === null) {
    return experienceLevel === null
      ? []
      : ["/taxonomy/experienceLevel must be null when /experienceLevelId is null"];
  }

  return experienceLevel?.id === experienceLevelId
    ? []
    : ["/taxonomy/experienceLevel must resolve /experienceLevelId"];
};

const sourced = (value, sourcePath) => ({ value, sourcePath });

const sourcedOrNull = (value, sourcePath) => {
  return value === null ? null : sourced(value, sourcePath);
};

const sourcedList = (values, sourcePath) => {
  return values.map((value, index) => sourced(value, `${sourcePath}/${index}`));
};

const pickFields = (value, fields) => {
  return Object.fromEntries(fields.map((field) => [field, value[field]]));
};

const resolveSourcePath = (source, sourcePath) => {
  return sourcePath
    .split("/")
    .slice(1)
    .reduce((value, token) => value?.[token], source);
};

const deepFreeze = (value) => {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }

  return value;
};

export {
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
};
