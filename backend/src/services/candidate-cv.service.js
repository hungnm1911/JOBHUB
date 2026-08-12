import mongoose from "mongoose";

import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_STORAGE from "../constants/candidate-cv-uploaded-storage.js";
import CANDIDATE_CV_VISIBILITY from "../constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../constants/category-level.js";
import CLOUDINARY_FOLDER from "../constants/cloudinary-folder.js";
import CV_LANGUAGE_PROFICIENCY from "../constants/cv-language-proficiency.js";
import EMPLOYMENT_TYPE from "../constants/employment-type.js";
import LOCATION from "../constants/location.js";
import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import WORK_MODE from "../constants/work-mode.js";
import CandidateCV from "../models/candidate-cv.model.js";
import Category from "../models/category.model.js";
import ExperienceLevel from "../models/experience-level.model.js";
import AppError from "../utils/app-error.js";
import { inspectUploadedCandidateCvPdf } from "./candidate-cv-uploaded-pdf.service.js";
import { renderHarvardCandidateCvPdf } from "./candidate-cv-harvard-pdf.service.js";
import { deleteFile, downloadFileBuffer, uploadFileBuffer } from "./file.service.js";

const uploadOwnUploadedCandidateCvFile = (buffer) => {
  return uploadFileBuffer({
    buffer,
    assetFolder: CLOUDINARY_FOLDER.CANDIDATE_UPLOADED_CVS,
    resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
    deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
  });
};

const deleteOwnUploadedCandidateCvFile = (publicId) => {
  return deleteFile({
    publicId,
    resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
    deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
  });
};

const downloadOwnUploadedCandidateCvFile = (publicId) => {
  return downloadFileBuffer({
    publicId,
    resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
    deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
  });
};

const LOCATION_VALUES = new Set(Object.values(LOCATION));
const EMPLOYMENT_TYPE_VALUES = new Set(Object.values(EMPLOYMENT_TYPE));
const WORK_MODE_VALUES = new Set(Object.values(WORK_MODE));
const CATEGORY_LEVEL_VALUES = new Set(Object.values(CATEGORY_LEVEL));
const VISIBILITY_VALUES = new Set(Object.values(CANDIDATE_CV_VISIBILITY));
const LANGUAGE_PROFICIENCY_VALUES = new Set(
  Object.values(CV_LANGUAGE_PROFICIENCY),
);

const hasPresentString = (value) => {
  return typeof value === "string" && value.trim() !== "";
};

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

  // Data V7 §7.2: storageKey is an internal locator — persist only, do not expose.
  return {
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

  const metadata = await normalizeCandidateCvCreateMetadata(draft);

  // F03 / BR-09–BR-11: exact Generated Draft initialization.
  // BR-31: metadata create does not synthesize Harvard content beyond empty shell.
  const candidateCv = await CandidateCV.create({
    candidateUserId,
    name: metadata.name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status: CANDIDATE_CV_STATUS.DRAFT,
    visibility: metadata.visibility,
    categoryId: metadata.categoryId,
    experienceLevelId: metadata.experienceLevelId,
    preferredLocations: metadata.preferredLocations,
    skillTags: metadata.skillTags,
    employmentTypes: metadata.employmentTypes,
    workModes: metadata.workModes,
    isDefault: false,
    generatedContent: {},
    archivedAt: null,
  });

  return toPublicCandidateCvDetail(candidateCv);
};

const normalizeCandidateCvCreateMetadata = async (draft) => {
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

  return {
    name,
    visibility,
    categoryId: category._id,
    experienceLevelId,
    preferredLocations,
    skillTags,
    employmentTypes,
    workModes,
  };
};

