import { PDFDocument } from "pdf-lib";
import mongoose from "mongoose";

import APPLICATION_SOURCE from "../constants/application-source.js";
import APPLICATION_STATUS from "../constants/application-status.js";
import APPLICATION_SUBMITTED_CV_STORAGE from "../constants/application-submitted-cv-storage.js";
import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_PDF from "../constants/candidate-cv-uploaded-pdf.js";
import CANDIDATE_CV_UPLOADED_STORAGE from "../constants/candidate-cv-uploaded-storage.js";
import CLOUDINARY_FOLDER from "../constants/cloudinary-folder.js";
import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../constants/company-member-status.js";
import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import Application from "../models/application.model.js";
import CandidateCV from "../models/candidate-cv.model.js";
import Company from "../models/company.model.js";
import CompanyMember from "../models/company-member.model.js";
import Conversation from "../models/conversation.model.js";
import Job from "../models/job.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/app-error.js";
import { renderHarvardCandidateCvPdf } from "./candidate-cv-harvard-pdf.service.js";
import {
  assertSameCompanyTenant,
  resolveCompanyManagerRecruiterManagementContext,
  resolveCompanyStaffBusinessContext,
  resolveRecruiterBusinessContext,
} from "./company.service.js";
import { deleteFile, downloadFileBuffer, uploadFileBuffer } from "./file.service.js";
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

const uploadApplicationSubmittedCvSnapshotFile = (buffer) => {
  return uploadFileBuffer({
    buffer,
    assetFolder: CLOUDINARY_FOLDER.APPLICATION_SUBMITTED_CV_SNAPSHOTS,
    resourceType: APPLICATION_SUBMITTED_CV_STORAGE.RESOURCE_TYPE,
    deliveryType: APPLICATION_SUBMITTED_CV_STORAGE.DELIVERY_TYPE,
  });
};

const deleteApplicationSubmittedCvSnapshotFile = (publicId) => {
  return deleteFile({
    publicId,
    resourceType: APPLICATION_SUBMITTED_CV_STORAGE.RESOURCE_TYPE,
    deliveryType: APPLICATION_SUBMITTED_CV_STORAGE.DELIVERY_TYPE,
  });
};

const isMongoDuplicateKeyError = (error) => {
  return error?.code === 11000;
};

const assertCandidateActor = (user) => {
  if (!user || user.role !== USER_ROLE.CANDIDATE) {
    throw new AppError(403, "Candidate access required");
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, "Candidate account is not active");
  }
};

const deepCopyGeneratedContent = (generatedContent) => {
  if (generatedContent == null) {
    return null;
  }

  if (typeof generatedContent.toObject === "function") {
    return generatedContent.toObject();
  }

  return JSON.parse(JSON.stringify(generatedContent));
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

const toPrimaryJobApplicationView = (
  application,
  { candidate, assignedRecruiter } = {},
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

const hydratePrimaryJobApplicationViews = async (applications) => {
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

  const [candidates, assigneeMemberships] = await Promise.all([
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
    });
  });
};

