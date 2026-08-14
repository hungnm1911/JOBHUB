import {
  createFirstInterviewProposal,
  directApplyToJob,
  downloadCandidateApplicationSubmittedCv,
  downloadPrimaryJobApplicationSubmittedCv,
  downloadRecruiterMyApplicationSubmittedCv,
  firstAssignApplication,
  forceReassignApplication,
  getCandidateApplicationConversation,
  getCandidateMyApplication,
  getManagedJobPipelineWorkspace,
  getRecruiterApplicationConversation,
  getRecruiterMyApplication,
  listCandidateMyApplications,
  listManagedJobs,
  listPrimaryJobApplications,
  listRecruiterMyApplications,
  previewCandidateApplicationSubmittedCv,
  previewPrimaryJobApplicationSubmittedCv,
  previewRecruiterMyApplicationSubmittedCv,
  reassignApplication,
  replaceSubmittedCv,
  sendCandidateApplicationConversationNormalMessage,
  sendRecruiterApplicationConversationNormalMessage,
  submitCandidateAvailabilityFirstTime,
  unassignApplication,
  updateApplicationRecruitmentPipelineStatus,
  withdrawApplication,
} from "../services/application.service.js";

const sendSubmittedCvSnapshotPdf = (response, delivery, disposition) => {
  response.setHeader("Content-Type", delivery.mimeType);
  response.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${delivery.fileName}"`,
  );
  response.setHeader("Content-Length", delivery.buffer.length);
  // Snapshot delivery must not leak storage URLs or invent public-access semantics.
  response.setHeader("Cache-Control", "private, no-store");

  return response.status(200).send(delivery.buffer);
};

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

const listCandidateMyApplicationsHandler = async (request, response, next) => {
  try {
    const result = await listCandidateMyApplications({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      status: request.query?.status,
      q: request.query?.q,
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const getCandidateMyApplicationHandler = async (request, response, next) => {
  try {
    const result = await getCandidateMyApplication({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const submitCandidateAvailabilityFirstTimeHandler = async (
  request,
  response,
  next,
) => {
  try {
    const availability = await submitCandidateAvailabilityFirstTime({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
      timezone: request.body.timezone,
      slots: request.body.slots,
    });

    return response.status(201).json({ availability });
  } catch (error) {
    return next(error);
  }
};

const createFirstInterviewProposalHandler = async (request, response, next) => {
  try {
    const result = await createFirstInterviewProposal({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      applicationId: request.params.applicationId,
      date: request.body.date,
      dayPart: request.body.dayPart,
      expectedAvailabilityRevision: request.body.expectedAvailabilityRevision,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

const getCandidateApplicationConversationHandler = async (
  request,
  response,
  next,
) => {
  try {
    const result = await getCandidateApplicationConversation({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const sendCandidateApplicationConversationNormalMessageHandler = async (
  request,
  response,
  next,
) => {
  try {
    const result = await sendCandidateApplicationConversationNormalMessage({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
      content: request.body.content,
    });

    return response.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

const previewCandidateApplicationSubmittedCvHandler = async (
  request,
  response,
  next,
) => {
  try {
    const delivery = await previewCandidateApplicationSubmittedCv({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
    });

    return sendSubmittedCvSnapshotPdf(response, delivery, "inline");
  } catch (error) {
    return next(error);
  }
};

const downloadCandidateApplicationSubmittedCvHandler = async (
  request,
  response,
  next,
) => {
  try {
    const delivery = await downloadCandidateApplicationSubmittedCv({
      candidateUserId: request.auth.user._id,
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
    });

    return sendSubmittedCvSnapshotPdf(response, delivery, "attachment");
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

const listRecruiterMyApplicationsHandler = async (request, response, next) => {
  try {
    const result = await listRecruiterMyApplications({
      actorUser: request.auth.user,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const getRecruiterMyApplicationHandler = async (request, response, next) => {
  try {
    const result = await getRecruiterMyApplication({
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const getRecruiterApplicationConversationHandler = async (
  request,
  response,
  next,
) => {
  try {
    const result = await getRecruiterApplicationConversation({
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const sendRecruiterApplicationConversationNormalMessageHandler = async (
  request,
  response,
  next,
) => {
  try {
    const result = await sendRecruiterApplicationConversationNormalMessage({
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
      content: request.body.content,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

const previewPrimaryJobApplicationSubmittedCvHandler = async (
  request,
  response,
  next,
) => {
  try {
    const delivery = await previewPrimaryJobApplicationSubmittedCv({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      applicationId: request.params.applicationId,
      clientCompanyId: readClientCompanyId(request),
    });

    return sendSubmittedCvSnapshotPdf(response, delivery, "inline");
  } catch (error) {
    return next(error);
  }
};

const downloadPrimaryJobApplicationSubmittedCvHandler = async (
  request,
  response,
  next,
) => {
  try {
    const delivery = await downloadPrimaryJobApplicationSubmittedCv({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      applicationId: request.params.applicationId,
      clientCompanyId: readClientCompanyId(request),
    });

    return sendSubmittedCvSnapshotPdf(response, delivery, "attachment");
  } catch (error) {
    return next(error);
  }
};

const previewRecruiterMyApplicationSubmittedCvHandler = async (
  request,
  response,
  next,
) => {
  try {
    const delivery = await previewRecruiterMyApplicationSubmittedCv({
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
      clientCompanyId: readClientCompanyId(request),
    });

    return sendSubmittedCvSnapshotPdf(response, delivery, "inline");
  } catch (error) {
    return next(error);
  }
};

const downloadRecruiterMyApplicationSubmittedCvHandler = async (
  request,
  response,
  next,
) => {
  try {
    const delivery = await downloadRecruiterMyApplicationSubmittedCv({
      actorUser: request.auth.user,
      applicationId: request.params.applicationId,
      clientCompanyId: readClientCompanyId(request),
    });

    return sendSubmittedCvSnapshotPdf(response, delivery, "attachment");
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

const unassignApplicationHandler = async (request, response, next) => {
  try {
    const result = await unassignApplication({
      actorUser: request.auth.user,
      jobId: request.params.jobId,
      applicationId: request.params.applicationId,
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
  createFirstInterviewProposalHandler,
  directApplyToJobHandler,
  downloadCandidateApplicationSubmittedCvHandler,
  downloadPrimaryJobApplicationSubmittedCvHandler,
  downloadRecruiterMyApplicationSubmittedCvHandler,
  firstAssignApplicationHandler,
  forceReassignApplicationHandler,
  getCandidateApplicationConversationHandler,
  getCandidateMyApplicationHandler,
  getManagedJobPipelineWorkspaceHandler,
  getRecruiterApplicationConversationHandler,
  getRecruiterMyApplicationHandler,
  listCandidateMyApplicationsHandler,
  listManagedJobsHandler,
  listPrimaryJobApplicationsHandler,
  listRecruiterMyApplicationsHandler,
  previewCandidateApplicationSubmittedCvHandler,
  previewPrimaryJobApplicationSubmittedCvHandler,
  previewRecruiterMyApplicationSubmittedCvHandler,
  reassignApplicationHandler,
  replaceSubmittedCvHandler,
  sendCandidateApplicationConversationNormalMessageHandler,
  sendRecruiterApplicationConversationNormalMessageHandler,
  submitCandidateAvailabilityFirstTimeHandler,
  unassignApplicationHandler,
  updateApplicationRecruitmentPipelineStatusHandler,
  withdrawApplicationHandler,
};
