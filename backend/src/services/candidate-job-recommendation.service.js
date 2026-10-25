import JOB_DISCOVERY_VISIBILITY from "../constants/job-discovery-visibility.js";
import { aiKit } from "./ai-kit.service.js";
import { assessOwnDefaultCvJobCandidates } from "./candidate-job-recommendation-assessment.service.js";
import { getPublicJobDiscoveryDetail } from "./job-discovery.service.js";

const MAX_RECOMMENDATIONS = 10;

const recommendOwnDefaultCvJobs = async ({ actorUser, diagnostic } = {}) => {
  const assessedJobs = await assessOwnDefaultCvJobCandidates({ actorUser, diagnostic });
  if (diagnostic) diagnostic.currentStage = "scoring";
  let scoredJobs;
  try {
    scoredJobs = assessedJobs.map(({ jobKey, jobId, jobNormalizationResult,
      cvNormalizationResult, assessment }) => {
      const scoring = aiKit.scoreRecommendationAssessment({
        jobKey, jobNormalizationResult, cvNormalizationResult, assessment,
      });
      if (scoring.jobId !== jobId?.toString()) {
        throw new TypeError("Scoring Job identity does not match the candidate");
      }
      return { jobId, assessment, matchScore: scoring.matchScore };
    });
  } catch (error) {
    if (diagnostic && error instanceof Error) {
      error.diagnosticStage = "scoring";
      error.diagnosticCode = "SCORING_FAILED";
    }
    throw error;
  }
  if (diagnostic) diagnostic.providerEvents.push({ gate: "scoring", status: "PASS",
    jobCount: scoredJobs.length });
  scoredJobs.sort((left, right) => right.matchScore - left.matchScore);

  if (diagnostic) diagnostic.currentStage = "visibility";
  const recommendations = [];
  let checkedJobs = 0;
  try {
    for (const { jobId, matchScore, assessment } of scoredJobs) {
      checkedJobs += 1;
      let job;
      try {
        job = await getPublicJobDiscoveryDetail({ actorUser, jobId });
      } catch (error) {
        if (error.statusCode === 404) continue;
        throw error;
      }
      if (job.effectiveState !== JOB_DISCOVERY_VISIBILITY.DISCOVERABLE) continue;
      recommendations.push({ job, matchScore, reason: assessment.reason });
      if (recommendations.length === MAX_RECOMMENDATIONS) break;
    }
  } catch (error) {
    if (diagnostic && error instanceof Error) {
      error.diagnosticStage = "visibility";
      error.diagnosticCode = "VISIBILITY_FAILED";
    }
    throw error;
  }
  if (diagnostic) {
    diagnostic.providerEvents.push({ gate: "visibility", status: "PASS",
      checkedJobs, recommendationCount: recommendations.length });
    diagnostic.currentStage = "complete";
  }
  return recommendations;
};

export { recommendOwnDefaultCvJobs };
