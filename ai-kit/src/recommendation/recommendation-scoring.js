import { scoreDeterministicFields } from "../matching/deterministic-field-scoring.js";
import { calculateWeightedMatchScore } from "../matching/weighted-match-scoring.js";

const scoreRecommendationAssessment = ({ cvNormalizationResult, jobNormalizationResult,
  assessment, jobKey } = {}) => {
  if (cvNormalizationResult?.status !== "READY" || !cvNormalizationResult.profile
    || jobNormalizationResult?.status !== "READY" || !jobNormalizationResult.profile) {
    throw new TypeError("Job and CV normalization results must both be READY");
  }

  const jobProfile = jobNormalizationResult.profile;
  const cvProfile = cvNormalizationResult.profile;
  if (typeof jobKey !== "string" || !jobKey.trim()
    || assessment?.jobKey !== jobKey || assessment?.jobId !== jobProfile.source?.jobId
    || typeof assessment.reason !== "string" || !assessment.reason.trim()) {
    throw new TypeError("Assessment and reason must belong to the Job");
  }

  return {
    jobId: jobProfile.source.jobId,
    candidateCvId: cvProfile.source.candidateCvId,
    ...calculateWeightedMatchScore(assessment,
      scoreDeterministicFields(jobProfile, cvProfile)),
  };
};

export { scoreRecommendationAssessment };