const createUploadedCandidateCv = async ({
  candidateUserId,
  actorUser,
  draft,
  file,
}) => {
  assertCandidateCvActor(actorUser);

  // BR-04 / BR-42: ownership is always the authenticated Candidate.
  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only create their own CVs");
  }

  const metadata = await normalizeCandidateCvCreateMetadata(draft);

  // BR-22 / Data 7.3: inspect before any CandidateCV persistence.
  // Candidate CV domain owns PDF rules; file.service only stores bytes.
  const inspectedPdf = await inspectUploadedCandidateCvPdf(file?.buffer);

  const originalFileName =
    typeof file?.originalFileName === "string" &&
    file.originalFileName.trim() !== ""
      ? file.originalFileName.trim()
      : "candidate-cv.pdf";

  let storedFile = null;

  try {
    storedFile = await uploadOwnUploadedCandidateCvFile(file.buffer);

    // F05 / BR-23: exact UPLOADED/ACTIVE initialization — no DRAFT path.
    const candidateCv = await CandidateCV.create({
      candidateUserId,
      name: metadata.name,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: metadata.visibility,
      categoryId: metadata.categoryId,
      experienceLevelId: metadata.experienceLevelId,
      preferredLocations: metadata.preferredLocations,
      skillTags: metadata.skillTags,
      employmentTypes: metadata.employmentTypes,
      workModes: metadata.workModes,
      isDefault: false,
      archivedAt: null,
      uploadedFile: {
        storageKey: storedFile.publicId,
        originalFileName,
        mimeType: inspectedPdf.mimeType,
        sizeBytes: inspectedPdf.sizeBytes,
        pageCount: inspectedPdf.pageCount,
        uploadedAt: new Date(),
      },
    });

    return toPublicCandidateCvDetail(candidateCv);
  } catch (error) {
    // Data 10.3: DB failure after external upload must not leave a CandidateCV;
    // orphan file cleanup is best-effort engineering concern.
    if (storedFile?.publicId) {
      try {
        await deleteOwnUploadedCandidateCvFile(storedFile.publicId);
      } catch {
        // Swallow cleanup failure — business state has no CandidateCV.
      }
    }

    throw error;
  }
};

const loadOwnUploadedCandidateCvForReplace = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
}) => {
  assertCandidateCvActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only replace their own CVs");
  }

  if (!mongoose.isValidObjectId(candidateCvId)) {
    throw new AppError(404, "Candidate CV not found");
  }

  const candidateCv = await CandidateCV.findOne({
    _id: candidateCvId,
    candidateUserId,
  });

  if (!candidateCv) {
    throw new AppError(404, "Candidate CV not found");
  }

  if (candidateCv.archivedAt != null) {
    throw new AppError(409, "Archived Candidate CV cannot be replaced", {
      field: "archivedAt",
    });
  }

  if (candidateCv.sourceType !== CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
    throw new AppError(
      409,
      "Only Uploaded Candidate CVs support PDF replacement",
      {
        field: "sourceType",
      },
    );
  }

  if (
    candidateCv.uploadedFile == null ||
    typeof candidateCv.uploadedFile.storageKey !== "string" ||
    candidateCv.uploadedFile.storageKey.trim() === ""
  ) {
    throw new AppError(409, "Uploaded Candidate CV is missing current file", {
      field: "uploadedFile",
    });
  }

  return candidateCv;
};

const cleanupExternalUploadedCvFileBestEffort = async (publicId) => {
  if (typeof publicId !== "string" || publicId.trim() === "") {
    return;
  }

  try {
    await deleteOwnUploadedCandidateCvFile(publicId);
  } catch {
    // Best-effort external cleanup — never roll back business persistence.
  }
};

/**
 * F06 / BR-22, BR-25, BR-26: replace current Uploaded PDF only.
 * Validates the new PDF fully before any current-file mutation; atomically swaps
 * the entire uploadedFile value; cleans up the previous external artifact only
 * after persistence succeeds; concurrent/stale writes are rejected via the prior
 * storageKey predicate so one request cannot delete another request's current file.
 */
