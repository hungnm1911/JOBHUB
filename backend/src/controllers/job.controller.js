import JOB_LIST_SCOPE from "../constants/job-list-scope.js";
import AppError from "../utils/app-error.js";
import { parseListQuery } from "../utils/list-query.js";
import {
  approveAndPublishJob,
  addSupportingRecruiter,
  closePublishedJob,
  createDraftJob,
  deletePrePublicationJob,
  getInternalJob,
  getJobRecruitmentTeam,
  listInternalJobs,
  reassignPrimaryRecruiter,
  rejectPendingJob,
  removeSupportingRecruiter,
  replacePrimaryRecruiter,
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
    const { scope, page, limit } = request.query;
    // Legacy reads did not consume search/status/sort parameters. Keep that
    // contract; scoped reads accept only the new parameters and tenant guard.
    if (scope !== undefined) {
      for (const key of Object.keys(request.query)) {
        if (!["scope", "page", "limit", "companyId"].includes(key)) {
          throw new AppError(400, `Invalid ${key} query`, { field: key });
        }
      }
    }
    const options = parseListQuery({
      ...(scope !== undefined ? { scope } : {}),
      ...(page !== undefined ? { page } : {}),
      ...(limit !== undefined ? { limit } : {}),
    }, {
      filters: { scope: Object.values(JOB_LIST_SCOPE) },
      defaultSort: "createdAt",
    });
    const result = await listInternalJobs({
      actorUser: request.auth.user,
      clientCompanyId: readClientCompanyId(request),
      options,
    });

    return response.status(200).json({
      message: "Jobs retrieved.",
      ...result,
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
      actorUser: request.auth.user,
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
      keepOldPrimaryAsSupporting: request.body.keepOldPrimaryAsSupporting,
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

const getJobRecruitmentTeamHandler = async (request, response, next) => {
  try {
    const team = await getJobRecruitmentTeam({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json({
      message: "Recruitment Team retrieved.",
      team,
    });
  } catch (error) {
    return next(error);
  }
};

const addSupportingRecruiterHandler = async (request, response, next) => {
  try {
    const team = await addSupportingRecruiter({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
      supportingRecruiterCompanyMemberId:
        request.body.supportingRecruiterCompanyMemberId,
    });

    return response.status(200).json({
      message: "Supporting recruiter added.",
      team,
    });
  } catch (error) {
    return next(error);
  }
};

const removeSupportingRecruiterHandler = async (request, response, next) => {
  try {
    const team = await removeSupportingRecruiter({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
      supportingRecruiterCompanyMemberId: request.params.companyMemberId,
    });

    return response.status(200).json({
      message: "Supporting recruiter removed.",
      team,
    });
  } catch (error) {
    return next(error);
  }
};

const replacePrimaryRecruiterHandler = async (request, response, next) => {
  try {
    const team = await replacePrimaryRecruiter({
      managerUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
      newPrimaryCompanyMemberId: request.body.newPrimaryCompanyMemberId,
      keepOldPrimaryAsSupporting: request.body.keepOldPrimaryAsSupporting,
    });

    return response.status(200).json({
      message: "Primary Recruiter replaced.",
      team,
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
  getJobRecruitmentTeamHandler,
  addSupportingRecruiterHandler,
  listInternalJobsHandler,
  reassignPrimaryRecruiterHandler,
  rejectPendingJobHandler,
  removeSupportingRecruiterHandler,
  replacePrimaryRecruiterHandler,
  submitDraftJobHandler,
  updateDraftJobHandler,
};
