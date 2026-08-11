import {
  activateOwnGeneratedCandidateCv,
  createGeneratedDraftCandidateCv,
  createUploadedCandidateCv,
  getOwnActiveCandidateCv,
  listOwnActiveCandidateCvs,
  replaceOwnUploadedCandidateCvPdf,
  saveOwnGeneratedContent,
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

const createUploadedCandidateCvHandler = async (request, response, next) => {
  try {
    const cv = await createUploadedCandidateCv({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      draft: request.body,
      file: request.file
        ? {
            buffer: request.file.buffer,
            originalFileName: request.file.originalname,
          }
        : null,
    });

    return response.status(201).json({
      cv,
    });
  } catch (error) {
    return next(error);
  }
};

const replaceOwnUploadedCandidateCvPdfHandler = async (
  request,
  response,
  next,
) => {
  try {
    const cv = await replaceOwnUploadedCandidateCvPdf({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      candidateCvId: request.params.cvId,
      file: request.file
        ? {
            buffer: request.file.buffer,
            originalFileName: request.file.originalname,
          }
        : null,
    });

    return response.status(200).json({
      cv,
    });
  } catch (error) {
    return next(error);
  }
};

const saveOwnGeneratedContentHandler = async (request, response, next) => {
  try {
    const result = await saveOwnGeneratedContent({
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

const activateOwnGeneratedCandidateCvHandler = async (
  request,
  response,
  next,
) => {
  try {
    const result = await activateOwnGeneratedCandidateCv({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      candidateCvId: request.params.cvId,
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

export {
  activateOwnGeneratedCandidateCvHandler,
  createGeneratedDraftCandidateCvHandler,
  createUploadedCandidateCvHandler,
  getOwnActiveCandidateCvHandler,
  listOwnActiveCandidateCvsHandler,
  replaceOwnUploadedCandidateCvPdfHandler,
  saveOwnGeneratedContentHandler,
};
