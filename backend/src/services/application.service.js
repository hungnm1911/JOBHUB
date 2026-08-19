import mongoose from "mongoose";

import APPLICATION_SOURCE from "../constants/application-source.js";
import APPLICATION_STATUS from "../constants/application-status.js";
import APPLICATION_SUBMITTED_CV_STORAGE from "../constants/application-submitted-cv-storage.js";
import AVAILABILITY_DAY_PART from "../constants/availability-day-part.js";
import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../constants/candidate-cv-status.js";
import CONVERSATION_REALTIME_MODE from "../constants/conversation-realtime-mode.js";
import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../constants/company-member-status.js";
import MESSAGE_TYPE from "../constants/message-type.js";
import NOTIFICATION_TYPE from "../constants/notification-type.js";
import SYSTEM_MESSAGE_CONTENT from "../constants/system-message-content.js";
import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import Application from "../models/application.model.js";
import CandidateAvailability, {
  isCalendarDate,
  isValidTimeZone,
} from "../models/candidate-availability.model.js";
import CandidateCV from "../models/candidate-cv.model.js";
import Company from "../models/company.model.js";
import CompanyMember from "../models/company-member.model.js";
import Conversation from "../models/conversation.model.js";
import InterviewSchedule from "../models/interview-schedule.model.js";
import Job from "../models/job.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import INTERVIEW_SCHEDULE_STATUS from "../constants/interview-schedule-status.js";
import AppError from "../utils/app-error.js";
import {
  acquireCandidateJobSerialization,
  assertCandidateJobAllowsDirectApply,
} from "./candidate-job-serialization.service.js";
import {
  APPLICATION_CV_SNAPSHOT_STORAGE,
  captureCvSnapshot,
  captureGeneratedCvSnapshot,
  captureUploadedCvSnapshot,
  deepCopyGeneratedContent,
  deleteCvSnapshotFile,
} from "./cv-snapshot.service.js";
import {
  assertSameCompanyTenant,
  resolveCompanyManagerRecruiterManagementContext,
  resolveCompanyStaffBusinessContext,
  resolveRecruiterBusinessContext,
  resolveRecruiterChatHistoryContext,
} from "./company.service.js";
import { downloadFileBuffer } from "./file.service.js";
import { evaluateApplicationConversationChatAuthority } from "./application-chat-authority.service.js";
import {
  createNotificationEvent,
  materializeNotificationEvent,
} from "./notification.service.js";
import { emitConversationStateToRecipients, emitMessageToRecipients } from "./realtime-distribution.service.js";
import {
  acquireActiveCompanyStaffMembershipForBusinessAccessTx,
  acquireActiveRecruiterMembershipForTeamResponsibilityTx,
  acquireActiveUserForAssigneeEligibilityTx,
  acquireJobCurrentPrimaryForAssignmentManagementTx,
  acquireJobTeamMembershipForAssigneeEligibilityTx,
  acquireOperationalCompanyForAssigneeEligibilityTx,
  isJobPubliclyEligible,
  isOwningCompanyActiveForPublicEligibility,
  toPublicJob,
} from "./job.service.js";
import { materializeStalePendingInvitationForCandidateJob } from "./job-invitation.service.js";

const deleteApplicationSubmittedCvSnapshotFile = (publicId) => {
  return deleteCvSnapshotFile({
    storageKey: publicId,
    storage: APPLICATION_CV_SNAPSHOT_STORAGE,
  });
};

const isMongoDuplicateKeyError = (error) => {
  return error?.code === 11000;
};

const AVAILABILITY_DAY_PART_VALUES = Object.values(AVAILABILITY_DAY_PART);

// V15 Slice 07: Invitation-source Applications reuse the existing Application
// lifecycle after CONTACTED. Direct Apply create/Replace/Withdraw stay
// source-specific and keep `DIRECT_APPLICATION` guards.
const LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES = Object.freeze([
  APPLICATION_SOURCE.DIRECT_APPLICATION,
  APPLICATION_SOURCE.RECRUITER_INVITATION,
]);

const isLifecycleCompatibleApplicationSource = (source) =>
  LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES.includes(source);

const assertCandidateActor = (user) => {
  if (!user || user.role !== USER_ROLE.CANDIDATE) {
    throw new AppError(403, "Candidate access required");
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, "Candidate account is not active");
  }
};

const toPublicSnapshotPdfFile = (pdfFile) => {
  if (pdfFile == null) {
    return null;
  }

  return {
    originalFileName: pdfFile.originalFileName,
    mimeType: pdfFile.mimeType,
    sizeBytes: pdfFile.sizeBytes,
    pageCount: pdfFile.pageCount,
  };
};

const toPublicSubmittedCvSnapshot = (submittedCvSnapshot) => {
  if (submittedCvSnapshot == null) {
    return null;
  }

  const result = {
    sourceCandidateCvId: submittedCvSnapshot.sourceCandidateCvId,
    name: submittedCvSnapshot.name,
    sourceType: submittedCvSnapshot.sourceType,
    pdfFile: toPublicSnapshotPdfFile(submittedCvSnapshot.pdfFile),
    capturedAt: submittedCvSnapshot.capturedAt,
  };

  if (submittedCvSnapshot.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    result.generatedContent = deepCopyGeneratedContent(
      submittedCvSnapshot.generatedContent,
    );
  }

  return result;
};

