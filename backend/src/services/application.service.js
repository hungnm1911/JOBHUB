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
import Job from "../models/job.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/app-error.js";
import { renderHarvardCandidateCvPdf } from "./candidate-cv-harvard-pdf.service.js";
import {
  assertSameCompanyTenant,
  resolveCompanyManagerRecruiterManagementContext,
  resolveRecruiterBusinessContext,
} from "./company.service.js";
import { deleteFile, downloadFileBuffer, uploadFileBuffer } from "./file.service.js";
import {
  acquireActiveRecruiterMembershipForTeamResponsibilityTx,
  isJobPubliclyEligible,
  isOwningCompanyActiveForPublicEligibility,
  toPublicJob,
} from "./job.service.js";

// Administrative handoff modes (F04 / BR-15 / PI-23). Public CM force-reassign
// is recovery-only; pre-lifecycle requires trusted orchestration context.
const ADMINISTRATIVE_HANDOFF_MODE = Object.freeze({
  RECOVERY: "recovery",
  PRE_LIFECYCLE: "pre-lifecycle",
});

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
      "Only the current Primary Recruiter can view Applications for this Job",
      { field: "role" },
    );
  }

  // BR-44: V10 Primary Application View only covers Direct Applications.
  const applications = await Application.find({
    jobId: job._id,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
  }).sort({ appliedAt: 1, _id: 1 });

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

  const applicationViews = applications.map((application) => {
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

  return {
    job: toPublicJob(job),
    applications: applicationViews,
  };
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

// BR-07 / TX-02: assignee eligibility for First Assign and Reassign/Take over —
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

// TX-02: assignment/handoff target eligibility at commit, serialized against
// Recruiter lifecycle completion via the same ACTIVE membership acquire used by
// Job-team responsibility assignment.
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

  return assigneeContext;
};

// BR-07 / BR-28: current Assignee operational eligibility for recovery handoff
// (team/role/member/user). Company operational state is enforced on the
// replacement target, not as a reason to invent a handoff replacement when the
// Company itself cannot host an eligible Assignee.
const isCurrentAssigneeOperationallyEligible = async ({
  assigneeCompanyMemberId,
  job,
  session,
} = {}) => {
  if (!mongoose.isValidObjectId(assigneeCompanyMemberId)) {
    return false;
  }

  let membershipQuery = CompanyMember.findById(assigneeCompanyMemberId);
  if (session) {
    membershipQuery = membershipQuery.session(session);
  }

  const membership = await membershipQuery;

  if (!membership) {
    return false;
  }

  if (membership.companyId.toString() !== job.companyId.toString()) {
    return false;
  }

  if (membership.role !== COMPANY_MEMBER_ROLE.RECRUITER) {
    return false;
  }

  if (membership.status !== COMPANY_MEMBER_STATUS.ACTIVE) {
    return false;
  }

  const membershipIdStr = membership._id.toString();
  const isPrimary =
    job.primaryRecruiterCompanyMemberId.toString() === membershipIdStr;
  const isSupporting = (job.supportingRecruiterCompanyMemberIds ?? []).some(
    (id) => id.toString() === membershipIdStr,
  );

  if (!isPrimary && !isSupporting) {
    return false;
  }

  let userQuery = User.findById(membership.userId).select("status");
  if (session) {
    userQuery = userQuery.session(session);
  }

  const user = await userQuery;

  if (!user || user.status !== USER_STATUS.ACTIVE) {
    return false;
  }

  return true;
};

// BR-15 / PI-23: recovery requires current Assignee ineligible; pre-lifecycle
// allows still-eligible Assignees only when they are the verified subject of the
// trusted eligibility-losing lifecycle/team operation.
const assertAdministrativeHandoffAuthorized = async ({
  assigneeCompanyMemberId,
  job,
  session,
  handoffMode,
  verifiedOutgoingSubjectCompanyMemberId,
} = {}) => {
  if (handoffMode === ADMINISTRATIVE_HANDOFF_MODE.PRE_LIFECYCLE) {
    if (
      !mongoose.isValidObjectId(verifiedOutgoingSubjectCompanyMemberId) ||
      verifiedOutgoingSubjectCompanyMemberId.toString() !==
        assigneeCompanyMemberId.toString()
    ) {
      throw new AppError(
        409,
        "Pre-lifecycle handoff requires the outgoing Assignee to be the verified subject of the eligibility-losing operation",
        { field: "verifiedOutgoingSubjectCompanyMemberId" },
      );
    }

    return;
  }

  const stillEligible = await isCurrentAssigneeOperationallyEligible({
    assigneeCompanyMemberId,
    job,
    session,
  });

  if (stillEligible) {
    throw new AppError(
      409,
      "Administrative forced reassignment requires the current Assignee to be ineligible for handoff",
      { field: "expectedAssigneeCompanyMemberId" },
    );
  }
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
      "Application has changed; refresh and retry First Assign",
      { field: "expectedVersion" },
    );
  }

  throw new AppError(
    409,
    "Application has changed; refresh and retry First Assign",
    { field: "expectedVersion" },
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

  const context = await resolveRecruiterBusinessContext({
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

      // BR-06 / BR-09 / BR-42: only current Primary may First Assign.
      assertCurrentPrimaryOfJob({
        job,
        actorMembershipId: context.membership._id,
        actionLabel: "First Assign",
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

      // BR-44: V10 First Assign only covers Direct Applications.
      if (application.source !== APPLICATION_SOURCE.DIRECT_APPLICATION) {
        throw new AppError(409, "Only Direct Applications can be First Assigned", {
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

      // Canonical V10 Unassigned + First Assign boundary is APPLIED only
      // (status×assignment matrix forbids Unassigned pipeline states).
      if (application.status !== APPLICATION_STATUS.APPLIED) {
        throw new AppError(
          409,
          "Only APPLIED Unassigned Applications can be First Assigned",
          { field: "status", status: application.status },
        );
      }

      if (!isApplicationUnassigned(application)) {
        throw new AppError(409, "Application already has an Assignee", {
          field: "assignedRecruiterCompanyMemberId",
        });
      }

      // TX-02: re-validate target eligibility and serialize against lifecycle
      // completion inside the commit transaction.
      assigneeContext = await assertAssigneeEligibleAtAssignmentCommit({
        assigneeCompanyMemberId,
        job,
        session,
      });

      // TX-01 / BR-36 / BR-37: atomic Unassigned + version CAS; no intermediate state.
      // MongoDB null equality matches both explicit null and missing assignee fields.
      assignedApplication = await Application.findOneAndUpdate(
        {
          _id: application._id,
          jobId: job._id,
          source: APPLICATION_SOURCE.DIRECT_APPLICATION,
          status: APPLICATION_STATUS.APPLIED,
          version: expectedVersion,
          assignedRecruiterCompanyMemberId: null,
        },
        {
          $set: {
            assignedRecruiterCompanyMemberId: assigneeContext.membership._id,
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

      if (!assignedApplication) {
        await rejectFailedFirstAssignCas({
          applicationId: application._id,
          expectedVersion,
          session,
        });
      }
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

const rejectFailedReassignCas = async ({
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

  if (isApplicationTerminalStatus(latestApplication.status)) {
    throw new AppError(409, "Terminal Applications cannot be reassigned", {
      field: "status",
      status: latestApplication.status,
    });
  }

  if (isApplicationUnassigned(latestApplication)) {
    throw new AppError(409, "Application has no Assignee to reassign", {
      field: "assignedRecruiterCompanyMemberId",
    });
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

const reassignApplication = async ({
  actorUser,
  jobId,
  applicationId,
  assigneeCompanyMemberId,
  expectedAssigneeCompanyMemberId,
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
    assigneeCompanyMemberId != null &&
    expectedAssigneeCompanyMemberId != null &&
    assigneeCompanyMemberId.toString() ===
      expectedAssigneeCompanyMemberId.toString()
  ) {
    throw new AppError(
      409,
      "Reassign target must differ from the current Assignee",
      { field: "assigneeCompanyMemberId" },
    );
  }

  const context = await resolveRecruiterBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  const session = await mongoose.startSession();
  let reassignedApplication = null;
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

      // BR-12 / BR-19 / BR-42: only current Primary may Reassign or Take over.
      // Supporting cannot self-reassign, self-takeover, or claim another Assignee's Application.
      assertCurrentPrimaryOfJob({
        job,
        actorMembershipId: context.membership._id,
        actionLabel: "Reassign",
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

      // BR-44: V10 Reassign/Take over only covers Direct Applications.
      if (application.source !== APPLICATION_SOURCE.DIRECT_APPLICATION) {
        throw new AppError(409, "Only Direct Applications can be reassigned", {
          field: "source",
        });
      }

      // BR-17: terminal Applications cannot change Assignee.
      if (isApplicationTerminalStatus(application.status)) {
        throw new AppError(409, "Terminal Applications cannot be reassigned", {
          field: "status",
          status: application.status,
        });
      }

      if (!APPLICATION_NON_TERMINAL_STATUSES.includes(application.status)) {
        throw new AppError(409, "Terminal Applications cannot be reassigned", {
          field: "status",
          status: application.status,
        });
      }

      // BR-10: no Unassign; Reassign requires an existing Assignee.
      if (isApplicationUnassigned(application)) {
        throw new AppError(409, "Application has no Assignee to reassign", {
          field: "assignedRecruiterCompanyMemberId",
        });
      }

      if (
        application.assignedRecruiterCompanyMemberId.toString() !==
        expectedAssigneeCompanyMemberId.toString()
      ) {
        throw new AppError(
          409,
          "Application Assignee has changed; refresh and retry Reassign",
          { field: "expectedAssigneeCompanyMemberId" },
        );
      }

      if (
        assigneeCompanyMemberId.toString() ===
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
          "Application has changed; refresh and retry Reassign",
          { field: "expectedVersion" },
        );
      }

      // TX-02: same canonical eligibility + lifecycle serialization as First Assign.
      assigneeContext = await assertAssigneeEligibleAtAssignmentCommit({
        assigneeCompanyMemberId,
        job,
        session,
      });

      // TX-01 / TX-03 / BR-10 / BR-14 / BR-36–BR-38:
      // Atomic A → B transition; no intermediate Unassigned; status unbound so a
      // prior valid status mutation is preserved on retry, never rolled back.
      reassignedApplication = await Application.findOneAndUpdate(
        {
          _id: application._id,
          jobId: job._id,
          source: APPLICATION_SOURCE.DIRECT_APPLICATION,
          version: expectedVersion,
          assignedRecruiterCompanyMemberId: expectedAssigneeCompanyMemberId,
          status: { $in: [...APPLICATION_NON_TERMINAL_STATUSES] },
        },
        {
          $set: {
            assignedRecruiterCompanyMemberId: assigneeContext.membership._id,
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

      if (!reassignedApplication) {
        await rejectFailedReassignCas({
          applicationId: application._id,
          expectedVersion,
          expectedAssigneeCompanyMemberId,
          session,
        });
      }
    });
  } finally {
    await session.endSession();
  }

  const applicationView = await buildPrimaryApplicationViewFromDocs({
    application: reassignedApplication,
    assigneeMembership: assigneeContext.membership,
    assigneeUser: assigneeContext.user,
  });

  return {
    job: toPublicJob(job),
    application: applicationView,
  };
};

const runAdministrativeApplicationHandoffInSession = async ({
  session,
  tenantCompanyId,
  jobId,
  applicationId,
  assigneeCompanyMemberId,
  expectedAssigneeCompanyMemberId,
  expectedVersion,
  handoffMode,
  verifiedOutgoingSubjectCompanyMemberId,
} = {}) => {
  const job = await Job.findById(jobId).session(session);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  // BR-40: tenant from Manager membership / trusted orchestration → Job.companyId.
  assertSameCompanyTenant({
    resourceCompanyId: job.companyId,
    tenantCompanyId,
  });

  const application = await Application.findById(applicationId).session(session);

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

  // BR-44: Direct Applications only.
  if (application.source !== APPLICATION_SOURCE.DIRECT_APPLICATION) {
    throw new AppError(
      409,
      "Only Direct Applications can be force-reassigned",
      { field: "source" },
    );
  }

  // BR-17: terminal Applications cannot change Assignee.
  if (isApplicationTerminalStatus(application.status)) {
    throw new AppError(409, "Terminal Applications cannot be reassigned", {
      field: "status",
      status: application.status,
    });
  }

  if (!APPLICATION_NON_TERMINAL_STATUSES.includes(application.status)) {
    throw new AppError(409, "Terminal Applications cannot be reassigned", {
      field: "status",
      status: application.status,
    });
  }

  // BR-10: no Unassign; administrative handoff requires an existing Assignee.
  if (isApplicationUnassigned(application)) {
    throw new AppError(409, "Application has no Assignee to reassign", {
      field: "assignedRecruiterCompanyMemberId",
    });
  }

  if (
    application.assignedRecruiterCompanyMemberId.toString() !==
    expectedAssigneeCompanyMemberId.toString()
  ) {
    throw new AppError(
      409,
      "Application Assignee has changed; refresh and retry Forced Reassignment",
      { field: "expectedAssigneeCompanyMemberId" },
    );
  }

  if (
    assigneeCompanyMemberId.toString() ===
    expectedAssigneeCompanyMemberId.toString()
  ) {
    throw new AppError(
      409,
      "Forced reassignment target must differ from the current Assignee",
      { field: "assigneeCompanyMemberId" },
    );
  }

  if (application.version !== expectedVersion) {
    throw new AppError(
      409,
      "Application has changed; refresh and retry Forced Reassignment",
      { field: "expectedVersion" },
    );
  }

  // BR-15 / BR-28 / PI-23 / TX-02: recovery vs verified pre-lifecycle boundary.
  await assertAdministrativeHandoffAuthorized({
    assigneeCompanyMemberId: expectedAssigneeCompanyMemberId,
    job,
    session,
    handoffMode,
    verifiedOutgoingSubjectCompanyMemberId,
  });

  // TX-02 / BR-07: replacement target eligibility at commit, serialized against
  // lifecycle completion (Company Manager cannot become Assignee via this authority).
  const assigneeContext = await assertAssigneeEligibleAtAssignmentCommit({
    assigneeCompanyMemberId,
    job,
    session,
  });

  // BR-27 / F09: CLOSED/EXPIRED Jobs still allow handoff of existing
  // non-terminal Applications — no Job-status gate here.

  // TX-01 / TX-03 / BR-10: atomic A → B; no intermediate Unassigned.
  const reassignedApplication = await Application.findOneAndUpdate(
    {
      _id: application._id,
      jobId: job._id,
      source: APPLICATION_SOURCE.DIRECT_APPLICATION,
      version: expectedVersion,
      assignedRecruiterCompanyMemberId: expectedAssigneeCompanyMemberId,
      status: { $in: [...APPLICATION_NON_TERMINAL_STATUSES] },
    },
    {
      $set: {
        assignedRecruiterCompanyMemberId: assigneeContext.membership._id,
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

  if (!reassignedApplication) {
    await rejectFailedReassignCas({
      applicationId: application._id,
      expectedVersion,
      expectedAssigneeCompanyMemberId,
      session,
      actionLabel: "Forced Reassignment",
    });
  }

  return {
    job,
    reassignedApplication,
    assigneeContext,
  };
};

const executeAdministrativeApplicationHandoff = async ({
  handoffMode,
  actorUser,
  companyId,
  jobId,
  applicationId,
  assigneeCompanyMemberId,
  expectedAssigneeCompanyMemberId,
  expectedVersion,
  clientCompanyId,
  verifiedOutgoingSubjectCompanyMemberId,
  session: outerSession,
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
    assigneeCompanyMemberId != null &&
    expectedAssigneeCompanyMemberId != null &&
    assigneeCompanyMemberId.toString() ===
      expectedAssigneeCompanyMemberId.toString()
  ) {
    throw new AppError(
      409,
      "Forced reassignment target must differ from the current Assignee",
      { field: "assigneeCompanyMemberId" },
    );
  }

  let tenantCompanyId = companyId;

  if (handoffMode === ADMINISTRATIVE_HANDOFF_MODE.RECOVERY) {
    // BR-15 / BR-42: public Company Manager administrative recovery authority only.
    // Client-declared lifecycle reasons / pre-lifecycle flags are ignored.
    const context = await resolveCompanyManagerRecruiterManagementContext({
      user: actorUser,
      clientCompanyId,
    });
    tenantCompanyId = context.companyId;
  } else if (handoffMode === ADMINISTRATIVE_HANDOFF_MODE.PRE_LIFECYCLE) {
    if (!mongoose.isValidObjectId(companyId)) {
      throw new AppError(400, "Invalid Company id", {
        field: "companyId",
      });
    }
  } else {
    throw new AppError(400, "Unsupported administrative handoff mode", {
      field: "handoffMode",
    });
  }

  const runWithSession = async (session) => {
    return runAdministrativeApplicationHandoffInSession({
      session,
      tenantCompanyId,
      jobId,
      applicationId,
      assigneeCompanyMemberId,
      expectedAssigneeCompanyMemberId,
      expectedVersion,
      handoffMode,
      verifiedOutgoingSubjectCompanyMemberId,
    });
  };

  let handoffResult;

  if (outerSession) {
    handoffResult = await runWithSession(outerSession);
  } else {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        handoffResult = await runWithSession(session);
      });
    } finally {
      await session.endSession();
    }
  }

  const applicationView = await buildPrimaryApplicationViewFromDocs({
    application: handoffResult.reassignedApplication,
    assigneeMembership: handoffResult.assigneeContext.membership,
    assigneeUser: handoffResult.assigneeContext.user,
  });

  return {
    job: toPublicJob(handoffResult.job),
    application: applicationView,
  };
};

// F04 public recovery path: CM may force-reassign only when current Assignee is
// already operationally ineligible. Does not accept client-declared pre-lifecycle
// authority.
const forceReassignApplication = async ({
  actorUser,
  jobId,
  applicationId,
  assigneeCompanyMemberId,
  expectedAssigneeCompanyMemberId,
  expectedVersion,
  clientCompanyId,
} = {}) => {
  return executeAdministrativeApplicationHandoff({
    handoffMode: ADMINISTRATIVE_HANDOFF_MODE.RECOVERY,
    actorUser,
    jobId,
    applicationId,
    assigneeCompanyMemberId,
    expectedAssigneeCompanyMemberId,
    expectedVersion,
    clientCompanyId,
  });
};

// Trusted internal pre-lifecycle handoff for later LOCK/TERMINATE/team-removal
// orchestration (Slice 07 foundation). Outgoing Assignee may still be eligible
// when they are the verified subject of the eligibility-losing operation.
// Not exposed on the public CM force-reassign HTTP API.
const executeTrustedPreLifecycleApplicationHandoff = async ({
  companyId,
  jobId,
  applicationId,
  assigneeCompanyMemberId,
  expectedAssigneeCompanyMemberId,
  expectedVersion,
  verifiedOutgoingSubjectCompanyMemberId,
  session,
} = {}) => {
  return executeAdministrativeApplicationHandoff({
    handoffMode: ADMINISTRATIVE_HANDOFF_MODE.PRE_LIFECYCLE,
    companyId,
    jobId,
    applicationId,
    assigneeCompanyMemberId,
    expectedAssigneeCompanyMemberId,
    expectedVersion,
    verifiedOutgoingSubjectCompanyMemberId,
    session,
  });
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
  captureGeneratedSubmittedCvSnapshot,
  captureUploadedSubmittedCvSnapshot,
  countNonTerminalApplicationsAssignedToRecruiter,
  deepCopyGeneratedContent,
  directApplyToJob,
  executeTrustedPreLifecycleApplicationHandoff,
  findNonTerminalApplicationsAssignedToRecruiter,
  firstAssignApplication,
  forceReassignApplication,
  isApplicationUnassigned,
  listPrimaryJobApplications,
  loadEligibleCandidateCvForDirectApply,
  loadJobAcceptingDirectApplications,
  reassignApplication,
  replaceSubmittedCv,
  withdrawApplication,
  toPrimaryJobApplicationView,
  toPublicApplication,
};
