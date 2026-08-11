import mongoose from "mongoose";

import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import CandidateCV from "../models/candidate-cv.model.js";
import AppError from "../utils/app-error.js";

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
  getOwnActiveCandidateCv,
  listOwnActiveCandidateCvs,
  toPublicCandidateCvDetail,
  toPublicCandidateCvSummary,
};