const toPublicApplication = (application) => {
  return {
    id: application._id,
    candidateUserId: application.candidateUserId,
    jobId: application.jobId,
    source: application.source,
    status: application.status,
    submittedCvSnapshot: toPublicSubmittedCvSnapshot(
      application.submittedCvSnapshot,
    ),
    appliedAt: application.appliedAt,
    withdrawnAt: application.withdrawnAt,
    withdrawReason: application.withdrawReason,
    version: application.version,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
};

// BR-05 / PI-05: Unassigned is assignment-state only (absent or null), never a status.
const isApplicationUnassigned = (application) => {
  return application?.assignedRecruiterCompanyMemberId == null;
};

const APPLICATION_TERMINAL_STATUSES = Object.freeze([
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
]);

const APPLICATION_NON_TERMINAL_STATUSES = Object.freeze([
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
]);

// BR-43: Pipeline/Kanban columns are the eight canonical Recruitment Statuses.
const APPLICATION_PIPELINE_STATUSES = Object.freeze([
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
]);

const createEmptyCountsByStatus = () => {
  const counts = {};

  for (const status of APPLICATION_PIPELINE_STATUSES) {
    counts[status] = 0;
  }

  return counts;
};

const createEmptyPipelineGroups = () => {
  const pipeline = {};

  for (const status of APPLICATION_PIPELINE_STATUSES) {
    pipeline[status] = [];
  }

  return pipeline;
};

const toPublicCandidateSummary = (user) => {
  if (user == null) {
    return null;
  }

  return {
    id: user._id.toString(),
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? null,
  };
};

const toPublicAssignedRecruiterSummary = ({ membership, user } = {}) => {
  if (membership == null) {
    return null;
  }

  return {
    companyMemberId: membership._id.toString(),
    jobTitle: membership.jobTitle ?? null,
    fullName: user?.fullName ?? null,
    avatarUrl: user?.avatarUrl ?? null,
  };
};

const toCandidateAvailabilityProjection = (availability) => {
  if (availability == null) {
    return {
      status: "NOT_SUBMITTED",
      timezone: null,
      slots: [],
      revision: null,
    };
  }

  return {
    status: "SUBMITTED",
    timezone: availability.timezone,
    slots: availability.slots.map((slot) => ({
      date: slot.date,
      dayPart: slot.dayPart,
    })),
    revision: availability.revision,
  };
};

const toInterviewScheduleProjection = (schedule) => {
  return {
    id: schedule._id.toString(),
    applicationId: schedule.applicationId.toString(),
    status: schedule.status,
    date: schedule.date,
    dayPart: schedule.dayPart,
    timezone: schedule.timezone,
    expiresAt: schedule.expiresAt,
    createdByUserId: schedule.createdByUserId.toString(),
    createdByCompanyMemberId: schedule.createdByCompanyMemberId.toString(),
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
};

const toPrimaryJobApplicationView = (
  application,
  { candidate, assignedRecruiter, availability, interviewSchedules } = {},
) => {
  const assignedRecruiterCompanyMemberId =
    application.assignedRecruiterCompanyMemberId == null
      ? null
      : application.assignedRecruiterCompanyMemberId.toString();

  return {
    id: application._id.toString(),
    candidateUserId: application.candidateUserId.toString(),
    jobId: application.jobId.toString(),
    source: application.source,
    status: application.status,
    assignedRecruiterCompanyMemberId,
    isUnassigned: isApplicationUnassigned(application),
    assignedRecruiter: assignedRecruiter ?? null,
    candidate: candidate ?? null,
    availability: availability ?? {
      status: "NOT_SUBMITTED",
      timezone: null,
      slots: [],
      revision: null,
    },
    interviewSchedules: interviewSchedules ?? [],
    submittedCvSnapshot: toPublicSubmittedCvSnapshot(
      application.submittedCvSnapshot,
    ),
    appliedAt: application.appliedAt,
    withdrawnAt: application.withdrawnAt,
    withdrawReason: application.withdrawReason,
    version: application.version,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
};

const hydratePrimaryJobApplicationViews = async (
  applications,
  { now = new Date() } = {},
) => {
  const applicationIds = applications.map((application) => application._id);
  await expireDueInterviewProposalsForApplications({ applicationIds, now });
  const candidateUserIds = [
    ...new Set(
      applications.map((application) => application.candidateUserId.toString()),
    ),
  ];
  const assigneeMemberIds = [
    ...new Set(
      applications
        .filter((application) => !isApplicationUnassigned(application))
        .map((application) =>
          application.assignedRecruiterCompanyMemberId.toString(),
        ),
    ),
  ];

  const [candidates, assigneeMemberships, availabilities, interviewSchedules] =
    await Promise.all([
    candidateUserIds.length === 0
      ? []
      : User.find({ _id: { $in: candidateUserIds } }).select(
          "fullName avatarUrl",
        ),
    assigneeMemberIds.length === 0
      ? []
      : CompanyMember.find({ _id: { $in: assigneeMemberIds } }).select(
          "userId jobTitle",
        ),
    applicationIds.length === 0
      ? []
      : CandidateAvailability.find({
          applicationId: { $in: applicationIds },
        }).select("applicationId timezone slots revision"),
    applicationIds.length === 0
      ? []
      : InterviewSchedule.find({
          applicationId: { $in: applicationIds },
        }).sort({ createdAt: -1, _id: -1 }),
  ]);

  const candidateById = new Map(
    candidates.map((candidate) => [candidate._id.toString(), candidate]),
  );
  const assigneeMembershipById = new Map(
    assigneeMemberships.map((membership) => [
      membership._id.toString(),
      membership,
    ]),
  );
  const availabilityByApplicationId = new Map(
    availabilities.map((availability) => [
      availability.applicationId.toString(),
      availability,
    ]),
  );
  const interviewSchedulesByApplicationId = new Map();
  for (const schedule of interviewSchedules) {
    const key = schedule.applicationId.toString();
    const schedules = interviewSchedulesByApplicationId.get(key) ?? [];
    schedules.push(toInterviewScheduleProjection(schedule));
    interviewSchedulesByApplicationId.set(key, schedules);
  }

  const assigneeUserIds = [
    ...new Set(
      assigneeMemberships.map((membership) => membership.userId.toString()),
    ),
  ];
  const assigneeUsers =
    assigneeUserIds.length === 0
      ? []
      : await User.find({ _id: { $in: assigneeUserIds } }).select(
          "fullName avatarUrl",
        );
  const assigneeUserById = new Map(
    assigneeUsers.map((user) => [user._id.toString(), user]),
  );

  return applications.map((application) => {
    const candidate = toPublicCandidateSummary(
      candidateById.get(application.candidateUserId.toString()),
    );

    let assignedRecruiter = null;

    if (!isApplicationUnassigned(application)) {
      const membership = assigneeMembershipById.get(
        application.assignedRecruiterCompanyMemberId.toString(),
      );
      const assigneeUser =
        membership == null
          ? null
          : assigneeUserById.get(membership.userId.toString());

      assignedRecruiter = toPublicAssignedRecruiterSummary({
        membership,
        user: assigneeUser,
      });
    }

    return toPrimaryJobApplicationView(application, {
      candidate,
      assignedRecruiter,
      availability: toCandidateAvailabilityProjection(
        availabilityByApplicationId.get(application._id.toString()),
      ),
      interviewSchedules:
        interviewSchedulesByApplicationId.get(application._id.toString()) ?? [],
    });
  });
};

const loadLifecycleCompatibleApplicationsForJob = async (jobId) => {
  return Application.find({
    jobId,
    source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
  }).sort({ appliedAt: 1, _id: 1 });
};

// PI-21 / BR-33 / Slice 05: current workload is non-terminal + assigned only;
// Job.status does not participate. Unassigned (null/missing) never contributes.
// BR-03 / BR-05 / BR-43: status counts still include Unassigned Applications in
// their Recruitment Status group; Unassigned is assignment-state, not a column.
const deriveManagedJobApplicationProjection = (applications) => {
  const countsByStatus = createEmptyCountsByStatus();
  let unassignedCount = 0;
  const workloadCountByAssignee = new Map();

  for (const application of applications) {
    if (APPLICATION_PIPELINE_STATUSES.includes(application.status)) {
      countsByStatus[application.status] += 1;
    }

    if (isApplicationUnassigned(application)) {
      unassignedCount += 1;
      continue;
    }

    if (!APPLICATION_NON_TERMINAL_STATUSES.includes(application.status)) {
      continue;
    }

    const assigneeId = application.assignedRecruiterCompanyMemberId.toString();
    workloadCountByAssignee.set(
      assigneeId,
      (workloadCountByAssignee.get(assigneeId) ?? 0) + 1,
    );
  }

  const currentWorkloadByAssignee = [...workloadCountByAssignee.entries()]
    .map(([companyMemberId, count]) => ({ companyMemberId, count }))
    .sort((left, right) =>
      left.companyMemberId.localeCompare(right.companyMemberId),
    );

  return {
    applicationCount: applications.length,
    unassignedCount,
    countsByStatus,
    currentWorkloadByAssignee,
  };
};

const buildPipelineWorkspaceFromApplicationViews = (applicationViews) => {
  const pipeline = createEmptyPipelineGroups();
  const unassignedApplications = [];

  for (const application of applicationViews) {
    // BR-43: group by the eight Recruitment Statuses even when Unassigned.
    if (APPLICATION_PIPELINE_STATUSES.includes(application.status)) {
      pipeline[application.status].push(application);
    }

    // BR-05: Unassigned filter uses current Assignee (null/missing), not status.
    if (application.isUnassigned) {
      unassignedApplications.push(application);
    }
  }

  return {
    pipeline,
    unassignedApplications,
  };
};

const mergeWorkloadByAssignee = (workloadGroups) => {
  const merged = new Map();

  for (const group of workloadGroups) {
    for (const entry of group) {
      merged.set(
        entry.companyMemberId,
        (merged.get(entry.companyMemberId) ?? 0) + entry.count,
      );
    }
  }

  return [...merged.entries()]
    .map(([companyMemberId, count]) => ({ companyMemberId, count }))
    .sort((left, right) =>
      left.companyMemberId.localeCompare(right.companyMemberId),
    );
};

const resolvePrimaryManagedJobContext = async ({
  actorUser,
  jobId,
  clientCompanyId,
  actionLabel = "view",
} = {}) => {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  const context = await resolveRecruiterBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  // BR-40: tenant from trusted membership → Job.companyId, never client companyId alone.
  assertSameCompanyTenant({
    resourceCompanyId: job.companyId,
    tenantCompanyId: context.companyId,
  });

  if (
    job.primaryRecruiterCompanyMemberId.toString() !==
    context.membership._id.toString()
  ) {
    throw new AppError(
      403,
      `Only the current Primary Recruiter can ${actionLabel} Applications for this Job`,
      { field: "role" },
    );
  }

  return { context, job };
};

const listPrimaryJobApplications = async ({
  actorUser,
  jobId,
  clientCompanyId,
} = {}) => {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  const context = await resolveCompanyStaffBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  // BR-40 / BR-53: tenant from authenticated membership → Job.companyId.
  assertSameCompanyTenant({
    resourceCompanyId: job.companyId,
    tenantCompanyId: context.companyId,
  });

  // F01 / F04: Primary of the Job or CM of the owning Company may read enough
  // Application context to manage Assignee. Snapshot-delivery remains separate.
  assertAssignmentManagementAuthority({
    context,
    job,
    actionLabel: "view",
  });

  // V15 Slice 07: Primary/CM Application View covers both Direct Apply and
  // Invitation-source Applications. Authority remains tenant + current
  // assignment-management role, never sourceInvitationId or historical sender.
  const applications = await loadLifecycleCompatibleApplicationsForJob(job._id);
  const applicationViews = await hydratePrimaryJobApplicationViews(applications);

  return {
    job: toPublicJob(job),
    applications: applicationViews,
  };
};

// F06 / F10 / Slice 05: Managed Jobs + Pipeline Workspace + Current Workload.
// Read-only derived views; never persist ManagedJob/Kanban/workload counters.
// Non-terminal Unassigned Applications remain in their Recruitment Status group.
const listManagedJobs = async ({ actorUser, clientCompanyId } = {}) => {
  const context = await resolveRecruiterBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  const primaryMemberId = context.membership._id;

  // F06: Managed Jobs are current-Primary Jobs; not limited to accepting Jobs.
  // DRAFT/PENDING_APPROVAL/PUBLISHED/CLOSED/EXPIRED all qualify while Primary.
  const managedJobs = await Job.find({
    primaryRecruiterCompanyMemberId: primaryMemberId,
    companyId: context.companyId,
  }).sort({ createdAt: 1, _id: 1 });

  const managedJobIds = managedJobs.map((job) => job._id);

  const applicationRows =
    managedJobIds.length === 0
      ? []
      : await Application.find({
          jobId: { $in: managedJobIds },
          source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
        })
          .select("jobId status assignedRecruiterCompanyMemberId")
          .lean();

  const applicationsByJobId = new Map();

  for (const application of applicationRows) {
    const jobKey = application.jobId.toString();
    const bucket = applicationsByJobId.get(jobKey);

    if (bucket == null) {
      applicationsByJobId.set(jobKey, [application]);
    } else {
      bucket.push(application);
    }
  }

  const managedJobProjections = managedJobs.map((job) => {
    const applications = applicationsByJobId.get(job._id.toString()) ?? [];
    const aggregates = deriveManagedJobApplicationProjection(applications);

    return {
      job: toPublicJob(job),
      supportingRecruiterCount: (
        job.supportingRecruiterCompanyMemberIds ?? []
      ).length,
      applicationCount: aggregates.applicationCount,
      unassignedCount: aggregates.unassignedCount,
      countsByStatus: aggregates.countsByStatus,
      currentWorkloadByAssignee: aggregates.currentWorkloadByAssignee,
    };
  });

  return {
    managedJobs: managedJobProjections,
    // BR-33 / BR-40: scoped to actor Managed Jobs only — never company-global.
    currentWorkloadByAssignee: mergeWorkloadByAssignee(
      managedJobProjections.map((item) => item.currentWorkloadByAssignee),
    ),
  };
};

const getManagedJobPipelineWorkspace = async ({
  actorUser,
  jobId,
  clientCompanyId,
} = {}) => {
  const { job } = await resolvePrimaryManagedJobContext({
    actorUser,
    jobId,
    clientCompanyId,
    actionLabel: "view the Pipeline Workspace of",
  });

  const applications = await loadLifecycleCompatibleApplicationsForJob(job._id);
  const applicationViews =
    await hydratePrimaryJobApplicationViews(applications);
  const aggregates = deriveManagedJobApplicationProjection(applications);
  const { pipeline, unassignedApplications } =
    buildPipelineWorkspaceFromApplicationViews(applicationViews);

  return {
    job: toPublicJob(job),
    supportingRecruiterCount: (job.supportingRecruiterCompanyMemberIds ?? [])
      .length,
    applications: applicationViews,
    pipeline,
    unassignedApplications,
    applicationCount: aggregates.applicationCount,
    unassignedCount: aggregates.unassignedCount,
    countsByStatus: aggregates.countsByStatus,
    // Job-scoped workload (F10 within one Managed Job workspace).
    currentWorkloadByAssignee: aggregates.currentWorkloadByAssignee,
  };
};

// F07 / F09 partial / Slice 05: Recruiter My Applications — current assignee
// only. A→NONE or A→B removes the row from A; NONE→B or A→B adds it to B.
// Read-only; list membership never invents Pipeline authority.
const toRecruiterMyApplicationView = (applicationView, job) => {
  return {
    ...applicationView,
    job: toPublicJob(job),
    // BR-20 / BR-33: terminals remain readable historical responsibility when
    // still assigned, but are not active Current Workload.
    isActiveWorkload: APPLICATION_NON_TERMINAL_STATUSES.includes(
      applicationView.status,
    ),
  };
};

const loadRecruiterMyApplicationsForActor = async ({
  actorMembershipId,
  tenantCompanyId,
} = {}) => {
  // IDX-A04: current responsibility only — never Assignment History / prior assignee.
  const applications = await Application.find({
    assignedRecruiterCompanyMemberId: actorMembershipId,
    source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
  }).sort({ appliedAt: 1, _id: 1 });

  if (applications.length === 0) {
    return [];
  }

  const jobIds = [
    ...new Set(applications.map((application) => application.jobId.toString())),
  ];
  const jobs = await Job.find({
    _id: { $in: jobIds },
    companyId: tenantCompanyId,
  });
  const jobById = new Map(jobs.map((job) => [job._id.toString(), job]));

  // BR-40: drop any row whose Job is outside the trusted membership tenant.
  const tenantApplications = applications.filter((application) =>
    jobById.has(application.jobId.toString()),
  );

  const applicationViews =
    await hydratePrimaryJobApplicationViews(tenantApplications);

  return applicationViews.map((applicationView) => {
    const job = jobById.get(applicationView.jobId);
    return toRecruiterMyApplicationView(applicationView, job);
  });
};

const listRecruiterMyApplications = async ({
  actorUser,
  clientCompanyId,
} = {}) => {
  const context = await resolveRecruiterBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  const applications = await loadRecruiterMyApplicationsForActor({
    actorMembershipId: context.membership._id,
    tenantCompanyId: context.companyId,
  });

  // BR-33 / BR-34: active workload is derived from current non-terminal rows only.
  const currentWorkloadCount = applications.filter(
    (application) => application.isActiveWorkload,
  ).length;

  return {
    applications,
    currentWorkloadCount,
  };
};

const getRecruiterMyApplication = async ({
  actorUser,
  applicationId,
  clientCompanyId,
} = {}) => {
  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const context = await resolveRecruiterBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  const application = await Application.findById(applicationId);

  if (
    !application ||
    !isLifecycleCompatibleApplicationSource(application.source)
  ) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  // F07: My Applications is current assignee scope only — Primary of the Job
  // does not expand this surface beyond Applications assigned to the actor.
  if (
    application.assignedRecruiterCompanyMemberId == null ||
    application.assignedRecruiterCompanyMemberId.toString() !==
      context.membership._id.toString()
  ) {
    throw new AppError(
      403,
      "Only the current Assigned Recruiter can view this Application in My Applications",
      { field: "assignedRecruiterCompanyMemberId" },
    );
  }

  const job = await Job.findById(application.jobId);

  if (!job) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  // BR-40: tenant via membership → assignee → Job.companyId.
  assertSameCompanyTenant({
    resourceCompanyId: job.companyId,
    tenantCompanyId: context.companyId,
  });

  const [applicationView] = await hydratePrimaryJobApplicationViews([
    application,
  ]);

  return {
    application: toRecruiterMyApplicationView(applicationView, job),
  };
};

// F08 / F09 partial: Candidate My Applications — owner-scoped read projection.
// BR-32: Candidate-visible Assignee is live fullName/avatarUrl/jobTitle only.
const toCandidateVisibleAssignedRecruiter = ({ membership, user } = {}) => {
  if (membership == null) {
    return null;
  }

  return {
    fullName: user?.fullName ?? null,
    avatarUrl: user?.avatarUrl ?? null,
    jobTitle: membership.jobTitle ?? null,
  };
};

const toCandidateVisibleCompany = (company) => {
  if (company == null) {
    return null;
  }

  return {
    id: company._id.toString(),
    name: company.name,
    logoUrl: company.logoUrl ?? null,
  };
};

// Candidate Job view omits Recruitment Team membership identifiers (BR-41 scope).
const toCandidateMyApplicationJob = (job) => {
  return {
    id: job._id.toString(),
    companyId: job.companyId.toString(),
    title: job.title,
    jobDescription: job.jobDescription,
    requiredSkills: job.requiredSkills,
    salaryText: job.salaryText,
    location: job.location,
    employmentType: job.employmentType,
    workModes: job.workModes,
    applicationDeadline: job.applicationDeadline,
    status: job.status,
    publishedAt: job.publishedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
};

// F08 / Slice 05: Candidate sees own Application at every Recruitment Status.
// Unassign nulls assignee-facing fields; Assign again shows the new Assignee.
const toCandidateMyApplicationView = (
  application,
  { job, company, assignedRecruiter, availability, interviewSchedules } = {},
) => {
  return {
    id: application._id.toString(),
    jobId: application.jobId.toString(),
    source: application.source,
    status: application.status,
    isUnassigned: isApplicationUnassigned(application),
    assignedRecruiter: assignedRecruiter ?? null,
    availability: availability ?? {
      status: "NOT_SUBMITTED",
      timezone: null,
      slots: [],
      revision: null,
    },
    interviewSchedules: interviewSchedules ?? [],
    job: job == null ? null : toCandidateMyApplicationJob(job),
    company: toCandidateVisibleCompany(company),
    submittedCvSnapshot: toPublicSubmittedCvSnapshot(
      application.submittedCvSnapshot,
    ),
    appliedAt: application.appliedAt,
    withdrawnAt: application.withdrawnAt,
    withdrawReason: application.withdrawReason,
    version: application.version,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
};

const hydrateCandidateMyApplicationViews = async (
  applications,
  { now = new Date() } = {},
) => {
  if (applications.length === 0) {
    return [];
  }

  const jobIds = [
    ...new Set(applications.map((application) => application.jobId.toString())),
  ];
  const applicationIds = applications.map((application) => application._id);
  await expireDueInterviewProposalsForApplications({ applicationIds, now });
  const jobs = await Job.find({ _id: { $in: jobIds } });
  const jobById = new Map(jobs.map((job) => [job._id.toString(), job]));

  const companyIds = [
    ...new Set(jobs.map((job) => job.companyId.toString())),
  ];
  const companies =
    companyIds.length === 0
      ? []
      : await Company.find({ _id: { $in: companyIds } }).select("name logoUrl");
  const companyById = new Map(
    companies.map((company) => [company._id.toString(), company]),
  );

  const assigneeMemberIds = [
    ...new Set(
      applications
        .filter((application) => !isApplicationUnassigned(application))
        .map((application) =>
          application.assignedRecruiterCompanyMemberId.toString(),
        ),
    ),
  ];
  const [assigneeMemberships, availabilities, interviewSchedules] =
    await Promise.all([
    assigneeMemberIds.length === 0
      ? []
      : CompanyMember.find({ _id: { $in: assigneeMemberIds } }).select(
          "userId jobTitle",
        ),
    CandidateAvailability.find({
      applicationId: { $in: applicationIds },
    }).select("applicationId timezone slots revision"),
    InterviewSchedule.find({
      applicationId: { $in: applicationIds },
    }).sort({ createdAt: -1, _id: -1 }),
  ]);
  const assigneeMembershipById = new Map(
    assigneeMemberships.map((membership) => [
      membership._id.toString(),
      membership,
    ]),
  );
  const availabilityByApplicationId = new Map(
    availabilities.map((availability) => [
      availability.applicationId.toString(),
      availability,
    ]),
  );
  const interviewSchedulesByApplicationId = new Map();
  for (const schedule of interviewSchedules) {
    const key = schedule.applicationId.toString();
    const schedules = interviewSchedulesByApplicationId.get(key) ?? [];
    schedules.push(toInterviewScheduleProjection(schedule));
    interviewSchedulesByApplicationId.set(key, schedules);
  }

  const assigneeUserIds = [
    ...new Set(
      assigneeMemberships.map((membership) => membership.userId.toString()),
    ),
  ];
  const assigneeUsers =
    assigneeUserIds.length === 0
      ? []
      : await User.find({ _id: { $in: assigneeUserIds } }).select(
          "fullName avatarUrl",
        );
  const assigneeUserById = new Map(
    assigneeUsers.map((user) => [user._id.toString(), user]),
  );

  return applications.map((application) => {
    const job = jobById.get(application.jobId.toString()) ?? null;
    const company =
      job == null ? null : companyById.get(job.companyId.toString()) ?? null;

    let assignedRecruiter = null;

    if (!isApplicationUnassigned(application)) {
      const membership = assigneeMembershipById.get(
        application.assignedRecruiterCompanyMemberId.toString(),
      );
      const assigneeUser =
        membership == null
          ? null
          : assigneeUserById.get(membership.userId.toString());

      assignedRecruiter = toCandidateVisibleAssignedRecruiter({
        membership,
        user: assigneeUser,
      });
    }

    return toCandidateMyApplicationView(application, {
      job,
      company,
      assignedRecruiter,
      availability: toCandidateAvailabilityProjection(
        availabilityByApplicationId.get(application._id.toString()),
      ),
      interviewSchedules:
        interviewSchedulesByApplicationId.get(application._id.toString()) ?? [],
    });
  });
};

const normalizeCandidateMyApplicationsStatusFilter = (status) => {
  if (status == null || status === "") {
    return null;
  }

  if (
    typeof status !== "string" ||
    !APPLICATION_PIPELINE_STATUSES.includes(status)
  ) {
    throw new AppError(400, "Invalid Application status filter", {
      field: "status",
    });
  }

  return status;
};

const normalizeCandidateMyApplicationsSearch = (search) => {
  if (search == null || search === "") {
    return null;
  }

  if (typeof search !== "string") {
    throw new AppError(400, "Search must be a string", {
      field: "q",
    });
  }

  const trimmed = search.trim();
  return trimmed === "" ? null : trimmed.toLowerCase();
};

const getCalendarDateInTimeZone = (instant, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const values = Object.fromEntries(
    parts
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const getTimeZoneParts = (instant, timeZone) => {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .filter((part) =>
        ["year", "month", "day", "hour", "minute", "second"].includes(
          part.type,
        ),
      )
      .map((part) => [part.type, Number(part.value)]),
  );

  return values;
};

// `expiresAt` is midnight of the next calendar day in the Availability timezone.
// Iteration accounts for offsets that change across DST boundaries.
const deriveProposalExpiresAt = ({ date, timezone }) => {
  const [year, month, day] = date.split("-").map(Number);
  const localNextMidnight = Date.UTC(year, month - 1, day + 1);
  let instant = localNextMidnight;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = getTimeZoneParts(new Date(instant), timezone);
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    instant = localNextMidnight - (representedAsUtc - instant);
  }

  return new Date(instant);
};

// V12 F08 Slice 06 / BR-25: System lifecycle persists PROPOSED → CANCELLED when
// now >= expiresAt. Guarded Schedule writes only; Application and Availability
// stay unchanged. Invoked at scheduling operation boundaries (V5-style), not via
// a general-purpose scheduler.
const expireDueInterviewProposalsForApplications = async ({
  applicationIds = [],
  now = new Date(),
  session = null,
} = {}) => {
  if (applicationIds.length === 0) {
    return { modifiedCount: 0, notificationEvents: [] };
  }

  const normalizedApplicationIds = applicationIds.map((applicationId) =>
    applicationId instanceof mongoose.Types.ObjectId
      ? applicationId
      : new mongoose.Types.ObjectId(applicationId),
  );
  const dueSchedules = await InterviewSchedule.find({
    applicationId: { $in: normalizedApplicationIds },
    status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
    expiresAt: { $lte: now },
  })
    .select("_id")
    .session(session)
    .lean();
  const notificationEvents = [];
  let modifiedCount = 0;

  for (const dueSchedule of dueSchedules) {
    const expireOne = async (activeSession) =>
      expireDueInterviewProposal({
        interviewScheduleId: dueSchedule._id,
        now,
        session: activeSession,
      });

    let result;
    if (session) {
      result = await expireOne(session);
    } else {
      const expirationSession = await mongoose.startSession();
      try {
        await expirationSession.withTransaction(async () => {
          result = await expireOne(expirationSession);
        });
      } finally {
        await expirationSession.endSession();
      }
    }

    modifiedCount += result.modifiedCount;
    if (result.notificationEvent) {
      notificationEvents.push(result.notificationEvent);
    }
  }

  if (!session) {
    for (const notificationEvent of notificationEvents) {
      try {
        await materializeNotificationEvent({ eventId: notificationEvent._id });
      } catch {
        // The committed expiration and durable obligation remain recoverable.
      }
    }
  }

  return { modifiedCount, notificationEvents };
};

const expireDueInterviewProposalsForApplication = async ({
  applicationId,
  now = new Date(),
  session = null,
} = {}) =>
  expireDueInterviewProposalsForApplications({
    applicationIds: [applicationId],
    now,
    session,
  });

const expireDueInterviewProposals = async ({ now = new Date() } = {}) => {
  const dueSchedules = await InterviewSchedule.find(
    {
      status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
      expiresAt: { $lte: now },
    },
    { _id: 1, applicationId: 1 },
  ).lean();

  return expireDueInterviewProposalsForApplications({
    applicationIds: [
      ...new Map(
        dueSchedules.map((schedule) => [
          schedule.applicationId.toString(),
          schedule.applicationId,
        ]),
      ).values(),
    ],
    now,
  });
};

// V12 F08 Slice 07 / TX-03: this is intentionally callable only by canonical
// Application terminal-transition workflows. It preserves proposal identity,
// Availability, and terminal Schedule history while invalidating the one active
// Schedule, if any, in the same transaction as its parent Application.
const cancelActiveInterviewScheduleForTerminalApplication = async ({
  application,
  job,
  session,
} = {}) => {
  const activeSchedule = await InterviewSchedule.findOne({
    applicationId: application._id,
    status: {
      $in: [
        INTERVIEW_SCHEDULE_STATUS.PROPOSED,
        INTERVIEW_SCHEDULE_STATUS.CONFIRMED,
      ],
    },
  }).session(session);
  if (!activeSchedule) {
    return { modifiedCount: 0, notificationEvent: null };
  }

  let updateQuery = InterviewSchedule.updateOne(
    {
      _id: activeSchedule._id,
      status: {
        $in: [
          INTERVIEW_SCHEDULE_STATUS.PROPOSED,
          INTERVIEW_SCHEDULE_STATUS.CONFIRMED,
        ],
      },
    },
    { $set: { status: INTERVIEW_SCHEDULE_STATUS.CANCELLED } },
    { runValidators: true },
  );
  if (session) {
    updateQuery = updateQuery.session(session);
  }
  const result = await updateQuery;
  if ((result.modifiedCount ?? result.nModified ?? 0) === 0) {
    return { modifiedCount: 0, notificationEvent: null };
  }
  activeSchedule.status = INTERVIEW_SCHEDULE_STATUS.CANCELLED;

  const notificationEvent = await createInterviewScheduleNotificationEvent({
    application,
    job,
    schedule: activeSchedule,
    type: NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CHANGED,
    session,
  });

  return {
    modifiedCount: 1,
    notificationEvent,
  };
};

// Guard acquire: perform a real write for transaction serialization, then
// restore updatedAt so the guard does not become an Application business change.
const acquireWithRestoredUpdatedAt = async ({
  acquire,
  model,
  documentId,
  session,
} = {}) => {
  const before =
    documentId == null
      ? null
      : await model
          .findById(documentId)
          .select("updatedAt")
          .session(session)
          .lean();

  const acquired = await acquire();

  if (acquired && before?.updatedAt) {
    await model.findOneAndUpdate(
      { _id: documentId },
      { $set: { updatedAt: before.updatedAt } },
      { session, timestamps: false },
    );
  }

  return acquired;
};

// V13 F05 / TX-01: serialize first-submit recipient selection with every
// Assignment CAS without changing Application status, version, or timestamps.
const acquireApplicationAssignmentForAvailabilityFirstSubmit = async ({
  application,
  session,
} = {}) => {
  return acquireWithRestoredUpdatedAt({
    model: Application,
    documentId: application._id,
    session,
    acquire: () =>
      Application.findOneAndUpdate(
        {
          _id: application._id,
          candidateUserId: application.candidateUserId,
          jobId: application.jobId,
          source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
          status: APPLICATION_STATUS.CONTACTED,
          version: application.version,
          assignedRecruiterCompanyMemberId:
            application.assignedRecruiterCompanyMemberId ?? null,
        },
        {
          $set: {
            assignedRecruiterCompanyMemberId:
              application.assignedRecruiterCompanyMemberId ?? null,
          },
        },
        { returnDocument: "after", session },
      ),
  });
};

const normalizeFirstAvailabilitySubmission = ({ timezone, slots, now }) => {
  if (!isValidTimeZone(timezone)) {
    throw new AppError(400, "timezone must be a valid IANA time zone identifier", {
      field: "timezone",
    });
  }

  if (!Array.isArray(slots)) {
    throw new AppError(400, "slots must be an array", { field: "slots" });
  }

  const today = getCalendarDateInTimeZone(now, timezone);
  const normalizedSlots = [];
  const seenSlots = new Set();

  for (const [index, slot] of slots.entries()) {
    if (!isCalendarDate(slot?.date)) {
      throw new AppError(400, "slots[].date must use YYYY-MM-DD", {
        field: `slots.${index}.date`,
      });
    }

    if (!AVAILABILITY_DAY_PART_VALUES.includes(slot.dayPart)) {
      throw new AppError(400, "slots[].dayPart must be MORNING or AFTERNOON", {
        field: `slots.${index}.dayPart`,
      });
    }

    if (slot.date < today) {
      throw new AppError(
        409,
        "Availability slots must not be before today in the submitted timezone",
        { field: `slots.${index}.date` },
      );
    }

    const key = `${slot.date}:${slot.dayPart}`;

    if (seenSlots.has(key)) {
      throw new AppError(
        400,
        "slots must not contain duplicate (date, dayPart) values",
        { field: `slots.${index}` },
      );
    }

    seenSlots.add(key);
    normalizedSlots.push({ date: slot.date, dayPart: slot.dayPart });
  }

  return {
    timezone,
    slots: normalizedSlots,
  };
};

// V12 F02 + V13 F05: first submit creates the sole current Availability and,
// only when the winning Application assignment is ASSIGNED(A), the required
// durable NotificationEvent for A in the same transaction. It never creates a
// Schedule or mutates Application status/version; UNASSIGNED has no fallback.
const submitCandidateAvailabilityFirstTime = async ({
  candidateUserId,
  actorUser,
  applicationId,
  timezone,
  slots,
  now = new Date(),
} = {}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(
      403,
      "Candidates may only submit Availability for their own Applications",
    );
  }

  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const submission = normalizeFirstAvailabilitySubmission({
    timezone,
    slots,
    now,
  });
  const session = await mongoose.startSession();
  let availability = null;
  let notificationEvent = null;

  try {
    await session.withTransaction(async () => {
      // withTransaction may retry this callback after a transient write conflict.
      availability = null;
      notificationEvent = null;

      const application = await Application.findOne({
        _id: applicationId,
        candidateUserId,
        source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
      }).session(session);

      if (!application) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      // Legacy pre-V12 downstream Applications are never backfilled with
      // inferred Availability.
      if (application.status !== APPLICATION_STATUS.CONTACTED) {
        throw new AppError(
          409,
          "Availability can first be submitted only while Application is CONTACTED",
          { field: "status" },
        );
      }

      const acquiredApplication =
        await acquireApplicationAssignmentForAvailabilityFirstSubmit({
          application,
          session,
        });
      if (!acquiredApplication) {
        throw new AppError(
          409,
          "Application has changed; refresh and retry Availability submission",
          { field: "applicationId" },
        );
      }

      [availability] = await CandidateAvailability.create(
        [
          {
            applicationId: acquiredApplication._id,
            timezone: submission.timezone,
            slots: submission.slots,
            revision: 0,
          },
        ],
        { session },
      );

      if (!isApplicationUnassigned(acquiredApplication)) {
        const [assignee, job] = await Promise.all([
          CompanyMember.findById(
            acquiredApplication.assignedRecruiterCompanyMemberId,
          )
            .select("userId")
            .session(session),
          Job.findById(acquiredApplication.jobId).select("title").session(session),
        ]);
        if (!assignee?.userId || !job) {
          throw new AppError(
            409,
            "Current Assignee is unavailable for Availability Notification",
          );
        }

        const { event } = await createNotificationEvent({
          eventKey: `interview-availability-submitted:${availability._id.toString()}`,
          type: NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_SUBMITTED,
          actorUserId: actorUser._id,
          applicationId: acquiredApplication._id,
          recipients: [
            {
              recipientUserId: assignee.userId,
              content: `The candidate submitted interview availability for ${job.title}.`,
            },
          ],
          session,
        });
        notificationEvent = event;
      }
    });
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw new AppError(
        409,
        "Availability has already been submitted; use the edit workflow",
        { field: "applicationId" },
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }

  if (notificationEvent) {
    try {
      await materializeNotificationEvent({ eventId: notificationEvent._id });
    } catch {
      // Availability and its durable obligation stay committed for recovery.
    }
  }

  return toCandidateAvailabilityProjection(availability);
};

// V12 F03: replace the one current Availability set, guarded by its revision.
// This shares the Availability write with proposal creation so transactions
// serialize either the edit or the proposal; neither can commit on stale slots.
const editCandidateAvailability = async ({
  candidateUserId,
  actorUser,
  applicationId,
  timezone,
  slots,
  expectedRevision,
  now = new Date(),
} = {}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(
      403,
      "Candidates may only edit Availability for their own Applications",
    );
  }

  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new AppError(
      400,
      "expectedRevision must be a non-negative integer",
      { field: "expectedRevision" },
    );
  }

  const submission = normalizeFirstAvailabilitySubmission({
    timezone,
    slots,
    now,
  });
  const session = await mongoose.startSession();
  let updatedAvailability = null;
  const notificationEvents = [];

  try {
    await session.withTransaction(async () => {
      notificationEvents.length = 0;
      const application = await Application.findOne({
        _id: applicationId,
        candidateUserId,
        source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
      }).session(session);
      if (!application) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      const availability = await CandidateAvailability.findOne({
        applicationId: application._id,
      }).session(session);
      if (!availability) {
        throw new AppError(
          409,
          "Availability has not been submitted; submit it before editing",
          { field: "applicationId" },
        );
      }

      const expirationResult = await expireDueInterviewProposalsForApplication({
        applicationId: application._id,
        now,
        session,
      });
      notificationEvents.push(...expirationResult.notificationEvents);

      const proposedSchedule = await InterviewSchedule.exists({
        applicationId: application._id,
        status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
      }).session(session);
      if (proposedSchedule) {
        throw new AppError(
          409,
          "Availability cannot be edited while an Interview Schedule is proposed",
          { field: "applicationId" },
        );
      }

      if (availability.revision !== expectedRevision) {
        throw new AppError(
          409,
          "Availability has changed; refresh and retry the edit",
          { field: "expectedRevision" },
        );
      }

      availability.timezone = submission.timezone;
      availability.slots = submission.slots;
      availability.revision += 1;
      await availability.save({ session });
      updatedAvailability = availability;
    });
  } finally {
    await session.endSession();
  }

  for (const notificationEvent of notificationEvents) {
    try {
      await materializeNotificationEvent({ eventId: notificationEvent._id });
    } catch {
      // The committed expiration and Availability edit remain recoverable.
    }
  }

  return toCandidateAvailabilityProjection(updatedAvailability);
};

const createInterviewProposal = async ({
  actorUser,
  jobId,
  applicationId,
  date,
  dayPart,
  expectedAvailabilityRevision,
  clientCompanyId,
  now = new Date(),
} = {}) => {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(404, "Job not found", { field: "jobId" });
  }

  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", { field: "applicationId" });
  }

  if (!isCalendarDate(date)) {
    throw new AppError(400, "date must use YYYY-MM-DD", { field: "date" });
  }

  if (!AVAILABILITY_DAY_PART_VALUES.includes(dayPart)) {
    throw new AppError(400, "dayPart must be MORNING or AFTERNOON", {
      field: "dayPart",
    });
  }

  if (
    !Number.isInteger(expectedAvailabilityRevision) ||
    expectedAvailabilityRevision < 0
  ) {
    throw new AppError(
      400,
      "expectedAvailabilityRevision must be a non-negative integer",
      { field: "expectedAvailabilityRevision" },
    );
  }

  const context = await resolveRecruiterBusinessContext({
    user: actorUser,
    clientCompanyId,
  });
  const session = await mongoose.startSession();
  let schedule = null;
  let job = null;
  let updatedApplication = null;
  let updatedAvailability = null;
  const notificationEvents = [];

  try {
    await session.withTransaction(async () => {
      notificationEvents.length = 0;
      job = await Job.findById(jobId).session(session);
      if (!job) {
        throw new AppError(404, "Job not found", { field: "jobId" });
      }

      assertSameCompanyTenant({
        resourceCompanyId: job.companyId,
        tenantCompanyId: context.companyId,
      });

      const application = await Application.findById(applicationId).session(session);
      if (!application || application.jobId.toString() !== job._id.toString()) {
        throw new AppError(404, "Application not found", { field: "applicationId" });
      }

      if (!isLifecycleCompatibleApplicationSource(application.source)) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      if (isApplicationTerminalStatus(application.status)) {
        throw new AppError(409, "Terminal Applications cannot receive proposals", {
          field: "status",
        });
      }

      const isFirstProposal =
        application.status === APPLICATION_STATUS.CONTACTED;
      if (
        !isFirstProposal &&
        application.status !== APPLICATION_STATUS.INTERVIEW_SCHEDULED
      ) {
        throw new AppError(
          409,
          "Interview proposals can only be created while Application is CONTACTED or INTERVIEW_SCHEDULED",
          { field: "status" },
        );
      }

      if (
        isApplicationUnassigned(application) ||
        application.assignedRecruiterCompanyMemberId.toString() !==
          context.membership._id.toString()
      ) {
        throw new AppError(
          403,
          "Only the current Assigned Recruiter can create an Interview proposal",
          { field: "role" },
        );
      }

      const assigneeContext = await assertAssigneeEligibleAtAssignmentCommit({
        assigneeCompanyMemberId: context.membership._id,
        job,
        session,
      });

      const availability = await CandidateAvailability.findOne({
        applicationId: application._id,
      }).session(session);
      if (!availability) {
        throw new AppError(409, "Candidate Availability has not been submitted", {
          field: "applicationId",
        });
      }

      if (availability.revision !== expectedAvailabilityRevision) {
        throw new AppError(
          409,
          "Availability has changed; refresh and retry Interview proposal",
          { field: "expectedAvailabilityRevision" },
        );
      }

      const selectedSlot = availability.slots.find(
        (slot) => slot.date === date && slot.dayPart === dayPart,
      );
      if (!selectedSlot) {
        throw new AppError(409, "Selected slot is not in current Availability", {
          field: "date",
        });
      }

      if (date < getCalendarDateInTimeZone(now, availability.timezone)) {
        throw new AppError(409, "Selected slot is in the past", { field: "date" });
      }

      const expirationResult = await expireDueInterviewProposalsForApplication({
        applicationId: application._id,
        now,
        session,
      });
      notificationEvents.push(...expirationResult.notificationEvents);

      const [activeSchedule, declinedSchedule] = await Promise.all([
        InterviewSchedule.exists({
          applicationId: application._id,
          status: {
            $in: [
              INTERVIEW_SCHEDULE_STATUS.PROPOSED,
              INTERVIEW_SCHEDULE_STATUS.CONFIRMED,
            ],
          },
        }).session(session),
        InterviewSchedule.exists({
          applicationId: application._id,
          date,
          dayPart,
          status: INTERVIEW_SCHEDULE_STATUS.DECLINED,
        }).session(session),
      ]);
      if (activeSchedule) {
        throw new AppError(409, "Application already has an active Interview Schedule", {
          field: "applicationId",
        });
      }
      if (declinedSchedule) {
        throw new AppError(409, "Selected slot was previously declined", {
          field: "date",
        });
      }

      const expiresAt = deriveProposalExpiresAt({
        date,
        timezone: availability.timezone,
      });
      schedule = new InterviewSchedule({
        applicationId: application._id,
        status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
        date,
        dayPart,
        timezone: availability.timezone,
        expiresAt,
        createdByUserId: assigneeContext.user._id,
        createdByCompanyMemberId: assigneeContext.membership._id,
      });
      await schedule.save({ session });

      // Every proposal claims the current Application revision. For a
      // reproposal this is a concurrency-only write: it serializes proposal
      // creation with a terminal transition without changing the Application
      // business status. If terminal wins, the Schedule insert rolls back with
      // this transaction instead of leaving terminal + PROPOSED committed.
      updatedApplication = await Application.findOneAndUpdate(
        {
          _id: application._id,
          status: application.status,
          version: application.version,
          assignedRecruiterCompanyMemberId: assigneeContext.membership._id,
        },
        {
          ...(isFirstProposal
            ? { $set: { status: APPLICATION_STATUS.INTERVIEW_SCHEDULED } }
            : {}),
          $inc: { version: 1 },
        },
        { returnDocument: "after", session },
      );
      if (!updatedApplication) {
        throw new AppError(
          409,
          "Application has changed; refresh and retry Interview proposal",
          { field: "applicationId" },
        );
      }

      if (isFirstProposal) {
        const statusNotificationEvent =
          await createApplicationLifecycleNotificationEvent({
            application: updatedApplication,
            job,
            type: NOTIFICATION_TYPE.APPLICATION_STATUS_CHANGED,
            actorUserId: actorUser._id,
            recipientUserId: updatedApplication.candidateUserId,
            session,
          });
        if (statusNotificationEvent) {
          notificationEvents.push(statusNotificationEvent);
        }
      }

      const scheduleNotificationEvent =
        await createInterviewScheduleNotificationEvent({
          application: updatedApplication,
          job,
          schedule,
          type: NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CREATED,
          actorUserId: actorUser._id,
          session,
        });
      if (scheduleNotificationEvent) {
        notificationEvents.push(scheduleNotificationEvent);
      }

      availability.revision += 1;
      await availability.save({ session });
      updatedAvailability = availability;
    });
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      throw new AppError(409, "Application already has an active Interview Schedule", {
        field: "applicationId",
      });
    }
    throw error;
  } finally {
    await session.endSession();
  }

  for (const notificationEvent of notificationEvents) {
    try {
      await materializeNotificationEvent({ eventId: notificationEvent._id });
    } catch {
      // The committed proposal/status event remains pending for recovery.
    }
  }

  return {
    job: toPublicJob(job),
    application: {
      id: updatedApplication._id.toString(),
      status: updatedApplication.status,
      version: updatedApplication.version,
    },
    availability: toCandidateAvailabilityProjection(updatedAvailability),
    interviewSchedule: {
      id: schedule._id.toString(),
      applicationId: schedule.applicationId.toString(),
      status: schedule.status,
      date: schedule.date,
      dayPart: schedule.dayPart,
      timezone: schedule.timezone,
      expiresAt: schedule.expiresAt,
      createdByUserId: schedule.createdByUserId.toString(),
      createdByCompanyMemberId: schedule.createdByCompanyMemberId.toString(),
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    },
  };
};

