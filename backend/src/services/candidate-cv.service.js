import mongoose from "mongoose";

import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../constants/category-level.js";
import EMPLOYMENT_TYPE from "../constants/employment-type.js";
import LOCATION from "../constants/location.js";
import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import WORK_MODE from "../constants/work-mode.js";
import CandidateCV from "../models/candidate-cv.model.js";
import Category from "../models/category.model.js";
import ExperienceLevel from "../models/experience-level.model.js";
import AppError from "../utils/app-error.js";

const LOCATION_VALUES = new Set(Object.values(LOCATION));
const EMPLOYMENT_TYPE_VALUES = new Set(Object.values(EMPLOYMENT_TYPE));
const WORK_MODE_VALUES = new Set(Object.values(WORK_MODE));
const CATEGORY_LEVEL_VALUES = new Set(Object.values(CATEGORY_LEVEL));
const VISIBILITY_VALUES = new Set(Object.values(CANDIDATE_CV_VISIBILITY));

const toPublicCandidateCvSummary = (candidateCv) => {
  return {
    id: candidateCv._id.toString(),
    candidateUserId: candidateCv.candidateUserId.toString(),
    name: candidateCv.name,
    sourceType: candidateCv.sourceType,
    status: candidateCv.status,
    visibility: candidateCv.visibility,
    categoryId: candidateCv.categoryId.toString(),
    experienceLevelId: candidateCv.experienceLevelId
      ? candidateCv.experienceLevelId.toString()
      : null,
    preferredLocations: [...(candidateCv.preferredLocations ?? [])],
    skillTags: [...(candidateCv.skillTags ?? [])],
    employmentTypes: [...(candidateCv.employmentTypes ?? [])],
    workModes: [...(candidateCv.workModes ?? [])],
    isDefault: candidateCv.isDefault,
    archivedAt: candidateCv.archivedAt ?? null,
    createdAt: candidateCv.createdAt,
    updatedAt: candidateCv.updatedAt,
  };
};

const toPublicGeneratedContent = (generatedContent) => {
  if (generatedContent == null) {
    return null;
  }

  return {
    personalInfo: {
      fullName: generatedContent.personalInfo?.fullName ?? null,
      email: generatedContent.personalInfo?.email ?? null,
      phone: generatedContent.personalInfo?.phone ?? null,
      displayLocation: generatedContent.personalInfo?.displayLocation ?? null,
      links: [...(generatedContent.personalInfo?.links ?? [])],
      avatarUrl: generatedContent.personalInfo?.avatarUrl ?? null,
    },
    professionalSummary: generatedContent.professionalSummary ?? null,
    educations: (generatedContent.educations ?? []).map((education) => ({
      institutionName: education.institutionName ?? null,
      degree: education.degree ?? null,
      fieldOfStudy: education.fieldOfStudy ?? null,
      startDate: education.startDate ?? null,
      endDate: education.endDate ?? null,
    })),
    skills: [...(generatedContent.skills ?? [])],
    workExperiences: (generatedContent.workExperiences ?? []).map(
      (experience) => ({
        companyName: experience.companyName ?? null,
        position: experience.position ?? null,
        startDate: experience.startDate ?? null,
        endDate: experience.endDate ?? null,
        description: experience.description ?? null,
        achievements: [...(experience.achievements ?? [])],
      }),
    ),
    projects: (generatedContent.projects ?? []).map((project) => ({
      name: project.name ?? null,
      role: project.role ?? null,
      technologies: [...(project.technologies ?? [])],
      description: project.description ?? null,
      projectUrl: project.projectUrl ?? null,
    })),
    certifications: (generatedContent.certifications ?? []).map(
      (certification) => ({
        name: certification.name ?? null,
        issuer: certification.issuer ?? null,
        issueDate: certification.issueDate ?? null,
        expirationDate: certification.expirationDate ?? null,
        credentialId: certification.credentialId ?? null,
        credentialUrl: certification.credentialUrl ?? null,
      }),
    ),
    languages: (generatedContent.languages ?? []).map((language) => ({
      name: language.name ?? null,
      proficiency: language.proficiency ?? null,
    })),
    hiddenSections: [...(generatedContent.hiddenSections ?? [])],
  };
};

const toPublicUploadedFile = (uploadedFile) => {
  if (uploadedFile == null) {
    return null;
  }

  return {
    storageKey: uploadedFile.storageKey,
    originalFileName: uploadedFile.originalFileName,
    mimeType: uploadedFile.mimeType,
    sizeBytes: uploadedFile.sizeBytes,
    pageCount: uploadedFile.pageCount,
    uploadedAt: uploadedFile.uploadedAt,
  };
};

const toPublicCandidateCvDetail = (candidateCv) => {
  return {
    ...toPublicCandidateCvSummary(candidateCv),
    generatedContent: toPublicGeneratedContent(candidateCv.generatedContent),
    uploadedFile: toPublicUploadedFile(candidateCv.uploadedFile),
  };
};

const assertCandidateCvActor = (user) => {
  if (!user || user.role !== USER_ROLE.CANDIDATE) {
    throw new AppError(403, "Candidate access required");
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, "Candidate account is not active");
  }
};

const assertDistinctCanonicalValues = ({
  values,
  allowedValues,
  field,
  label,
}) => {
  if (!Array.isArray(values)) {
    throw new AppError(400, `CandidateCV ${field} must be an array`, {
      field,
    });
  }

  if (new Set(values).size !== values.length) {
    throw new AppError(400, `CandidateCV ${field} must not contain duplicates`, {
      field,
    });
  }

  for (const value of values) {
    if (!allowedValues.has(value)) {
      throw new AppError(
        400,
        `CandidateCV ${field} must use canonical ${label} values`,
        {
          field,
        },
      );
    }
  }
};