const replaceOwnUploadedCandidateCvPdf = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
  file,
}) => {
  const candidateCv = await loadOwnUploadedCandidateCvForReplace({
    candidateUserId,
    actorUser,
    candidateCvId,
  });

  const previousStorageKey = candidateCv.uploadedFile.storageKey;

  // BR-25: full PDF validation before the new file can become current.
  const inspectedPdf = await inspectUploadedCandidateCvPdf(file?.buffer);

  const originalFileName =
    typeof file?.originalFileName === "string" &&
    file.originalFileName.trim() !== ""
      ? file.originalFileName.trim()
      : "candidate-cv.pdf";

  let storedFile = null;
  let replacementCommitted = false;

  try {
    storedFile = await uploadOwnUploadedCandidateCvFile(file.buffer);

    const nextUploadedFile = {
      storageKey: storedFile.publicId,
      originalFileName,
      mimeType: inspectedPdf.mimeType,
      sizeBytes: inspectedPdf.sizeBytes,
      pageCount: inspectedPdf.pageCount,
      uploadedAt: new Date(),
    };

    // Atomic whole-value swap of uploadedFile only (Data 9.7 / 10.2).
    // Prior storageKey binds the write so a concurrent/stale request cannot
    // commit over a newer current file or clean up that newer artifact.
    const updatedCv = await CandidateCV.findOneAndUpdate(
      {
        _id: candidateCv._id,
        candidateUserId,
        sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
        status: CANDIDATE_CV_STATUS.ACTIVE,
        archivedAt: null,
        "uploadedFile.storageKey": previousStorageKey,
      },
      {
        $set: {
          uploadedFile: nextUploadedFile,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!updatedCv) {
      throw new AppError(
        409,
        "Uploaded CV changed before PDF replacement could complete",
        {
          field: "uploadedFile",
        },
      );
    }

    replacementCommitted = true;

    // Data 10.3: cleanup the previous external file only after persistence.
    // Cleanup failure must not roll back the committed current-file swap.
    await cleanupExternalUploadedCvFileBestEffort(previousStorageKey);

    return toPublicCandidateCvDetail(updatedCv);
  } catch (error) {
    // BR-26 / Data 10.3: if the new file never became canonical current,
    // keep the old uploadedFile and best-effort cleanup the orphan upload.
    if (storedFile?.publicId && !replacementCommitted) {
      await cleanupExternalUploadedCvFileBestEffort(storedFile.publicId);
    }

    throw error;
  }
};

const isValidGeneratedEducation = (education) => {
  return (
    hasPresentString(education?.institutionName) &&
    hasPresentString(education?.degree)
  );
};

const isValidGeneratedCertification = (certification) => {
  return hasPresentString(certification?.name);
};

const isValidGeneratedLanguage = (language) => {
  return (
    hasPresentString(language?.name) &&
    LANGUAGE_PROFICIENCY_VALUES.has(language?.proficiency)
  );
};

const evaluateGeneratedCvCompleteness = (generatedContent) => {
  const content = generatedContent ?? {};
  const personalInfo = content.personalInfo ?? {};
  const educations = content.educations ?? [];
  const skills = content.skills ?? [];
  const certifications = content.certifications ?? [];
  const languages = content.languages ?? [];

  // BR-14 / BR-15 / BR-16: exact Product completeness.
  // Incomplete Education/WorkExperience/Project drafts do not by themselves fail
  // completeness when the exact minimum is otherwise met.
  const hasRequiredPersonalInfo =
    hasPresentString(personalInfo.fullName) &&
    hasPresentString(personalInfo.email) &&
    hasPresentString(personalInfo.phone);
  const hasProfessionalSummary = hasPresentString(content.professionalSummary);
  const hasValidEducation = educations.some(isValidGeneratedEducation);
  const hasSkill = skills.some((skill) => hasPresentString(skill));

  // BR-17 / BR-18 + Data 11.3: existing Certification/Language records must be
  // well-formed for the CV to be activation-ready.
  const hasValidCertifications = certifications.every(
    isValidGeneratedCertification,
  );
  const hasValidLanguages = languages.every(isValidGeneratedLanguage);

  const isComplete =
    hasRequiredPersonalInfo &&
    hasProfessionalSummary &&
    hasValidEducation &&
    hasSkill &&
    hasValidCertifications &&
    hasValidLanguages;

  return {
    isComplete,
  };
};

// Data 9.3 / 10.2: activation commit must bind the exact validated
// generatedContent snapshot. updatedAt alone is insufficient under same-
// millisecond content mutation.
const buildValidatedGeneratedContentMatch = (candidateCv) => {
  const generatedContent = candidateCv.generatedContent;

  if (generatedContent == null) {
    return {
      generatedContent: null,
    };
  }

  return {
    generatedContent:
      typeof generatedContent.toObject === "function"
        ? generatedContent.toObject()
        : generatedContent,
  };
};

const normalizeOptionalContentString = (value) => {
  if (value === undefined) {
    return null;
  }

  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const normalizeStringArray = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeOptionalContentString(value))
    .filter((value) => value != null);
};

const normalizeGeneratedContentForPersistence = (content = {}) => {
  const personalInfo = content.personalInfo ?? {};

  return {
    personalInfo: {
      fullName: normalizeOptionalContentString(personalInfo.fullName),
      email: normalizeOptionalContentString(personalInfo.email),
      phone: normalizeOptionalContentString(personalInfo.phone),
      displayLocation: normalizeOptionalContentString(
        personalInfo.displayLocation,
      ),
      links: normalizeStringArray(personalInfo.links),
      avatarUrl: normalizeOptionalContentString(personalInfo.avatarUrl),
    },
    professionalSummary: normalizeOptionalContentString(
      content.professionalSummary,
    ),
    educations: (content.educations ?? []).map((education) => ({
      institutionName: normalizeOptionalContentString(education.institutionName),
      degree: normalizeOptionalContentString(education.degree),
      fieldOfStudy: normalizeOptionalContentString(education.fieldOfStudy),
      startDate: education.startDate ?? null,
      endDate: education.endDate ?? null,
    })),
    skills: normalizeStringArray(content.skills),
    workExperiences: (content.workExperiences ?? []).map((experience) => ({
      companyName: normalizeOptionalContentString(experience.companyName),
      position: normalizeOptionalContentString(experience.position),
      startDate: experience.startDate ?? null,
      endDate: experience.endDate ?? null,
      description: normalizeOptionalContentString(experience.description),
      achievements: normalizeStringArray(experience.achievements),
    })),
    projects: (content.projects ?? []).map((project) => ({
      name: normalizeOptionalContentString(project.name),
      role: normalizeOptionalContentString(project.role),
      technologies: normalizeStringArray(project.technologies),
      description: normalizeOptionalContentString(project.description),
      projectUrl: normalizeOptionalContentString(project.projectUrl),
    })),
    certifications: (content.certifications ?? []).map((certification) => ({
      name: normalizeOptionalContentString(certification.name),
      issuer: normalizeOptionalContentString(certification.issuer),
      issueDate: certification.issueDate ?? null,
      expirationDate: certification.expirationDate ?? null,
      credentialId: normalizeOptionalContentString(certification.credentialId),
      credentialUrl: normalizeOptionalContentString(certification.credentialUrl),
    })),
    languages: (content.languages ?? []).map((language) => ({
      name: normalizeOptionalContentString(language.name),
      proficiency: language.proficiency ?? null,
    })),
    hiddenSections: normalizeStringArray(content.hiddenSections),
  };
};

const assertOwnEditableGeneratedCandidateCv = ({
  candidateUserId,
  actorUser,
  candidateCv,
}) => {
  assertCandidateCvActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only edit their own CVs");
  }

  if (!candidateCv) {
    throw new AppError(404, "Candidate CV not found");
  }

  if (candidateCv.archivedAt != null) {
    throw new AppError(409, "Archived Candidate CV cannot be edited", {
      field: "archivedAt",
    });
  }

  if (candidateCv.sourceType !== CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    throw new AppError(
      409,
      "Only Generated Candidate CVs support this operation",
      {
        field: "sourceType",
      },
    );
  }
};

