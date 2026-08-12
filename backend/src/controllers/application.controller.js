import { directApplyToJob } from "../services/application.service.js";

const directApplyToJobHandler = async (request, response, next) => {
  try {
    const application = await directApplyToJob({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      jobId: request.body.jobId,
      candidateCvId: request.body.candidateCvId,
    });

    return response.status(201).json({
      application,
    });
  } catch (error) {
    return next(error);
  }
};

export { directApplyToJobHandler };
