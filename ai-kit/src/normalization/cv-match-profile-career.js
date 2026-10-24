import { deepFreeze } from "./normalization-support.js";

// One read contract for career content in both CVMatchProfile variants. The
// variants retain their source shapes; this view only aligns group and item
// structure. Source-specific fields stay separate rather than deriving dates,
// periods, proficiency, or other claims from one another.
const ITEM_FIELDS = Object.freeze({
  workExperiences: Object.freeze([
    "companyName", "position", "startDate", "endDate", "period",
    "description", "achievements",
  ]),
  projects: Object.freeze([
    "name", "role", "period", "technologies", "description", "projectUrl",
  ]),
  educations: Object.freeze([
    "institutionName", "degree", "fieldOfStudy", "startDate", "endDate", "period",
  ]),
  certifications: Object.freeze([
    "name", "issuer", "issueDate", "expirationDate", "date",
    "credentialId", "credentialUrl",
  ]),
  languages: Object.freeze(["name", "proficiency", "statedProficiency"]),
});
const LIST_FIELDS = Object.freeze(["achievements", "technologies"]);
const CV_CAREER_GROUPS = Object.freeze([
  "careerPositioning", "professionalSummary", "skills", ...Object.keys(ITEM_FIELDS),
  "otherCareerClaims", "unresolvedContent",
]);

const generatedProvenance = (sourcePath, fieldSourcePaths = {}) => ({
  sourcePath,
  fieldSourcePaths,
  evidence: [],
});

const pdfProvenance = (evidence) => ({
  sourcePath: null,
  fieldSourcePaths: {},
  evidence: [...evidence],
});

const generatedClaim = ({ value, sourcePath }) => ({
  value,
  provenance: generatedProvenance(sourcePath),
});

const pdfClaim = ({ value, evidence }) => ({
  value,
  provenance: pdfProvenance(evidence),
});

const generatedItem = (item, fields) => {
  const value = {};
  const fieldSourcePaths = {};

  for (const field of fields) {
    const sourced = item.freeText?.[field] ?? item[field] ?? null;

    if (LIST_FIELDS.includes(field)) {
      value[field] = sourced === null ? [] : sourced.map((entry) => entry.value);
      if (sourced?.length) {
        fieldSourcePaths[field] = sourced.map((entry) => entry.sourcePath);
      }
    } else {
      value[field] = sourced?.value ?? null;
      if (sourced !== null) {
        fieldSourcePaths[field] = sourced.sourcePath;
      }
    }
  }

  return { value, provenance: generatedProvenance(item.sourcePath, fieldSourcePaths) };
};

const pdfItem = (item, fields) => ({
  value: Object.fromEntries(fields.map((field) => {
    const value = item[field] ?? (LIST_FIELDS.includes(field) ? [] : null);
    return [field, Array.isArray(value) ? [...value] : value];
  })),
  provenance: pdfProvenance(item.evidence),
});

const readGeneratedCareerContent = (profile) => {
  const summary = profile.freeText.professionalSummary;

  return {
    careerPositioning: [],
    professionalSummary: summary === null ? [] : [generatedClaim(summary)],
    skills: profile.content.skills.map(generatedClaim),
    ...Object.fromEntries(Object.entries(ITEM_FIELDS).map(([group, fields]) => {
      return [group, profile.content[group].map((item) => generatedItem(item, fields))];
    })),
    otherCareerClaims: [],
    unresolvedContent: [],
  };
};

const readUploadedCareerContent = (profile) => {
  const { pdfContent } = profile;

  return {
    careerPositioning: pdfContent.careerPositioning.map(pdfClaim),
    professionalSummary: pdfContent.professionalSummary.map(pdfClaim),
    skills: pdfContent.skills.map(pdfClaim),
    ...Object.fromEntries(Object.entries(ITEM_FIELDS).map(([group, fields]) => {
      return [group, pdfContent[group].map((item) => pdfItem(item, fields))];
    })),
    otherCareerClaims: pdfContent.otherCareerClaims.map(pdfClaim),
    unresolvedContent: pdfContent.unresolvedContent.map(pdfClaim),
  };
};

const readCvCareerContent = (profile) => {
  switch (profile?.source?.type) {
    case "GENERATED_CV":
      return deepFreeze(readGeneratedCareerContent(profile));
    case "UPLOADED_CV":
      return deepFreeze(readUploadedCareerContent(profile));
    default:
      throw new TypeError("CVMatchProfile source type is unsupported");
  }
};

export { readCvCareerContent, CV_CAREER_GROUPS };
