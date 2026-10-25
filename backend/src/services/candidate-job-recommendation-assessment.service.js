import { aiKit } from "./ai-kit.service.js";
import { normalizeCandidateVisibleJob } from "./job-ai-normalization.service.js";
import { InvalidJobNormalizationSourceError } from "./job-ai-normalization-core.service.js";
import { retrieveOwnDefaultCvJobCandidates } from "./candidate-job-recommendation-retrieval.service.js";
import AppError from "../utils/app-error.js";

const DEFAULT_BATCH_SIZE = 12;

const assessOwnDefaultCvJobCandidates = async ({ actorUser, batchSize = DEFAULT_BATCH_SIZE,
  diagnostic } = {}) => {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new TypeError("batchSize must be a positive integer");
  }
  if (diagnostic) diagnostic.currentStage = "retrieval";
  const { cvNormalizationResult, candidates } = await retrieveOwnDefaultCvJobCandidates({ actorUser });
  const shortlist = candidates.slice(0, batchSize);
  if (diagnostic) {
    diagnostic.retrievalCandidates = candidates.length;
    diagnostic.shortlistSize = shortlist.length;
  }
  if (!shortlist.length) return [];

  if (diagnostic) diagnostic.currentStage = "job_normalization";
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

  if (diagnostic) diagnostic.batchSize = jobs.length;
  if (!jobs.length) return [];

  if (diagnostic) diagnostic.currentStage = "batch_inference";
  const assessments = await aiKit.assessRecommendationBatch({
    cvNormalizationResult,
    jobs: jobs.map(({ jobKey, jobNormalizationResult }) => ({ jobKey, jobNormalizationResult })),
    ...(diagnostic ? { diagnostic: (event) => diagnostic.providerEvents.push(event) } : {}),
  });
  if (diagnostic) diagnostic.providerEvents.push({ gate: "batch_assessment", status: "PASS",
    jobCount: assessments.length });
  return jobs.map((candidate, index) => ({ ...candidate, cvNormalizationResult,
    assessment: assessments[index] }));
};

export { assessOwnDefaultCvJobCandidates };