const loadOwnGeneratedCandidateCvForMutation = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
}) => {
  assertCandidateCvActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only edit their own CVs");
  }

  if (!mongoose.isValidObjectId(candidateCvId)) {
    throw new AppError(404, "Candidate CV not found");
  }

  const candidateCv = await CandidateCV.findOne({
    _id: candidateCvId,
    candidateUserId,
  });

  assertOwnEditableGeneratedCandidateCv({
    candidateUserId,
    actorUser,
    candidateCv,
  });

  return candidateCv;
};

const saveOwnGeneratedContent = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
  generatedContent,
}) => {
  const candidateCv = await loadOwnGeneratedCandidateCvForMutation({
    candidateUserId,
    actorUser,
    candidateCvId,
  });

  // F04 / BR-12 / BR-21: Generated DRAFT and ACTIVE may both receive Harvard
  // content saves. Uploaded and archived remain rejected above.
  if (
    candidateCv.status !== CANDIDATE_CV_STATUS.DRAFT &&
    candidateCv.status !== CANDIDATE_CV_STATUS.ACTIVE
  ) {
    throw new AppError(
      409,
      "Generated content can only be saved while the CV is DRAFT or ACTIVE",
      {
        field: "status",
      },
    );
  }

  const normalizedContent =
    normalizeGeneratedContentForPersistence(generatedContent);
  const completeness = evaluateGeneratedCvCompleteness(normalizedContent);

  // BR-13 / BR-31: content save mutates only generatedContent (+ ACTIVE
  // lifecycle fields below); Profile and CandidateCV metadata stay unchanged.
  // BR-20: DRAFT completeness never auto-activates.
  // BR-21 / Data 9.5 / 10.2: incomplete ACTIVE save atomically demotes and
  // clears Default so DRAFT + isDefault=true cannot persist.
  let update;
  if (candidateCv.status === CANDIDATE_CV_STATUS.DRAFT) {
    update = {
      $set: {
        generatedContent: normalizedContent,
      },
    };
  } else if (completeness.isComplete) {
    update = {
      $set: {
        generatedContent: normalizedContent,
        status: CANDIDATE_CV_STATUS.ACTIVE,
      },
    };
  } else {
    update = {
      $set: {
        generatedContent: normalizedContent,
        status: CANDIDATE_CV_STATUS.DRAFT,
        isDefault: false,
      },
    };
  }

  const updatedCv = await CandidateCV.findOneAndUpdate(
    {
      _id: candidateCv._id,
      candidateUserId,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: candidateCv.status,
      archivedAt: null,
    },
    update,
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedCv) {
    throw new AppError(
      409,
      "Generated CV changed before content save could complete",
      {
        field: "status",
      },
    );
  }

  return {
    cv: toPublicCandidateCvDetail(updatedCv),
    completeness: evaluateGeneratedCvCompleteness(updatedCv.generatedContent),
  };
};

