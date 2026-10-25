import Job from "../models/job.model.js";
import logger from "../utils/logger.js";
import { isMongoDbAvailabilityError } from "../utils/mongodb-availability-error.js";
import { loadPublicJobDiscoverySource } from "./job-discovery.service.js";
import { loadInternalJob } from "./job.service.js";
import { FAILED_RESULT, normalizeLoadedJob } from "./job-ai-normalization-core.service.js";

// AI-V01 F01 Backend entry for Company Staff. Sparse DRAFTs remain eligible.
const normalizeInternalJob = async ({
  actorUser,
  jobId,
  clientCompanyId,
} = {}) => {
  let loadedSource;
  try {
    loadedSource = await loadInternalJob(
      { actorUser, jobId, clientCompanyId },
      { includePersistedSource: true },
    );
  } catch (error) {
    if (!isMongoDbAvailabilityError(error)) {
      throw error;
    }

    logger.warn("AI-V01 Job source lookup failed; normalization FAILED", {
      jobId,
      errorType: error.name,
    });
    return FAILED_RESULT;
  }

  return normalizeLoadedJob(loadedSource);
};

// AI-V03 Candidate entry: V8 public visibility authorizes the raw Job source.
// Hydration supplies defaults only for absent persisted keys; the projection
// overlays raw values so malformed stored values cannot be repaired silently.
const normalizeCandidateVisibleJob = async ({ actorUser, jobId, strictFailures = false } = {}) => {
  let persistedJob;
  try {
    ({ job: persistedJob } = await loadPublicJobDiscoverySource({ actorUser, jobId }));
  } catch (error) {
    if (!isMongoDbAvailabilityError(error)) {
      throw error;
    }

    if (strictFailures) throw error;

    logger.warn("AI-V03 Candidate Job source lookup failed; normalization FAILED", {
      jobId,
      errorType: error.name,
    });
    return FAILED_RESULT;
  }

  return normalizeLoadedJob({ job: Job.hydrate(persistedJob), persistedJob }, { strictFailures });
};

export { normalizeCandidateVisibleJob, normalizeInternalJob };