const createFirstInterviewProposal = createInterviewProposal;

// V12 F06/F07: Candidate ownership is resolved only through the Application.
// The guarded update lets exactly one concurrent PROPOSED response commit.
const respondToCandidateInterviewProposal = async ({
  candidateUserId,
  actorUser,
  applicationId,
  interviewScheduleId,
  targetStatus,
  now = new Date(),
} = {}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(
      403,
      "Candidates may only respond to Interview Schedules for their own Applications",
    );
  }

  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", { field: "applicationId" });
  }

  if (!mongoose.isValidObjectId(interviewScheduleId)) {
    throw new AppError(404, "Interview Schedule not found", {
      field: "interviewScheduleId",
    });
  }

  const initialApplication = await Application.findOne({
    _id: applicationId,
    candidateUserId,
    source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
  }).lean();
  if (!initialApplication) {
    throw new AppError(404, "Application not found", { field: "applicationId" });
  }

  await expireDueInterviewProposalsForApplication({
    applicationId: initialApplication._id,
    now,
  });

  const session = await mongoose.startSession();
  let schedule = null;
  let notificationEvent = null;

  try {
    await session.withTransaction(async () => {
      schedule = null;
      notificationEvent = null;

      const application = await Application.findOne({
        _id: applicationId,
        candidateUserId,
        source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
      }).session(session);
      if (!application) {
        throw new AppError(404, "Application not found", { field: "applicationId" });
      }
      if (isApplicationTerminalStatus(application.status)) {
        throw new AppError(409, "Terminal Applications cannot receive Schedule responses", {
          field: "status",
        });
      }

      const acquiredApplication = await acquireWithRestoredUpdatedAt({
        model: Application,
        documentId: application._id,
        session,
        acquire: () =>
          Application.findOneAndUpdate(
            {
              _id: application._id,
              candidateUserId,
              source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
              status: application.status,
              version: application.version,
              assignedRecruiterCompanyMemberId:
                application.assignedRecruiterCompanyMemberId ?? null,
            },
            {
              $set: {
                assignedRecruiterCompanyMemberId:
                  application.assignedRecruiterCompanyMemberId ?? null,
              },
            },
            { returnDocument: "after", session },
          ),
      });
      if (!acquiredApplication) {
        throw new AppError(
          409,
          "Application has changed; refresh and retry the Interview Schedule response",
          { field: "applicationId" },
        );
      }

      schedule = await InterviewSchedule.findOneAndUpdate(
        {
          _id: interviewScheduleId,
          applicationId: acquiredApplication._id,
          status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
          expiresAt: { $gt: now },
        },
        { $set: { status: targetStatus } },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!schedule) {
        throw new AppError(
          409,
          "Interview Schedule is no longer a live proposed proposal",
          { field: "interviewScheduleId" },
        );
      }

      if (!isApplicationUnassigned(acquiredApplication)) {
        const [assignee, job] = await Promise.all([
          CompanyMember.findById(
            acquiredApplication.assignedRecruiterCompanyMemberId,
          )
            .select("userId")
            .session(session),
          Job.findById(acquiredApplication.jobId).select("title").session(session),
        ]);
        if (!assignee?.userId) {
          throw new Error("Current Assignee is unavailable for Schedule Notification");
        }

        notificationEvent = await createInterviewScheduleNotificationEvent({
          application: acquiredApplication,
          job,
          schedule,
          type:
            targetStatus === INTERVIEW_SCHEDULE_STATUS.CONFIRMED
              ? NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CONFIRMED
              : NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_DECLINED,
          actorUserId: actorUser._id,
          recipientUserId: assignee.userId,
          session,
        });
      }
    });
  } finally {
    await session.endSession();
  }

  if (notificationEvent) {
    try {
      await materializeNotificationEvent({ eventId: notificationEvent._id });
    } catch {
      // The committed Schedule response remains recoverable.
    }
  }

  return toInterviewScheduleProjection(schedule);
};

const confirmCandidateInterviewProposal = async (input = {}) => {
  return respondToCandidateInterviewProposal({
    ...input,
    targetStatus: INTERVIEW_SCHEDULE_STATUS.CONFIRMED,
  });
};

const declineCandidateInterviewProposal = async (input = {}) => {
  return respondToCandidateInterviewProposal({
    ...input,
    targetStatus: INTERVIEW_SCHEDULE_STATUS.DECLINED,
  });
};

