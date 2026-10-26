import mongoose from "mongoose";

import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../constants/candidate-cv-status.js";
import AppError from "../utils/app-error.js";
import { loadOwnActiveCandidateCv } from "./candidate-cv.service.js";

const CAREER_ARRAY_SECTIONS = [
  "skills",
  "workExperiences",
  "projects",
  "educations",
  "certifications",
  "languages",
];

const BASELINE_METADATA_FIELDS = [
  "name",
  "visibility",
  "categoryId",
  "experienceLevelId",
  "preferredLocations",
  "skillTags",
  "employmentTypes",
  "workModes",
];

const cloneObjectId = (value) =>
  value == null ? value : new mongoose.Types.ObjectId(value.toString());

// AI-V06 F02: retain the persisted Harvard source independently of the AI
// normalization profile. Empty section values describe absence, not CV claims.
const prepareOwnGeneratedCvBaseline = async (input) => {
  const source = await loadOwnActiveCandidateCv({ ...input, lean: true });

  if (source.sourceType !== CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    throw new AppError(409, "Only Generated Candidate CVs support this baseline");
  }
  if (![CANDIDATE_CV_STATUS.ACTIVE, CANDIDATE_CV_STATUS.DRAFT].includes(source.status)
    || source.generatedContent == null || typeof source.generatedContent !== "object") {
    throw new AppError(409, "Generated Candidate CV source is invalid");
  }

  const generatedContent = structuredClone(source.generatedContent);
  const careerSections = {
    professionalSummary: generatedContent.professionalSummary ?? null,
    ...Object.fromEntries(CAREER_ARRAY_SECTIONS.map((section) => [
      section, structuredClone(generatedContent[section] ?? []),
    ])),
  };

  return {
    metadata: Object.fromEntries(BASELINE_METADATA_FIELDS
      .filter((field) => Object.hasOwn(source, field))
      .map((field) => [
        field,
        field === "categoryId" || field === "experienceLevelId"
          ? cloneObjectId(source[field])
          : structuredClone(source[field]),
      ])),
    generatedContent,
    careerSections,
  };
};

export { prepareOwnGeneratedCvBaseline };
