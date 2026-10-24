import { evaluateOwnCandidateCvForJob } from "../services/candidate-cv-evaluation.service.js";

const evaluateOwnCandidateCvForJobHandler = async (request, response, next) => {
  try {
    const evaluationResult = await evaluateOwnCandidateCvForJob({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      candidateCvId: request.body?.candidateCvId,
    });

    response.setHeader("Cache-Control", "private, no-store");
    return response.status(200).json({ evaluationResult });
  } catch (error) {
    return next(error);
  }
};

export { evaluateOwnCandidateCvForJobHandler };