// Slice 04 name retained as a stable alias for DRAFT/ACTIVE Harvard content save.
const saveOwnGeneratedDraftContent = saveOwnGeneratedContent;

const activateOwnGeneratedCandidateCv = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
}) => {
  const candidateCv = await loadOwnGeneratedCandidateCvForMutation({
    candidateUserId,
    actorUser,
    candidateCvId,
  });

  if (candidateCv.status !== CANDIDATE_CV_STATUS.DRAFT) {
    throw new AppError(
      409,
      "Only Generated DRAFT CVs can be activated",
      {
        field: "status",
      },
    );
  }

  // BR-14–BR-20 / Data 9.3: revalidate current persisted content at decision time.
  const completeness = evaluateGeneratedCvCompleteness(
    candidateCv.generatedContent,
  );

  if (!completeness.isComplete) {
    throw new AppError(
      409,
      "Generated CV must satisfy completeness before activation",
      {
        field: "completeness",
      },
    );
  }

  // Bind status + validated generatedContent (+ updatedAt as a cheap revision
  // hint) so a concurrent content edit cannot commit ACTIVE from a stale
  // complete snapshot, including same-millisecond updates that keep updatedAt.
  // Activation mutates only status; ownership/visibility/metadata stay intact.
  const updatedCv = await CandidateCV.findOneAndUpdate(
    {
      _id: candidateCv._id,
      candidateUserId,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.DRAFT,
      archivedAt: null,
      updatedAt: candidateCv.updatedAt,
      ...buildValidatedGeneratedContentMatch(candidateCv),
    },
    {
      $set: {
        status: CANDIDATE_CV_STATUS.ACTIVE,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedCv) {
    const currentCv = await CandidateCV.findOne({
      _id: candidateCv._id,
      candidateUserId,
    });

    if (
      currentCv &&
      currentCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED &&
      currentCv.status === CANDIDATE_CV_STATUS.DRAFT &&
      currentCv.archivedAt == null
    ) {
      throw new AppError(
        409,
        "Generated CV changed before activation could complete",
        {
          field: "content",
        },
      );
    }

    throw new AppError(409, "Only Generated DRAFT CVs can be activated", {
      field: "status",
    });
  }

  return {
    cv: toPublicCandidateCvDetail(updatedCv),
    completeness: evaluateGeneratedCvCompleteness(updatedCv.generatedContent),
  };
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

const sanitizeDownloadFileName = (name, fallback = "candidate-cv.pdf") => {
  const base =
    typeof name === "string" && name.trim() !== ""
      ? name.trim()
      : fallback.replace(/\.pdf$/i, "");
  const sanitized = base
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  if (sanitized === "") {
    return "candidate-cv.pdf";
  }

  return sanitized.toLowerCase().endsWith(".pdf")
    ? sanitized
    : `${sanitized}.pdf`;
};

/**
 * Load own non-archived CandidateCV for F08 Preview/Download.
 * Ownership + active-library filter only — PUBLIC does not expand access.
 */
const loadOwnActiveCandidateCvForDelivery = async ({
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

  return candidateCv;
};

const buildGeneratedCvPdfDelivery = async (candidateCv) => {
  const pdfBuffer = await renderHarvardCandidateCvPdf(
    candidateCv.generatedContent,
  );

  return {
    buffer: pdfBuffer,
    mimeType: "application/pdf",
    fileName: sanitizeDownloadFileName(candidateCv.name),
    sourceType: candidateCv.sourceType,
    status: candidateCv.status,
  };
};

const buildUploadedCvPdfDelivery = async (candidateCv) => {
  if (
    candidateCv.uploadedFile == null ||
    typeof candidateCv.uploadedFile.storageKey !== "string" ||
    candidateCv.uploadedFile.storageKey.trim() === ""
  ) {
    throw new AppError(409, "Uploaded Candidate CV is missing current file", {
      field: "uploadedFile",
    });
  }

  let pdfBuffer;

  try {
    pdfBuffer = await downloadOwnUploadedCandidateCvFile(
      candidateCv.uploadedFile.storageKey,
    );
  } catch {
    throw new AppError(502, "Failed to retrieve current Uploaded CV PDF", {
      field: "uploadedFile",
    });
  }

  return {
    buffer: pdfBuffer,
    mimeType: candidateCv.uploadedFile.mimeType || "application/pdf",
    fileName: sanitizeDownloadFileName(
      candidateCv.uploadedFile.originalFileName,
      sanitizeDownloadFileName(candidateCv.name),
    ),
    sourceType: candidateCv.sourceType,
    status: candidateCv.status,
  };
};

/**
 * F08 / BR-32, BR-33, BR-43: owner-scoped Preview.
 * Generated DRAFT and ACTIVE both render from current generatedContent.
 * Uploaded Preview uses current uploadedFile only. Read-only — no lifecycle writes.
 */
const previewOwnCandidateCv = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
}) => {
  const candidateCv = await loadOwnActiveCandidateCvForDelivery({
    candidateUserId,
    actorUser,
    candidateCvId,
  });

  if (candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    return buildGeneratedCvPdfDelivery(candidateCv);
  }

  if (candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
    return buildUploadedCvPdfDelivery(candidateCv);
  }

  throw new AppError(409, "Unsupported Candidate CV source type", {
    field: "sourceType",
  });
};

/**
 * F08 / BR-34, BR-43: owner-scoped Download.
 * Generated official PDF only when ACTIVE; Generated DRAFT is denied.
 * Uploaded Download uses current uploadedFile. No public URL / PDF persistence.
 */
const downloadOwnCandidateCv = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
}) => {
  const candidateCv = await loadOwnActiveCandidateCvForDelivery({
    candidateUserId,
    actorUser,
    candidateCvId,
  });

  if (candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    if (candidateCv.status !== CANDIDATE_CV_STATUS.ACTIVE) {
      throw new AppError(
        409,
        "Generated DRAFT CVs cannot be downloaded as official PDF",
        {
          field: "status",
        },
      );
    }

    return buildGeneratedCvPdfDelivery(candidateCv);
  }

  if (candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
    return buildUploadedCvPdfDelivery(candidateCv);
  }

  throw new AppError(409, "Unsupported Candidate CV source type", {
    field: "sourceType",
  });
};

