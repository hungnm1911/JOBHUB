import mongoose from "mongoose";

import JOB_INVITATION_EXPIRATION from "../constants/job-invitation-expiration.js";
import JOB_INVITATION_STATUS from "../constants/job-invitation-status.js";
import NOTIFICATION_TYPE from "../constants/notification-type.js";
import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CompanyMember from "../models/company-member.model.js";
import Job from "../models/job.model.js";
import JobInvitation from "../models/job-invitation.model.js";
import AppError from "../utils/app-error.js";
import { loadCurrentSearchEligibleCandidateCvById } from "./candidate-cv.service.js";
import {
  APPLICATION_EXISTS_MESSAGE,
  PENDING_INVITATION_EXISTS_MESSAGE,
  acquireCandidateJobSerialization,
  assertCandidateJobAllowsSendInvitation,
  findApplicationForCandidateJob,
  findPendingInvitationForCandidateJob,
} from "./candidate-job-serialization.service.js";
import { resolveRecruiterBusinessContext } from "./company.service.js";
import {
  captureCvSnapshot,
  deleteCvSnapshotFile,
  JOB_INVITATION_CV_SNAPSHOT_STORAGE,
} from "./cv-snapshot.service.js";
import {
  acquireActiveRecruiterMembershipForTeamResponsibilityTx,
  acquireActiveUserForAssigneeEligibilityTx,
  acquireOperationalCompanyForAssigneeEligibilityTx,
  isJobPubliclyEligible,
} from "./job.service.js";
import {
  evaluateJobInvitationCurrentState,
  evaluateJobInvitationCurrentStateFromResources,
  isRecruiterOnJobTeam,
  loadJobInvitationCurrentStateResources,
  resourcesForInvitation,
} from "./job-invitation-current-state.service.js";
import {
  createNotificationEvent,
  materializeNotificationEvent,
} from "./notification.service.js";

const isMongoDuplicateKeyError = (error) => error?.code === 11000;

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
  return Object.fromEntries(
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
        ["year", "month", "day", "hour", "minute", "second"].includes(part.type),
      )
      .map((part) => [part.type, Number(part.value)]),
  );
};

const addCalendarDays = (isoDate, days) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));

  return [
    utc.getUTCFullYear(),
    String(utc.getUTCMonth() + 1).padStart(2, "0"),
    String(utc.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

const deriveZonedStartOfDay = ({ isoDate, timezone }) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const localMidnightGuess = Date.UTC(year, month - 1, day);
  let instant = localMidnightGuess;

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
    instant = localMidnightGuess - (representedAsUtc - instant);
  }

  return new Date(instant);
};

