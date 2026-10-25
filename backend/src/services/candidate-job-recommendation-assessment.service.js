import { aiKit } from "./ai-kit.service.js";
import { normalizeCandidateVisibleJob } from "./job-ai-normalization.service.js";
import { InvalidJobNormalizationSourceError } from "./job-ai-normalization-core.service.js";
import { retrieveOwnDefaultCvJobCandidates } from "./candidate-job-recommendation-retrieval.service.js";
import AppError from "../utils/app-error.js";

const DEFAULT_BATCH_SIZE = 12;

const assessOwnDefaultCvJobCandidates = async ({ actorUser, batchSize = DEFAULT_BATCH_SIZE } = {}) => {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new TypeError("batchSize must be a positive integer");
  }
  const { cvNormalizationResult, candidates } = await retrieveOwnDefaultCvJobCandidates({ actorUser });
  const shortlist = candidates.slice(0, batchSize);
  if (!shortlist.length) return [];

  const jobs = [];
  for (const { job, vectorScore, retrievalRank } of shortlist) {
    let jobNormalizationResult;
    try {
      jobNormalizationResult = await normalizeCandidateVisibleJob({
        actorUser, jobId: job._id, strictFailures: true,
      });
    } catch (error) {
      if (error instanceof InvalidJobNormalizationSourceError) continue;
      throw error;
    }
    if (jobNormalizationResult?.status !== "READY" || !jobNormalizationResult.profile) {
      throw new AppError(503, "Recommendation Job normalization is unavailable");
    }
    jobs.push({ jobKey: `J${jobs.length + 1}`, jobNormalizationResult,
      jobId: job._id, vectorScore, retrievalRank });
  }

  if (!jobs.length) return [];

  const assessments = await aiKit.assessRecommendationBatch({
    cvNormalizationResult,
    jobs: jobs.map(({ jobKey, jobNormalizationResult }) => ({ jobKey, jobNormalizationResult })),
  });
  return jobs.map((candidate, index) => ({ ...candidate, cvNormalizationResult,
    assessment: assessments[index] }));
};

export { assessOwnDefaultCvJobCandidates };
