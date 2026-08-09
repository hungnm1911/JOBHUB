import {
  approveAndPublishJob,
  closePublishedJob,
  createDraftJob,
  deletePrePublicationJob,
  getInternalJob,
  listInternalJobs,
  reassignPrimaryRecruiter,
  rejectPendingJob,
  submitDraftJob,
  updateDraftJob,
} from "../services/job.service.js";

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

const listInternalJobsHandler = async (request, response, next) => {
  try {
    const jobs = await listInternalJobs({
      actorUser: request.auth.user,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json({
      message: "Jobs retrieved.",
      jobs,
    });
  } catch (error) {
    return next(error);
  }
};

const getInternalJobHandler = async (request, response, next) => {
  try {
    const job = await getInternalJob({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json({
      message: "Job retrieved.",
      job,
    });
  } catch (error) {
    return next(error);
  }
};

const submitDraftJobHandler = async (request, response, next) => {
  try {
    const job = await submitDraftJob({
      recruiterUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json({
      message: "Job submitted for approval.",
      job,
    });
  } catch (error) {
    return next(error);
  }
};

const approveAndPublishJobHandler = async (request, response, next) => {
  try {
    const job = await approveAndPublishJob({
      managerUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json({
      message: "Job approved and published.",
      job,
    });
  } catch (error) {
    return next(error);
  }
};

const rejectPendingJobHandler = async (request, response, next) => {
  try {
    const result = await rejectPendingJob({
      managerUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json({
      message: "Job rejected.",
      jobId: result.id,
    });
  } catch (error) {
    return next(error);
  }
};

const deletePrePublicationJobHandler = async (request, response, next) => {
  try {
    const result = await deletePrePublicationJob({
      managerUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json({
      message: "Job deleted.",
      jobId: result.id,
    });
  } catch (error) {
    return next(error);
  }
};

const reassignPrimaryRecruiterHandler = async (request, response, next) => {
  try {
    const job = await reassignPrimaryRecruiter({
      managerUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
      primaryRecruiterCompanyMemberId:
        request.body.primaryRecruiterCompanyMemberId,
    });

    return response.status(200).json({
      message: "Job Primary Recruiter reassigned.",
      job,
    });
  } catch (error) {
    return next(error);
  }
};

const closePublishedJobHandler = async (request, response, next) => {
  try {
    const job = await closePublishedJob({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json({
      message: "Job closed.",
      job,
    });
  } catch (error) {
    return next(error);
  }
};

export {
  approveAndPublishJobHandler,
  closePublishedJobHandler,
  createDraftJobHandler,
  deletePrePublicationJobHandler,
  getInternalJobHandler,
  listInternalJobsHandler,
  reassignPrimaryRecruiterHandler,
  rejectPendingJobHandler,
  submitDraftJobHandler,
  updateDraftJobHandler,
};
