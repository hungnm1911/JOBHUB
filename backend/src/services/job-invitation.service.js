import mongoose from "mongoose";

import JOB_INVITATION_EXPIRATION from "../constants/job-invitation-expiration.js";
import JOB_INVITATION_STATUS from "../constants/job-invitation-status.js";
import NOTIFICATION_TYPE from "../constants/notification-type.js";
import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import Job from "../models/job.model.js";
import JobInvitation from "../models/job-invitation.model.js";
import AppError from "../utils/app-error.js";
import { loadCurrentSearchEligibleCandidateCvById } from "./candidate-cv.service.js";
import {
  acquireCandidateJobSerialization,
  assertCandidateJobAllowsSendInvitation,
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

const isRecruiterOnJobTeam = ({ job, recruiterCompanyMemberId }) => {
  const memberId = recruiterCompanyMemberId.toString();

  if (job.primaryRecruiterCompanyMemberId?.toString() === memberId) {
    return true;
  }

  return (job.supportingRecruiterCompanyMemberIds ?? []).some(
    (id) => id.toString() === memberId,
  );
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
  let notificationEvent;

  try {
    try {
      await session.withTransaction(async () => {
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

        await assertCandidateJobAllowsSendInvitation({
          candidateUserId: candidateUser._id,
          jobId: currentJob._id,
          session,
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

        ({ event: notificationEvent } = await createNotificationEvent({
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

export { deriveInvitationExpiresAt, sendJobInvitation, toPublicJobInvitation };