const loadOwnActiveCandidateCvForMetadataUpdate = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
}) => {
  assertCandidateCvActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only update their own CVs");
  }

  if (!mongoose.isValidObjectId(candidateCvId)) {
    throw new AppError(404, "Candidate CV not found");
  }

  const candidateCv = await CandidateCV.findOne({
    _id: candidateCvId,
    candidateUserId,
  });

  if (!candidateCv) {
    throw new AppError(404, "Candidate CV not found");
  }

  if (candidateCv.archivedAt != null) {
    throw new AppError(409, "Archived Candidate CV cannot be updated", {
      field: "archivedAt",
    });
  }

  return candidateCv;
};

/**
 * F07 / BR-05, BR-27–BR-31, BR-43, BR-45, BR-46: patch common CandidateCV
 * metadata for Generated and Uploaded CVs without mutating content, source,
 * lifecycle, Default, or archive state.
 */
const normalizeCandidateCvMetadataPatch = async (patch = {}) => {
  const updates = {};

  if (Object.prototype.hasOwnProperty.call(patch, "name")) {
    updates.name = normalizeRequiredName(patch.name);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "visibility")) {
    updates.visibility = normalizeVisibility(patch.visibility);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "categoryId")) {
    const category = await assertGeneratedDraftCategory(patch.categoryId);
    updates.categoryId = category._id;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "experienceLevelId")) {
    updates.experienceLevelId = await assertOptionalExperienceLevel(
      patch.experienceLevelId,
    );
  }

  if (Object.prototype.hasOwnProperty.call(patch, "preferredLocations")) {
    const preferredLocations = patch.preferredLocations ?? [];
    assertDistinctCanonicalValues({
      values: preferredLocations,
      allowedValues: LOCATION_VALUES,
      field: "preferredLocations",
      label: "Location",
    });
    updates.preferredLocations = preferredLocations;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "skillTags")) {
    updates.skillTags = normalizeSkillTags(patch.skillTags);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "employmentTypes")) {
    const employmentTypes = patch.employmentTypes ?? [];
    assertDistinctCanonicalValues({
      values: employmentTypes,
      allowedValues: EMPLOYMENT_TYPE_VALUES,
      field: "employmentTypes",
      label: "EmploymentType",
    });
    updates.employmentTypes = employmentTypes;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "workModes")) {
    const workModes = patch.workModes ?? [];
    assertDistinctCanonicalValues({
      values: workModes,
      allowedValues: WORK_MODE_VALUES,
      field: "workModes",
      label: "WorkMode",
    });
    updates.workModes = workModes;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, "CandidateCV metadata update requires at least one field");
  }

  return updates;
};

