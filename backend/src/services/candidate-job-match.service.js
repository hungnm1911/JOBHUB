import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import AppError from "../utils/app-error.js";
import { aiKit } from "./ai-kit.service.js";
import {
  normalizeOwnGeneratedCandidateCv,
  normalizeOwnUploadedCandidateCv,
} from "./candidate-cv-ai-normalization.service.js";
import { loadOwnActiveCandidateCv } from "./candidate-cv.service.js";
import { normalizeCandidateVisibleJob } from "./job-ai-normalization.service.js";

const requireReady = (result) => {
  if (result?.status !== "READY" || !result.profile) {
    throw new AppError(503, "Matching input is unavailable");
  }
  return result;
};

const matchOwnCandidateCvToJob = async ({ actorUser, jobId, candidateCvId } = {}) => {
  const candidateUserId = actorUser?._id;
  const candidateCv = await loadOwnActiveCandidateCv({
    candidateUserId,
    actorUser,
    candidateCvId,
  });

  let normalizeCv;
  if (candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    normalizeCv = normalizeOwnGeneratedCandidateCv;
  } else if (candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
    normalizeCv = normalizeOwnUploadedCandidateCv;
  } else {
    throw new AppError(500, "Candidate CV source type is invalid");
  }

  const jobNormalizationResult = requireReady(await normalizeCandidateVisibleJob({
    actorUser,
    jobId,
  }));
  const cvNormalizationResult = requireReady(await normalizeCv({
    candidateUserId,
    actorUser,
    candidateCvId,
  }));

  return aiKit.matchJobCv({ jobNormalizationResult, cvNormalizationResult });
};

export { matchOwnCandidateCvToJob };
