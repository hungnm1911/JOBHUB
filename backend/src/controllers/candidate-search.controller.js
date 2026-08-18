import { listCandidateSearchEligibleCandidateCvs } from "../services/candidate-cv.service.js";

const listCandidateSearchEligibleCandidateCvsHandler = async (
  request,
  response,
  next,
) => {
  try {
    const cvs = await listCandidateSearchEligibleCandidateCvs({
      actorUser: request.auth.user,
    });

    return response.status(200).json({
      cvs,
    });
  } catch (error) {
    return next(error);
  }
};

export { listCandidateSearchEligibleCandidateCvsHandler };