const updateOwnCandidateCvMetadata = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
  patch,
}) => {
  const candidateCv = await loadOwnActiveCandidateCvForMetadataUpdate({
    candidateUserId,
    actorUser,
    candidateCvId,
  });

  // Validate Category/ExperienceLevel/vocabularies before any persistence write.
  const updates = await normalizeCandidateCvMetadataPatch(patch);

  const updatedCv = await CandidateCV.findOneAndUpdate(
    {
      _id: candidateCv._id,
      candidateUserId,
      archivedAt: null,
    },
    {
      $set: updates,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedCv) {
    throw new AppError(
      409,
      "Candidate CV changed before metadata update could complete",
      {
        field: "archivedAt",
      },
    );
  }

  return toPublicCandidateCvDetail(updatedCv);
};

const isMongoDuplicateKeyError = (error) => {
  return error?.code === 11000;
};

/**
 * F09 / BR-35–BR-37 / TX-01: set or switch Default to an eligible own
 * CandidateCV. Mutates only `isDefault`. Generated DRAFT and archived CVs are
 * rejected. Switch clears the prior Default and sets the target atomically.
 */
const setOwnCandidateCvAsDefault = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
}) => {
  assertCandidateCvActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only manage Default on their own CVs");
  }

  if (!mongoose.isValidObjectId(candidateCvId)) {
    throw new AppError(404, "Candidate CV not found");
  }

  const session = await mongoose.startSession();
  let resultCv = null;

  try {
    await session.withTransaction(async () => {
      const targetCv = await CandidateCV.findOne({
        _id: candidateCvId,
        candidateUserId,
      }).session(session);

      if (!targetCv) {
        throw new AppError(404, "Candidate CV not found");
      }

      if (targetCv.archivedAt != null) {
        throw new AppError(409, "Archived Candidate CV cannot be Default", {
          field: "archivedAt",
        });
      }

      if (targetCv.status !== CANDIDATE_CV_STATUS.ACTIVE) {
        throw new AppError(
          409,
          "Only ACTIVE Candidate CVs can be Default",
          {
            field: "status",
          },
        );
      }

      // Idempotent when the target is already the sole Default.
      if (targetCv.isDefault) {
        resultCv = targetCv;
        return;
      }

      const currentDefault = await CandidateCV.findOne({
        candidateUserId,
        isDefault: true,
        archivedAt: null,
        _id: { $ne: targetCv._id },
      }).session(session);

      // TX-01: clear prior Default before setting the target so uniqueness and
      // rollback stay consistent across the cross-document switch.
      if (currentDefault) {
        const cleared = await CandidateCV.findOneAndUpdate(
          {
            _id: currentDefault._id,
            candidateUserId,
            isDefault: true,
            archivedAt: null,
          },
          {
            $set: {
              isDefault: false,
            },
          },
          {
            session,
            returnDocument: "after",
            runValidators: true,
          },
        );

        if (!cleared) {
          throw new AppError(
            409,
            "Default CV changed before switch could complete",
            {
              field: "isDefault",
            },
          );
        }
      }

      let updatedTarget;
      try {
        updatedTarget = await CandidateCV.findOneAndUpdate(
          {
            _id: targetCv._id,
            candidateUserId,
            status: CANDIDATE_CV_STATUS.ACTIVE,
            archivedAt: null,
            isDefault: false,
          },
          {
            $set: {
              isDefault: true,
            },
          },
          {
            session,
            returnDocument: "after",
            runValidators: true,
          },
        );
      } catch (error) {
        if (isMongoDuplicateKeyError(error)) {
          throw new AppError(
            409,
            "Candidate already has a Default CV",
            {
              field: "isDefault",
            },
          );
        }

        throw error;
      }

      if (!updatedTarget) {
        throw new AppError(
          409,
          "Candidate CV is no longer eligible to be Default",
          {
            field: "isDefault",
          },
        );
      }

      resultCv = updatedTarget;
    });
  } finally {
    await session.endSession();
  }

  return toPublicCandidateCvDetail(resultCv);
};