// V12 F08 Slice 05: cancellation authority follows the current eligible
// Assignee, never the Schedule's immutable historical creator identity.
const cancelRecruiterInterviewProposal = async ({
  actorUser,
  jobId,
  applicationId,
  interviewScheduleId,
  clientCompanyId,
} = {}) => {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(404, "Job not found", { field: "jobId" });
  }
  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", { field: "applicationId" });
  }
  if (!mongoose.isValidObjectId(interviewScheduleId)) {
    throw new AppError(404, "Interview Schedule not found", {
      field: "interviewScheduleId",
    });
  }

  const context = await resolveRecruiterBusinessContext({
    user: actorUser,
    clientCompanyId,
  });
  const session = await mongoose.startSession();
  let cancelledSchedule = null;
  let notificationEvent = null;

  try {
    await session.withTransaction(async () => {
      cancelledSchedule = null;
      notificationEvent = null;
      const job = await Job.findById(jobId).session(session);
      if (!job) {
        throw new AppError(404, "Job not found", { field: "jobId" });
      }
      assertSameCompanyTenant({
        resourceCompanyId: job.companyId,
        tenantCompanyId: context.companyId,
      });

      const application = await Application.findOne({
        _id: applicationId,
        jobId: job._id,
        source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
      }).session(session);
      if (!application) {
        throw new AppError(404, "Application not found", { field: "applicationId" });
      }
      if (isApplicationTerminalStatus(application.status)) {
        throw new AppError(409, "Terminal Applications cannot cancel Schedules", {
          field: "status",
        });
      }
      if (
        isApplicationUnassigned(application) ||
        application.assignedRecruiterCompanyMemberId.toString() !==
          context.membership._id.toString()
      ) {
        throw new AppError(
          403,
          "Only the current Assigned Recruiter can cancel an Interview proposal",
          { field: "role" },
        );
      }

      await assertAssigneeEligibleAtAssignmentCommit({
        assigneeCompanyMemberId: context.membership._id,
        job,
        session,
      });

      cancelledSchedule = await InterviewSchedule.findOneAndUpdate(
        {
          _id: interviewScheduleId,
          applicationId: application._id,
          status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
        },
        { $set: { status: INTERVIEW_SCHEDULE_STATUS.CANCELLED } },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!cancelledSchedule) {
        throw new AppError(
          409,
          "Interview Schedule is not a proposed proposal for this Application",
          { field: "interviewScheduleId" },
        );
      }

      notificationEvent = await createInterviewScheduleNotificationEvent({
        application,
        job,
        schedule: cancelledSchedule,
        type: NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CHANGED,
        actorUserId: actorUser._id,
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  if (notificationEvent) {
    try {
      await materializeNotificationEvent({ eventId: notificationEvent._id });
    } catch {
      // The committed cancellation remains recoverable.
    }
  }

  return toInterviewScheduleProjection(cancelledSchedule);
};

const listCandidateMyApplications = async ({
  candidateUserId,
  actorUser,
  status,
  q,
} = {}) => {
  assertCandidateActor(actorUser);

  // BR-41: ownership from authenticated identity only — never client candidateUserId.
  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(
      403,
      "Candidates may only access their own Applications",
    );
  }

  const statusFilter = normalizeCandidateMyApplicationsStatusFilter(status);
  const search = normalizeCandidateMyApplicationsSearch(q);

  // IDX-A05: Candidate My Applications by owner (+ optional status).
  const query = {
    candidateUserId,
    source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
  };

  if (statusFilter != null) {
    query.status = statusFilter;
  }

  const applications = await Application.find(query).sort({
    appliedAt: -1,
    _id: -1,
  });

  let views = await hydrateCandidateMyApplicationViews(applications);

  // F08: optional Job/Company name search on the current owner projection.
  if (search != null) {
    views = views.filter((application) => {
      const jobTitle = application.job?.title?.toLowerCase() ?? "";
      const companyName = application.company?.name?.toLowerCase() ?? "";
      return jobTitle.includes(search) || companyName.includes(search);
    });
  }

  return {
    applications: views,
  };
};

const getCandidateMyApplication = async ({
  candidateUserId,
  actorUser,
  applicationId,
  now = new Date(),
} = {}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(
      403,
      "Candidates may only access their own Applications",
    );
  }

  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  // BR-41: owner-scoped lookup — foreign Applications are not readable.
  const application = await Application.findOne({
    _id: applicationId,
    candidateUserId,
    source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
  });

  if (!application) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const [view] = await hydrateCandidateMyApplicationViews([application], { now });

  return {
    application: view,
  };
};

// BR-21 / BR-22: canonical forward chain + Reject from any non-terminal stage.
const PIPELINE_FORWARD_TARGET_BY_SOURCE = Object.freeze({
  [APPLICATION_STATUS.APPLIED]: APPLICATION_STATUS.SCREENING,
  [APPLICATION_STATUS.SCREENING]: APPLICATION_STATUS.CONTACTED,
  [APPLICATION_STATUS.CONTACTED]: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  [APPLICATION_STATUS.INTERVIEW_SCHEDULED]:
    APPLICATION_STATUS.INTERVIEW_COMPLETED,
  [APPLICATION_STATUS.INTERVIEW_COMPLETED]: APPLICATION_STATUS.HIRED,
});

const isAllowedRecruitmentPipelineTransition = ({
  expectedStatus,
  targetStatus,
} = {}) => {
  if (targetStatus === APPLICATION_STATUS.REJECTED) {
    return APPLICATION_NON_TERMINAL_STATUSES.includes(expectedStatus);
  }

  return PIPELINE_FORWARD_TARGET_BY_SOURCE[expectedStatus] === targetStatus;
};

const isApplicationTerminalStatus = (status) => {
  return APPLICATION_TERMINAL_STATUSES.includes(status);
};

const assertCurrentPrimaryOfJob = ({
  job,
  actorMembershipId,
  actionLabel = "manage",
}) => {
  if (job.primaryRecruiterCompanyMemberId.toString() !== actorMembershipId.toString()) {
    throw new AppError(
      403,
      `Only the current Primary Recruiter can ${actionLabel} Applications for this Job`,
      { field: "role" },
    );
  }
};

// BR-06 / BR-15 / BR-42 / BR-53: assignment-management authority is current
// Primary of the Job or Company Manager of the owning Company. Tenant is the
// authenticated membership company, never a client-supplied company identity.
const assertAssignmentManagementAuthority = ({
  context,
  job,
  actionLabel = "manage",
}) => {
  if (context.membership.role === COMPANY_MEMBER_ROLE.COMPANY_MANAGER) {
    return;
  }

  assertCurrentPrimaryOfJob({
    job,
    actorMembershipId: context.membership._id,
    actionLabel,
  });
};

// Manual assignment-management actor business-access at commit (BR-06/BR-12/
// BR-15/BR-53; V1/V3 Company Staff access; TX-02): soft pre-tx context is not
// enough. Soft-read then conditionally acquire current Company operational +
// actor CompanyMember ACTIVE with expected role + actor User ACTIVE, and
// revalidate mustChangePassword from the acquired/current User — never trust
// pre-tx membership/user snapshots. Soft reads precede acquires so concurrent
// Company/User writers can commit against a stale soft snapshot (same pattern
// as target eligibility). Call BEFORE target eligibility and BEFORE Job
// acquires so order stays
// Company → actor Membership → actor User → target Membership/User → Job.
// Automatic Unassign does not use this path.
const assertAssignmentManagementActorBusinessAccessAtCommit = async ({
  context,
  job,
  session,
} = {}) => {
  const isCompanyManager =
    context.membership.role === COMPANY_MEMBER_ROLE.COMPANY_MANAGER;
  const expectedMembershipRole = isCompanyManager
    ? COMPANY_MEMBER_ROLE.COMPANY_MANAGER
    : COMPANY_MEMBER_ROLE.RECRUITER;

  let companyQuery = Company.findById(job.companyId).select(
    "approvalStatus operationalStatus",
  );
  if (session) {
    companyQuery = companyQuery.session(session);
  }

  const company = await companyQuery;

  if (!isOwningCompanyActiveForPublicEligibility(company)) {
    throw new AppError(409, "Owning Company is not operational", {
      field: "companyId",
    });
  }

  let membershipQuery = CompanyMember.findById(context.membership._id);
  if (session) {
    membershipQuery = membershipQuery.session(session);
  }

  const membership = await membershipQuery;

  if (
    !membership ||
    membership.companyId.toString() !== job.companyId.toString() ||
    membership.role !== expectedMembershipRole ||
    membership.status !== COMPANY_MEMBER_STATUS.ACTIVE
  ) {
    throw new AppError(403, "Company membership is not active", {
      field: "membershipStatus",
    });
  }

  let userQuery = User.findById(membership.userId).select(
    "status mustChangePassword",
  );
  if (session) {
    userQuery = userQuery.session(session);
  }

  const user = await userQuery;

  if (!user || user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, "Account is not active", {
      field: "status",
    });
  }

  if (user.mustChangePassword) {
    throw new AppError(
      403,
      "Password setup is required before business access",
      {
        field: "mustChangePassword",
      },
    );
  }

  const stillOperationalCompany =
    await acquireOperationalCompanyForAssigneeEligibilityTx({
      companyId: job.companyId,
      session,
    });

  if (!stillOperationalCompany) {
    throw new AppError(409, "Owning Company is not operational", {
      field: "companyId",
    });
  }

  const stillActiveMembership =
    await acquireActiveCompanyStaffMembershipForBusinessAccessTx({
      companyMemberId: membership._id,
      companyId: job.companyId,
      role: expectedMembershipRole,
      session,
    });

  if (!stillActiveMembership) {
    throw new AppError(403, "Company membership is not active", {
      field: "membershipStatus",
    });
  }

  const stillActiveUser = await acquireActiveUserForAssigneeEligibilityTx({
    userId: stillActiveMembership.userId,
    session,
  });

  if (!stillActiveUser) {
    throw new AppError(403, "Account is not active", {
      field: "status",
    });
  }

  // Re-check password gate from the acquired User document (not pre-tx
  // context.user.mustChangePassword).
  if (stillActiveUser.mustChangePassword) {
    throw new AppError(
      403,
      "Password setup is required before business access",
      {
        field: "mustChangePassword",
      },
    );
  }

  return {
    company: stillOperationalCompany,
    membership: stillActiveMembership,
    user: stillActiveUser,
    isCompanyManager,
  };
};

// Primary relation acquire only — run AFTER actor Membership/User and any
// target eligibility acquires so Job is not locked before Membership/User.
const assertAssignmentManagementPrimaryRelationAtCommit = async ({
  context,
  job,
  session,
  actionLabel = "manage",
} = {}) => {
  if (context.membership.role === COMPANY_MEMBER_ROLE.COMPANY_MANAGER) {
    return null;
  }

  const stillCurrentPrimaryJob =
    await acquireJobCurrentPrimaryForAssignmentManagementTx({
      jobId: job._id,
      companyId: job.companyId,
      primaryCompanyMemberId: context.membership._id,
      session,
    });

  if (!stillCurrentPrimaryJob) {
    throw new AppError(
      403,
      `Only the current Primary Recruiter can ${actionLabel} Applications for this Job`,
      { field: "role" },
    );
  }

  return stillCurrentPrimaryJob;
};

// BR-07 / TX-02: assignee eligibility for Assign and Reassign/Take over —
// derived from persisted Job/Member/User/Company at commit time.
const assertAssigneeEligibleForJobAssignment = async ({
  assigneeCompanyMemberId,
  job,
  session,
} = {}) => {
  if (!mongoose.isValidObjectId(assigneeCompanyMemberId)) {
    throw new AppError(400, "Invalid assignee CompanyMember id", {
      field: "assigneeCompanyMemberId",
    });
  }

  let membershipQuery = CompanyMember.findById(assigneeCompanyMemberId);
  if (session) {
    membershipQuery = membershipQuery.session(session);
  }

  const membership = await membershipQuery;

  if (!membership) {
    throw new AppError(409, "Assignee Recruiter was not found", {
      field: "assigneeCompanyMemberId",
    });
  }

  // BR-40: assignee must belong to Job company.
  if (membership.companyId.toString() !== job.companyId.toString()) {
    throw new AppError(409, "Assignee must belong to the Job Company", {
      field: "assigneeCompanyMemberId",
    });
  }

  if (membership.role !== COMPANY_MEMBER_ROLE.RECRUITER) {
    throw new AppError(409, "Assignee must be a Recruiter", {
      field: "assigneeCompanyMemberId",
    });
  }

  if (membership.status !== COMPANY_MEMBER_STATUS.ACTIVE) {
    throw new AppError(409, "Assignee CompanyMember must be ACTIVE", {
      field: "assigneeCompanyMemberId",
      status: membership.status,
    });
  }

  const membershipIdStr = membership._id.toString();
  const isPrimary =
    job.primaryRecruiterCompanyMemberId.toString() === membershipIdStr;
  const isSupporting = (job.supportingRecruiterCompanyMemberIds ?? []).some(
    (id) => id.toString() === membershipIdStr,
  );

  if (!isPrimary && !isSupporting) {
    throw new AppError(
      409,
      "Assignee must be the current Primary or Supporting Recruiter of the Job",
      { field: "assigneeCompanyMemberId" },
    );
  }

  let userQuery = User.findById(membership.userId).select("status fullName avatarUrl");
  if (session) {
    userQuery = userQuery.session(session);
  }

  const user = await userQuery;

  if (!user || user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(409, "Assignee User must be ACTIVE", {
      field: "assigneeCompanyMemberId",
    });
  }

  let companyQuery = Company.findById(job.companyId).select(
    "approvalStatus operationalStatus",
  );
  if (session) {
    companyQuery = companyQuery.session(session);
  }

  const company = await companyQuery;

  if (!isOwningCompanyActiveForPublicEligibility(company)) {
    throw new AppError(409, "Owning Company is not operational", {
      field: "companyId",
    });
  }

  return { membership, user, company };
};

// TX-02: assignment/handoff/Pipeline eligibility at commit. Canonical Assignee
// eligibility depends on Company + CompanyMember + User + Job team; serialize
// against eligibility-losing writers on each dimension via conditional acquires.
// Lock order Company → CompanyMember → User → Job matches team-removal /
// Recruiter LOCK writers (CompanyMember before Job) to avoid deadlock.
const assertAssigneeEligibleAtAssignmentCommit = async ({
  assigneeCompanyMemberId,
  job,
  session,
} = {}) => {
  const assigneeContext = await assertAssigneeEligibleForJobAssignment({
    assigneeCompanyMemberId,
    job,
    session,
  });

  const stillOperationalCompany =
    await acquireOperationalCompanyForAssigneeEligibilityTx({
      companyId: job.companyId,
      session,
    });

  if (!stillOperationalCompany) {
    throw new AppError(409, "Owning Company is not operational", {
      field: "companyId",
    });
  }

  const stillActiveMembership =
    await acquireActiveRecruiterMembershipForTeamResponsibilityTx({
      recruiterCompanyMemberId: assigneeContext.membership._id,
      companyId: job.companyId,
      session,
    });

  if (!stillActiveMembership) {
    throw new AppError(409, "Assignee CompanyMember must be ACTIVE", {
      field: "assigneeCompanyMemberId",
      status: COMPANY_MEMBER_STATUS.LOCKED,
    });
  }

  const stillActiveUser = await acquireActiveUserForAssigneeEligibilityTx({
    userId: assigneeContext.membership.userId,
    session,
  });

  if (!stillActiveUser) {
    throw new AppError(409, "Assignee User must be ACTIVE", {
      field: "assigneeCompanyMemberId",
    });
  }

  const stillOnTeam = await acquireJobTeamMembershipForAssigneeEligibilityTx({
    jobId: job._id,
    companyId: job.companyId,
    assigneeCompanyMemberId: assigneeContext.membership._id,
    session,
  });

  if (!stillOnTeam) {
    throw new AppError(
      409,
      "Assignee must be the current Primary or Supporting Recruiter of the Job",
      { field: "assigneeCompanyMemberId" },
    );
  }

  return {
    membership: stillActiveMembership,
    user: stillActiveUser,
    company: stillOperationalCompany,
  };
};

const buildPrimaryApplicationViewFromDocs = async ({
  application,
  assigneeMembership,
  assigneeUser,
  session,
  now = new Date(),
} = {}) => {
  const [applicationView] = await hydratePrimaryJobApplicationViews(
    [application],
    { now },
  );

  if (
    !isApplicationUnassigned(application) &&
    (assigneeMembership != null || assigneeUser != null)
  ) {
    let membership = assigneeMembership;
    let user = assigneeUser;

    if (membership == null) {
      let membershipQuery = CompanyMember.findById(
        application.assignedRecruiterCompanyMemberId,
      ).select("userId jobTitle");
      if (session) {
        membershipQuery = membershipQuery.session(session);
      }
      membership = await membershipQuery;
    }

    if (membership != null && user == null) {
      let userQuery = User.findById(membership.userId).select(
        "fullName avatarUrl",
      );
      if (session) {
        userQuery = userQuery.session(session);
      }
      user = await userQuery;
    }

    applicationView.assignedRecruiter = toPublicAssignedRecruiterSummary({
      membership,
      user,
    });
  }

  return applicationView;
};

const rejectFailedFirstAssignCas = async ({
  applicationId,
  expectedVersion,
  session,
} = {}) => {
  let latestQuery = Application.findById(applicationId);
  if (session) {
    latestQuery = latestQuery.session(session);
  }

  const latestApplication = await latestQuery;

  if (!latestApplication) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  if (isApplicationTerminalStatus(latestApplication.status)) {
    throw new AppError(409, "Terminal Applications cannot be assigned", {
      field: "status",
      status: latestApplication.status,
    });
  }

  if (!isApplicationUnassigned(latestApplication)) {
    throw new AppError(409, "Application already has an Assignee", {
      field: "assignedRecruiterCompanyMemberId",
    });
  }

  if (latestApplication.version !== expectedVersion) {
    throw new AppError(
      409,
      "Application has changed; refresh and retry Assign",
      { field: "expectedVersion" },
    );
  }

  throw new AppError(
    409,
    "Application has changed; refresh and retry Assign",
    { field: "expectedVersion" },
  );
};

// Canonical NONE → Recruiter persistence mutation (Data Contract §8.1 / TX-01).
// Matches Unassigned + expected version + current non-terminal status; does not
// mutate Recruitment Status, identity, snapshot, or Recruitment Team.
const commitAssignFromUnassigned = async ({
  applicationId,
  jobId,
  assigneeCompanyMemberId,
  expectedVersion,
  session,
} = {}) => {
  return Application.findOneAndUpdate(
    {
      _id: applicationId,
      jobId,
      source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
      status: { $in: [...APPLICATION_NON_TERMINAL_STATUSES] },
      version: expectedVersion,
      assignedRecruiterCompanyMemberId: null,
    },
    {
      $set: {
        assignedRecruiterCompanyMemberId: assigneeCompanyMemberId,
      },
      $inc: {
        version: 1,
      },
    },
    {
      returnDocument: "after",
      session,
    },
  );
};

// V11 F01 / TX-01: Conversation consequence of a successful First Assign.
// Absence of Conversation distinguishes First Assign from Assign again; this
// helper creates Conversation only when none exists.
const createConversationOnFirstAssignIfAbsent = async ({
  applicationId,
  session,
} = {}) => {
  const existingConversation = await Conversation.findOne({
    applicationId,
  }).session(session);

  if (existingConversation) {
    return { conversation: existingConversation, created: false };
  }

  try {
    const [createdConversation] = await Conversation.create(
      [{ applicationId }],
      { session },
    );
    return { conversation: createdConversation, created: true };
  } catch (error) {
    if (!isMongoDuplicateKeyError(error)) {
      throw error;
    }

    const concurrentConversation = await Conversation.findOne({
      applicationId,
    }).session(session);

    if (concurrentConversation) {
      return { conversation: concurrentConversation, created: false };
    }

    throw error;
  }
};

const createChatMessageNotificationEvent = async ({
  applicationId,
  message,
  actorUserId = null,
  recipients,
  session,
} = {}) => {
  const recipientsByUserId = new Map();

  for (const recipient of recipients) {
    if (
      recipient.recipientUserId == null ||
      (actorUserId != null &&
        recipient.recipientUserId.toString() === actorUserId.toString())
    ) {
      continue;
    }

    recipientsByUserId.set(recipient.recipientUserId.toString(), recipient);
  }

  if (recipientsByUserId.size === 0) {
    return null;
  }

  const { event } = await createNotificationEvent({
    eventKey: `chat-message-created:${message._id.toString()}`,
    type: NOTIFICATION_TYPE.CHAT_MESSAGE_CREATED,
    actorUserId,
    applicationId,
    messageId: message._id,
    recipients: [...recipientsByUserId.values()],
    session,
  });

  return event;
};

const emitCommittedChatMessageRealtimeBestEffort = ({
  message,
  recipientUserIds,
  applicationId,
} = {}) => {
  if (message == null || applicationId == null) {
    return;
  }

  try {
    emitMessageToRecipients({
      message,
      recipientUserIds,
      applicationId,
    });
  } catch {
    // Message realtime fan-out is best-effort and must not fail the caller.
  }
};

const resolveConversationStateRealtimeRecipients = async ({
  application,
  session,
} = {}) => {
  if (application == null) {
    return null;
  }

  let conversationQuery = Conversation.findOne({
    applicationId: application._id,
  });
  if (session) {
    conversationQuery = conversationQuery.session(session);
  }

  const conversation = await conversationQuery;

  if (!conversation) {
    return null;
  }

  const recipientUserIds = new Set([
    application.candidateUserId.toString(),
  ]);

  if (!isApplicationUnassigned(application)) {
    let assigneeQuery = CompanyMember.findById(
      application.assignedRecruiterCompanyMemberId,
    );
    if (session) {
      assigneeQuery = assigneeQuery.session(session);
    }

    const assignee = await assigneeQuery;

    if (assignee) {
      let assigneeUserQuery = User.findById(assignee.userId);
      if (session) {
        assigneeUserQuery = assigneeUserQuery.session(session);
      }

      const assigneeUser = await assigneeUserQuery;

      if (assigneeUser) {
        const applicationIsTerminal = isApplicationTerminalStatus(
          application.status,
        );

        if (
          !applicationIsTerminal ||
          (assignee.status === COMPANY_MEMBER_STATUS.ACTIVE &&
            assigneeUser.status === USER_STATUS.ACTIVE)
        ) {
          recipientUserIds.add(assignee.userId.toString());
        }
      }
    }
  }

  return {
    conversationId: conversation._id,
    recipientUserIds: [...recipientUserIds],
  };
};

const emitCommittedConversationStateRealtimeBestEffort = async ({
  application,
  mode,
  session,
} = {}) => {
  if (application == null || mode == null) {
    return;
  }

  try {
    const context = await resolveConversationStateRealtimeRecipients({
      application,
      session,
    });

    if (!context) {
      return;
    }

    emitConversationStateToRecipients({
      recipientUserIds: context.recipientUserIds,
      conversationId: context.conversationId,
      applicationId: application._id,
      mode,
    });
  } catch {
    // Conversation state realtime fan-out is best-effort and must not fail the caller.
  }
};

const createAssignmentNotificationEvent = async ({
  application,
  job,
  type,
  actorUserId = null,
  outgoingAssigneeUserId = null,
  newAssigneeUserId = null,
  session,
} = {}) => {
  const jobTitle = job?.title ?? "this position";
  const recipientsByUserId = new Map();
  const addRecipient = (recipientUserId, content) => {
    if (
      recipientUserId == null ||
      (actorUserId != null &&
        recipientUserId.toString() === actorUserId.toString())
    ) {
      return;
    }

    const recipientKey = recipientUserId.toString();
    if (!recipientsByUserId.has(recipientKey)) {
      recipientsByUserId.set(recipientKey, { recipientUserId, content });
    }
  };

  if (type === NOTIFICATION_TYPE.APPLICATION_ASSIGNED) {
    addRecipient(
      application.candidateUserId,
      `Your application for ${jobTitle} has been assigned to a recruiter.`,
    );
    addRecipient(
      newAssigneeUserId,
      `You have been assigned responsibility for an application for ${jobTitle}.`,
    );
  } else if (type === NOTIFICATION_TYPE.APPLICATION_REASSIGNED) {
    addRecipient(
      application.candidateUserId,
      `The responsible recruiter for your application for ${jobTitle} has changed.`,
    );
    addRecipient(
      outgoingAssigneeUserId,
      `You are no longer responsible for an application for ${jobTitle}.`,
    );
    addRecipient(
      newAssigneeUserId,
      `You are now responsible for an application for ${jobTitle}.`,
    );
  } else if (type === NOTIFICATION_TYPE.APPLICATION_UNASSIGNED) {
    addRecipient(
      application.candidateUserId,
      `Your application for ${jobTitle} is waiting for a new responsible recruiter.`,
    );
    addRecipient(
      outgoingAssigneeUserId,
      `You are no longer responsible for an application for ${jobTitle}.`,
    );
  } else {
    throw new Error("Unsupported Assignment Notification type");
  }

  if (recipientsByUserId.size === 0) {
    return null;
  }

  const { event } = await createNotificationEvent({
    eventKey: `${type.toLowerCase()}:${application._id.toString()}:${application.version}`,
    type,
    actorUserId,
    applicationId: application._id,
    recipients: [...recipientsByUserId.values()],
    session,
  });

  return event;
};

// V13 F04/F05: source transitions own their durable obligation. This helper
// snapshots exactly one trusted recipient for each Application lifecycle event;
// it never derives recipients from client input or during materialization.
const createApplicationLifecycleNotificationEvent = async ({
  application,
  job,
  type,
  actorUserId = null,
  recipientUserId,
  session,
} = {}) => {
  if (
    recipientUserId == null ||
    (actorUserId != null &&
      recipientUserId.toString() === actorUserId.toString())
  ) {
    return null;
  }

  const jobTitle = job?.title ?? "this position";
  const contentByType = {
    [NOTIFICATION_TYPE.APPLICATION_STATUS_CHANGED]: `Your application for ${jobTitle} has moved to ${application.status}.`,
    [NOTIFICATION_TYPE.APPLICATION_HIRED]: `Your application for ${jobTitle} has been marked as hired.`,
    [NOTIFICATION_TYPE.APPLICATION_REJECTED]: `Your application for ${jobTitle} has been rejected.`,
    [NOTIFICATION_TYPE.APPLICATION_WITHDRAWN]: `The candidate withdrew their application for ${jobTitle}.`,
    [NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED]: `Please provide your availability for an interview for ${jobTitle}.`,
  };
  const content = contentByType[type];

  if (!content) {
    throw new Error("Unsupported Application lifecycle Notification type");
  }

  const { event } = await createNotificationEvent({
    eventKey: `${type.toLowerCase()}:${application._id.toString()}:${application.version}`,
    type,
    actorUserId,
    applicationId: application._id,
    recipients: [{ recipientUserId, content }],
    session,
  });

  return event;
};

// V13 F06 / TX-01: each Schedule transition owns its independent durable
// obligation. Recipient/content are fixed from the winning source state; this
// helper never reuses the historical Schedule creator as a current Assignee.
const createInterviewScheduleNotificationEvent = async ({
  application,
  job,
  schedule,
  type,
  actorUserId = null,
  recipientUserId = application.candidateUserId,
  session,
} = {}) => {
  if (
    recipientUserId == null ||
    (actorUserId != null &&
      recipientUserId.toString() === actorUserId.toString())
  ) {
    return null;
  }

  const jobTitle = job?.title ?? "this position";
  const contentByType = {
    [NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CREATED]: `A new interview schedule has been proposed for ${jobTitle}.`,
    [NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CHANGED]: `Your interview schedule for ${jobTitle} has changed.`,
    [NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CONFIRMED]: `The candidate confirmed the interview schedule for ${jobTitle}.`,
    [NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_DECLINED]: `The candidate declined the interview schedule for ${jobTitle}.`,
  };
  const content = contentByType[type];

  if (!content) {
    throw new Error("Unsupported Interview Schedule Notification type");
  }

  const { event } = await createNotificationEvent({
    eventKey: `${type.toLowerCase()}:${schedule._id.toString()}`,
    type,
    actorUserId,
    applicationId: application._id,
    interviewScheduleId: schedule._id,
    recipients: [{ recipientUserId, content }],
    session,
  });

  return event;
};

// A guarded expiration transition is a source mutation in V13. It must create
// its Schedule Changed obligation only after the guarded write wins, in the
// same session/transaction, so stale expiration scans cannot leave orphans.
const expireDueInterviewProposal = async ({
  interviewScheduleId,
  now,
  session,
} = {}) => {
  const schedule = await InterviewSchedule.findById(interviewScheduleId).session(session);
  if (!schedule) {
    return { modifiedCount: 0, notificationEvent: null };
  }

  const application = await Application.findById(schedule.applicationId).session(session);
  if (!application) {
    throw new Error("Interview Schedule references a missing Application");
  }
  const job = await Job.findById(application.jobId).select("title").session(session);

  const cancelledSchedule = await InterviewSchedule.findOneAndUpdate(
    {
      _id: schedule._id,
      status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
      expiresAt: { $lte: now },
    },
    { $set: { status: INTERVIEW_SCHEDULE_STATUS.CANCELLED } },
    { returnDocument: "after", runValidators: true, session },
  );
  if (!cancelledSchedule) {
    return { modifiedCount: 0, notificationEvent: null };
  }

  const notificationEvent = await createInterviewScheduleNotificationEvent({
    application,
    job,
    schedule: cancelledSchedule,
    type: NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CHANGED,
    session,
  });

  return { modifiedCount: 1, notificationEvent };
};

// V11 F03/F04/F05/F06 SYSTEM Message consequence when Conversation already
// exists. Does not create Conversation, rewrite history, or act as Assignment
// History / current-Assignee authority.
const createSystemMessageIfConversationExists = async ({
  applicationId,
  content,
  session,
} = {}) => {
  const conversation = await Conversation.findOne({
    applicationId,
  }).session(session);

  if (!conversation) {
    return null;
  }

  const [systemMessage] = await Message.create(
    [
      {
        conversationId: conversation._id,
        type: MESSAGE_TYPE.SYSTEM,
        senderUserId: null,
        senderCompanyMemberId: null,
        content,
      },
    ],
    { session },
  );

  // V13 Slice 04 / F07 / TX-01: a SYSTEM Message is a normal persisted
  // Message for CHAT_MESSAGE_CREATED. Resolve participants only from the
  // post-transition Application state held by this transaction, never from an
  // outgoing Assignee or caller input.
  const application = await Application.findById(applicationId).session(session);
  const recipients = [
    {
      recipientUserId: application.candidateUserId,
      content: "There is a new update in your application conversation.",
    },
  ];

  if (application.assignedRecruiterCompanyMemberId != null) {
    const currentAssignee = await CompanyMember.findById(
      application.assignedRecruiterCompanyMemberId,
    ).session(session);

    if (currentAssignee) {
      recipients.push({
        recipientUserId: currentAssignee.userId,
        content: "There is a new update in your application conversation.",
      });
    }
  }

  const notificationEvent = await createChatMessageNotificationEvent({
    applicationId: application._id,
    message: systemMessage,
    recipients,
    session,
  });

  const recipientUserIds = recipients.map(
    ({ recipientUserId }) => recipientUserId,
  );

  return { message: systemMessage, notificationEvent, recipientUserIds };
};

const toPublicConversationMessage = (message) => {
  return {
    id: message._id.toString(),
    type: message.type,
    senderUserId: message.senderUserId ? message.senderUserId.toString() : null,
    senderCompanyMemberId: message.senderCompanyMemberId
      ? message.senderCompanyMemberId.toString()
      : null,
    content: message.content,
    createdAt: message.createdAt,
  };
};

const toPublicConversationHistory = ({
  conversation,
  messages,
  authority,
} = {}) => {
  return {
    conversation: {
      id: conversation._id.toString(),
      applicationId: conversation.applicationId.toString(),
      createdAt: conversation.createdAt,
      mode: authority.mode,
    },
    messages: messages.map(toPublicConversationMessage),
    authority: {
      canRead: authority.canRead,
      canSendNormal: authority.canSendNormal,
    },
  };
};

// Soft continuous-eligibility facts for Chat authority (BR-08). Does not throw;
// Callers must not treat stored Assignee alone as authorization.
const buildCurrentAssigneeChatFacts = async ({
  application,
  job,
  company,
} = {}) => {
  if (isApplicationUnassigned(application)) {
    return {
      currentAssignee: null,
      isUnassigned: true,
    };
  }

  const assigneeCompanyMemberId = application.assignedRecruiterCompanyMemberId;
  const membership = await CompanyMember.findById(assigneeCompanyMemberId);

  if (!membership) {
    return {
      currentAssignee: {
        companyMemberId: assigneeCompanyMemberId.toString(),
        userId: null,
        membershipStatus: null,
        userStatus: null,
        isContinuouslyEligible: false,
      },
      isUnassigned: false,
    };
  }

  const user = await User.findById(membership.userId).select("status");
  const membershipIdStr = membership._id.toString();
  const isPrimary =
    job.primaryRecruiterCompanyMemberId.toString() === membershipIdStr;
  const isSupporting = (job.supportingRecruiterCompanyMemberIds ?? []).some(
    (id) => id.toString() === membershipIdStr,
  );
  const sameCompany =
    membership.companyId.toString() === job.companyId.toString();
  const companyIsOperational = isOwningCompanyActiveForPublicEligibility(company);
  const isContinuouslyEligible =
    membership.role === COMPANY_MEMBER_ROLE.RECRUITER &&
    membership.status === COMPANY_MEMBER_STATUS.ACTIVE &&
    user?.status === USER_STATUS.ACTIVE &&
    sameCompany &&
    (isPrimary || isSupporting) &&
    companyIsOperational;

  return {
    currentAssignee: {
      companyMemberId: membershipIdStr,
      userId: membership.userId.toString(),
      membershipStatus: membership.status,
      userStatus: user?.status ?? null,
      isContinuouslyEligible,
    },
    isUnassigned: false,
  };
};

const loadApplicationConversationHistoryContext = async ({
  applicationId,
} = {}) => {
  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const application = await Application.findById(applicationId);

  if (
    !application ||
    !isLifecycleCompatibleApplicationSource(application.source)
  ) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const conversation = await Conversation.findOne({
    applicationId: application._id,
  });

  if (!conversation) {
    throw new AppError(404, "Conversation not found", {
      field: "applicationId",
    });
  }

  const job = await Job.findById(application.jobId);

  if (!job) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const company = await Company.findById(job.companyId).select(
    "approvalStatus operationalStatus",
  );

  const companyIsOperational =
    isOwningCompanyActiveForPublicEligibility(company);
  const { currentAssignee, isUnassigned } = await buildCurrentAssigneeChatFacts({
    application,
    job,
    company,
  });

  return {
    application,
    conversation,
    job,
    company,
    companyIsOperational,
    currentAssignee,
    isUnassigned,
  };
};

const readAuthorizedConversationHistory = async ({
  context,
  actor,
} = {}) => {
  const authority = evaluateApplicationConversationChatAuthority({
    conversationExists: true,
    applicationStatus: context.application.status,
    isUnassigned: context.isUnassigned,
    companyIsOperational: context.companyIsOperational,
    currentAssignee: context.currentAssignee,
    actor,
  });

  if (!authority.canRead) {
    throw new AppError(403, "Conversation access is not allowed", {
      field: "conversationId",
      mode: authority.mode,
    });
  }

  const messages = await Message.find({
    conversationId: context.conversation._id,
  }).sort({ createdAt: 1, _id: 1 });

  return toPublicConversationHistory({
    conversation: context.conversation,
    messages,
    authority,
  });
};

// V11 Slice 05 / F02 / F04 / F05 / F07 / F08 / F09: Candidate Conversation
// history read. Authorization derives from Application ownership + current
// lifecycle state; Message history never grants authority (BR-07 / BR-48).
const getCandidateApplicationConversation = async ({
  candidateUserId,
  actorUser,
  applicationId,
} = {}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(
      403,
      "Candidates may only access their own Applications",
    );
  }

  const context = await loadApplicationConversationHistoryContext({
    applicationId,
  });

  // BR-07 / BR-41: foreign Applications are not readable as Conversation.
  if (context.application.candidateUserId.toString() !== candidateUserId.toString()) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  return readAuthorizedConversationHistory({
    context,
    actor: {
      kind: "CANDIDATE",
      userId: candidateUserId.toString(),
    },
  });
};

