import { createDraftJob } from "../services/job.service.js";

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

export { createDraftJobHandler };