const loadDirectApplicationsForJob = async (jobId) => {
  return Application.find({
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
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

  // BR-44: V10 assignment-management Application View only covers Direct Applications.
  const applications = await loadDirectApplicationsForJob(job._id);
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
          source: APPLICATION_SOURCE.DIRECT_APPLICATION,
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

  const applications = await loadDirectApplicationsForJob(job._id);
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
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
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
    application.source !== APPLICATION_SOURCE.DIRECT_APPLICATION
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
  { job, company, assignedRecruiter } = {},
) => {
  return {
    id: application._id.toString(),
    jobId: application.jobId.toString(),
    source: application.source,
    status: application.status,
    isUnassigned: isApplicationUnassigned(application),
    assignedRecruiter: assignedRecruiter ?? null,
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

const hydrateCandidateMyApplicationViews = async (applications) => {
  if (applications.length === 0) {
    return [];
  }

  const jobIds = [
    ...new Set(applications.map((application) => application.jobId.toString())),
  ];
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
  const assigneeMemberships =
    assigneeMemberIds.length === 0
      ? []
      : await CompanyMember.find({ _id: { $in: assigneeMemberIds } }).select(
          "userId jobTitle",
        );
  const assigneeMembershipById = new Map(
    assigneeMemberships.map((membership) => [
      membership._id.toString(),
      membership,
    ]),
  );

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
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
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
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
  });

  if (!application) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const [view] = await hydrateCandidateMyApplicationViews([application]);

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
} = {}) => {
  let candidateQuery = User.findById(application.candidateUserId).select(
    "fullName avatarUrl",
  );
  if (session) {
    candidateQuery = candidateQuery.session(session);
  }

  const candidateUser = await candidateQuery;

  let assignedRecruiter = null;
  if (!isApplicationUnassigned(application)) {
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

    assignedRecruiter = toPublicAssignedRecruiterSummary({
      membership,
      user,
    });
  }

  return toPrimaryJobApplicationView(application, {
    candidate: toPublicCandidateSummary(candidateUser),
    assignedRecruiter,
  });
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
      source: APPLICATION_SOURCE.DIRECT_APPLICATION,
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
// slice creates Conversation only when none exists and never writes a Message.
const createConversationOnFirstAssignIfAbsent = async ({
  applicationId,
  session,
} = {}) => {
  const existingConversation = await Conversation.findOne({
    applicationId,
  }).session(session);

  if (existingConversation) {
    return existingConversation;
  }

  try {
    const [createdConversation] = await Conversation.create(
      [{ applicationId }],
      { session },
    );
    return createdConversation;
  } catch (error) {
    if (!isMongoDuplicateKeyError(error)) {
      throw error;
    }

    const concurrentConversation = await Conversation.findOne({
      applicationId,
    }).session(session);

    if (concurrentConversation) {
      return concurrentConversation;
    }

    throw error;
  }
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
      source: APPLICATION_SOURCE.DIRECT_APPLICATION,
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

      // BR-44: V10 Assign only covers Direct Applications.
      if (application.source !== APPLICATION_SOURCE.DIRECT_APPLICATION) {
        throw new AppError(409, "Only Direct Applications can be Assigned", {
          field: "source",
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

      // V11 F01 / BR-05 / BR-06 / TX-01: First Assign and Conversation
      // creation are one atomic outcome. No SYSTEM Message on First Assign.
      await createConversationOnFirstAssignIfAbsent({
        applicationId: assignedApplication._id,
        session,
      });
    });
  } finally {
    await session.endSession();
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

      // BR-44: V10 assignment mutations only cover Direct Applications.
      if (application.source !== APPLICATION_SOURCE.DIRECT_APPLICATION) {
        throw new AppError(
          409,
          isUnassign
            ? "Only Direct Applications can be unassigned"
            : "Only Direct Applications can be reassigned",
          { field: "source" },
        );
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
    });
  } finally {
    await session.endSession();
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

  let applicationQuery = Application.findById(applicationId);
  if (session) {
    applicationQuery = applicationQuery.session(session);
  }

  const application = await applicationQuery;

  if (!application) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  // BR-44: V10 assignment mutations only cover Direct Applications.
  if (application.source !== APPLICATION_SOURCE.DIRECT_APPLICATION) {
    throw new AppError(409, "Only Direct Applications can be unassigned", {
      field: "source",
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
    session,
  });

  if (!unassignedApplication) {
    await rejectFailedAssignedAssigneeCas({
      applicationId: application._id,
      expectedVersion,
      expectedAssigneeCompanyMemberId,
      session,
      actionLabel: "Automatic Unassign",
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

  const context = await resolveRecruiterBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  const session = await mongoose.startSession();
  let updatedApplication = null;
  let job = null;
  let assigneeContext = null;

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

      // BR-44: V10 Pipeline only covers Direct Applications.
      if (application.source !== APPLICATION_SOURCE.DIRECT_APPLICATION) {
        throw new AppError(
          409,
          "Only Direct Applications can be updated in Recruitment Pipeline",
          { field: "source" },
        );
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
          source: APPLICATION_SOURCE.DIRECT_APPLICATION,
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
    });
  } finally {
    await session.endSession();
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

const downloadUploadedCandidateCvFile = (publicId) => {
  return downloadFileBuffer({
    publicId,
    resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
    deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
  });
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
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
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
    application.source !== APPLICATION_SOURCE.DIRECT_APPLICATION ||
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
    application.source !== APPLICATION_SOURCE.DIRECT_APPLICATION
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

const buildSnapshotOriginalFileName = (candidateCvName) => {
  const trimmedName =
    typeof candidateCvName === "string" ? candidateCvName.trim() : "";

  if (trimmedName === "") {
    return "submitted-cv.pdf";
  }

  return trimmedName.toLowerCase().endsWith(".pdf")
    ? trimmedName
    : `${trimmedName}.pdf`;
};

const resolveUploadedSnapshotOriginalFileName = (candidateCv) => {
  const uploadedOriginalFileName =
    typeof candidateCv.uploadedFile?.originalFileName === "string"
      ? candidateCv.uploadedFile.originalFileName.trim()
      : "";

  if (uploadedOriginalFileName !== "") {
    return uploadedOriginalFileName;
  }

  return buildSnapshotOriginalFileName(candidateCv.name);
};

const captureUploadedSubmittedCvSnapshot = async ({
  candidateCv,
  capturedAt = new Date(),
}) => {
  let pdfBuffer;

  try {
    pdfBuffer = await downloadUploadedCandidateCvFile(
      candidateCv.uploadedFile.storageKey,
    );
  } catch {
    throw new AppError(502, "Failed to retrieve Uploaded CV PDF for snapshot", {
      field: "candidateCvId",
    });
  }

  const storedFile = await uploadApplicationSubmittedCvSnapshotFile(pdfBuffer);
  const pageCount = candidateCv.uploadedFile.pageCount;
  const sizeBytes = candidateCv.uploadedFile.sizeBytes ?? pdfBuffer.length;

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new AppError(502, "Failed to capture Uploaded CV snapshot PDF", {
      field: "candidateCvId",
    });
  }

  if (!Number.isInteger(sizeBytes) || sizeBytes < 1) {
    throw new AppError(502, "Failed to capture Uploaded CV snapshot PDF", {
      field: "candidateCvId",
    });
  }

  return {
    snapshot: {
      sourceCandidateCvId: candidateCv._id,
      name: candidateCv.name,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      pdfFile: {
        storageKey: storedFile.publicId,
        originalFileName: resolveUploadedSnapshotOriginalFileName(candidateCv),
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes,
        pageCount,
      },
      capturedAt,
    },
    storageKey: storedFile.publicId,
  };
};

const captureGeneratedSubmittedCvSnapshot = async ({
  candidateCv,
  capturedAt = new Date(),
}) => {
  const generatedContent = deepCopyGeneratedContent(
    candidateCv.generatedContent,
  );
  const pdfBuffer = await renderHarvardCandidateCvPdf(generatedContent);
  const pdfDocument = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDocument.getPageCount();

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new AppError(502, "Failed to render Generated CV snapshot PDF", {
      field: "candidateCvId",
    });
  }

  const storedFile = await uploadApplicationSubmittedCvSnapshotFile(pdfBuffer);

  return {
    snapshot: {
      sourceCandidateCvId: candidateCv._id,
      name: candidateCv.name,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      generatedContent,
      pdfFile: {
        storageKey: storedFile.publicId,
        originalFileName: buildSnapshotOriginalFileName(candidateCv.name),
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: pdfBuffer.length,
        pageCount,
      },
      capturedAt,
    },
    storageKey: storedFile.publicId,
  };
};

const directApplyToJob = async ({
  candidateUserId,
  actorUser,
  jobId,
  candidateCvId,
}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only apply for themselves");
  }

  const job = await loadJobAcceptingDirectApplications(jobId);
  const candidateCv = await loadEligibleCandidateCvForDirectApply({
    candidateUserId,
    candidateCvId,
  });

  const existingApplication = await Application.findOne({
    candidateUserId,
    jobId: job._id,
  }).select("_id");

  if (existingApplication) {
    throw new AppError(
      409,
      "Application already exists for this Candidate and Job",
      {
        field: "jobId",
      },
    );
  }

  let uploadedSnapshotStorageKey = null;

  try {
    const capturedAt = new Date();
    const captureSubmittedCvSnapshot =
      candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED
        ? captureGeneratedSubmittedCvSnapshot
        : captureUploadedSubmittedCvSnapshot;
    const { snapshot: submittedCvSnapshot, storageKey } =
      await captureSubmittedCvSnapshot({
        candidateCv,
        capturedAt,
      });
    uploadedSnapshotStorageKey = storageKey;

    const application = await Application.create({
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
    });

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

  const application = await loadOwnedApplicationForReplace({
    candidateUserId,
    applicationId,
  });

  if (application.status !== APPLICATION_STATUS.APPLIED) {
    throw new AppError(409, "Only APPLIED Applications can be withdrawn", {
      field: "status",
    });
  }

  const normalizedWithdrawReason =
    typeof withdrawReason === "string" ? withdrawReason.trim() || null : null;
  const withdrawnAt = new Date();
  const withdrawnApplication = await Application.findOneAndUpdate(
    {
      _id: application._id,
      candidateUserId,
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
    },
  );

  if (!withdrawnApplication) {
    const latestApplication = await Application.findById(application._id);

    if (latestApplication?.status !== APPLICATION_STATUS.APPLIED) {
      throw new AppError(409, "Application is no longer APPLIED and cannot be withdrawn", {
        field: "status",
      });
    }

    throw new AppError(409, "Application has changed; refresh and retry withdraw", {
      field: "expectedVersion",
    });
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
  countNonTerminalApplicationsAssignedToRecruiter,
  countNonTerminalApplicationsAssignedToRecruiterOnJob,
  deepCopyGeneratedContent,
  directApplyToJob,
  downloadCandidateApplicationSubmittedCv,
  downloadPrimaryJobApplicationSubmittedCv,
  downloadRecruiterMyApplicationSubmittedCv,
  findNonTerminalApplicationsAssignedToRecruiter,
  findNonTerminalApplicationsAssignedToRecruiterOnJob,
  firstAssignApplication,
  forceReassignApplication,
  getCandidateMyApplication,
  getManagedJobPipelineWorkspace,
  getRecruiterMyApplication,
  isApplicationUnassigned,
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