// V11 Slice 05: Recruiter Conversation history read for current/persisted/
// final Assignee. Uses Chat-history context so Company lock does not block
// FROZEN_COMPANY / terminal historical read (BR-33 / BR-37). Primary,
// Supporting, Company Manager, Former Assignee, and cross-tenant actors do
// not gain authority from Job membership or Message history (BR-09–BR-12,
// BR-17, BR-48).
const getRecruiterApplicationConversation = async ({
  actorUser,
  applicationId,
  clientCompanyId,
} = {}) => {
  const recruiterContext = await resolveRecruiterChatHistoryContext({
    user: actorUser,
    clientCompanyId,
  });

  const context = await loadApplicationConversationHistoryContext({
    applicationId,
  });

  assertSameCompanyTenant({
    resourceCompanyId: context.job.companyId,
    tenantCompanyId: recruiterContext.companyId,
  });

  return readAuthorizedConversationHistory({
    context,
    actor: {
      kind: "RECRUITER",
      userId: actorUser._id.toString(),
      companyMemberId: recruiterContext.membership._id.toString(),
      membershipStatus: recruiterContext.membership.status,
      userStatus: actorUser.status,
    },
  });
};

const normalizeNormalMessageContent = (content) => {
  if (typeof content !== "string") {
    throw new AppError(400, "content must be a non-empty string", {
      field: "content",
    });
  }

  const normalized = content.trim();

  if (normalized === "") {
    throw new AppError(400, "content must be a non-empty string", {
      field: "content",
    });
  }

  return normalized;
};

// TX-06: write-lock current writable Assigned Application without bumping
// version or mutating business content. Concurrent assignment / terminal CAS
// writers either lose on version/assignee/status predicate or WriteConflict.
const commitApplicationWritableStateForNormalMessageSend = async ({
  applicationId,
  jobId,
  expectedVersion,
  expectedAssigneeCompanyMemberId,
  session,
} = {}) => {
  return acquireWithRestoredUpdatedAt({
    model: Application,
    documentId: applicationId,
    session,
    acquire: () =>
      Application.findOneAndUpdate(
        {
          _id: applicationId,
          jobId,
          source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
          version: expectedVersion,
          assignedRecruiterCompanyMemberId: expectedAssigneeCompanyMemberId,
          status: { $in: [...APPLICATION_NON_TERMINAL_STATUSES] },
        },
        {
          $set: {
            assignedRecruiterCompanyMemberId: expectedAssigneeCompanyMemberId,
          },
        },
        {
          returnDocument: "after",
          session,
        },
      ),
  });
};

// Soft continuous-eligibility probe at Send commit (TX-06 / BR-14 / BR-43 /
// BR-55). Reuses V10 lock order Company → CompanyMember → User → Job team.
// Returns facts for evaluateApplicationConversationChatAuthority; does not
// throw on expected eligibility loss.
const resolveAssigneeEligibilityFactsAtSendCommit = async ({
  application,
  job,
  session,
} = {}) => {
  if (isApplicationUnassigned(application)) {
    return {
      companyIsOperational: false,
      currentAssignee: null,
      isUnassigned: true,
    };
  }

  const assigneeCompanyMemberId = application.assignedRecruiterCompanyMemberId;

  const stillOperationalCompany = await acquireWithRestoredUpdatedAt({
    model: Company,
    documentId: job.companyId,
    session,
    acquire: () =>
      acquireOperationalCompanyForAssigneeEligibilityTx({
        companyId: job.companyId,
        session,
      }),
  });

  if (!stillOperationalCompany) {
    const membership = await CompanyMember.findById(
      assigneeCompanyMemberId,
    ).session(session);
    const user = membership
      ? await User.findById(membership.userId).select("status").session(session)
      : null;

    return {
      companyIsOperational: false,
      currentAssignee: {
        companyMemberId: assigneeCompanyMemberId.toString(),
        userId: membership ? membership.userId.toString() : null,
        membershipStatus: membership?.status ?? null,
        userStatus: user?.status ?? null,
        isContinuouslyEligible: false,
      },
      isUnassigned: false,
    };
  }

  const stillActiveMembership = await acquireWithRestoredUpdatedAt({
    model: CompanyMember,
    documentId: assigneeCompanyMemberId,
    session,
    acquire: () =>
      acquireActiveRecruiterMembershipForTeamResponsibilityTx({
        recruiterCompanyMemberId: assigneeCompanyMemberId,
        companyId: job.companyId,
        session,
      }),
  });

  if (!stillActiveMembership) {
    const membership = await CompanyMember.findById(
      assigneeCompanyMemberId,
    ).session(session);
    const user = membership
      ? await User.findById(membership.userId).select("status").session(session)
      : null;

    return {
      companyIsOperational: true,
      currentAssignee: {
        companyMemberId: assigneeCompanyMemberId.toString(),
        userId: membership ? membership.userId.toString() : null,
        membershipStatus: membership?.status ?? COMPANY_MEMBER_STATUS.LOCKED,
        userStatus: user?.status ?? null,
        isContinuouslyEligible: false,
      },
      isUnassigned: false,
    };
  }

  const stillActiveUser = await acquireWithRestoredUpdatedAt({
    model: User,
    documentId: stillActiveMembership.userId,
    session,
    acquire: () =>
      acquireActiveUserForAssigneeEligibilityTx({
        userId: stillActiveMembership.userId,
        session,
      }),
  });

  if (!stillActiveUser) {
    return {
      companyIsOperational: true,
      currentAssignee: {
        companyMemberId: stillActiveMembership._id.toString(),
        userId: stillActiveMembership.userId.toString(),
        membershipStatus: stillActiveMembership.status,
        userStatus: USER_STATUS.LOCKED,
        isContinuouslyEligible: false,
      },
      isUnassigned: false,
    };
  }

  const stillOnTeam = await acquireWithRestoredUpdatedAt({
    model: Job,
    documentId: job._id,
    session,
    acquire: () =>
      acquireJobTeamMembershipForAssigneeEligibilityTx({
        jobId: job._id,
        companyId: job.companyId,
        assigneeCompanyMemberId: stillActiveMembership._id,
        session,
      }),
  });

  const membershipIdStr = stillActiveMembership._id.toString();
  const isPrimary =
    job.primaryRecruiterCompanyMemberId.toString() === membershipIdStr;
  const isSupporting = (job.supportingRecruiterCompanyMemberIds ?? []).some(
    (id) => id.toString() === membershipIdStr,
  );
  const sameCompany =
    stillActiveMembership.companyId.toString() === job.companyId.toString();
  const isContinuouslyEligible =
    stillOnTeam != null &&
    stillActiveMembership.role === COMPANY_MEMBER_ROLE.RECRUITER &&
    stillActiveMembership.status === COMPANY_MEMBER_STATUS.ACTIVE &&
    stillActiveUser.status === USER_STATUS.ACTIVE &&
    sameCompany &&
    (isPrimary || isSupporting);

  return {
    companyIsOperational: true,
    currentAssignee: {
      companyMemberId: membershipIdStr,
      userId: stillActiveMembership.userId.toString(),
      membershipStatus: stillActiveMembership.status,
      userStatus: stillActiveUser.status,
      isContinuouslyEligible,
    },
    isUnassigned: false,
  };
};

// V11 Slice 06 / F02 / F10 / TX-06–TX-08: persist NORMAL Message only when
// commit-time Chat authority remains ACTIVE. Does not mutate Conversation
// ownership, Recruitment Status, Assignment State, Candidate, Job, source, or
// submittedCvSnapshot (BR-49 / BR-50). Sender identity is server-owned (BR-13).
const commitNormalMessageSend = async ({
  applicationId,
  actor,
  content,
  assertActorAccess,
} = {}) => {
  const normalizedContent = normalizeNormalMessageContent(content);
  const session = await mongoose.startSession();
  let createdMessage = null;
  let notificationEvent = null;
  let authority = null;
  let conversation = null;
  let chatMessageRecipientUserIds = null;

  try {
    await session.withTransaction(async () => {
      if (!mongoose.isValidObjectId(applicationId)) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      let application = await Application.findById(applicationId).session(
        session,
      );

      if (
        !application ||
        !isLifecycleCompatibleApplicationSource(application.source)
      ) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      conversation = await Conversation.findOne({
        applicationId: application._id,
      }).session(session);

      if (!conversation) {
        throw new AppError(404, "Conversation not found", {
          field: "applicationId",
        });
      }

      // TX-06 / F10 / BR-46: committed Application state at Send completion must
      // drive authority evaluation after Conversation acquisition. Read outside
      // the Send transaction so concurrent Assign lại / Unassign outcomes are visible.
      application = await Application.findById(applicationId);

      if (
        !application ||
        !isLifecycleCompatibleApplicationSource(application.source)
      ) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      const job = await Job.findById(application.jobId).session(session);

      if (!job) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      await assertActorAccess({ application, job, session });

      const eligibility = await resolveAssigneeEligibilityFactsAtSendCommit({
        application,
        job,
        session,
      });

      authority = evaluateApplicationConversationChatAuthority({
        conversationExists: true,
        applicationStatus: application.status,
        isUnassigned: eligibility.isUnassigned,
        companyIsOperational: eligibility.companyIsOperational,
        currentAssignee: eligibility.currentAssignee,
        actor,
      });

      if (!authority.canSendNormal) {
        throw new AppError(403, "NORMAL Message send is not allowed", {
          field: "conversationId",
          mode: authority.mode,
        });
      }

      const lockedApplication =
        await commitApplicationWritableStateForNormalMessageSend({
          applicationId: application._id,
          jobId: job._id,
          expectedVersion: application.version,
          expectedAssigneeCompanyMemberId:
            application.assignedRecruiterCompanyMemberId,
          session,
        });

      if (!lockedApplication) {
        throw new AppError(
          409,
          "Application conversation is no longer writable; refresh and retry",
          {
            field: "applicationId",
          },
        );
      }

      const senderUserId = actor.userId;
      const senderCompanyMemberId =
        actor.kind === "RECRUITER" ? actor.companyMemberId : null;

      const [message] = await Message.create(
        [
          {
            conversationId: conversation._id,
            type: MESSAGE_TYPE.NORMAL,
            senderUserId,
            senderCompanyMemberId,
            content: normalizedContent,
          },
        ],
        { session },
      );

      createdMessage = message;

      const recipients =
        actor.kind === "CANDIDATE"
          ? [
              {
                recipientUserId: eligibility.currentAssignee.userId,
                content: "The candidate sent you a new message.",
              },
            ]
          : [
              {
                recipientUserId: application.candidateUserId,
                content: "Your recruiter sent you a new message.",
              },
            ];

      notificationEvent = await createChatMessageNotificationEvent({
        applicationId: application._id,
        message,
        actorUserId: senderUserId,
        recipients,
        session,
      });

      chatMessageRecipientUserIds =
        actor.kind === "CANDIDATE"
          ? [eligibility.currentAssignee.userId]
          : [application.candidateUserId];
    });
  } finally {
    await session.endSession();
  }

  if (createdMessage) {
    emitCommittedChatMessageRealtimeBestEffort({
      message: createdMessage,
      recipientUserIds: chatMessageRecipientUserIds,
      applicationId: conversation.applicationId,
    });
  }

  if (notificationEvent) {
    try {
      await materializeNotificationEvent({ eventId: notificationEvent._id });
    } catch {
      // The committed Message and durable event obligation remain available for
      // canonical Notification recovery.
    }
  }

  return {
    message: toPublicConversationMessage(createdMessage),
    conversation: {
      id: conversation._id.toString(),
      applicationId: conversation.applicationId.toString(),
      createdAt: conversation.createdAt,
      mode: authority.mode,
    },
    authority: {
      canRead: authority.canRead,
      canSendNormal: authority.canSendNormal,
    },
  };
};

// V11 Slice 06: Candidate owner NORMAL Message send (F02 / BR-07 / BR-13–BR-14).
const sendCandidateApplicationConversationNormalMessage = async ({
  candidateUserId,
  actorUser,
  applicationId,
  content,
} = {}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(
      403,
      "Candidates may only access their own Applications",
    );
  }

  return commitNormalMessageSend({
    applicationId,
    content,
    actor: {
      kind: "CANDIDATE",
      userId: candidateUserId.toString(),
    },
    assertActorAccess: async ({ application }) => {
      if (
        application.candidateUserId.toString() !== candidateUserId.toString()
      ) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }
    },
  });
};

// V11 Slice 06: current Assigned Recruiter NORMAL Message send (F02 / BR-08 /
// BR-13–BR-14). Uses operational Recruiter business context so Company lock
// cannot pass the HTTP gate; TX-08 still re-acquires Company at commit.
const sendRecruiterApplicationConversationNormalMessage = async ({
  actorUser,
  applicationId,
  content,
  clientCompanyId,
} = {}) => {
  const recruiterContext = await resolveRecruiterBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  return commitNormalMessageSend({
    applicationId,
    content,
    actor: {
      kind: "RECRUITER",
      userId: actorUser._id.toString(),
      companyMemberId: recruiterContext.membership._id.toString(),
      membershipStatus: recruiterContext.membership.status,
      userStatus: actorUser.status,
    },
    assertActorAccess: async ({ job }) => {
      assertSameCompanyTenant({
        resourceCompanyId: job.companyId,
        tenantCompanyId: recruiterContext.companyId,
      });
    },
  });
};

// Canonical assigned-state mutation (Data Contract §8.2–§8.4 / TX-01 / TX-03):
// atomic A → B or A → NONE. Shared by manual Reassign/Unassign, CM force-reassign
// A → B, and automatic Unassign. Mutates only current Assignee + version;
// never an A → NONE → B intermediate. Target NONE is a committed Unassigned
// state.
const commitAssignedAssigneeMutation = async ({
  applicationId,
  jobId,
  expectedAssigneeCompanyMemberId,
  expectedVersion,
  nextAssignedRecruiterCompanyMemberId,
  session,
} = {}) => {
  return Application.findOneAndUpdate(
    {
      _id: applicationId,
      jobId,
      source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
      version: expectedVersion,
      assignedRecruiterCompanyMemberId: expectedAssigneeCompanyMemberId,
      status: { $in: [...APPLICATION_NON_TERMINAL_STATUSES] },
    },
    {
      $set: {
        assignedRecruiterCompanyMemberId: nextAssignedRecruiterCompanyMemberId,
      },
      $inc: {
        version: 1,
      },
    },
    {
      returnDocument: "after",
      session,
    },
  );
};