const assertGeneratedDraftCategory = async (categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    throw new AppError(400, "CandidateCV categoryId is invalid", {
      field: "categoryId",
    });
  }

  const category = await Category.findById(categoryId);

  if (!category) {
    throw new AppError(400, "CandidateCV categoryId must reference a Category", {
      field: "categoryId",
    });
  }

  if (!CATEGORY_LEVEL_VALUES.has(category.level)) {
    throw new AppError(
      400,
      "CandidateCV categoryId must reference a FIELD or POSITION Category",
      {
        field: "categoryId",
      },
    );
  }

  return category;
};

const assertOptionalExperienceLevel = async (experienceLevelId) => {
  if (experienceLevelId == null) {
    return null;
  }

  if (!mongoose.isValidObjectId(experienceLevelId)) {
    throw new AppError(400, "CandidateCV experienceLevelId is invalid", {
      field: "experienceLevelId",
    });
  }

  const experienceLevel = await ExperienceLevel.findById(experienceLevelId);

  if (!experienceLevel) {
    throw new AppError(
      400,
      "CandidateCV experienceLevelId must reference a canonical ExperienceLevel",
      {
        field: "experienceLevelId",
      },
    );
  }

  return experienceLevel._id;
};

const normalizeRequiredName = (name) => {
  if (typeof name !== "string" || name.trim() === "") {
    throw new AppError(400, "CandidateCV name is required", {
      field: "name",
    });
  }

  return name.trim();
};

const normalizeVisibility = (visibility) => {
  if (!VISIBILITY_VALUES.has(visibility)) {
    throw new AppError(400, "visibility must be PRIVATE or PUBLIC", {
      field: "visibility",
    });
  }

  return visibility;
};

const normalizeSkillTags = (skillTags) => {
  if (skillTags === undefined) {
    return [];
  }

  if (!Array.isArray(skillTags)) {
    throw new AppError(400, "CandidateCV skillTags must be an array", {
      field: "skillTags",
    });
  }

  return skillTags.map((tag) => {
    if (typeof tag !== "string" || tag.trim() === "") {
      throw new AppError(400, "Each skill tag must be a non-empty string", {
        field: "skillTags",
      });
    }

    return tag.trim();
  });
};

const createGeneratedDraftCandidateCv = async ({
  candidateUserId,
  actorUser,
  draft,
}) => {
  assertCandidateCvActor(actorUser);

  // BR-04 / BR-42: ownership is always the authenticated Candidate.
  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only create their own CVs");
  }

  const name = normalizeRequiredName(draft?.name);
  const visibility = normalizeVisibility(draft?.visibility);
  const category = await assertGeneratedDraftCategory(draft?.categoryId);
  const experienceLevelId = await assertOptionalExperienceLevel(
    draft?.experienceLevelId,
  );

  const preferredLocations = draft?.preferredLocations ?? [];
  const employmentTypes = draft?.employmentTypes ?? [];
  const workModes = draft?.workModes ?? [];
  const skillTags = normalizeSkillTags(draft?.skillTags);

  // BR-29 / BR-30: Location vocabulary excludes REMOTE; REMOTE belongs to WorkMode.
  assertDistinctCanonicalValues({
    values: preferredLocations,
    allowedValues: LOCATION_VALUES,
    field: "preferredLocations",
    label: "Location",
  });
  assertDistinctCanonicalValues({
    values: employmentTypes,
    allowedValues: EMPLOYMENT_TYPE_VALUES,
    field: "employmentTypes",
    label: "EmploymentType",
  });
  assertDistinctCanonicalValues({
    values: workModes,
    allowedValues: WORK_MODE_VALUES,
    field: "workModes",
    label: "WorkMode",
  });

  // F03 / BR-09–BR-11: exact Generated Draft initialization.
  // BR-31: metadata create does not synthesize Harvard content beyond empty shell.
  const candidateCv = await CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status: CANDIDATE_CV_STATUS.DRAFT,
    visibility,
    categoryId: category._id,
    experienceLevelId,
    preferredLocations,
    skillTags,
    employmentTypes,
    workModes,
    isDefault: false,
    generatedContent: {},
    archivedAt: null,
  });

  return toPublicCandidateCvDetail(candidateCv);
};

const listOwnActiveCandidateCvs = async ({ candidateUserId, actorUser }) => {
  assertCandidateCvActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only access their own CVs");
  }

  const candidateCvs = await CandidateCV.find({
    candidateUserId,
    archivedAt: null,
  }).sort({ updatedAt: -1, _id: -1 });

  return candidateCvs.map(toPublicCandidateCvSummary);
};

const getOwnActiveCandidateCv = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
}) => {
  assertCandidateCvActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only access their own CVs");
  }

  if (!mongoose.isValidObjectId(candidateCvId)) {
    throw new AppError(404, "Candidate CV not found");
  }

  const candidateCv = await CandidateCV.findOne({
    _id: candidateCvId,
    candidateUserId,
    archivedAt: null,
  });

  if (!candidateCv) {
    throw new AppError(404, "Candidate CV not found");
  }

  return toPublicCandidateCvDetail(candidateCv);
};

export {
  createGeneratedDraftCandidateCv,
  getOwnActiveCandidateCv,
  listOwnActiveCandidateCvs,
  toPublicCandidateCvDetail,
  toPublicCandidateCvSummary,
};
