import {
  activateOwnGeneratedCandidateCv,
  createGeneratedDraftCandidateCv,
  createUploadedCandidateCv,
  downloadOwnCandidateCv,
  getOwnActiveCandidateCv,
  listOwnActiveCandidateCvs,
  previewOwnCandidateCv,
  replaceOwnUploadedCandidateCvPdf,
  saveOwnGeneratedContent,
  setOwnCandidateCvAsDefault,
  unsetOwnCandidateCvDefault,
  updateOwnCandidateCvMetadata,
} from "../services/candidate-cv.service.js";

const sendCandidateCvPdf = (response, delivery, disposition) => {
  response.setHeader("Content-Type", delivery.mimeType);
  response.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${delivery.fileName}"`,
  );
  response.setHeader("Content-Length", delivery.buffer.length);
  // F08 must not leak storage URLs or invent public-access semantics.
  response.setHeader("Cache-Control", "private, no-store");

  return response.status(200).send(delivery.buffer);
};

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

const updateOwnCandidateCvMetadataHandler = async (
  request,
  response,
  next,
) => {
  try {
    const cv = await updateOwnCandidateCvMetadata({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      candidateCvId: request.params.cvId,
      patch: request.body,
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

const previewOwnCandidateCvHandler = async (request, response, next) => {
  try {
    const delivery = await previewOwnCandidateCv({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      candidateCvId: request.params.cvId,
    });

    return sendCandidateCvPdf(response, delivery, "inline");
  } catch (error) {
    return next(error);
  }
};

const downloadOwnCandidateCvHandler = async (request, response, next) => {
  try {
    const delivery = await downloadOwnCandidateCv({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      candidateCvId: request.params.cvId,
    });

    return sendCandidateCvPdf(response, delivery, "attachment");
  } catch (error) {
    return next(error);
  }
};

const setOwnCandidateCvAsDefaultHandler = async (request, response, next) => {
  try {
    const cv = await setOwnCandidateCvAsDefault({
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

const unsetOwnCandidateCvDefaultHandler = async (request, response, next) => {
  try {
    const cv = await unsetOwnCandidateCvDefault({
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

export {
  activateOwnGeneratedCandidateCvHandler,
  createGeneratedDraftCandidateCvHandler,
  createUploadedCandidateCvHandler,
  downloadOwnCandidateCvHandler,
  getOwnActiveCandidateCvHandler,
  listOwnActiveCandidateCvsHandler,
  previewOwnCandidateCvHandler,
  replaceOwnUploadedCandidateCvPdfHandler,
  saveOwnGeneratedContentHandler,
  setOwnCandidateCvAsDefaultHandler,
  unsetOwnCandidateCvDefaultHandler,
  updateOwnCandidateCvMetadataHandler,
};
