import { createOptimizedCandidateCvDraftForJob } from "../services/candidate-cv-optimization.service.js";

const createOptimizedCandidateCvDraftForJobHandler = async (request, response, next) => {
  try {
    const cv = await createOptimizedCandidateCvDraftForJob({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      candidateCvId: request.body.candidateCvId,
      evaluationResult: request.body.evaluationResult,
    });

    response.setHeader("Cache-Control", "private, no-store");
    return response.status(201).json({ cv });
  } catch (error) {
    return next(error);
  }
};

export { createOptimizedCandidateCvDraftForJobHandler };
