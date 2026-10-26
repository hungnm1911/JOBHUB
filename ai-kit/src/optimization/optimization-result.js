import { LANGUAGE_PROFICIENCIES } from "../normalization/cv-normalization.js";
import { deepFreeze, isPlainObject } from "../normalization/normalization-support.js";

const nullableString = { type: ["string", "null"] };
const nullableDate = { type: ["string", "null"] };
const stringList = { type: "array", items: { type: "string" } };
const strictObject = (properties) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const nullableList = (items) => ({ type: ["array", "null"], items });
const itemList = (properties) => nullableList(strictObject(properties));

// AI-V06 Data §6.6: seven replacement sections only. Every property is
// required for provider-native strict JSON; null explicitly retains baseline.
// Date values cross the JSON boundary as strings and are cast by Backend V7.
const OPTIMIZATION_RESULT_SCHEMA = deepFreeze(strictObject({
  professionalSummary: nullableString,
  skills: nullableList({ type: "string" }),
  workExperiences: itemList({
    companyName: nullableString,
    position: nullableString,
    startDate: nullableDate,
    endDate: nullableDate,
    description: nullableString,
    achievements: stringList,
  }),
  projects: itemList({
    name: nullableString,
    role: nullableString,
    technologies: stringList,
    description: nullableString,
    projectUrl: nullableString,
  }),
  educations: itemList({
    institutionName: nullableString,
    degree: nullableString,
    fieldOfStudy: nullableString,
    startDate: nullableDate,
    endDate: nullableDate,
  }),
  certifications: itemList({
    name: nullableString,
    issuer: nullableString,
    issueDate: nullableDate,
    expirationDate: nullableDate,
    credentialId: nullableString,
    credentialUrl: nullableString,
  }),
  languages: itemList({
    name: nullableString,
    proficiency: { type: ["string", "null"], enum: [...LANGUAGE_PROFICIENCIES, null] },
  }),
}));

class OptimizationResultError extends Error {
  constructor(details) {
    super("AI-V06 Optimization Result does not satisfy its output contract");
    this.name = "OptimizationResultError";
    this.code = "INVALID_OPTIMIZATION_RESULT";
    this.details = details;
  }
}

const isIsoDateString = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
    return false;
  }
  const calendarDay = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(Date.parse(value)) && Number.isFinite(calendarDay.getTime())
    && calendarDay.toISOString().slice(0, 10) === value.slice(0, 10);
};

const findSchemaIssues = (value, schema, path = "") => {
  const types = [schema.type].flat();
  if (value === null) {
    return types.includes("null") ? [] : [`${path || "/"} must not be null`];
  }
  if (types.includes("string")) {
    if (typeof value !== "string") {
      return [`${path || "/"} must be a string`];
    }
    if (schema === nullableDate && !isIsoDateString(value)) {
      return [`${path || "/"} must be an ISO 8601 date string`];
    }
    return schema.enum && !schema.enum.includes(value)
      ? [`${path || "/"} must be a canonical enum value`]
      : [];
  }
  if (types.includes("array")) {
    return Array.isArray(value)
      ? value.flatMap((item, index) => findSchemaIssues(item, schema.items, `${path}/${index}`))
      : [`${path || "/"} must be an array`];
  }
  if (!isPlainObject(value)) {
    return [`${path || "/"} must be an object`];
  }

  const missing = schema.required.filter((key) => !Object.hasOwn(value, key))
    .map((key) => `${path}/${key} is required`);
  const extra = Object.keys(value).filter((key) => !Object.hasOwn(schema.properties, key))
    .map((key) => `${path}/${key} is not allowed`);
  return [
    ...missing,
    ...extra,
    ...Object.entries(schema.properties).flatMap(([key, fieldSchema]) => {
      return Object.hasOwn(value, key)
        ? findSchemaIssues(value[key], fieldSchema, `${path}/${key}`)
        : [];
    }),
  ];
};

const parseOptimizationResult = (outputText) => {
  let result;
  try {
    result = JSON.parse(outputText);
  } catch {
    throw new OptimizationResultError(["/ must be valid JSON"]);
  }

  const issues = findSchemaIssues(result, OPTIMIZATION_RESULT_SCHEMA);
  if (issues.length > 0) {
    throw new OptimizationResultError(issues);
  }
  return result;
};

export { OPTIMIZATION_RESULT_SCHEMA, OptimizationResultError, parseOptimizationResult };
