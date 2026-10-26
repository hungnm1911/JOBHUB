import mongoose from "mongoose";

import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../constants/candidate-cv-status.js";
import CV_LANGUAGE_PROFICIENCY from "../constants/cv-language-proficiency.js";
import AppError from "../utils/app-error.js";
import { loadOwnActiveCandidateCv } from "./candidate-cv.service.js";
import { getOwnCandidateProfile } from "./candidate-profile.service.js";

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

const sourceMetadata = (source) => Object.fromEntries(BASELINE_METADATA_FIELDS
  .filter((field) => Object.hasOwn(source, field))
  .map((field) => [
    field,
    field === "categoryId" || field === "experienceLevelId"
      ? cloneObjectId(source[field])
      : structuredClone(source[field]),
  ]));

const careerSectionsFromContent = (generatedContent) => ({
  professionalSummary: generatedContent.professionalSummary ?? null,
  ...Object.fromEntries(CAREER_ARRAY_SECTIONS.map((section) => [
    section, structuredClone(generatedContent[section] ?? []),
  ])),
});

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

  return {
    metadata: sourceMetadata(source),
    generatedContent,
    careerSections: careerSectionsFromContent(generatedContent),
  };
};

const presentString = (value) =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const ITEM_FIELDS = Object.freeze({
  workExperiences: ["companyName", "position", "description"],
  projects: ["name", "role", "description", "projectUrl"],
  educations: ["institutionName", "degree", "fieldOfStudy"],
  certifications: ["name", "issuer", "credentialId", "credentialUrl"],
});

const mapItems = (items, fields, extras = {}) => items.map((item) => ({
  ...Object.fromEntries(fields.map((field) => [field, item[field] ?? null])),
  ...extras,
}));

// AI-V06 F02: the existing AI-V02 result supplies career claims. Uploaded
// periods/dates are free text, so no precise V7 Date can be derived here.
const toUploadedGeneratedContent = (pdfContent, candidateProfile) => ({
  personalInfo: {
    fullName: presentString(candidateProfile.fullName),
    email: presentString(candidateProfile.email),
    phone: presentString(candidateProfile.phoneNumber),
    displayLocation: null,
    links: [],
    avatarUrl: presentString(candidateProfile.avatarUrl),
  },
  professionalSummary: pdfContent.professionalSummary.length
    ? pdfContent.professionalSummary.map(({ value }) => value).join("\n")
    : null,
  skills: pdfContent.skills.map(({ value }) => value),
  workExperiences: mapItems(pdfContent.workExperiences, ITEM_FIELDS.workExperiences, {
    startDate: null, endDate: null,
  }).map((item, index) => ({
    ...item, achievements: [...(pdfContent.workExperiences[index].achievements ?? [])],
  })),
  projects: mapItems(pdfContent.projects, ITEM_FIELDS.projects).map((item, index) => ({
    ...item, technologies: [...(pdfContent.projects[index].technologies ?? [])],
  })),
  educations: mapItems(pdfContent.educations, ITEM_FIELDS.educations, {
    startDate: null, endDate: null,
  }),
  certifications: mapItems(pdfContent.certifications, ITEM_FIELDS.certifications, {
    issueDate: null, expirationDate: null,
  }),
  languages: pdfContent.languages.map(({ name, statedProficiency }) => ({
    name: name ?? null,
    proficiency: Object.values(CV_LANGUAGE_PROFICIENCY).includes(statedProficiency)
      ? statedProficiency : null,
  })),
  hiddenSections: [],
});

const prepareOwnUploadedCvBaseline = async ({ normalizationResult, ...input }) => {
  const source = await loadOwnActiveCandidateCv({ ...input, lean: true });

  if (source.sourceType !== CANDIDATE_CV_SOURCE_TYPE.UPLOADED
    || source.status !== CANDIDATE_CV_STATUS.ACTIVE) {
    throw new AppError(409, "Uploaded Candidate CV source is invalid");
  }

  const profile = normalizationResult?.profile;
  if (normalizationResult?.status !== "READY"
    || profile?.source?.type !== "UPLOADED_CV"
    || profile.source.candidateCvId !== source._id.toString()) {
    throw new AppError(409, "READY Uploaded CV normalization is required for this source");
  }

  const candidateProfile = await getOwnCandidateProfile({
    candidateUserId: input.candidateUserId,
  });
  const generatedContent = toUploadedGeneratedContent(profile.pdfContent, candidateProfile);

  return {
    metadata: sourceMetadata(source),
    generatedContent,
    careerSections: careerSectionsFromContent(generatedContent),
  };
};

export { prepareOwnGeneratedCvBaseline, prepareOwnUploadedCvBaseline };
