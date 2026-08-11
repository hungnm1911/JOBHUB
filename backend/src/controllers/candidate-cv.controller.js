import {
  createGeneratedDraftCandidateCv,
  getOwnActiveCandidateCv,
  listOwnActiveCandidateCvs,
  saveOwnGeneratedDraftContent,
} from "../services/candidate-cv.service.js";

const listOwnActiveCandidateCvsHandler = async (request, response, next) => {
  try {
    const cvs = await listOwnActiveCandidateCvs({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
    });

    return response.status(200).json({
      cvs,
    });
  } catch (error) {
    return next(error);
  }
};

const getOwnActiveCandidateCvHandler = async (request, response, next) => {
  try {
    const cv = await getOwnActiveCandidateCv({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      candidateCvId: request.params.cvId,
    });

    return response.status(200).json({
      cv,
    });
  } catch (error) {
    return next(error);
  }
};

const createGeneratedDraftCandidateCvHandler = async (
  request,
  response,
  next,
) => {
  try {
    const cv = await createGeneratedDraftCandidateCv({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      draft: request.body,
    });

    return response.status(201).json({
      cv,
    });
  } catch (error) {
    return next(error);
  }
};

const saveOwnGeneratedDraftContentHandler = async (request, response, next) => {
  try {
    const result = await saveOwnGeneratedDraftContent({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      candidateCvId: request.params.cvId,
      generatedContent: request.body,
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

export {
  createGeneratedDraftCandidateCvHandler,
  getOwnActiveCandidateCvHandler,
  listOwnActiveCandidateCvsHandler,
  saveOwnGeneratedDraftContentHandler,
};