const firstAssignApplication = async ({
  actorUser,
  jobId,
  applicationId,
  assigneeCompanyMemberId,
  expectedVersion,
  clientCompanyId,
} = {}) => {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  if (
    typeof expectedVersion !== "number" ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 0
  ) {
    throw new AppError(400, "expectedVersion must be a non-negative integer", {
      field: "expectedVersion",
    });
  }

  const context = await resolveCompanyStaffBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  const session = await mongoose.startSession();
  let assignedApplication = null;
  let job = null;
  let assigneeContext = null;
  const notificationEvents = [];
  const committedChatMessages = [];
  const committedConversationStateEvents = [];

  try {
    await session.withTransaction(async () => {
      job = await Job.findById(jobId).session(session);

      if (!job) {
        throw new AppError(404, "Job not found", {
          field: "jobId",
        });
      }

      assertSameCompanyTenant({
        resourceCompanyId: job.companyId,
        tenantCompanyId: context.companyId,
      });

      // BR-06 / BR-15 / BR-53: current Primary or owning-Company Manager.
      assertAssignmentManagementAuthority({
        context,
        job,
        actionLabel: "Assign",
      });

      const application = await Application.findById(applicationId).session(
        session,
      );

      if (!application) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      if (application.jobId.toString() !== job._id.toString()) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      if (!isLifecycleCompatibleApplicationSource(application.source)) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      // BR-17: terminal Applications cannot change Assignee.
      if (isApplicationTerminalStatus(application.status)) {
        throw new AppError(409, "Terminal Applications cannot be assigned", {
          field: "status",
          status: application.status,
        });
      }

      if (!APPLICATION_NON_TERMINAL_STATUSES.includes(application.status)) {
        throw new AppError(409, "Terminal Applications cannot be assigned", {
          field: "status",
          status: application.status,
        });
      }

      if (!isApplicationUnassigned(application)) {
        throw new AppError(409, "Application already has an Assignee", {
          field: "assignedRecruiterCompanyMemberId",
        });
      }

      // TX-02 actor business access first: Company → actor Membership → actor
      // User. Must precede target eligibility / Job acquires (no Job→Membership
      // inversion). Does not use stale pre-tx membership/user snapshots.
      await assertAssignmentManagementActorBusinessAccessAtCommit({
        context,
        job,
        session,
      });

      // TX-02: re-validate target eligibility and serialize against lifecycle
      // completion inside the commit transaction.
      assigneeContext = await assertAssigneeEligibleAtAssignmentCommit({
        assigneeCompanyMemberId,
        job,
        session,
      });

      // Primary relation after target Membership/User so Job is last before CAS.
      await assertAssignmentManagementPrimaryRelationAtCommit({
        context,
        job,
        session,
        actionLabel: "Assign",
      });

      // TX-01 / BR-36 / BR-37: atomic Unassigned + version CAS; no intermediate
      // state. Status is constrained to current non-terminal values so a
      // concurrent Withdraw/terminal write cannot be overwritten. MongoDB null
      // equality matches both explicit null and missing assignee fields.
      assignedApplication = await commitAssignFromUnassigned({
        applicationId: application._id,
        jobId: job._id,
        assigneeCompanyMemberId: assigneeContext.membership._id,
        expectedVersion,
        session,
      });

      if (!assignedApplication) {
        await rejectFailedFirstAssignCas({
          applicationId: application._id,
          expectedVersion,
          session,
        });
      }

      const assignmentNotificationEvent =
        await createAssignmentNotificationEvent({
          application: assignedApplication,
          job,
          type: NOTIFICATION_TYPE.APPLICATION_ASSIGNED,
          actorUserId: actorUser._id,
          newAssigneeUserId: assigneeContext.user._id,
          session,
        });
      if (assignmentNotificationEvent) {
        notificationEvents.push(assignmentNotificationEvent);
      }

      // V11 F01 / F06 / BR-05 / BR-06 / BR-29 / BR-30 / TX-01 / TX-05:
      // First Assign (no Conversation) creates Conversation with no SYSTEM
      // Message. Assign again (Conversation already exists) keeps that
      // Conversation and writes the required new-assignee SYSTEM Message.
      // V13 Slice 04 routes Assign-again SYSTEM Message through the shared
      // Message persistence primitive so CHAT_MESSAGE_CREATED is obligated
      // in the same TX-01 boundary.
      const conversationOutcome = await createConversationOnFirstAssignIfAbsent({
        applicationId: assignedApplication._id,
        session,
      });

      if (!conversationOutcome.created) {
        const systemMessageResult = await createSystemMessageIfConversationExists({
          applicationId: assignedApplication._id,
          content: SYSTEM_MESSAGE_CONTENT.NEW_ASSIGNEE,
          session,
        });
        if (systemMessageResult?.notificationEvent) {
          notificationEvents.push(systemMessageResult.notificationEvent);
        }
        if (systemMessageResult?.message) {
          committedChatMessages.push({
            message: systemMessageResult.message,
            recipientUserIds: systemMessageResult.recipientUserIds,
            applicationId: assignedApplication._id,
          });
        }

        committedConversationStateEvents.push({
          application: assignedApplication,
          mode: CONVERSATION_REALTIME_MODE.WRITABLE,
        });
      }
    });
  } finally {
    await session.endSession();
  }

  for (const notificationEvent of notificationEvents) {
    try {
      await materializeNotificationEvent({ eventId: notificationEvent._id });
    } catch {
      // The committed Assignment/Message result and durable obligation remain
      // recoverable by the canonical Notification worker.
    }
  }

  for (const committedChatMessage of committedChatMessages) {
    emitCommittedChatMessageRealtimeBestEffort(committedChatMessage);
  }

  for (const committedConversationStateEvent of committedConversationStateEvents) {
    await emitCommittedConversationStateRealtimeBestEffort(
      committedConversationStateEvent,
    );
  }

  const applicationView = await buildPrimaryApplicationViewFromDocs({
    application: assignedApplication,
    assigneeMembership: assigneeContext.membership,
    assigneeUser: assigneeContext.user,
  });

  return {
    job: toPublicJob(job),
    application: applicationView,
  };
};

const rejectFailedAssignedAssigneeCas = async ({
  applicationId,
  expectedVersion,
  expectedAssigneeCompanyMemberId,
  session,
  actionLabel = "Reassign",
} = {}) => {
  let latestQuery = Application.findById(applicationId);
  if (session) {
    latestQuery = latestQuery.session(session);
  }

  const latestApplication = await latestQuery;

  if (!latestApplication) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const isUnassign =
    actionLabel === "Unassign" || actionLabel === "Automatic Unassign";

  if (isApplicationTerminalStatus(latestApplication.status)) {
    throw new AppError(
      409,
      isUnassign
        ? "Terminal Applications cannot be unassigned"
        : "Terminal Applications cannot be reassigned",
      {
        field: "status",
        status: latestApplication.status,
      },
    );
  }

  if (isApplicationUnassigned(latestApplication)) {
    throw new AppError(
      409,
      isUnassign
        ? "Application has no Assignee to unassign"
        : "Application has no Assignee to reassign",
      { field: "assignedRecruiterCompanyMemberId" },
    );
  }

  if (
    latestApplication.assignedRecruiterCompanyMemberId.toString() !==
    expectedAssigneeCompanyMemberId.toString()
  ) {
    throw new AppError(
      409,
      `Application Assignee has changed; refresh and retry ${actionLabel}`,
      { field: "expectedAssigneeCompanyMemberId" },
    );
  }

  if (latestApplication.version !== expectedVersion) {
    throw new AppError(
      409,
      `Application has changed; refresh and retry ${actionLabel}`,
      { field: "expectedVersion" },
    );
  }

  throw new AppError(
    409,
    `Application has changed; refresh and retry ${actionLabel}`,
    { field: "expectedVersion" },
  );
};

// F03 / F04 / F09 / F10 — current-assignee mutation foundation shared by
// Primary and owning-Company Manager. nextAssigneeCompanyMemberId = Recruiter
// → A → B (Reassign / Take over); nextAssigneeCompanyMemberId = null →
// A → NONE (Unassign). Target NONE skips TX-02 eligibility. Take over is
// Reassign onto the current Primary.
const executePrimaryCurrentAssigneeMutation = async ({
  actorUser,
  actorContext,
  jobId,
  applicationId,
  nextAssigneeCompanyMemberId,
  expectedAssigneeCompanyMemberId,
  expectedVersion,
  clientCompanyId,
  actionLabel,
} = {}) => {
  const isUnassign = nextAssigneeCompanyMemberId == null;

  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  if (!mongoose.isValidObjectId(expectedAssigneeCompanyMemberId)) {
    throw new AppError(400, "Invalid expected Assignee CompanyMember id", {
      field: "expectedAssigneeCompanyMemberId",
    });
  }

  if (
    typeof expectedVersion !== "number" ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 0
  ) {
    throw new AppError(400, "expectedVersion must be a non-negative integer", {
      field: "expectedVersion",
    });
  }

  if (
    !isUnassign &&
    nextAssigneeCompanyMemberId.toString() ===
      expectedAssigneeCompanyMemberId.toString()
  ) {
    throw new AppError(
      409,
      "Reassign target must differ from the current Assignee",
      { field: "assigneeCompanyMemberId" },
    );
  }

  const context =
    actorContext ??
    (await resolveCompanyStaffBusinessContext({
      user: actorUser,
      clientCompanyId,
    }));

  const session = await mongoose.startSession();
  let mutatedApplication = null;
  let job = null;
  let assigneeContext = null;
  const notificationEvents = [];
  const committedChatMessages = [];
  const committedConversationStateEvents = [];

  try {
    await session.withTransaction(async () => {
      job = await Job.findById(jobId).session(session);

      if (!job) {
        throw new AppError(404, "Job not found", {
          field: "jobId",
        });
      }

      assertSameCompanyTenant({
        resourceCompanyId: job.companyId,
        tenantCompanyId: context.companyId,
      });

      // BR-12 / BR-15 / BR-42 / BR-53: current Primary or owning-Company
      // Manager. Supporting has no assignment-management authority.
      assertAssignmentManagementAuthority({
        context,
        job,
        actionLabel,
      });

      const application = await Application.findById(applicationId).session(
        session,
      );

      if (!application) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      if (application.jobId.toString() !== job._id.toString()) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      if (!isLifecycleCompatibleApplicationSource(application.source)) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      // BR-17: terminal Applications cannot change Assignee.
      if (
        isApplicationTerminalStatus(application.status) ||
        !APPLICATION_NON_TERMINAL_STATUSES.includes(application.status)
      ) {
        throw new AppError(
          409,
          isUnassign
            ? "Terminal Applications cannot be unassigned"
            : "Terminal Applications cannot be reassigned",
          {
            field: "status",
            status: application.status,
          },
        );
      }

      // BR-10 / F03: Reassign and Unassign both require a current Assignee.
      if (isApplicationUnassigned(application)) {
        throw new AppError(
          409,
          isUnassign
            ? "Application has no Assignee to unassign"
            : "Application has no Assignee to reassign",
          { field: "assignedRecruiterCompanyMemberId" },
        );
      }

      if (
        application.assignedRecruiterCompanyMemberId.toString() !==
        expectedAssigneeCompanyMemberId.toString()
      ) {
        throw new AppError(
          409,
          `Application Assignee has changed; refresh and retry ${actionLabel}`,
          { field: "expectedAssigneeCompanyMemberId" },
        );
      }

      if (
        !isUnassign &&
        nextAssigneeCompanyMemberId.toString() ===
          expectedAssigneeCompanyMemberId.toString()
      ) {
        throw new AppError(
          409,
          "Reassign target must differ from the current Assignee",
          { field: "assigneeCompanyMemberId" },
        );
      }

      if (application.version !== expectedVersion) {
        throw new AppError(
          409,
          `Application has changed; refresh and retry ${actionLabel}`,
          { field: "expectedVersion" },
        );
      }

      let nextAssignedRecruiterCompanyMemberId = null;
      const outgoingAssignee = await CompanyMember.findById(
        application.assignedRecruiterCompanyMemberId,
      ).session(session);

      // TX-02 actor business access first: Company → actor Membership → actor
      // User. Target NONE still requires this; automatic Unassign does not.
      await assertAssignmentManagementActorBusinessAccessAtCommit({
        context,
        job,
        session,
      });

      if (!isUnassign) {
        // TX-02: reuse Slice 02 eligibility + lifecycle serialization when the
        // target is a Recruiter. Unassign (A → NONE) has no target to revalidate.
        assigneeContext = await assertAssigneeEligibleAtAssignmentCommit({
          assigneeCompanyMemberId: nextAssigneeCompanyMemberId,
          job,
          session,
        });
        nextAssignedRecruiterCompanyMemberId = assigneeContext.membership._id;
      }

      // Primary relation after any target Membership/User acquires.
      await assertAssignmentManagementPrimaryRelationAtCommit({
        context,
        job,
        session,
        actionLabel,
      });

      // TX-01 / TX-03 / BR-10 / BR-14 / BR-36–BR-38:
      // Atomic A → B or A → NONE; no A → NONE → B intermediate for Reassign.
      // Non-terminal status CAS preserves a prior valid pipeline write on retry
      // and blocks overwrite of HIRED/REJECTED/WITHDRAWN.
      mutatedApplication = await commitAssignedAssigneeMutation({
        applicationId: application._id,
        jobId: job._id,
        expectedAssigneeCompanyMemberId,
        expectedVersion,
        nextAssignedRecruiterCompanyMemberId,
        session,
      });

      if (!mutatedApplication) {
        await rejectFailedAssignedAssigneeCas({
          applicationId: application._id,
          expectedVersion,
          expectedAssigneeCompanyMemberId,
          session,
          actionLabel,
        });
      }

      const assignmentNotificationEvent =
        await createAssignmentNotificationEvent({
          application: mutatedApplication,
          job,
          type: isUnassign
            ? NOTIFICATION_TYPE.APPLICATION_UNASSIGNED
            : NOTIFICATION_TYPE.APPLICATION_REASSIGNED,
          actorUserId: actorUser._id,
          outgoingAssigneeUserId: outgoingAssignee?.userId ?? null,
          newAssigneeUserId: assigneeContext?.user._id ?? null,
          session,
        });
      if (assignmentNotificationEvent) {
        notificationEvents.push(assignmentNotificationEvent);
      }

      // V11 F03 / F04 / BR-15–BR-23 / BR-47 / BR-51 / TX-02 / TX-03:
      // A → B or A → NONE keeps the existing Conversation and writes the
      // required SYSTEM Message in the same atomic outcome when Conversation
      // already exists. Automatic Unassign Chat consequence is owned by
      // automaticallyUnassignApplication (F05 / TX-04).
      if (isUnassign) {
        const systemMessageResult = await createSystemMessageIfConversationExists({
          applicationId: mutatedApplication._id,
          content: SYSTEM_MESSAGE_CONTENT.AWAITING_NEW_ASSIGNEE,
          session,
        });
        if (systemMessageResult?.notificationEvent) {
          notificationEvents.push(systemMessageResult.notificationEvent);
        }
        if (systemMessageResult?.message) {
          committedChatMessages.push({
            message: systemMessageResult.message,
            recipientUserIds: systemMessageResult.recipientUserIds,
            applicationId: mutatedApplication._id,
          });
        }

        committedConversationStateEvents.push({
          application: mutatedApplication,
          mode: CONVERSATION_REALTIME_MODE.PAUSED_UNASSIGNED,
        });
      } else {
        const systemMessageResult = await createSystemMessageIfConversationExists({
          applicationId: mutatedApplication._id,
          content: SYSTEM_MESSAGE_CONTENT.RESPONSIBILITY_CHANGED,
          session,
        });
        if (systemMessageResult?.notificationEvent) {
          notificationEvents.push(systemMessageResult.notificationEvent);
        }
        if (systemMessageResult?.message) {
          committedChatMessages.push({
            message: systemMessageResult.message,
            recipientUserIds: systemMessageResult.recipientUserIds,
            applicationId: mutatedApplication._id,
          });
        }
      }
    });
  } finally {
    await session.endSession();
  }

  for (const notificationEvent of notificationEvents) {
    try {
      await materializeNotificationEvent({ eventId: notificationEvent._id });
    } catch {
      // The committed Assignment/System Message outcome remains recoverable.
    }
  }

  for (const committedChatMessage of committedChatMessages) {
    emitCommittedChatMessageRealtimeBestEffort(committedChatMessage);
  }

  for (const committedConversationStateEvent of committedConversationStateEvents) {
    await emitCommittedConversationStateRealtimeBestEffort(
      committedConversationStateEvent,
    );
  }

  const applicationView = await buildPrimaryApplicationViewFromDocs({
    application: mutatedApplication,
    assigneeMembership: assigneeContext?.membership ?? null,
    assigneeUser: assigneeContext?.user ?? null,
  });

  return {
    job: toPublicJob(job),
    application: applicationView,
  };
};

const reassignApplication = async ({
  actorUser,
  jobId,
  applicationId,
  assigneeCompanyMemberId,
  expectedAssigneeCompanyMemberId,
  expectedVersion,
  clientCompanyId,
} = {}) => {
  return executePrimaryCurrentAssigneeMutation({
    actorUser,
    jobId,
    applicationId,
    nextAssigneeCompanyMemberId: assigneeCompanyMemberId,
    expectedAssigneeCompanyMemberId,
    expectedVersion,
    clientCompanyId,
    actionLabel: "Reassign",
  });
};

const unassignApplication = async ({
  actorUser,
  jobId,
  applicationId,
  expectedAssigneeCompanyMemberId,
  expectedVersion,
  clientCompanyId,
} = {}) => {
  return executePrimaryCurrentAssigneeMutation({
    actorUser,
    jobId,
    applicationId,
    nextAssigneeCompanyMemberId: null,
    expectedAssigneeCompanyMemberId,
    expectedVersion,
    clientCompanyId,
    actionLabel: "Unassign",
  });
};

// F04 / F09 / F11 — canonical internal automatic Unassign (A → NONE).
// Trusted lifecycle/team workflow owner; not a public HTTP surface and not
// actor-authorized assignment management. Reuses commitAssignedAssigneeMutation
// so stale expected-assignee/version writes cannot clear a newer Assignee.
// No replacement, no synthetic A → B, no status/snapshot/identity/team mutation.
//
// V11 F05 / TX-04: when Conversation already exists, A → NONE and the required
// awaiting-assignee SYSTEM Message are one per-Application atomic outcome.
// Missing Conversation keeps V10 behavior (A → NONE only; no Conversation or
// Message created for V11). Lifecycle reasons are never written into content.
const automaticallyUnassignApplication = async ({
  applicationId,
  expectedAssigneeCompanyMemberId,
  expectedVersion,
  session,
} = {}) => {
  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  if (!mongoose.isValidObjectId(expectedAssigneeCompanyMemberId)) {
    throw new AppError(400, "Invalid expected Assignee CompanyMember id", {
      field: "expectedAssigneeCompanyMemberId",
    });
  }

  if (
    typeof expectedVersion !== "number" ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 0
  ) {
    throw new AppError(400, "expectedVersion must be a non-negative integer", {
      field: "expectedVersion",
    });
  }

  let notificationEvent = null;
  let committedChatMessage = null;

  const commitAutomaticUnassign = async (activeSession) => {
    let applicationQuery = Application.findById(applicationId);
    if (activeSession) {
      applicationQuery = applicationQuery.session(activeSession);
    }

    const application = await applicationQuery;

    if (!application) {
      throw new AppError(404, "Application not found", {
        field: "applicationId",
      });
    }

    if (!isLifecycleCompatibleApplicationSource(application.source)) {
      throw new AppError(404, "Application not found", {
        field: "applicationId",
      });
    }

    // BR-17 / BR-52: terminal Applications keep the final Assignee.
    if (
      isApplicationTerminalStatus(application.status) ||
      !APPLICATION_NON_TERMINAL_STATUSES.includes(application.status)
    ) {
      throw new AppError(409, "Terminal Applications cannot be unassigned", {
        field: "status",
        status: application.status,
      });
    }

    // BR-10 / BR-52: automatic Unassign requires a current Assignee.
    if (isApplicationUnassigned(application)) {
      throw new AppError(409, "Application has no Assignee to unassign", {
        field: "assignedRecruiterCompanyMemberId",
      });
    }

    if (
      application.assignedRecruiterCompanyMemberId.toString() !==
      expectedAssigneeCompanyMemberId.toString()
    ) {
      throw new AppError(
        409,
        "Application Assignee has changed; refresh and retry Automatic Unassign",
        { field: "expectedAssigneeCompanyMemberId" },
      );
    }

    if (application.version !== expectedVersion) {
      throw new AppError(
        409,
        "Application has changed; refresh and retry Automatic Unassign",
        { field: "expectedVersion" },
      );
    }

    // TX-01 / TX-03 / BR-10 / BR-11 / BR-31 / BR-36–BR-38:
    // Atomic A → NONE via the shared assigned-state CAS. No target eligibility
    // (NONE has no replacement). Non-terminal status CAS preserves a prior valid
    // pipeline/Replace write on retry and blocks overwrite of terminals.
    const unassignedApplication = await commitAssignedAssigneeMutation({
      applicationId: application._id,
      jobId: application.jobId,
      expectedAssigneeCompanyMemberId,
      expectedVersion,
      nextAssignedRecruiterCompanyMemberId: null,
      session: activeSession,
    });

    if (!unassignedApplication) {
      await rejectFailedAssignedAssigneeCas({
        applicationId: application._id,
        expectedVersion,
        expectedAssigneeCompanyMemberId,
        session: activeSession,
        actionLabel: "Automatic Unassign",
      });
    }

    const outgoingAssignee = await CompanyMember.findById(
      application.assignedRecruiterCompanyMemberId,
    ).session(activeSession);
    notificationEvent = await createAssignmentNotificationEvent({
      application: unassignedApplication,
      type: NOTIFICATION_TYPE.APPLICATION_UNASSIGNED,
      outgoingAssigneeUserId: outgoingAssignee?.userId ?? null,
      session: activeSession,
    });

    // V11 F05 / BR-23 / BR-27 / BR-28 / BR-47 / BR-51 / TX-04:
    // Same atomic outcome as Manual Unassign when Conversation exists. Content
    // only announces awaiting a new responsible recruiter — never LOCK /
    // TERMINATE / membership / team-removal reasons.
    const systemMessageResult = await createSystemMessageIfConversationExists({
      applicationId: unassignedApplication._id,
      content: SYSTEM_MESSAGE_CONTENT.AWAITING_NEW_ASSIGNEE,
      session: activeSession,
    });
    if (systemMessageResult?.message) {
      committedChatMessage = {
        message: systemMessageResult.message,
        recipientUserIds: systemMessageResult.recipientUserIds,
        applicationId: unassignedApplication._id,
      };
    }

    return unassignedApplication;
  };

  if (session) {
    return commitAutomaticUnassign(session);
  }

  // Per-Application transaction only (TX-04). Callers that detach many
  // Applications keep independent commits — no global all-or-nothing lifecycle
  // transaction beyond canonical V10 orchestration.
  const ownedSession = await mongoose.startSession();
  let unassignedApplication = null;

  try {
    await ownedSession.withTransaction(async () => {
      unassignedApplication = await commitAutomaticUnassign(ownedSession);
    });
  } finally {
    await ownedSession.endSession();
  }

  if (notificationEvent) {
    try {
      await materializeNotificationEvent({ eventId: notificationEvent._id });
    } catch {
      // The committed automatic Unassign and durable obligation remain
      // recoverable by the canonical Notification worker.
    }
  }

  if (committedChatMessage) {
    emitCommittedChatMessageRealtimeBestEffort(committedChatMessage);
  }

  if (unassignedApplication) {
    await emitCommittedConversationStateRealtimeBestEffort({
      application: unassignedApplication,
      mode: CONVERSATION_REALTIME_MODE.PAUSED_UNASSIGNED,
    });
  }

  return unassignedApplication;
};

