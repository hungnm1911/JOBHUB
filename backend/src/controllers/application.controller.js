import {
  directApplyToJob,
  replaceSubmittedCv,
} from "../services/application.service.js";

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

const replaceSubmittedCvHandler = async (request, response, next) => {
  try {
    const application = await replaceSubmittedCv({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
      candidateCvId: request.body.candidateCvId,
      expectedVersion: request.body.expectedVersion,
    });

    return response.status(200).json({
      application,
    });
  } catch (error) {
    return next(error);
  }
};

export { directApplyToJobHandler, replaceSubmittedCvHandler };
