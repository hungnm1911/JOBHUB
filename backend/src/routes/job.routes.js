import express from "express";

import {
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
} from "../controllers/job.controller.js";
import {
  createFirstInterviewProposalHandler,
  downloadPrimaryJobApplicationSubmittedCvHandler,
  downloadRecruiterMyApplicationSubmittedCvHandler,
  firstAssignApplicationHandler,
  forceReassignApplicationHandler,
  getManagedJobPipelineWorkspaceHandler,
  getRecruiterApplicationConversationHandler,
  getRecruiterMyApplicationHandler,
  listManagedJobsHandler,
  listPrimaryJobApplicationsHandler,
  listRecruiterMyApplicationsHandler,
  previewPrimaryJobApplicationSubmittedCvHandler,
  previewRecruiterMyApplicationSubmittedCvHandler,
  reassignApplicationHandler,
  sendRecruiterApplicationConversationNormalMessageHandler,
  unassignApplicationHandler,
  updateApplicationRecruitmentPipelineStatusHandler,
} from "../controllers/application.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";
import authorizeCompanyManagerBusinessAccess from "../middlewares/authorize-company-manager-business-access.js";
import authorizeCompanyStaffBusinessAccess from "../middlewares/authorize-company-staff-business-access.js";
import authorizeRecruiterBusinessAccess from "../middlewares/authorize-recruiter-business-access.js";
import authorizeRecruiterChatHistoryAccess from "../middlewares/authorize-recruiter-chat-history-access.js";
import validateCreateDraftJob from "../middlewares/validate-create-draft-job.js";
import validateCreateFirstInterviewProposal from "../middlewares/validate-create-first-interview-proposal.js";
import validateAddSupportingRecruiter from "../middlewares/validate-add-supporting-recruiter.js";
import validateFirstAssignApplication from "../middlewares/validate-first-assign-application.js";
import validateForceReassignApplication from "../middlewares/validate-force-reassign-application.js";
import validateReassignApplication from "../middlewares/validate-reassign-application.js";
import validateSendConversationNormalMessage from "../middlewares/validate-send-conversation-normal-message.js";
import validateUnassignApplication from "../middlewares/validate-unassign-application.js";
import validateRecruitmentPipelineStatus from "../middlewares/validate-recruitment-pipeline-status.js";
import validateReassignPrimaryRecruiter from "../middlewares/validate-reassign-primary-recruiter.js";
import validateReplacePrimaryRecruiter from "../middlewares/validate-replace-primary-recruiter.js";
import validateUpdateDraftJob from "../middlewares/validate-update-draft-job.js";

const router = express.Router();

router.get(
  "/",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  listInternalJobsHandler,
);

router.get(
  "/managed",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  listManagedJobsHandler,
);

router.get(
  "/my-applications",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  listRecruiterMyApplicationsHandler,
);

router.get(
  "/my-applications/:applicationId",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  getRecruiterMyApplicationHandler,
);

router.get(
  "/my-applications/:applicationId/conversation",
  authenticateAccess,
  authorizeRecruiterChatHistoryAccess,
  getRecruiterApplicationConversationHandler,
);

router.post(
  "/my-applications/:applicationId/conversation/messages",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  validateSendConversationNormalMessage,
  sendRecruiterApplicationConversationNormalMessageHandler,
);

router.get(
  "/my-applications/:applicationId/submitted-cv/preview",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  previewRecruiterMyApplicationSubmittedCvHandler,
);

router.get(
  "/my-applications/:applicationId/submitted-cv/download",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  downloadRecruiterMyApplicationSubmittedCvHandler,
);

router.get(
  "/:jobId",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  getInternalJobHandler,
);

router.post(
  "/",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  validateCreateDraftJob,
  createDraftJobHandler,
);

router.get(
  "/:jobId/applications",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  listPrimaryJobApplicationsHandler,
);

router.get(
  "/:jobId/applications/:applicationId/submitted-cv/preview",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  previewPrimaryJobApplicationSubmittedCvHandler,
);

router.get(
  "/:jobId/applications/:applicationId/submitted-cv/download",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  downloadPrimaryJobApplicationSubmittedCvHandler,
);

router.get(
  "/:jobId/workspace",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  getManagedJobPipelineWorkspaceHandler,
);

router.post(
  "/:jobId/applications/:applicationId/assign",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  validateFirstAssignApplication,
  firstAssignApplicationHandler,
);

router.post(
  "/:jobId/applications/:applicationId/reassign",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  validateReassignApplication,
  reassignApplicationHandler,
);

router.post(
  "/:jobId/applications/:applicationId/unassign",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  validateUnassignApplication,
  unassignApplicationHandler,
);

router.post(
  "/:jobId/applications/:applicationId/force-reassign",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  validateForceReassignApplication,
  forceReassignApplicationHandler,
);

router.post(
  "/:jobId/applications/:applicationId/pipeline",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  validateRecruitmentPipelineStatus,
  updateApplicationRecruitmentPipelineStatusHandler,
);

router.post(
  "/:jobId/applications/:applicationId/interview-proposals",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  validateCreateFirstInterviewProposal,
  createFirstInterviewProposalHandler,
);

router.get(
  "/:jobId/team",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  getJobRecruitmentTeamHandler,
);

router.post(
  "/:jobId/team/supporting",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  validateAddSupportingRecruiter,
  addSupportingRecruiterHandler,
);

router.delete(
  "/:jobId/team/supporting/:companyMemberId",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  removeSupportingRecruiterHandler,
);

router.post(
  "/:jobId/submit",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  submitDraftJobHandler,
);

router.post(
  "/:jobId/approve",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  approveAndPublishJobHandler,
);

router.post(
  "/:jobId/reject",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  rejectPendingJobHandler,
);

router.post(
  "/:jobId/reassign-primary",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  validateReassignPrimaryRecruiter,
  reassignPrimaryRecruiterHandler,
);

router.post(
  "/:jobId/team/replace-primary",
  authenticateAccess,
  authorizeCompanyManagerBusinessAccess,
  validateReplacePrimaryRecruiter,
  replacePrimaryRecruiterHandler,
);

router.post(
  "/:jobId/close",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  closePublishedJobHandler,
);

router.delete(
  "/:jobId",
  authenticateAccess,
  authorizeCompanyStaffBusinessAccess,
  deletePrePublicationJobHandler,
);

router.patch(
  "/:jobId",
  authenticateAccess,
  authorizeRecruiterBusinessAccess,
  validateUpdateDraftJob,
  updateDraftJobHandler,
);

export default router;