// F04 compatibility surface: CM-only A → B using the canonical assigned-state
// mutation. No recovery-only restriction; CM does not become Assignee.
const forceReassignApplication = async ({
  actorUser,
  jobId,
  applicationId,
  assigneeCompanyMemberId,
  expectedAssigneeCompanyMemberId,
  expectedVersion,
  clientCompanyId,
} = {}) => {
  const actorContext = await resolveCompanyManagerRecruiterManagementContext({
    user: actorUser,
    clientCompanyId,
  });

  return executePrimaryCurrentAssigneeMutation({
    actorUser,
    actorContext,
    jobId,
    applicationId,
    nextAssigneeCompanyMemberId: assigneeCompanyMemberId,
    expectedAssigneeCompanyMemberId,
    expectedVersion,
    clientCompanyId,
    actionLabel: "Reassign",
  });
};

const rejectFailedRecruitmentPipelineCas = async ({
  applicationId,
  expectedStatus,
  expectedVersion,
  actorMembershipId,
  session,
} = {}) => {
  let latestQuery = Application.findById(applicationId);
  if (session) {
    latestQuery = latestQuery.session(session);
  }

  const latestApplication = await latestQuery;

  if (!latestApplication) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  if (isApplicationTerminalStatus(latestApplication.status)) {
    throw new AppError(
      409,
      "Terminal Applications cannot be updated in Recruitment Pipeline",
      {
        field: "status",
        status: latestApplication.status,
      },
    );
  }

  if (isApplicationUnassigned(latestApplication)) {
    throw new AppError(
      409,
      "Application has no Assignee; Recruitment Pipeline requires an Assignee",
      { field: "assignedRecruiterCompanyMemberId" },
    );
  }

  if (
    latestApplication.assignedRecruiterCompanyMemberId.toString() !==
    actorMembershipId.toString()
  ) {
    throw new AppError(
      409,
      "Application Assignee has changed; refresh and retry Recruitment Pipeline",
      { field: "assignedRecruiterCompanyMemberId" },
    );
  }

  if (latestApplication.status !== expectedStatus) {
    throw new AppError(
      409,
      "Application status has changed; refresh and retry Recruitment Pipeline",
      {
        field: "expectedStatus",
        status: latestApplication.status,
      },
    );
  }

  if (latestApplication.version !== expectedVersion) {
    throw new AppError(
      409,
      "Application has changed; refresh and retry Recruitment Pipeline",
      { field: "expectedVersion" },
    );
  }

  throw new AppError(
    409,
    "Application has changed; refresh and retry Recruitment Pipeline",
    { field: "expectedVersion" },
  );
};

// F05 / F09 partial — current eligible Assignee advances or rejects through the
// canonical Recruitment Pipeline. Mutates only status + version (TX-01);
// continuous eligibility re-checked at commit (BR-08 / TX-02). Does not use Job
// accepting/public eligibility; CLOSED/EXPIRED Jobs keep existing Applications
// processable (BR-25 / BR-30).
const updateApplicationRecruitmentPipelineStatus = async ({
  actorUser,
  jobId,
  applicationId,
  targetStatus,
  expectedStatus,
  expectedVersion,
  clientCompanyId,
} = {}) => {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  if (
    typeof expectedVersion !== "number" ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 0
  ) {
    throw new AppError(400, "expectedVersion must be a non-negative integer", {
      field: "expectedVersion",
    });
  }

  if (!Object.values(APPLICATION_STATUS).includes(expectedStatus)) {
    throw new AppError(400, "Invalid expectedStatus", {
      field: "expectedStatus",
    });
  }

  if (!Object.values(APPLICATION_STATUS).includes(targetStatus)) {
    throw new AppError(400, "Invalid targetStatus", {
      field: "targetStatus",
    });
  }

  // BR-20 / BR-23 / BR-24: WITHDRAWN is Candidate-only; no reopen / reverse /
  // skip; HIRED/REJECTED/WITHDRAWN are not pipeline sources.
  if (
    expectedStatus === APPLICATION_STATUS.WITHDRAWN ||
    targetStatus === APPLICATION_STATUS.WITHDRAWN
  ) {
    throw new AppError(
      409,
      "WITHDRAWN is Candidate-controlled and cannot be set by Recruitment Pipeline",
      { field: "targetStatus" },
    );
  }

  if (!isAllowedRecruitmentPipelineTransition({ expectedStatus, targetStatus })) {
    throw new AppError(409, "Invalid Recruitment Pipeline transition", {
      field: "targetStatus",
      expectedStatus,
      targetStatus,
    });
  }

  // V12 BR-18: this transition is no longer an independent Pipeline mutation.
  // Slice 01 intentionally has no proposal workflow to perform the coupled
  // Schedule creation and transition.
  if (
    expectedStatus === APPLICATION_STATUS.CONTACTED &&
    targetStatus === APPLICATION_STATUS.INTERVIEW_SCHEDULED
  ) {
    throw new AppError(
      409,
      "CONTACTED to INTERVIEW_SCHEDULED requires the first Interview Schedule proposal",
      { field: "targetStatus" },
    );
  }

  const context = await resolveRecruiterBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  const session = await mongoose.startSession();
  let updatedApplication = null;
  let job = null;
  let assigneeContext = null;
  const notificationEvents = [];
  const committedConversationStateEvents = [];

  try {
    await session.withTransaction(async () => {
      job = await Job.findById(jobId).session(session);

      if (!job) {
        throw new AppError(404, "Job not found", {
          field: "jobId",
        });
      }

      assertSameCompanyTenant({
        resourceCompanyId: job.companyId,
        tenantCompanyId: context.companyId,
      });

      const application = await Application.findById(applicationId).session(
        session,
      );

      if (!application) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      if (application.jobId.toString() !== job._id.toString()) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      if (!isLifecycleCompatibleApplicationSource(application.source)) {
        throw new AppError(404, "Application not found", {
          field: "applicationId",
        });
      }

      // BR-18: Unassigned Applications have no pipeline processing authority.
      if (isApplicationUnassigned(application)) {
        throw new AppError(
          409,
          "Application has no Assignee; Recruitment Pipeline requires an Assignee",
          { field: "assignedRecruiterCompanyMemberId" },
        );
      }

      // BR-18 / BR-19: pipeline authority belongs to current Assignee only —
      // Primary of the Job does not bypass Supporting responsibility.
      if (
        application.assignedRecruiterCompanyMemberId.toString() !==
        context.membership._id.toString()
      ) {
        throw new AppError(
          403,
          "Only the current Assignee can update Recruitment Pipeline for this Application",
          { field: "role" },
        );
      }

      if (isApplicationTerminalStatus(application.status)) {
        throw new AppError(
          409,
          "Terminal Applications cannot be updated in Recruitment Pipeline",
          {
            field: "status",
            status: application.status,
          },
        );
      }

      if (application.status !== expectedStatus) {
        throw new AppError(
          409,
          "Application status has changed; refresh and retry Recruitment Pipeline",
          {
            field: "expectedStatus",
            status: application.status,
          },
        );
      }

      if (application.version !== expectedVersion) {
        throw new AppError(
          409,
          "Application has changed; refresh and retry Recruitment Pipeline",
          { field: "expectedVersion" },
        );
      }

      // BR-08 / TX-02: stored assignee does not authorize processing; continuous
      // eligibility across Company/CompanyMember/User/Job-team must hold at
      // commit via shared TX-02 acquires.
      assigneeContext = await assertAssigneeEligibleAtAssignmentCommit({
        assigneeCompanyMemberId: context.membership._id,
        job,
        session,
      });

      // TX-01 / BR-31 / BR-36 / BR-38 / BR-39:
      // Atomic status-only mutation; assignee, snapshot, identity unchanged.
      // Competing Reassign/Replace/Withdraw on the same revision lose atomically.
      updatedApplication = await Application.findOneAndUpdate(
        {
          _id: application._id,
          jobId: job._id,
          source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
          status: expectedStatus,
          version: expectedVersion,
          assignedRecruiterCompanyMemberId: context.membership._id,
        },
        {
          $set: {
            status: targetStatus,
          },
          $inc: {
            version: 1,
          },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!updatedApplication) {
        await rejectFailedRecruitmentPipelineCas({
          applicationId: application._id,
          expectedStatus,
          expectedVersion,
          actorMembershipId: context.membership._id,
          session,
        });
      }

      const notificationType = isApplicationTerminalStatus(targetStatus)
        ? targetStatus === APPLICATION_STATUS.HIRED
          ? NOTIFICATION_TYPE.APPLICATION_HIRED
          : NOTIFICATION_TYPE.APPLICATION_REJECTED
        : NOTIFICATION_TYPE.APPLICATION_STATUS_CHANGED;
      const statusNotificationEvent =
        await createApplicationLifecycleNotificationEvent({
          application: updatedApplication,
          job,
          type: notificationType,
          actorUserId: actorUser._id,
          recipientUserId: updatedApplication.candidateUserId,
          session,
        });
      if (statusNotificationEvent) {
        notificationEvents.push(statusNotificationEvent);
      }

      if (targetStatus === APPLICATION_STATUS.CONTACTED) {
        const availabilityNotificationEvent =
          await createApplicationLifecycleNotificationEvent({
            application: updatedApplication,
            job,
            type: NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED,
            actorUserId: actorUser._id,
            recipientUserId: updatedApplication.candidateUserId,
            session,
          });
        if (availabilityNotificationEvent) {
          notificationEvents.push(availabilityNotificationEvent);
        }
      }

      if (isApplicationTerminalStatus(targetStatus)) {
        const terminalScheduleCancellation =
          await cancelActiveInterviewScheduleForTerminalApplication({
            application: updatedApplication,
            job,
            session,
          });
        if (terminalScheduleCancellation.notificationEvent) {
          notificationEvents.push(terminalScheduleCancellation.notificationEvent);
        }

        committedConversationStateEvents.push({
          application: updatedApplication,
          mode: CONVERSATION_REALTIME_MODE.READ_ONLY,
        });
      }
    });
  } finally {
    await session.endSession();
  }

  for (const notificationEvent of notificationEvents) {
    try {
      await materializeNotificationEvent({ eventId: notificationEvent._id });
    } catch {
      // The committed Application transition remains recoverable.
    }
  }

  for (const committedConversationStateEvent of committedConversationStateEvents) {
    await emitCommittedConversationStateRealtimeBestEffort(
      committedConversationStateEvent,
    );
  }

  const applicationView = await buildPrimaryApplicationViewFromDocs({
    application: updatedApplication,
    assigneeMembership: assigneeContext.membership,
    assigneeUser: assigneeContext.user,
  });

  return {
    job: toPublicJob(job),
    application: applicationView,
  };
};

// PI-21 / PI-22 / PI-24: non-terminal Application responsibility for a Recruiter
// is independent of Job.status (PUBLISHED/CLOSED/EXPIRED all count).
const findNonTerminalApplicationsAssignedToRecruiter = async ({
  assigneeCompanyMemberId,
  session,
} = {}) => {
  if (!mongoose.isValidObjectId(assigneeCompanyMemberId)) {
    return [];
  }

  let query = Application.find({
    assignedRecruiterCompanyMemberId: assigneeCompanyMemberId,
    status: { $in: [...APPLICATION_NON_TERMINAL_STATUSES] },
  }).sort({ _id: 1 });

  if (session) {
    query = query.session(session);
  }

  return query;
};

// TX-05: detach current non-terminal responsibilities of one Recruiter as
// independent per-Application A → NONE commits. No global all-or-nothing
// transaction, no persisted progress/recovery state, no replacement selection.
// Partial success is kept; callers retry remaining current responsibilities
// from persisted Application state. CompanyMember LOCK/TERMINATE (Slice 07),
// Recruitment Team removal (Slice 08 Job-scoped variant), and Platform Admin
// User LOCK/TERMINATE (Slice 09) reuse this owner.
const automaticallyUnassignCurrentResponsibilitiesOfRecruiter = async ({
  outgoingRecruiterCompanyMemberId,
} = {}) => {
  if (!mongoose.isValidObjectId(outgoingRecruiterCompanyMemberId)) {
    throw new AppError(400, "Invalid outgoing Recruiter CompanyMember id", {
      field: "outgoingRecruiterCompanyMemberId",
    });
  }

  const applications = await findNonTerminalApplicationsAssignedToRecruiter({
    assigneeCompanyMemberId: outgoingRecruiterCompanyMemberId,
  });

  const detached = [];
  const failed = [];

  for (const application of applications) {
    try {
      const unassignedApplication = await automaticallyUnassignApplication({
        applicationId: application._id,
        expectedAssigneeCompanyMemberId: outgoingRecruiterCompanyMemberId,
        expectedVersion: application.version,
      });
      detached.push(unassignedApplication);
    } catch (error) {
      failed.push({
        applicationId: application._id,
        error,
      });
    }
  }

  return { detached, failed };
};

// TX-05 Job-scoped variant for Recruitment Team removal: only non-terminal
// Applications of the mutated Job that still name the outgoing Recruiter.
// Independent per-Application A → NONE; no replacement; no cross-Job detach.
const automaticallyUnassignCurrentResponsibilitiesOfRecruiterOnJob = async ({
  outgoingRecruiterCompanyMemberId,
  jobId,
} = {}) => {
  if (!mongoose.isValidObjectId(outgoingRecruiterCompanyMemberId)) {
    throw new AppError(400, "Invalid outgoing Recruiter CompanyMember id", {
      field: "outgoingRecruiterCompanyMemberId",
    });
  }

  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(400, "Invalid Job id", { field: "jobId" });
  }

  const applications =
    await findNonTerminalApplicationsAssignedToRecruiterOnJob({
      assigneeCompanyMemberId: outgoingRecruiterCompanyMemberId,
      jobId,
    });

  const detached = [];
  const failed = [];

  for (const application of applications) {
    try {
      const unassignedApplication = await automaticallyUnassignApplication({
        applicationId: application._id,
        expectedAssigneeCompanyMemberId: outgoingRecruiterCompanyMemberId,
        expectedVersion: application.version,
      });
      detached.push(unassignedApplication);
    } catch (error) {
      failed.push({
        applicationId: application._id,
        error,
      });
    }
  }

  return { detached, failed };
};

const countNonTerminalApplicationsAssignedToRecruiter = async ({
  assigneeCompanyMemberId,
  session,
} = {}) => {
  if (!mongoose.isValidObjectId(assigneeCompanyMemberId)) {
    return 0;
  }

  let query = Application.countDocuments({
    assignedRecruiterCompanyMemberId: assigneeCompanyMemberId,
    status: { $in: [...APPLICATION_NON_TERMINAL_STATUSES] },
  });

  if (session) {
    query = query.session(session);
  }

  return query;
};

// TX-02 / TX-05 / PI-24: final lifecycle guard dimension for Application
// responsibility. Must run inside the terminal lifecycle transaction.
const assertNoOutstandingRecruiterApplicationResponsibility = async ({
  recruiterCompanyMemberId,
  session,
} = {}) => {
  const outstanding = await countNonTerminalApplicationsAssignedToRecruiter({
    assigneeCompanyMemberId: recruiterCompanyMemberId,
    session,
  });

  if (outstanding > 0) {
    throw new AppError(
      409,
      "Recruiter has outstanding non-terminal Application responsibility",
      {
        field: "assignedRecruiterCompanyMemberId",
        count: outstanding,
      },
    );
  }
};

// V10 Slice 08 / PI-22: Job-scoped Application responsibility. Job.status does
// not participate — PUBLISHED/CLOSED/EXPIRED Applications all count.
const findNonTerminalApplicationsAssignedToRecruiterOnJob = async ({
  assigneeCompanyMemberId,
  jobId,
  session,
} = {}) => {
  if (
    !mongoose.isValidObjectId(assigneeCompanyMemberId) ||
    !mongoose.isValidObjectId(jobId)
  ) {
    return [];
  }

  let query = Application.find({
    jobId,
    assignedRecruiterCompanyMemberId: assigneeCompanyMemberId,
    status: { $in: [...APPLICATION_NON_TERMINAL_STATUSES] },
  }).sort({ _id: 1 });

  if (session) {
    query = query.session(session);
  }

  return query;
};

const countNonTerminalApplicationsAssignedToRecruiterOnJob = async ({
  assigneeCompanyMemberId,
  jobId,
  session,
} = {}) => {
  if (
    !mongoose.isValidObjectId(assigneeCompanyMemberId) ||
    !mongoose.isValidObjectId(jobId)
  ) {
    return 0;
  }

  let query = Application.countDocuments({
    jobId,
    assignedRecruiterCompanyMemberId: assigneeCompanyMemberId,
    status: { $in: [...APPLICATION_NON_TERMINAL_STATUSES] },
  });

  if (session) {
    query = query.session(session);
  }

  return query;
};

const assertNoOutstandingRecruiterApplicationResponsibilityOnJob = async ({
  recruiterCompanyMemberId,
  jobId,
  session,
} = {}) => {
  const outstanding = await countNonTerminalApplicationsAssignedToRecruiterOnJob(
    {
      assigneeCompanyMemberId: recruiterCompanyMemberId,
      jobId,
      session,
    },
  );

  if (outstanding > 0) {
    throw new AppError(
      409,
      "Recruiter has outstanding non-terminal Application responsibility on this Job",
      {
        field: "assignedRecruiterCompanyMemberId",
        jobId: jobId.toString(),
        count: outstanding,
      },
    );
  }
};

// V10 ASSIGN/UNASSIGN Slice 08 / BR-28 / TX-05: Job-scoped automatic Unassign
// before Recruitment Team removal completion. A → NONE only; no Application
// replacement and no synthetic A → B. Partial detaches are kept; the Job-scoped
// outstanding guard blocks team-removal completion until current state is zero.
const automaticallyUnassignRecruiterApplicationsOnJobForTeamRemoval = async ({
  jobId,
  outgoingCompanyMemberId,
} = {}) => {
  await automaticallyUnassignCurrentResponsibilitiesOfRecruiterOnJob({
    outgoingRecruiterCompanyMemberId: outgoingCompanyMemberId,
    jobId,
  });

  await assertNoOutstandingRecruiterApplicationResponsibilityOnJob({
    recruiterCompanyMemberId: outgoingCompanyMemberId,
    jobId,
  });
};

const loadJobAcceptingDirectApplications = async (jobId, now = new Date()) => {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  const company = await Company.findById(job.companyId);

  if (!isJobPubliclyEligible({ job, company, now })) {
    throw new AppError(409, "Job is not accepting applications", {
      field: "jobId",
    });
  }

  return job;
};

