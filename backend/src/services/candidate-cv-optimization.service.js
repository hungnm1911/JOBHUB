import AppError from "../utils/app-error.js";
import { aiKit } from "./ai-kit.service.js";
import { prepareOwnCandidateCvJobProfiles } from "./candidate-job-match.service.js";
import {
  prepareOwnGeneratedCvBaseline,
  prepareOwnUploadedCvBaseline,
} from "./candidate-cv-optimization-baseline.service.js";
import { createGeneratedDraftCandidateCv } from "./candidate-cv.service.js";

// The request supplies only resource IDs and prior V04 advice. Authorized
// profiles and baseline are always prepared from the current canonical sources.
const optimizeOwnCandidateCvForJob = async ({
  actorUser, jobId, candidateCvId, evaluationResult,
} = {}) => {
  let sourceSnapshot;
  const { jobNormalizationResult, cvNormalizationResult } =
    await prepareOwnCandidateCvJobProfiles({
      actorUser, jobId, candidateCvId,
      onAuthorizedCvSource: (source) => { sourceSnapshot = source; },
    });
  const jobMatchProfile = jobNormalizationResult.profile;
  const cvMatchProfile = cvNormalizationResult.profile;
  const authorizedJobId = jobMatchProfile.source?.jobId;
  const authorizedCvId = cvMatchProfile.source?.candidateCvId;

  if (authorizedJobId !== jobId?.toString()
    || authorizedCvId !== candidateCvId?.toString()) {
    throw new AppError(500, "AI source identity does not match the authorized request");
  }
  if (evaluationResult?.jobId !== authorizedJobId
    || evaluationResult?.candidateCvId !== authorizedCvId) {
    throw new AppError(400, "Evaluation does not belong to the selected Job and CV");
  }
  if (!sourceSnapshot || sourceSnapshot._id?.toString() !== authorizedCvId) {
    throw new AppError(500, "AI CV source snapshot is unavailable or mismatched");
  }

  const baselineInput = {
    actorUser,
    candidateUserId: actorUser._id,
    candidateCvId: authorizedCvId,
    sourceSnapshot,
  };
  let generatedBaseline;
  if (cvMatchProfile.source.type === "GENERATED_CV") {
    generatedBaseline = await prepareOwnGeneratedCvBaseline(baselineInput);
  } else if (cvMatchProfile.source.type === "UPLOADED_CV") {
    generatedBaseline = await prepareOwnUploadedCvBaseline({
      ...baselineInput,
      normalizationResult: cvNormalizationResult,
    });
  } else {
    throw new AppError(500, "AI CV source type is invalid");
  }

  const optimizationResult = await aiKit.optimizeCv({
    jobMatchProfile,
    cvMatchProfile,
    generatedBaseline: generatedBaseline.careerSections,
    evaluationResult,
  });

  return {
    jobId: authorizedJobId,
    candidateCvId: authorizedCvId,
    generatedBaseline,
    optimizationResult,
  };
};

const mergeOptimizationWithBaseline = (generatedBaseline, optimizationResult) => ({
  ...structuredClone(generatedBaseline.generatedContent),
  ...Object.fromEntries(Object.entries(generatedBaseline.careerSections).map(([section, value]) => [
    section,
    structuredClone(optimizationResult[section] === null ? value : optimizationResult[section]),
  ])),
});

const createOptimizedCandidateCvDraftForJob = async (input) => {
  const { generatedBaseline, optimizationResult } = await optimizeOwnCandidateCvForJob(input);
  const generatedContent = mergeOptimizationWithBaseline(generatedBaseline, optimizationResult);

  return createGeneratedDraftCandidateCv({
    candidateUserId: input.actorUser._id,
    actorUser: input.actorUser,
    draft: generatedBaseline.metadata,
    generatedContent,
  });
};

export { optimizeOwnCandidateCvForJob, createOptimizedCandidateCvDraftForJob };
