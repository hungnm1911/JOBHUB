import { createDraftJob, updateDraftJob } from "../services/job.service.js";

const readClientCompanyId = (request) => {
  return (
    request.body?.companyId ??
    request.params?.companyId ??
    request.query?.companyId ??
    null
  );
};

const createDraftJobHandler = async (request, response, next) => {
  try {
    const job = await createDraftJob({
      recruiterUser: request.auth.user,
      clientCompanyId: readClientCompanyId(request),
      content: request.body,
    });

    return response.status(201).json({
      message: "Job draft created.",
      job,
    });
  } catch (error) {
    return next(error);
  }
};

const updateDraftJobHandler = async (request, response, next) => {
  try {
    const job = await updateDraftJob({
      recruiterUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
      content: request.body,
    });

    return response.status(200).json({
      message: "Job draft updated.",
      job,
    });
  } catch (error) {
    return next(error);
  }
};

export { createDraftJobHandler, updateDraftJobHandler };
