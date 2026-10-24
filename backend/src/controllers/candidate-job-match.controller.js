import { matchOwnCandidateCvToJob } from "../services/candidate-job-match.service.js";

const matchOwnCandidateCvToJobHandler = async (request, response, next) => {
  try {
    const matchResult = await matchOwnCandidateCvToJob({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      candidateCvId: request.body?.candidateCvId,
    });

    response.setHeader("Cache-Control", "private, no-store");
    return response.status(200).json({ matchResult });
  } catch (error) {
    return next(error);
  }
};

export { matchOwnCandidateCvToJobHandler };
