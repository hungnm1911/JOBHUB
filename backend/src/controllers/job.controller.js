import JOB_LIST_SCOPE from "../constants/job-list-scope.js";
import JOB_STATUS from "../constants/job-status.js";
import { parseListQuery, parseOptionalListQuery } from "../utils/list-query.js";
import {
  approveAndPublishJob,
  addSupportingRecruiter,
  closePublishedJob,
  createDraftJob,
  deletePrePublicationJob,
  getInternalJob,
  getJobRecruitmentTeam,
  listInternalJobs,
  listJobRecruiterOptions,
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
    const config = { filters: { scope: Object.values(JOB_LIST_SCOPE), status: Object.values(JOB_STATUS) },
      sorts: ["createdAt", "title", "applicationDeadline"], defaultSort: "createdAt" };
    const options = parseOptionalListQuery(request.query, config) ?? {};
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

const listJobRecruiterOptionsHandler = async (request, response, next) => {
  try {
    const options = parseListQuery(Object.fromEntries(Object.entries(request.query).filter(([key]) => key !== "companyId")),
      { sorts: ["fullName"], defaultSort: "fullName" });
    const result = await listJobRecruiterOptions({ actorUser: request.auth.user,
      jobId: request.params.jobId, clientCompanyId: readClientCompanyId(request), options,
      purpose: request.path.endsWith("assignment-options") ? "assignment" : "supporting" });
    return response.status(200).json(result);
  } catch (error) { return next(error); }
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
  listJobRecruiterOptionsHandler,
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
