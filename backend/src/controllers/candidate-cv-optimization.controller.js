import {
  commitOptimizedCandidateCvProposalForJob,
  createOptimizedCandidateCvDraftForJob,
  previewOptimizedCandidateCvForJob,
} from "../services/candidate-cv-optimization.service.js";

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

const previewOptimizedCandidateCvForJobHandler = async (request, response, next) => {
  try {
    const preview = await previewOptimizedCandidateCvForJob({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      candidateCvId: request.body.candidateCvId,
      evaluationResult: request.body.evaluationResult,
    });

    response.setHeader("Cache-Control", "private, no-store");
    return response.status(200).json(preview);
  } catch (error) {
    return next(error);
  }
};

const commitOptimizedCandidateCvProposalForJobHandler = async (request, response, next) => {
  try {
    const cv = await commitOptimizedCandidateCvProposalForJob({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      proposal: request.body.proposal,
    });

    response.setHeader("Cache-Control", "private, no-store");
    return response.status(201).json({ cv });
  } catch (error) {
    return next(error);
  }
};

export {
  commitOptimizedCandidateCvProposalForJobHandler,
  createOptimizedCandidateCvDraftForJobHandler,
  previewOptimizedCandidateCvForJobHandler,
};
