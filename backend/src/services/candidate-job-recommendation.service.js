import JOB_DISCOVERY_VISIBILITY from "../constants/job-discovery-visibility.js";
import { aiKit } from "./ai-kit.service.js";
import { assessOwnDefaultCvJobCandidates } from "./candidate-job-recommendation-assessment.service.js";
import { getPublicJobDiscoveryDetail } from "./job-discovery.service.js";

const MAX_RECOMMENDATIONS = 10;

const recommendOwnDefaultCvJobs = async ({ actorUser } = {}) => {
  const assessedJobs = await assessOwnDefaultCvJobCandidates({ actorUser });
  const scoredJobs = assessedJobs.map(({ jobKey, jobId, jobNormalizationResult,
    cvNormalizationResult, assessment }) => {
    const scoring = aiKit.scoreRecommendationAssessment({
      jobKey, jobNormalizationResult, cvNormalizationResult, assessment,
    });
    if (scoring.jobId !== jobId?.toString()) {
      throw new TypeError("Scoring Job identity does not match the candidate");
    }
    return { jobId, assessment, matchScore: scoring.matchScore };
  });
  scoredJobs.sort((left, right) => right.matchScore - left.matchScore);

  const recommendations = [];
  for (const { jobId, matchScore, assessment } of scoredJobs) {
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
  return recommendations;
};

export { recommendOwnDefaultCvJobs };