const deriveInvitationExpiresAt = ({ sentAt, applicationDeadline }) => {
  const day1 = getCalendarDateInTimeZone(
    sentAt,
    JOB_INVITATION_EXPIRATION.TIMEZONE,
  );
  const day16 = addCalendarDays(
    day1,
    JOB_INVITATION_EXPIRATION.OWN_CUTOFF_DAY_OFFSET,
  );
  const ownCutoff = deriveZonedStartOfDay({
    isoDate: day16,
    timezone: JOB_INVITATION_EXPIRATION.TIMEZONE,
  });
  const deadline =
    applicationDeadline instanceof Date
      ? applicationDeadline
      : new Date(applicationDeadline);

  return ownCutoff.getTime() <= deadline.getTime() ? ownCutoff : deadline;
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

const toPublicInvitedCvSnapshot = (invitedCvSnapshot) => {
  if (invitedCvSnapshot == null) {
    return null;
  }

  const result = {
    sourceCandidateCvId: invitedCvSnapshot.sourceCandidateCvId,
    name: invitedCvSnapshot.name,
    sourceType: invitedCvSnapshot.sourceType,
    pdfFile: toPublicSnapshotPdfFile(invitedCvSnapshot.pdfFile),
    capturedAt: invitedCvSnapshot.capturedAt,
  };

  if (invitedCvSnapshot.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    result.generatedContent = invitedCvSnapshot.generatedContent;
  }

  return result;
};

const toPublicJobInvitation = (invitation) => {
  return {
    id: invitation._id,
    candidateUserId: invitation.candidateUserId,
    invitedCvId: invitation.invitedCvId,
    jobId: invitation.jobId,
    sentByRecruiterCompanyMemberId: invitation.sentByRecruiterCompanyMemberId,
    invitedCvSnapshot: toPublicInvitedCvSnapshot(invitation.invitedCvSnapshot),
    greetingMessage: invitation.greetingMessage ?? null,
    status: invitation.status,
    sentAt: invitation.sentAt,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
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

const toCandidateVisibleJob = (job) => {
  if (job == null) {
    return null;
  }

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

const toCandidateVisibleSender = ({ membership, user } = {}) => {
  if (membership == null && user == null) {
    return null;
  }

  return {
    fullName: user?.fullName ?? null,
    avatarUrl: user?.avatarUrl ?? null,
    jobTitle: membership?.jobTitle ?? null,
  };
};

const toInvitationTerminalMetadata = (invitation, evaluation) => {
  return {
    acceptedAt: invitation.acceptedAt ?? null,
    rejectedAt: invitation.rejectedAt ?? null,
    revokedAt: invitation.revokedAt ?? null,
    invalidatedAt: invitation.invalidatedAt ?? null,
    invalidationReason:
      evaluation.currentStatus === JOB_INVITATION_STATUS.INVALIDATED
        ? (invitation.invalidationReason ??
          evaluation.winningCause?.reason ??
          null)
        : (invitation.invalidationReason ?? null),
  };
};

const toCandidateJobInvitationView = (
  invitation,
  evaluation,
  { job, company, senderMembership, senderUser } = {},
) => {
  return {
    id: invitation._id.toString(),
    jobId: invitation.jobId.toString(),
    invitedCvId: invitation.invitedCvId.toString(),
    sentByRecruiterCompanyMemberId:
      invitation.sentByRecruiterCompanyMemberId.toString(),
    job: toCandidateVisibleJob(job),
    company: toCandidateVisibleCompany(company),
    sender: toCandidateVisibleSender({
      membership: senderMembership,
      user: senderUser,
    }),
    greetingMessage: invitation.greetingMessage ?? null,
    invitedCvSnapshot: toPublicInvitedCvSnapshot(invitation.invitedCvSnapshot),
    status: evaluation.currentStatus,
    canAccept: evaluation.canAccept,
    canReject: evaluation.canReject,
    sentAt: invitation.sentAt,
    expiresAt: invitation.expiresAt,
    ...toInvitationTerminalMetadata(invitation, evaluation),
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
};

const toPrimaryVisibleCandidate = (candidateUser) => {
  if (candidateUser == null) {
    return null;
  }

  return {
    id: candidateUser._id.toString(),
    fullName: candidateUser.fullName,
    avatarUrl: candidateUser.avatarUrl ?? null,
  };
};

const toPrimaryJobInvitationView = (
  invitation,
  evaluation,
  { candidateUser, senderMembership, senderUser } = {},
) => {
  return {
    id: invitation._id.toString(),
    candidateUserId: invitation.candidateUserId.toString(),
    invitedCvId: invitation.invitedCvId.toString(),
    jobId: invitation.jobId.toString(),
    sentByRecruiterCompanyMemberId:
      invitation.sentByRecruiterCompanyMemberId.toString(),
    candidate: toPrimaryVisibleCandidate(candidateUser),
    sender: toCandidateVisibleSender({
      membership: senderMembership,
      user: senderUser,
    }),
    greetingMessage: invitation.greetingMessage ?? null,
    invitedCvSnapshot: toPublicInvitedCvSnapshot(invitation.invitedCvSnapshot),
    status: evaluation.currentStatus,
    canRevoke: evaluation.isActionable,
    sentAt: invitation.sentAt,
    expiresAt: invitation.expiresAt,
    ...toInvitationTerminalMetadata(invitation, evaluation),
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
};

const assertCandidateInvitationActor = (user) => {
  if (!user || user.role !== USER_ROLE.CANDIDATE) {
    throw new AppError(403, "Candidate access required");
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, "Candidate account is not active");
  }
};

const hydrateJobInvitationViews = async (
  invitations,
  toView,
  { now = new Date(), session } = {},
) => {
  if (invitations.length === 0) {
    return [];
  }

  const resources = await loadJobInvitationCurrentStateResources(invitations, {
    session,
  });

  return invitations.map((invitation) => {
    const invitationResources = resourcesForInvitation(invitation, resources);
    const evaluation = evaluateJobInvitationCurrentStateFromResources({
      invitation,
      resources,
      now,
    });

    return toView(invitation, evaluation, invitationResources);
  });
};

const hydrateCandidateJobInvitationViews = async (invitations, options) => {
  return hydrateJobInvitationViews(
    invitations,
    toCandidateJobInvitationView,
    options,
  );
};

const hydratePrimaryJobInvitationViews = async (invitations, options) => {
  return hydrateJobInvitationViews(
    invitations,
    toPrimaryJobInvitationView,
    options,
  );
};

const buildInvalidationNotificationRecipients = ({
  invitation,
  job,
  senderUser,
  senderMembership,
}) => {
  const jobTitle = job?.title ?? "a job";
  const recipients = [
    {
      recipientUserId: invitation.candidateUserId,
      content: `Your job invitation for ${jobTitle} is no longer valid.`,
    },
  ];
  const senderUserId = senderUser?._id ?? senderMembership?.userId;

  if (
    senderUserId != null &&
    senderUserId.toString() !== invitation.candidateUserId.toString()
  ) {
    recipients.push({
      recipientUserId: senderUserId,
      content: `A job invitation you sent for ${jobTitle} is no longer valid.`,
    });
  }

  return recipients;
};

const persistExpiredJobInvitation = async ({ invitation, session = null }) => {
  return JobInvitation.findOneAndUpdate(
    {
      _id: invitation._id,
      status: JOB_INVITATION_STATUS.PENDING,
    },
    {
      $set: {
        status: JOB_INVITATION_STATUS.EXPIRED,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
      session,
    },
  );
};

const persistInvalidatedJobInvitation = async ({
  invitation,
  invalidatedAt,
  invalidationReason,
  session = null,
}) => {
  return JobInvitation.findOneAndUpdate(
    {
      _id: invitation._id,
      status: JOB_INVITATION_STATUS.PENDING,
    },
    {
      $set: {
        status: JOB_INVITATION_STATUS.INVALIDATED,
        invalidatedAt,
        invalidationReason,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
      session,
    },
  );
};

const commitEvaluatedJobInvitationMaterialization = async ({
  invitation,
  evaluation,
  resources,
  session = null,
}) => {
  if (evaluation.currentStatus === JOB_INVITATION_STATUS.EXPIRED) {
    const persisted = await persistExpiredJobInvitation({
      invitation,
      session,
    });

    if (!persisted) {
      const current = await JobInvitation.findById(invitation._id).session(
        session,
      );
      return {
        invitation: current ?? invitation,
        evaluation: evaluateJobInvitationCurrentState({
          invitation: current ?? invitation,
        }),
        notificationEvent: null,
        persisted: false,
      };
    }

    return {
      invitation: persisted,
      evaluation,
      notificationEvent: null,
      persisted: true,
    };
  }

  if (evaluation.currentStatus !== JOB_INVITATION_STATUS.INVALIDATED) {
    return {
      invitation,
      evaluation,
      notificationEvent: null,
      persisted: false,
    };
  }

  const invitationResources = resourcesForInvitation(invitation, resources);
  const invalidatedAt =
    evaluation.winningCause?.causeAt instanceof Date
      ? evaluation.winningCause.causeAt
      : invitation.updatedAt;
  const persisted = await persistInvalidatedJobInvitation({
    invitation,
    invalidatedAt,
    invalidationReason: evaluation.winningCause?.reason,
    session,
  });

  if (!persisted) {
    const current = await JobInvitation.findById(invitation._id).session(session);
    return {
      invitation: current ?? invitation,
      evaluation: evaluateJobInvitationCurrentState({
        invitation: current ?? invitation,
      }),
      notificationEvent: null,
      persisted: false,
    };
  }

  const { event: notificationEvent } = await createNotificationEvent({
    eventKey: `job-invitation-invalidated:${persisted._id.toString()}`,
    type: NOTIFICATION_TYPE.JOB_INVITATION_INVALIDATED,
    actorUserId: null,
    jobInvitationId: persisted._id,
    recipients: buildInvalidationNotificationRecipients({
      invitation: persisted,
      job: invitationResources.job,
      senderUser: invitationResources.senderUser,
      senderMembership: invitationResources.senderMembership,
    }),
    session,
  });

  return {
    invitation: persisted,
    evaluation,
    notificationEvent,
    persisted: true,
  };
};

const materializeJobInvitationIfDue = async ({
  invitation,
  session = null,
  now = new Date(),
} = {}) => {
  const run = async (activeSession) => {
    const currentInvitation = await JobInvitation.findById(invitation._id).session(
      activeSession,
    );

    if (currentInvitation == null) {
      return {
        invitation,
        evaluation: evaluateJobInvitationCurrentState({ invitation, now }),
        notificationEvent: null,
        persisted: false,
      };
    }

    if (currentInvitation.status !== JOB_INVITATION_STATUS.PENDING) {
      return {
        invitation: currentInvitation,
        evaluation: evaluateJobInvitationCurrentState({
          invitation: currentInvitation,
          now,
        }),
        notificationEvent: null,
        persisted: false,
      };
    }

    const resources = await loadJobInvitationCurrentStateResources(
      [currentInvitation],
      { session: activeSession },
    );
    const evaluation = evaluateJobInvitationCurrentStateFromResources({
      invitation: currentInvitation,
      resources,
      now,
    });

    if (evaluation.isActionable) {
      return {
        invitation: currentInvitation,
        evaluation,
        notificationEvent: null,
        persisted: false,
      };
    }

    return commitEvaluatedJobInvitationMaterialization({
      invitation: currentInvitation,
      evaluation,
      resources,
      session: activeSession,
    });
  };

  if (session) {
    return run(session);
  }

  const materializationSession = await mongoose.startSession();
  let result;

  try {
    await materializationSession.withTransaction(async () => {
      result = await run(materializationSession);
    });
  } finally {
    await materializationSession.endSession();
  }

  if (result?.notificationEvent) {
    try {
      await materializeNotificationEvent({
        eventId: result.notificationEvent._id,
      });
    } catch {
      // The persisted event obligation remains pending for canonical recovery.
    }
  }

  return result;
};

const materializePendingJobInvitations = async ({
  filter = {},
  now = new Date(),
} = {}) => {
  const invitations = await JobInvitation.find({
    ...filter,
    status: JOB_INVITATION_STATUS.PENDING,
  });
  const materialized = [];
  const failed = [];

  for (const invitation of invitations) {
    try {
      materialized.push(
        await materializeJobInvitationIfDue({
          invitation,
          now,
        }),
      );
    } catch (error) {
      failed.push({
        invitationId: invitation._id,
        error,
      });
    }
  }

  return { materialized, failed };
};

const materializePendingJobInvitationsBestEffort = async (args = {}) => {
  try {
    return await materializePendingJobInvitations(args);
  } catch {
    return { materialized: [], failed: [] };
  }
};

const materializeDueExpiredJobInvitations = async ({
  now = new Date(),
} = {}) => {
  return materializePendingJobInvitations({
    filter: {
      expiresAt: {
        $lte: now,
      },
    },
    now,
  });
};

const materializePendingJobInvitationsForCompany = async ({
  companyId,
  now = new Date(),
} = {}) => {
  const jobs = await Job.find({ companyId }).select("_id");

  if (jobs.length === 0) {
    return { materialized: [], failed: [] };
  }

  return materializePendingJobInvitations({
    filter: {
      jobId: { $in: jobs.map((job) => job._id) },
    },
    now,
  });
};

const materializePendingJobInvitationsForUser = async ({
  userId,
  now = new Date(),
} = {}) => {
  const memberships = await CompanyMember.find({ userId }).select("_id");

  return materializePendingJobInvitations({
    filter: {
      $or: [
        { candidateUserId: userId },
        {
          sentByRecruiterCompanyMemberId: {
            $in: memberships.map((membership) => membership._id),
          },
        },
      ],
    },
    now,
  });
};

const materializeStalePendingInvitationForCandidateJob = async ({
  candidateUserId,
  jobId,
  session = null,
  now = new Date(),
} = {}) => {
  const pendingInvitation = await findPendingInvitationForCandidateJob({
    candidateUserId,
    jobId,
    session,
  });

  if (!pendingInvitation) {
    return {
      invitation: null,
      evaluation: null,
      notificationEvent: null,
      persisted: false,
    };
  }

  const result = await materializeJobInvitationIfDue({
    invitation: pendingInvitation,
    session,
    now,
  });

  if (result.evaluation?.isActionable) {
    throw new AppError(409, PENDING_INVITATION_EXISTS_MESSAGE, {
      field: "jobId",
    });
  }

  return result;
};

const normalizeGreetingMessage = (greetingMessage) => {
  if (greetingMessage == null) {
    return null;
  }

  if (typeof greetingMessage !== "string") {
    throw new AppError(400, "greetingMessage must be a string", {
      field: "greetingMessage",
    });
  }

  const trimmed = greetingMessage.trim();
  return trimmed === "" ? null : trimmed;
};

const sendJobInvitation = async ({
  recruiterUser,
  clientCompanyId,
  jobId,
  candidateCvId,
  greetingMessage = null,
  now = new Date(),
}) => {
  if (!recruiterUser || recruiterUser.role !== USER_ROLE.COMPANY_STAFF) {
    throw new AppError(403, "Recruiter access required");
  }

  if (recruiterUser.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, "Recruiter account is not active");
  }

  const context = await resolveRecruiterBusinessContext({
    user: recruiterUser,
    clientCompanyId,
  });

  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(404, "Job not found", { field: "jobId" });
  }

  const job = await Job.findById(jobId);

  if (!job || job.companyId.toString() !== context.companyId.toString()) {
    throw new AppError(404, "Job not found", { field: "jobId" });
  }

  if (
    !isRecruiterOnJobTeam({
      job,
      recruiterCompanyMemberId: context.membership._id,
    })
  ) {
    throw new AppError(
      403,
      "Recruiter must currently be Primary or Supporting of the selected Job",
      { field: "jobId" },
    );
  }

  if (
    !isJobPubliclyEligible({
      job,
      company: context.company,
      now,
    })
  ) {
    throw new AppError(409, "Job is not accepting invitations", {
      field: "jobId",
    });
  }

  const candidateCv =
    await loadCurrentSearchEligibleCandidateCvById(candidateCvId);

  if (!candidateCv) {
    throw new AppError(404, "Candidate CV not found", {
      field: "candidateCvId",
    });
  }

  await assertCandidateJobAllowsSendInvitation({
    candidateUserId: candidateCv.candidateUserId,
    jobId: job._id,
    now,
  });

  const normalizedGreeting = normalizeGreetingMessage(greetingMessage);
  const capturedAt = now;
  const { snapshot: invitedCvSnapshot, storageKey } = await captureCvSnapshot({
    candidateCv,
    capturedAt,
    storage: JOB_INVITATION_CV_SNAPSHOT_STORAGE,
  });

  const session = await mongoose.startSession();
  let invitation;
  const notificationEvents = [];

  try {
    try {
      await session.withTransaction(async () => {
        notificationEvents.length = 0;

        const operationalCompany =
          await acquireOperationalCompanyForAssigneeEligibilityTx({
            companyId: context.companyId,
            session,
          });

        if (!operationalCompany) {
          throw new AppError(409, "Company is not operational", {
            field: "companyId",
          });
        }

        const membership =
          await acquireActiveRecruiterMembershipForTeamResponsibilityTx({
            recruiterCompanyMemberId: context.membership._id,
            companyId: context.companyId,
            session,
          });

        if (!membership) {
          throw new AppError(
            403,
            "Recruiter must currently be Primary or Supporting of the selected Job",
            { field: "jobId" },
          );
        }

        const senderUser = await acquireActiveUserForAssigneeEligibilityTx({
          userId: recruiterUser._id,
          session,
        });

        if (!senderUser) {
          throw new AppError(403, "Recruiter account is not active");
        }

        const { job: currentJob, candidateUser } =
          await acquireCandidateJobSerialization({
            candidateUserId: candidateCv.candidateUserId,
            jobId: job._id,
            session,
          });

        if (currentJob.companyId.toString() !== context.companyId.toString()) {
          throw new AppError(404, "Job not found", { field: "jobId" });
        }

        if (
          !isRecruiterOnJobTeam({
            job: currentJob,
            recruiterCompanyMemberId: membership._id,
          })
        ) {
          throw new AppError(
            403,
            "Recruiter must currently be Primary or Supporting of the selected Job",
            { field: "jobId" },
          );
        }

        if (
          !isJobPubliclyEligible({
            job: currentJob,
            company: operationalCompany,
            now,
          })
        ) {
          throw new AppError(409, "Job is not accepting invitations", {
            field: "jobId",
          });
        }

        const currentCandidateCv =
          await loadCurrentSearchEligibleCandidateCvById(candidateCv._id, {
            session,
          });

        if (
          !currentCandidateCv ||
          !currentCandidateCv.candidateUserId.equals(candidateUser._id)
        ) {
          throw new AppError(404, "Candidate CV not found", {
            field: "candidateCvId",
          });
        }

        const staleInvitationResult =
          await materializeStalePendingInvitationForCandidateJob({
            candidateUserId: candidateUser._id,
            jobId: currentJob._id,
            session,
            now,
          });

        if (staleInvitationResult.notificationEvent) {
          notificationEvents.push(staleInvitationResult.notificationEvent);
        }

        await assertCandidateJobAllowsSendInvitation({
          candidateUserId: candidateUser._id,
          jobId: currentJob._id,
          session,
          now,
        });

        const sentAt = now;
        const expiresAt = deriveInvitationExpiresAt({
          sentAt,
          applicationDeadline: currentJob.applicationDeadline,
        });

        [invitation] = await JobInvitation.create(
          [
            {
              candidateUserId: candidateUser._id,
              invitedCvId: currentCandidateCv._id,
              jobId: currentJob._id,
              sentByRecruiterCompanyMemberId: membership._id,
              invitedCvSnapshot,
              greetingMessage: normalizedGreeting,
              status: JOB_INVITATION_STATUS.PENDING,
              sentAt,
              expiresAt,
            },
          ],
          { session },
        );

        const { event: receivedEvent } = await createNotificationEvent({
          eventKey: `job-invitation-received:${invitation._id.toString()}`,
          type: NOTIFICATION_TYPE.JOB_INVITATION_RECEIVED,
          actorUserId: senderUser._id,
          jobInvitationId: invitation._id,
          recipients: [
            {
              recipientUserId: candidateUser._id,
              content: `You received a job invitation for ${currentJob.title}.`,
            },
          ],
          session,
        });
        notificationEvents.push(receivedEvent);
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

    return toPublicJobInvitation(invitation);
  } catch (error) {
    if (storageKey) {
      try {
        await deleteCvSnapshotFile({
          storageKey,
          storage: JOB_INVITATION_CV_SNAPSHOT_STORAGE,
        });
      } catch {
        // Best-effort orphan cleanup when DB commit fails.
      }
    }

    if (isMongoDuplicateKeyError(error)) {
      throw new AppError(
        409,
        "A pending Job Invitation already exists for this Candidate and Job",
        { field: "jobId" },
      );
    }

    throw error;
  }
};

const listOwnJobInvitations = async ({
  candidateUser,
  now = new Date(),
} = {}) => {
  assertCandidateInvitationActor(candidateUser);

  const invitations = await JobInvitation.find({
    candidateUserId: candidateUser._id,
  }).sort({ createdAt: -1, _id: -1 });

  return {
    invitations: await hydrateCandidateJobInvitationViews(invitations, { now }),
  };
};

const loadOwnJobInvitationForCandidate = async ({
  candidateUser,
  invitationId,
  session = null,
}) => {
  if (!mongoose.isValidObjectId(invitationId)) {
    throw new AppError(404, "Job Invitation not found", {
      field: "invitationId",
    });
  }

  const query = JobInvitation.findOne({
    _id: invitationId,
    candidateUserId: candidateUser._id,
  });

  if (session) {
    query.session(session);
  }

  const invitation = await query;

  if (!invitation) {
    throw new AppError(404, "Job Invitation not found", {
      field: "invitationId",
    });
  }

  return invitation;
};

const getOwnJobInvitation = async ({
  candidateUser,
  invitationId,
  now = new Date(),
} = {}) => {
  assertCandidateInvitationActor(candidateUser);

  const invitation = await loadOwnJobInvitationForCandidate({
    candidateUser,
    invitationId,
  });

  const [view] = await hydrateCandidateJobInvitationViews([invitation], {
    now,
  });

  return {
    invitation: view,
  };
};

const rejectOwnJobInvitation = async ({
  candidateUser,
  invitationId,
  now = new Date(),
} = {}) => {
  assertCandidateInvitationActor(candidateUser);

  const ownedInvitation = await loadOwnJobInvitationForCandidate({
    candidateUser,
    invitationId,
  });

  const session = await mongoose.startSession();
  let rejectedInvitation;
  let notificationEvent;

  try {
    await session.withTransaction(async () => {
      rejectedInvitation = null;
      notificationEvent = null;

      await acquireCandidateJobSerialization({
        candidateUserId: ownedInvitation.candidateUserId,
        jobId: ownedInvitation.jobId,
        session,
      });

      const invitation = await loadOwnJobInvitationForCandidate({
        candidateUser,
        invitationId: ownedInvitation._id,
        session,
      });

      if (invitation.status !== JOB_INVITATION_STATUS.PENDING) {
        throw new AppError(409, "Job Invitation is no longer actionable", {
          field: "invitationId",
        });
      }

      const resources = await loadJobInvitationCurrentStateResources(
        [invitation],
        { session },
      );
      const invitationResources = resourcesForInvitation(invitation, resources);
      const evaluation = evaluateJobInvitationCurrentStateFromResources({
        invitation,
        resources,
        now,
      });

      if (!evaluation.isActionable) {
        throw new AppError(409, "Job Invitation is no longer actionable", {
          field: "invitationId",
        });
      }

      if (
        invitationResources.senderUser == null ||
        invitationResources.job == null
      ) {
        throw new AppError(409, "Job Invitation is no longer actionable", {
          field: "invitationId",
        });
      }

      rejectedInvitation = await JobInvitation.findOneAndUpdate(
        {
          _id: invitation._id,
          candidateUserId: candidateUser._id,
          status: JOB_INVITATION_STATUS.PENDING,
        },
        {
          $set: {
            status: JOB_INVITATION_STATUS.REJECTED,
            rejectedAt: now,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!rejectedInvitation) {
        throw new AppError(409, "Job Invitation is no longer actionable", {
          field: "invitationId",
        });
      }

      ({ event: notificationEvent } = await createNotificationEvent({
        eventKey: `job-invitation-rejected:${rejectedInvitation._id.toString()}`,
        type: NOTIFICATION_TYPE.JOB_INVITATION_REJECTED,
        actorUserId: candidateUser._id,
        jobInvitationId: rejectedInvitation._id,
        recipients: [
          {
            recipientUserId: invitationResources.senderUser._id,
            content: `A candidate rejected the job invitation for ${invitationResources.job.title}.`,
          },
        ],
        session,
      }));
    });
  } finally {
    await session.endSession();
  }

  try {
    await materializeNotificationEvent({ eventId: notificationEvent._id });
  } catch {
    // The persisted event obligation remains pending for canonical recovery.
  }

  const [view] = await hydrateCandidateJobInvitationViews([rejectedInvitation], {
    now,
  });

  return {
    invitation: view,
  };
};

const acceptOwnJobInvitation = async ({
  candidateUser,
  invitationId,
  now = new Date(),
} = {}) => {
  assertCandidateInvitationActor(candidateUser);

  const ownedInvitation = await loadOwnJobInvitationForCandidate({
    candidateUser,
    invitationId,
  });

  const session = await mongoose.startSession();
  let acceptedInvitation;
  let createdApplication;
  const notificationEvents = [];

  try {
    await session.withTransaction(async () => {
      acceptedInvitation = null;
      createdApplication = null;
      notificationEvents.length = 0;

      await acquireCandidateJobSerialization({
        candidateUserId: ownedInvitation.candidateUserId,
        jobId: ownedInvitation.jobId,
        session,
      });

      const invitation = await loadOwnJobInvitationForCandidate({
        candidateUser,
        invitationId: ownedInvitation._id,
        session,
      });

      if (invitation.status !== JOB_INVITATION_STATUS.PENDING) {
        throw new AppError(409, "Job Invitation is no longer actionable", {
          field: "invitationId",
        });
      }

      const resources = await loadJobInvitationCurrentStateResources(
        [invitation],
        { session },
      );
      const invitationResources = resourcesForInvitation(invitation, resources);
      const evaluation = evaluateJobInvitationCurrentStateFromResources({
        invitation,
        resources,
        now,
      });

      if (!evaluation.isActionable) {
        throw new AppError(409, "Job Invitation is no longer actionable", {
          field: "invitationId",
        });
      }

      if (
        invitationResources.senderUser == null ||
        invitationResources.job == null
      ) {
        throw new AppError(409, "Job Invitation is no longer actionable", {
          field: "invitationId",
        });
      }

      const existingApplication = await findApplicationForCandidateJob({
        candidateUserId: invitation.candidateUserId,
        jobId: invitation.jobId,
        session,
      });

      if (existingApplication) {
        throw new AppError(409, APPLICATION_EXISTS_MESSAGE, {
          field: "jobId",
        });
      }

      acceptedInvitation = await JobInvitation.findOneAndUpdate(
        {
          _id: invitation._id,
          candidateUserId: candidateUser._id,
          status: JOB_INVITATION_STATUS.PENDING,
        },
        {
          $set: {
            status: JOB_INVITATION_STATUS.ACCEPTED,
            acceptedAt: now,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!acceptedInvitation) {
        throw new AppError(409, "Job Invitation is no longer actionable", {
          field: "invitationId",
        });
      }

      const { createInvitationSourceApplicationOnAccept } = await import(
        "./application.service.js"
      );
      const applicationOutcome = await createInvitationSourceApplicationOnAccept({
        invitation: acceptedInvitation,
        job: invitationResources.job,
        session,
      });
      createdApplication = applicationOutcome.application;
      notificationEvents.push(applicationOutcome.availabilityNotificationEvent);

      const jobTitle = invitationResources.job.title;
      const senderUserId = invitationResources.senderUser._id;

      const { event: acceptedEvent } = await createNotificationEvent({
        eventKey: `job-invitation-accepted:${acceptedInvitation._id.toString()}`,
        type: NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED,
        actorUserId: candidateUser._id,
        jobInvitationId: acceptedInvitation._id,
        recipients: [
          {
            recipientUserId: senderUserId,
            content: `A candidate accepted the job invitation for ${jobTitle}.`,
          },
        ],
        session,
      });
      notificationEvents.push(acceptedEvent);

      const { event: invitedApplicationEvent } = await createNotificationEvent({
        eventKey: `invited-application-created:${createdApplication._id.toString()}`,
        type: NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED,
        actorUserId: candidateUser._id,
        jobInvitationId: acceptedInvitation._id,
        applicationId: createdApplication._id,
        recipients: [
          {
            recipientUserId: senderUserId,
            content: `An invited application for ${jobTitle} was created.`,
          },
        ],
        session,
      });
      notificationEvents.push(invitedApplicationEvent);
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

  const [view] = await hydrateCandidateJobInvitationViews([acceptedInvitation], {
    now,
  });

  return {
    invitation: view,
    applicationId: createdApplication._id,
  };
};

const assertRecruiterInvitationActor = (user) => {
  if (!user || user.role !== USER_ROLE.COMPANY_STAFF) {
    throw new AppError(403, "Recruiter access required");
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, "Recruiter account is not active");
  }
};

const assertCurrentPrimaryOfJob = ({ job, recruiterCompanyMemberId }) => {
  if (
    job?.primaryRecruiterCompanyMemberId?.toString() !==
    recruiterCompanyMemberId?.toString()
  ) {
    throw new AppError(
      403,
      "Only the current Primary Recruiter can manage Job Invitations",
      { field: "jobId" },
    );
  }
};

const loadCurrentPrimaryManagedJob = async ({
  recruiterUser,
  clientCompanyId,
  jobId,
  session = null,
}) => {
  assertRecruiterInvitationActor(recruiterUser);

  const context = await resolveRecruiterBusinessContext({
    user: recruiterUser,
    clientCompanyId,
    session,
  });

  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(404, "Job not found", { field: "jobId" });
  }

  const query = Job.findById(jobId);
  if (session) {
    query.session(session);
  }

  const job = await query;

  if (!job || job.companyId.toString() !== context.companyId.toString()) {
    throw new AppError(404, "Job not found", { field: "jobId" });
  }

  assertCurrentPrimaryOfJob({
    job,
    recruiterCompanyMemberId: context.membership._id,
  });

  return { context, job };
};

const loadJobInvitationForManagedJob = async ({
  jobId,
  invitationId,
  session = null,
}) => {
  if (!mongoose.isValidObjectId(invitationId)) {
    throw new AppError(404, "Job Invitation not found", {
      field: "invitationId",
    });
  }

  const query = JobInvitation.findOne({
    _id: invitationId,
    jobId,
  });

  if (session) {
    query.session(session);
  }

  const invitation = await query;

  if (!invitation) {
    throw new AppError(404, "Job Invitation not found", {
      field: "invitationId",
    });
  }

  return invitation;
};

const listPrimaryJobInvitations = async ({
  recruiterUser,
  clientCompanyId,
  jobId,
  now = new Date(),
} = {}) => {
  const { job } = await loadCurrentPrimaryManagedJob({
    recruiterUser,
    clientCompanyId,
    jobId,
  });

  const invitations = await JobInvitation.find({
    jobId: job._id,
  }).sort({ createdAt: -1, _id: -1 });

  return {
    invitations: await hydratePrimaryJobInvitationViews(invitations, { now }),
  };
};

const getPrimaryJobInvitation = async ({
  recruiterUser,
  clientCompanyId,
  jobId,
  invitationId,
  now = new Date(),
} = {}) => {
  const { job } = await loadCurrentPrimaryManagedJob({
    recruiterUser,
    clientCompanyId,
    jobId,
  });

  const invitation = await loadJobInvitationForManagedJob({
    jobId: job._id,
    invitationId,
  });

  const [view] = await hydratePrimaryJobInvitationViews([invitation], {
    now,
  });

  return {
    invitation: view,
  };
};

const revokePrimaryJobInvitation = async ({
  recruiterUser,
  clientCompanyId,
  jobId,
  invitationId,
  now = new Date(),
} = {}) => {
  const { context, job } = await loadCurrentPrimaryManagedJob({
    recruiterUser,
    clientCompanyId,
    jobId,
  });

  const managedInvitation = await loadJobInvitationForManagedJob({
    jobId: job._id,
    invitationId,
  });

  const session = await mongoose.startSession();
  let revokedInvitation;
  let notificationEvent;

  try {
    await session.withTransaction(async () => {
      revokedInvitation = null;
      notificationEvent = null;

      const operationalCompany =
        await acquireOperationalCompanyForAssigneeEligibilityTx({
          companyId: context.companyId,
          session,
        });

      if (!operationalCompany) {
        throw new AppError(409, "Company is not operational", {
          field: "companyId",
        });
      }

      const membership =
        await acquireActiveRecruiterMembershipForTeamResponsibilityTx({
          recruiterCompanyMemberId: context.membership._id,
          companyId: context.companyId,
          session,
        });

      if (!membership) {
        throw new AppError(
          403,
          "Only the current Primary Recruiter can manage Job Invitations",
          { field: "jobId" },
        );
      }

      const actorUser = await acquireActiveUserForAssigneeEligibilityTx({
        userId: recruiterUser._id,
        session,
      });

      if (!actorUser) {
        throw new AppError(403, "Recruiter account is not active");
      }

      const { job: currentJob } = await acquireCandidateJobSerialization({
        candidateUserId: managedInvitation.candidateUserId,
        jobId: managedInvitation.jobId,
        session,
      });

      if (currentJob.companyId.toString() !== context.companyId.toString()) {
        throw new AppError(404, "Job not found", { field: "jobId" });
      }

      assertCurrentPrimaryOfJob({
        job: currentJob,
        recruiterCompanyMemberId: membership._id,
      });

      const invitation = await loadJobInvitationForManagedJob({
        jobId: currentJob._id,
        invitationId: managedInvitation._id,
        session,
      });

      if (invitation.status !== JOB_INVITATION_STATUS.PENDING) {
        throw new AppError(409, "Job Invitation is no longer actionable", {
          field: "invitationId",
        });
      }

      const resources = await loadJobInvitationCurrentStateResources(
        [invitation],
        { session },
      );
      const invitationResources = resourcesForInvitation(invitation, resources);
      const evaluation = evaluateJobInvitationCurrentStateFromResources({
        invitation,
        resources,
        now,
      });

      if (!evaluation.isActionable) {
        throw new AppError(409, "Job Invitation is no longer actionable", {
          field: "invitationId",
        });
      }

      if (
        invitationResources.candidateUser == null ||
        invitationResources.job == null
      ) {
        throw new AppError(409, "Job Invitation is no longer actionable", {
          field: "invitationId",
        });
      }

      revokedInvitation = await JobInvitation.findOneAndUpdate(
        {
          _id: invitation._id,
          jobId: currentJob._id,
          status: JOB_INVITATION_STATUS.PENDING,
        },
        {
          $set: {
            status: JOB_INVITATION_STATUS.REVOKED,
            revokedAt: now,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!revokedInvitation) {
        throw new AppError(409, "Job Invitation is no longer actionable", {
          field: "invitationId",
        });
      }

      ({ event: notificationEvent } = await createNotificationEvent({
        eventKey: `job-invitation-revoked:${revokedInvitation._id.toString()}`,
        type: NOTIFICATION_TYPE.JOB_INVITATION_REVOKED,
        actorUserId: actorUser._id,
        jobInvitationId: revokedInvitation._id,
        recipients: [
          {
            recipientUserId: invitationResources.candidateUser._id,
            content: `Your job invitation for ${invitationResources.job.title} was revoked.`,
          },
        ],
        session,
      }));
    });
  } finally {
    await session.endSession();
  }

  try {
    await materializeNotificationEvent({ eventId: notificationEvent._id });
  } catch {
    // The persisted event obligation remains pending for canonical recovery.
  }

  const [view] = await hydratePrimaryJobInvitationViews([revokedInvitation], {
    now,
  });

  return {
    invitation: view,
  };
};

export {
  acceptOwnJobInvitation,
  deriveInvitationExpiresAt,
  getOwnJobInvitation,
  getPrimaryJobInvitation,
  listOwnJobInvitations,
  listPrimaryJobInvitations,
  materializeDueExpiredJobInvitations,
  materializeJobInvitationIfDue,
  materializePendingJobInvitations,
  materializePendingJobInvitationsBestEffort,
  materializePendingJobInvitationsForCompany,
  materializePendingJobInvitationsForUser,
  materializeStalePendingInvitationForCandidateJob,
  rejectOwnJobInvitation,
  revokePrimaryJobInvitation,
  sendJobInvitation,
  toPublicJobInvitation,
};
