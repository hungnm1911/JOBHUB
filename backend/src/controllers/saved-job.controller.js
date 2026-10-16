import {
  listSavedJobs,
  saveJob,
  unsaveJob,
} from "../services/saved-job.service.js";

const saveJobHandler = async (request, response, next) => {
  try {
    const result = await saveJob({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      jobId: request.params.jobId,
    });
    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const unsaveJobHandler = async (request, response, next) => {
  try {
    const result = await unsaveJob({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      jobId: request.params.jobId,
    });
    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const listSavedJobsHandler = async (request, response, next) => {
  try {
    const result = await listSavedJobs({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
    });
    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

export { listSavedJobsHandler, saveJobHandler, unsaveJobHandler };