const downloadSubmittedCvSnapshotFile = (publicId) => {
  return downloadFileBuffer({
    publicId,
    resourceType: APPLICATION_SUBMITTED_CV_STORAGE.RESOURCE_TYPE,
    deliveryType: APPLICATION_SUBMITTED_CV_STORAGE.DELIVERY_TYPE,
  });
};

const sanitizeSubmittedCvSnapshotFileName = (
  name,
  fallback = "submitted-cv.pdf",
) => {
  const base =
    typeof name === "string" && name.trim() !== ""
      ? name.trim()
      : fallback.replace(/\.pdf$/i, "");
  const sanitized = base
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  if (sanitized === "") {
    return "submitted-cv.pdf";
  }

  return sanitized.toLowerCase().endsWith(".pdf")
    ? sanitized
    : `${sanitized}.pdf`;
};

/**
 * Application-scoped snapshot PDF delivery (V10 H1 / F06–F08; BR-31).
 * Reads only Application.submittedCvSnapshot.pdfFile — never live CandidateCV.
 * Read-only: does not mutate Application, snapshot, CandidateCV, Job, or version.
 */
const buildSubmittedCvSnapshotPdfDelivery = async (application) => {
  const snapshot = application.submittedCvSnapshot;

  if (
    snapshot?.pdfFile == null ||
    typeof snapshot.pdfFile.storageKey !== "string" ||
    snapshot.pdfFile.storageKey.trim() === ""
  ) {
    throw new AppError(409, "Application submitted CV snapshot is missing PDF", {
      field: "submittedCvSnapshot",
    });
  }

  let pdfBuffer;

  try {
    pdfBuffer = await downloadSubmittedCvSnapshotFile(
      snapshot.pdfFile.storageKey,
    );
  } catch {
    throw new AppError(502, "Failed to retrieve submitted CV snapshot PDF", {
      field: "submittedCvSnapshot",
    });
  }

  return {
    buffer: pdfBuffer,
    mimeType: snapshot.pdfFile.mimeType || "application/pdf",
    fileName: sanitizeSubmittedCvSnapshotFileName(
      snapshot.pdfFile.originalFileName,
      sanitizeSubmittedCvSnapshotFileName(snapshot.name),
    ),
    sourceType: snapshot.sourceType,
  };
};

const loadCandidateOwnedApplicationForSnapshotDelivery = async ({
  candidateUserId,
  actorUser,
  applicationId,
}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(
      403,
      "Candidates may only access their own Applications",
    );
  }

  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const application = await Application.findOne({
    _id: applicationId,
    candidateUserId,
    source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
  });

  if (!application) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  return application;
};

const loadPrimaryManagedJobApplicationForSnapshotDelivery = async ({
  actorUser,
  jobId,
  applicationId,
  clientCompanyId,
}) => {
  const { job } = await resolvePrimaryManagedJobContext({
    actorUser,
    jobId,
    clientCompanyId,
    actionLabel: "read the submitted CV snapshot of",
  });

  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const application = await Application.findById(applicationId);

  if (
    !application ||
    !isLifecycleCompatibleApplicationSource(application.source) ||
    application.jobId.toString() !== job._id.toString()
  ) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  return application;
};

const loadRecruiterMyApplicationForSnapshotDelivery = async ({
  actorUser,
  applicationId,
  clientCompanyId,
}) => {
  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const context = await resolveRecruiterBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  const application = await Application.findById(applicationId);

  if (
    !application ||
    !isLifecycleCompatibleApplicationSource(application.source)
  ) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  if (
    application.assignedRecruiterCompanyMemberId == null ||
    application.assignedRecruiterCompanyMemberId.toString() !==
      context.membership._id.toString()
  ) {
    throw new AppError(
      403,
      "Only the current Assigned Recruiter can read this Application submitted CV snapshot",
      { field: "assignedRecruiterCompanyMemberId" },
    );
  }

  const job = await Job.findById(application.jobId);

  if (!job) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  assertSameCompanyTenant({
    resourceCompanyId: job.companyId,
    tenantCompanyId: context.companyId,
  });

  return application;
};

const previewCandidateApplicationSubmittedCv = async ({
  candidateUserId,
  actorUser,
  applicationId,
}) => {
  const application = await loadCandidateOwnedApplicationForSnapshotDelivery({
    candidateUserId,
    actorUser,
    applicationId,
  });

  return buildSubmittedCvSnapshotPdfDelivery(application);
};

const downloadCandidateApplicationSubmittedCv = async ({
  candidateUserId,
  actorUser,
  applicationId,
}) => {
  const application = await loadCandidateOwnedApplicationForSnapshotDelivery({
    candidateUserId,
    actorUser,
    applicationId,
  });

  return buildSubmittedCvSnapshotPdfDelivery(application);
};

const previewPrimaryJobApplicationSubmittedCv = async ({
  actorUser,
  jobId,
  applicationId,
  clientCompanyId,
}) => {
  const application =
    await loadPrimaryManagedJobApplicationForSnapshotDelivery({
      actorUser,
      jobId,
      applicationId,
      clientCompanyId,
    });

  return buildSubmittedCvSnapshotPdfDelivery(application);
};

const downloadPrimaryJobApplicationSubmittedCv = async ({
  actorUser,
  jobId,
  applicationId,
  clientCompanyId,
}) => {
  const application =
    await loadPrimaryManagedJobApplicationForSnapshotDelivery({
      actorUser,
      jobId,
      applicationId,
      clientCompanyId,
    });

  return buildSubmittedCvSnapshotPdfDelivery(application);
};

const previewRecruiterMyApplicationSubmittedCv = async ({
  actorUser,
  applicationId,
  clientCompanyId,
}) => {
  const application = await loadRecruiterMyApplicationForSnapshotDelivery({
    actorUser,
    applicationId,
    clientCompanyId,
  });

  return buildSubmittedCvSnapshotPdfDelivery(application);
};

const downloadRecruiterMyApplicationSubmittedCv = async ({
  actorUser,
  applicationId,
  clientCompanyId,
}) => {
  const application = await loadRecruiterMyApplicationForSnapshotDelivery({
    actorUser,
    applicationId,
    clientCompanyId,
  });

  return buildSubmittedCvSnapshotPdfDelivery(application);
};

const loadEligibleCandidateCvForDirectApply = async ({
  candidateUserId,
  candidateCvId,
}) => {
  if (!mongoose.isValidObjectId(candidateCvId)) {
    throw new AppError(404, "Candidate CV not found", {
      field: "candidateCvId",
    });
  }

  const candidateCv = await CandidateCV.findOne({
    _id: candidateCvId,
    candidateUserId,
  });

  if (!candidateCv) {
    throw new AppError(404, "Candidate CV not found", {
      field: "candidateCvId",
    });
  }

  if (candidateCv.archivedAt != null) {
    throw new AppError(409, "Archived Candidate CV cannot be used to apply", {
      field: "candidateCvId",
    });
  }

  if (candidateCv.status !== CANDIDATE_CV_STATUS.ACTIVE) {
    throw new AppError(409, "Only ACTIVE Candidate CVs can be used to apply", {
      field: "status",
    });
  }

  if (candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
    if (
      candidateCv.uploadedFile == null ||
      typeof candidateCv.uploadedFile.storageKey !== "string" ||
      candidateCv.uploadedFile.storageKey.trim() === ""
    ) {
      throw new AppError(409, "Uploaded Candidate CV is missing current file", {
        field: "candidateCvId",
      });
    }
  } else if (candidateCv.sourceType !== CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    throw new AppError(404, "Candidate CV not found", {
      field: "candidateCvId",
    });
  }

  return candidateCv;
};

const captureUploadedSubmittedCvSnapshot = ({
  candidateCv,
  capturedAt = new Date(),
}) => {
  return captureUploadedCvSnapshot({
    candidateCv,
    capturedAt,
    storage: APPLICATION_CV_SNAPSHOT_STORAGE,
  });
};

const captureGeneratedSubmittedCvSnapshot = ({
  candidateCv,
  capturedAt = new Date(),
}) => {
  return captureGeneratedCvSnapshot({
    candidateCv,
    capturedAt,
    storage: APPLICATION_CV_SNAPSHOT_STORAGE,
  });
};

const directApplyToJob = async ({
  candidateUserId,
  actorUser,
  jobId,
  candidateCvId,
  now = new Date(),
}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only apply for themselves");
  }

  const job = await loadJobAcceptingDirectApplications(jobId, now);
  const candidateCv = await loadEligibleCandidateCvForDirectApply({
    candidateUserId,
    candidateCvId,
  });

  await assertCandidateJobAllowsDirectApply({
    candidateUserId,
    jobId: job._id,
    now,
  });

  let uploadedSnapshotStorageKey = null;

  try {
    const capturedAt = new Date();
    const { snapshot: submittedCvSnapshot, storageKey } = await captureCvSnapshot(
      {
        candidateCv,
        capturedAt,
        storage: APPLICATION_CV_SNAPSHOT_STORAGE,
      },
    );
    uploadedSnapshotStorageKey = storageKey;

    const session = await mongoose.startSession();
    let application;
    const notificationEvents = [];

    try {
      await session.withTransaction(async () => {
        notificationEvents.length = 0;

        const { job: currentJob } = await acquireCandidateJobSerialization({
          candidateUserId,
          jobId: job._id,
          session,
        });

        await assertCandidateJobAllowsDirectApply({
          candidateUserId,
          jobId: currentJob._id,
          session,
          now,
        });

        const staleInvitationResult =
          await materializeStalePendingInvitationForCandidateJob({
            candidateUserId,
            jobId: currentJob._id,
            session,
            now,
          });

        if (staleInvitationResult.notificationEvent) {
          notificationEvents.push(staleInvitationResult.notificationEvent);
        }

        const primaryRecruiter = await CompanyMember.findOne({
          _id: currentJob.primaryRecruiterCompanyMemberId,
          companyId: currentJob.companyId,
        }).session(session);

        if (!primaryRecruiter) {
          throw new AppError(409, "Job Primary Recruiter is no longer available");
        }

        [application] = await Application.create(
          [
            {
              candidateUserId,
              jobId: job._id,
              source: APPLICATION_SOURCE.DIRECT_APPLICATION,
              status: APPLICATION_STATUS.APPLIED,
              submittedCvSnapshot,
              appliedAt: new Date(),
              withdrawnAt: null,
              withdrawReason: null,
              // V10: Unassigned is assignment-state only; normalize on Direct Apply write.
              assignedRecruiterCompanyMemberId: null,
              version: 0,
            },
          ],
          { session },
        );

        const recipientsByUserId = new Map();
        const addRecipient = (recipientUserId, content) => {
          const recipientKey = recipientUserId.toString();

          if (!recipientsByUserId.has(recipientKey)) {
            recipientsByUserId.set(recipientKey, {
              recipientUserId,
              content,
            });
          }
        };

        addRecipient(
          candidateUserId,
          `Your application for ${currentJob.title} was submitted successfully.`,
        );
        addRecipient(
          primaryRecruiter.userId,
          `A new application for ${currentJob.title} is awaiting assignment.`,
        );

        const { event: createdApplicationEvent } = await createNotificationEvent({
          eventKey: `direct-application-created:${application._id.toString()}`,
          type: NOTIFICATION_TYPE.DIRECT_APPLICATION_CREATED,
          actorUserId: candidateUserId,
          applicationId: application._id,
          recipients: [...recipientsByUserId.values()],
          session,
        });
        notificationEvents.push(createdApplicationEvent);
      });
    } finally {
      await session.endSession();
    }

    for (const event of notificationEvents) {
      try {
        await materializeNotificationEvent({ eventId: event._id });
      } catch {
        // The persisted event obligation remains pending for canonical recovery.
      }
    }

    return toPublicApplication(application);
  } catch (error) {
    if (uploadedSnapshotStorageKey) {
      try {
        await deleteApplicationSubmittedCvSnapshotFile(
          uploadedSnapshotStorageKey,
        );
      } catch {
        // Best-effort orphan cleanup when DB commit fails.
      }
    }

    if (isMongoDuplicateKeyError(error)) {
      throw new AppError(
        409,
        "Application already exists for this Candidate and Job",
        {
          field: "jobId",
        },
      );
    }

    throw error;
  }
};

const loadOwnedApplicationForReplace = async ({ candidateUserId, applicationId }) => {
  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const application = await Application.findOne({
    _id: applicationId,
    candidateUserId,
  });

  if (!application) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  return application;
};

const replaceSubmittedCv = async ({
  candidateUserId,
  actorUser,
  applicationId,
  candidateCvId,
  expectedVersion,
}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only replace Applications for themselves");
  }

  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new AppError(400, "expectedVersion must be a non-negative integer", {
      field: "expectedVersion",
    });
  }

  const application = await loadOwnedApplicationForReplace({
    candidateUserId,
    applicationId,
  });

  if (application.source === APPLICATION_SOURCE.RECRUITER_INVITATION) {
    throw new AppError(
      409,
      "Invitation-source Applications cannot replace Submitted CV",
      { field: "source" },
    );
  }

  if (application.status !== APPLICATION_STATUS.APPLIED) {
    throw new AppError(409, "Only APPLIED Applications can replace Submitted CV", {
      field: "status",
    });
  }

  await loadJobAcceptingDirectApplications(application.jobId);
  const candidateCv = await loadEligibleCandidateCvForDirectApply({
    candidateUserId,
    candidateCvId,
  });

  const capturedAt = new Date();
  const captureSubmittedCvSnapshot =
    candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED
      ? captureGeneratedSubmittedCvSnapshot
      : captureUploadedSubmittedCvSnapshot;
  let uploadedSnapshotStorageKey = null;

  try {
    const { snapshot: submittedCvSnapshot, storageKey } =
      await captureSubmittedCvSnapshot({
        candidateCv,
        capturedAt,
      });
    uploadedSnapshotStorageKey = storageKey;

    const replacedApplication = await Application.findOneAndUpdate(
      {
        _id: application._id,
        candidateUserId,
        source: APPLICATION_SOURCE.DIRECT_APPLICATION,
        status: APPLICATION_STATUS.APPLIED,
        version: expectedVersion,
      },
      {
        $set: {
          submittedCvSnapshot,
        },
        $inc: {
          version: 1,
        },
      },
      {
        returnDocument: "after",
      },
    );

    if (!replacedApplication) {
      const latestApplication = await Application.findById(application._id);

      if (latestApplication?.status !== APPLICATION_STATUS.APPLIED) {
        throw new AppError(
          409,
          "Application is no longer APPLIED and cannot replace Submitted CV",
          {
            field: "status",
          },
        );
      }

      throw new AppError(409, "Application has changed; refresh and retry replace", {
        field: "expectedVersion",
      });
    }

    return toPublicApplication(replacedApplication);
  } catch (error) {
    if (uploadedSnapshotStorageKey) {
      try {
        await deleteApplicationSubmittedCvSnapshotFile(uploadedSnapshotStorageKey);
      } catch {
        // Best-effort orphan cleanup when DB commit fails.
      }
    }

    throw error;
  }
};

const withdrawApplication = async ({
  candidateUserId,
  actorUser,
  applicationId,
  expectedVersion,
  withdrawReason,
}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only withdraw Applications for themselves");
  }

  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new AppError(400, "expectedVersion must be a non-negative integer", {
      field: "expectedVersion",
    });
  }
  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const normalizedWithdrawReason =
    typeof withdrawReason === "string" ? withdrawReason.trim() || null : null;
  const withdrawnAt = new Date();
  const session = await mongoose.startSession();
  let withdrawnApplication = null;
  const notificationEvents = [];
  let committedConversationStateEvent = null;

  try {
    await session.withTransaction(async () => {
      notificationEvents.length = 0;
      const application = await Application.findOne({
        _id: applicationId,
        candidateUserId,
        source: { $in: LIFECYCLE_COMPATIBLE_APPLICATION_SOURCES },
      }).session(session);

      if (!application) {
        throw new AppError(404, "Application not found", { field: "applicationId" });
      }
      if (application.source === APPLICATION_SOURCE.RECRUITER_INVITATION) {
        throw new AppError(
          409,
          "Invitation-source Applications cannot be withdrawn",
          { field: "source" },
        );
      }
      if (application.status !== APPLICATION_STATUS.APPLIED) {
        throw new AppError(409, "Only APPLIED Applications can be withdrawn", {
          field: "status",
        });
      }
      if (application.version !== expectedVersion) {
        throw new AppError(409, "Application has changed; refresh and retry withdraw", {
          field: "expectedVersion",
        });
      }

      const job = await Job.findById(application.jobId).session(session);
      if (!job) {
        throw new AppError(404, "Job not found", { field: "jobId" });
      }

      let recipientUserId;
      if (application.assignedRecruiterCompanyMemberId != null) {
        const assignee = await CompanyMember.findById(
          application.assignedRecruiterCompanyMemberId,
        ).session(session);
        recipientUserId = assignee?.userId ?? null;
      } else {
        const primaryRecruiter = await CompanyMember.findOne({
          _id: job.primaryRecruiterCompanyMemberId,
          companyId: job.companyId,
        }).session(session);
        recipientUserId = primaryRecruiter?.userId ?? null;
      }
      if (recipientUserId == null) {
        throw new AppError(409, "Withdraw Notification recipient is unavailable");
      }

      withdrawnApplication = await Application.findOneAndUpdate(
        {
          _id: application._id,
          candidateUserId,
          source: APPLICATION_SOURCE.DIRECT_APPLICATION,
          status: APPLICATION_STATUS.APPLIED,
          version: expectedVersion,
        },
        {
          $set: {
            status: APPLICATION_STATUS.WITHDRAWN,
            withdrawnAt,
            withdrawReason: normalizedWithdrawReason,
          },
          $inc: {
            version: 1,
          },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!withdrawnApplication) {
        throw new AppError(409, "Application has changed; refresh and retry withdraw", {
          field: "expectedVersion",
        });
      }

      const notificationEvent = await createApplicationLifecycleNotificationEvent({
        application: withdrawnApplication,
        job,
        type: NOTIFICATION_TYPE.APPLICATION_WITHDRAWN,
        actorUserId: actorUser._id,
        recipientUserId,
        session,
      });
      if (notificationEvent) {
        notificationEvents.push(notificationEvent);
      }

      const terminalScheduleCancellation =
        await cancelActiveInterviewScheduleForTerminalApplication({
          application: withdrawnApplication,
          job,
          session,
        });
      if (terminalScheduleCancellation.notificationEvent) {
        notificationEvents.push(terminalScheduleCancellation.notificationEvent);
      }

      committedConversationStateEvent = {
        application: withdrawnApplication,
        mode: CONVERSATION_REALTIME_MODE.READ_ONLY,
      };
    });
  } finally {
    await session.endSession();
  }

  for (const notificationEvent of notificationEvents) {
    try {
      await materializeNotificationEvent({ eventId: notificationEvent._id });
    } catch {
      // The committed Withdraw remains recoverable by the Notification worker.
    }
  }

  if (committedConversationStateEvent) {
    await emitCommittedConversationStateRealtimeBestEffort(
      committedConversationStateEvent,
    );
  }

  return toPublicApplication(withdrawnApplication);
};

export {
  assertNoOutstandingRecruiterApplicationResponsibility,
  assertNoOutstandingRecruiterApplicationResponsibilityOnJob,
  automaticallyUnassignApplication,
  automaticallyUnassignCurrentResponsibilitiesOfRecruiter,
  automaticallyUnassignCurrentResponsibilitiesOfRecruiterOnJob,
  automaticallyUnassignRecruiterApplicationsOnJobForTeamRemoval,
  captureGeneratedSubmittedCvSnapshot,
  captureUploadedSubmittedCvSnapshot,
  cancelRecruiterInterviewProposal,
  confirmCandidateInterviewProposal,
  countNonTerminalApplicationsAssignedToRecruiter,
  countNonTerminalApplicationsAssignedToRecruiterOnJob,
  createFirstInterviewProposal,
  createInterviewProposal,
  deepCopyGeneratedContent,
  declineCandidateInterviewProposal,
  directApplyToJob,
  downloadCandidateApplicationSubmittedCv,
  downloadPrimaryJobApplicationSubmittedCv,
  downloadRecruiterMyApplicationSubmittedCv,
  expireDueInterviewProposals,
  expireDueInterviewProposalsForApplication,
  expireDueInterviewProposalsForApplications,
  evaluateApplicationConversationChatAuthority,
  findNonTerminalApplicationsAssignedToRecruiter,
  findNonTerminalApplicationsAssignedToRecruiterOnJob,
  firstAssignApplication,
  forceReassignApplication,
  getCandidateApplicationConversation,
  getCandidateMyApplication,
  getManagedJobPipelineWorkspace,
  getRecruiterApplicationConversation,
  getRecruiterMyApplication,
  isApplicationUnassigned,
  sendCandidateApplicationConversationNormalMessage,
  sendRecruiterApplicationConversationNormalMessage,
  editCandidateAvailability,
  submitCandidateAvailabilityFirstTime,
  listCandidateMyApplications,
  listManagedJobs,
  listPrimaryJobApplications,
  listRecruiterMyApplications,
  loadEligibleCandidateCvForDirectApply,
  loadJobAcceptingDirectApplications,
  previewCandidateApplicationSubmittedCv,
  previewPrimaryJobApplicationSubmittedCv,
  previewRecruiterMyApplicationSubmittedCv,
  reassignApplication,
  replaceSubmittedCv,
  unassignApplication,
  updateApplicationRecruitmentPipelineStatus,
  withdrawApplication,
  toPrimaryJobApplicationView,
  toPublicApplication,
};
