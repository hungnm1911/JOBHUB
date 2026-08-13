import {
  directApplyToJob,
  firstAssignApplication,
  forceReassignApplication,
  getManagedJobPipelineWorkspace,
  listManagedJobs,
  listPrimaryJobApplications,
  reassignApplication,
  replaceSubmittedCv,
  updateApplicationRecruitmentPipelineStatus,
  withdrawApplication,
} from "../services/application.service.js";

const directApplyToJobHandler = async (request, response, next) => {
  try {
    const application = await directApplyToJob({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      jobId: request.body.jobId,
      candidateCvId: request.body.candidateCvId,
    });

    return response.status(201).json({
      application,
    });
  } catch (error) {
    return next(error);
  }
};

const replaceSubmittedCvHandler = async (request, response, next) => {
  try {
    const application = await replaceSubmittedCv({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
      candidateCvId: request.body.candidateCvId,
      expectedVersion: request.body.expectedVersion,
    });

    return response.status(200).json({
      application,
    });
  } catch (error) {
    return next(error);
  }
};

const withdrawApplicationHandler = async (request, response, next) => {
  try {
    const application = await withdrawApplication({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
      expectedVersion: request.body.expectedVersion,
      withdrawReason: request.body.withdrawReason,
    });

    return response.status(200).json({
      application,
    });
  } catch (error) {
    return next(error);
  }
};

const readClientCompanyId = (request) => {
  return (
    request.body?.companyId ??
    request.params?.companyId ??
    request.query?.companyId ??
    null
  );
};

const listPrimaryJobApplicationsHandler = async (request, response, next) => {
  try {
    const result = await listPrimaryJobApplications({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const listManagedJobsHandler = async (request, response, next) => {
  try {
    const result = await listManagedJobs({
      actorUser: request.auth.user,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const getManagedJobPipelineWorkspaceHandler = async (
  request,
  response,
  next,
) => {
  try {
    const result = await getManagedJobPipelineWorkspace({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const firstAssignApplicationHandler = async (request, response, next) => {
  try {
    const result = await firstAssignApplication({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      applicationId: request.params.applicationId,
      assigneeCompanyMemberId: request.body.assigneeCompanyMemberId,
      expectedVersion: request.body.expectedVersion,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const reassignApplicationHandler = async (request, response, next) => {
  try {
    const result = await reassignApplication({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      applicationId: request.params.applicationId,
      assigneeCompanyMemberId: request.body.assigneeCompanyMemberId,
      expectedAssigneeCompanyMemberId:
        request.body.expectedAssigneeCompanyMemberId,
      expectedVersion: request.body.expectedVersion,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const forceReassignApplicationHandler = async (request, response, next) => {
  try {
    const result = await forceReassignApplication({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      applicationId: request.params.applicationId,
      assigneeCompanyMemberId: request.body.assigneeCompanyMemberId,
      expectedAssigneeCompanyMemberId:
        request.body.expectedAssigneeCompanyMemberId,
      expectedVersion: request.body.expectedVersion,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const updateApplicationRecruitmentPipelineStatusHandler = async (
  request,
  response,
  next,
) => {
  try {
    const result = await updateApplicationRecruitmentPipelineStatus({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      applicationId: request.params.applicationId,
      targetStatus: request.body.targetStatus,
      expectedStatus: request.body.expectedStatus,
      expectedVersion: request.body.expectedVersion,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

export {
  directApplyToJobHandler,
  firstAssignApplicationHandler,
  forceReassignApplicationHandler,
  getManagedJobPipelineWorkspaceHandler,
  listManagedJobsHandler,
  listPrimaryJobApplicationsHandler,
  reassignApplicationHandler,
  replaceSubmittedCvHandler,
  updateApplicationRecruitmentPipelineStatusHandler,
  withdrawApplicationHandler,
};