/**
 * F09 / BR-35, BR-37: explicit Unset of the current Default on the given CV.
 * Does not auto-select a replacement Default.
 */
const unsetOwnCandidateCvDefault = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
}) => {
  assertCandidateCvActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only manage Default on their own CVs");
  }

  if (!mongoose.isValidObjectId(candidateCvId)) {
    throw new AppError(404, "Candidate CV not found");
  }

  const candidateCv = await CandidateCV.findOne({
    _id: candidateCvId,
    candidateUserId,
  });

  if (!candidateCv) {
    throw new AppError(404, "Candidate CV not found");
  }

  if (!candidateCv.isDefault) {
    throw new AppError(409, "Candidate CV is not the Default", {
      field: "isDefault",
    });
  }

  const updatedCv = await CandidateCV.findOneAndUpdate(
    {
      _id: candidateCv._id,
      candidateUserId,
      isDefault: true,
    },
    {
      $set: {
        isDefault: false,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedCv) {
    throw new AppError(409, "Default CV changed before unset could complete", {
      field: "isDefault",
    });
  }

  return toPublicCandidateCvDetail(updatedCv);
};

/**
 * F10 / BR-08, BR-38–BR-45: soft-archive own CandidateCV out of the active
 * library. Atomically sets archivedAt and clears isDefault. Does not hard
 * delete the document, mutate content/file metadata, delete external storage,
 * restore, or auto-select a Default replacement.
 */
const archiveOwnCandidateCv = async ({
  candidateUserId,
  actorUser,
  candidateCvId,
}) => {
  assertCandidateCvActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only archive their own CVs");
  }

  if (!mongoose.isValidObjectId(candidateCvId)) {
    throw new AppError(404, "Candidate CV not found");
  }

  const candidateCv = await CandidateCV.findOne({
    _id: candidateCvId,
    candidateUserId,
  });

  if (!candidateCv) {
    throw new AppError(404, "Candidate CV not found");
  }

  if (candidateCv.archivedAt != null) {
    throw new AppError(409, "Candidate CV is already archived", {
      field: "archivedAt",
    });
  }

  // Data 9.12 / 10.2: archivedAt + isDefault=false must commit together so
  // archivedAt != null && isDefault=true cannot persist.
  const archivedAt = new Date();
  const updatedCv = await CandidateCV.findOneAndUpdate(
    {
      _id: candidateCv._id,
      candidateUserId,
      archivedAt: null,
    },
    {
      $set: {
        archivedAt,
        isDefault: false,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedCv) {
    throw new AppError(
      409,
      "Candidate CV changed before archive could complete",
      {
        field: "archivedAt",
      },
    );
  }

  return toPublicCandidateCvDetail(updatedCv);
};

export {
  activateOwnGeneratedCandidateCv,
  archiveOwnCandidateCv,
  createGeneratedDraftCandidateCv,
  createUploadedCandidateCv,
  downloadOwnCandidateCv,
  evaluateGeneratedCvCompleteness,
  getOwnActiveCandidateCv,
  listOwnActiveCandidateCvs,
  previewOwnCandidateCv,
  replaceOwnUploadedCandidateCvPdf,
  saveOwnGeneratedContent,
  saveOwnGeneratedDraftContent,
  setOwnCandidateCvAsDefault,
  toPublicCandidateCvDetail,
  toPublicCandidateCvSummary,
  unsetOwnCandidateCvDefault,
  updateOwnCandidateCvMetadata,
};
