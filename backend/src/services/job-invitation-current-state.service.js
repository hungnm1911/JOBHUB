import JOB_INVITATION_INVALIDATION_REASON from "../constants/job-invitation-invalidation-reason.js";
import JOB_INVITATION_STATUS from "../constants/job-invitation-status.js";
import JOB_STATUS from "../constants/job-status.js";
import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../constants/company-member-status.js";
import USER_STATUS from "../constants/user-status.js";
import CandidateCV from "../models/candidate-cv.model.js";
import Company from "../models/company.model.js";
import CompanyMember from "../models/company-member.model.js";
import Job from "../models/job.model.js";
import {
  TERMINAL_JOB_INVITATION_STATUSES,
} from "../models/job-invitation.model.js";
import User from "../models/user.model.js";
import {
  getJobApplicationDeadline,
  isOwningCompanyActiveForPublicEligibility,
  resolveEffectiveJobStatus,
} from "./job.service.js";

const EXPIRATION_CAUSE_SOURCE = Object.freeze({
  INVITATION_CUTOFF: "INVITATION_CUTOFF",
  JOB_DEADLINE: "JOB_DEADLINE",
  JOB_CLOSED: "JOB_CLOSED",
  JOB_EXPIRED: "JOB_EXPIRED",
});

const INVALIDATION_REASON_ORDER = Object.freeze(
  Object.values(JOB_INVITATION_INVALIDATION_REASON),
);

const BRANCH_SORT_RANK = Object.freeze({
  [JOB_INVITATION_STATUS.EXPIRED]: 0,
  [JOB_INVITATION_STATUS.INVALIDATED]: 1,
});

const toDate = (value) => {
  if (value == null) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const hasOccurredByTime = (causeAt, now) => {
  const occurredAt = toDate(causeAt);
  if (occurredAt == null) {
    return false;
  }

  return occurredAt.getTime() <= now.getTime();
};

const isRecruiterOnJobTeam = ({ job, recruiterCompanyMemberId }) => {
  if (job == null || recruiterCompanyMemberId == null) {
    return false;
  }

  const memberId = recruiterCompanyMemberId.toString();

  if (job.primaryRecruiterCompanyMemberId?.toString() === memberId) {
    return true;
  }

  return (job.supportingRecruiterCompanyMemberIds ?? []).some(
    (id) => id.toString() === memberId,
  );
};

const isActiveRecruiterMembershipForJobCompany = ({ membership, job }) => {
  if (membership == null || job == null) {
    return false;
  }

  return (
    membership.role === COMPANY_MEMBER_ROLE.RECRUITER &&
    membership.status === COMPANY_MEMBER_STATUS.ACTIVE &&
    membership.companyId?.toString() === job.companyId?.toString()
  );
};

const collectExpirationCauses = ({ invitation, job, now }) => {
  const causes = [];
  const expiresAt = toDate(invitation.expiresAt);

  if (hasOccurredByTime(expiresAt, now)) {
    causes.push({
      branch: JOB_INVITATION_STATUS.EXPIRED,
      causeAt: expiresAt,
      reason: null,
      source: EXPIRATION_CAUSE_SOURCE.INVITATION_CUTOFF,
    });
  }

  if (job == null) {
    return causes;
  }

  const deadline = getJobApplicationDeadline(job);
  if (hasOccurredByTime(deadline, now)) {
    causes.push({
      branch: JOB_INVITATION_STATUS.EXPIRED,
      causeAt: deadline,
      reason: null,
      source: EXPIRATION_CAUSE_SOURCE.JOB_DEADLINE,
    });
  }

  const effectiveJobStatus = resolveEffectiveJobStatus(job, now);

  if (
    job.status === JOB_STATUS.CLOSED ||
    effectiveJobStatus === JOB_STATUS.CLOSED
  ) {
    causes.push({
      branch: JOB_INVITATION_STATUS.EXPIRED,
      causeAt: toDate(job.updatedAt),
      reason: null,
      source: EXPIRATION_CAUSE_SOURCE.JOB_CLOSED,
    });
  }

  if (
    job.status === JOB_STATUS.EXPIRED ||
    effectiveJobStatus === JOB_STATUS.EXPIRED
  ) {
    causes.push({
      branch: JOB_INVITATION_STATUS.EXPIRED,
      causeAt: deadline ?? toDate(job.updatedAt),
      reason: null,
      source: EXPIRATION_CAUSE_SOURCE.JOB_EXPIRED,
    });
  }

  return causes;
};

const collectInvalidationCauses = ({
  job,
  company,
  candidateUser,
  invitedCv,
  senderMembership,
  senderUser,
}) => {
  const causes = [];

  if (candidateUser == null || candidateUser.status !== USER_STATUS.ACTIVE) {
    causes.push({
      branch: JOB_INVITATION_STATUS.INVALIDATED,
      causeAt: toDate(candidateUser?.updatedAt),
      reason: JOB_INVITATION_INVALIDATION_REASON.CANDIDATE_NOT_ACTIVE,
      source: JOB_INVITATION_INVALIDATION_REASON.CANDIDATE_NOT_ACTIVE,
    });
  }

  if (candidateUser == null || candidateUser.emailVerifiedAt == null) {
    causes.push({
      branch: JOB_INVITATION_STATUS.INVALIDATED,
      causeAt: toDate(candidateUser?.updatedAt),
      reason: JOB_INVITATION_INVALIDATION_REASON.CANDIDATE_EMAIL_UNVERIFIED,
      source: JOB_INVITATION_INVALIDATION_REASON.CANDIDATE_EMAIL_UNVERIFIED,
    });
  }

  if (invitedCv == null || invitedCv.archivedAt != null) {
    causes.push({
      branch: JOB_INVITATION_STATUS.INVALIDATED,
      causeAt: toDate(invitedCv?.archivedAt) ?? toDate(invitedCv?.updatedAt),
      reason: JOB_INVITATION_INVALIDATION_REASON.INVITED_CV_ARCHIVED,
      source: JOB_INVITATION_INVALIDATION_REASON.INVITED_CV_ARCHIVED,
    });
  }

  const companyBelongsToJob =
    job != null &&
    company != null &&
    company._id.toString() === job.companyId.toString();

  if (
    !companyBelongsToJob ||
    !isOwningCompanyActiveForPublicEligibility(company)
  ) {
    causes.push({
      branch: JOB_INVITATION_STATUS.INVALIDATED,
      causeAt: toDate(company?.updatedAt),
      reason: JOB_INVITATION_INVALIDATION_REASON.COMPANY_NOT_OPERATIONAL,
      source: JOB_INVITATION_INVALIDATION_REASON.COMPANY_NOT_OPERATIONAL,
    });
  }

  if (senderUser == null || senderUser.status !== USER_STATUS.ACTIVE) {
    causes.push({
      branch: JOB_INVITATION_STATUS.INVALIDATED,
      causeAt: toDate(senderUser?.updatedAt),
      reason: JOB_INVITATION_INVALIDATION_REASON.SENDER_NOT_ACTIVE,
      source: JOB_INVITATION_INVALIDATION_REASON.SENDER_NOT_ACTIVE,
    });
  }

  if (!isActiveRecruiterMembershipForJobCompany({ membership: senderMembership, job })) {
    causes.push({
      branch: JOB_INVITATION_STATUS.INVALIDATED,
      causeAt: toDate(senderMembership?.updatedAt),
      reason:
        JOB_INVITATION_INVALIDATION_REASON.SENDER_COMPANY_MEMBERSHIP_INVALID,
      source: JOB_INVITATION_INVALIDATION_REASON.SENDER_COMPANY_MEMBERSHIP_INVALID,
    });
  }

  if (
    !isRecruiterOnJobTeam({
      job,
      recruiterCompanyMemberId: senderMembership?._id,
    })
  ) {
    causes.push({
      branch: JOB_INVITATION_STATUS.INVALIDATED,
      causeAt: toDate(job?.updatedAt),
      reason: JOB_INVITATION_INVALIDATION_REASON.SENDER_REMOVED_FROM_JOB_TEAM,
      source: JOB_INVITATION_INVALIDATION_REASON.SENDER_REMOVED_FROM_JOB_TEAM,
    });
  }

  return causes;
};

const compareCurrentStateCauses = (left, right) => {
  const leftTime =
    left.causeAt == null ? Number.POSITIVE_INFINITY : left.causeAt.getTime();
  const rightTime =
    right.causeAt == null ? Number.POSITIVE_INFINITY : right.causeAt.getTime();

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  const branchDiff =
    (BRANCH_SORT_RANK[left.branch] ?? 99) -
    (BRANCH_SORT_RANK[right.branch] ?? 99);
  if (branchDiff !== 0) {
    return branchDiff;
  }

  return (
    INVALIDATION_REASON_ORDER.indexOf(left.reason) -
    INVALIDATION_REASON_ORDER.indexOf(right.reason)
  );
};

const buildActionability = ({ persistedStatus, currentStatus, winningCause }) => {
  const isActionable = currentStatus === JOB_INVITATION_STATUS.PENDING;

  return {
    persistedStatus,
    currentStatus,
    isActionable,
    canAccept: isActionable,
    canReject: isActionable,
    winningCause,
  };
};

const evaluateJobInvitationCurrentState = ({
  invitation,
  job = null,
  company = null,
  candidateUser = null,
  invitedCv = null,
  senderMembership = null,
  senderUser = null,
  now = new Date(),
} = {}) => {
  const persistedStatus = invitation.status;

  if (TERMINAL_JOB_INVITATION_STATUSES.includes(persistedStatus)) {
    return buildActionability({
      persistedStatus,
      currentStatus: persistedStatus,
      winningCause: null,
    });
  }

  const causes = [
    ...collectExpirationCauses({ invitation, job, now }),
    ...collectInvalidationCauses({
      job,
      company,
      candidateUser,
      invitedCv,
      senderMembership,
      senderUser,
    }),
  ].sort(compareCurrentStateCauses);

  const winningCause = causes[0] ?? null;
  const currentStatus = winningCause?.branch ?? JOB_INVITATION_STATUS.PENDING;

  return buildActionability({
    persistedStatus,
    currentStatus,
    winningCause,
  });
};

const uniqueObjectIds = (values) => {
  const seen = new Set();
  const ids = [];

  for (const value of values) {
    if (value == null) {
      continue;
    }

    const key = value.toString();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    ids.push(value);
  }

  return ids;
};

const findByIds = async (model, ids, { session } = {}) => {
  if (ids.length === 0) {
    return [];
  }

  const query = model.find({ _id: { $in: ids } });
  if (session) {
    query.session(session);
  }

  return query;
};

const indexById = (documents) => {
  return new Map(documents.map((document) => [document._id.toString(), document]));
};

const loadJobInvitationCurrentStateResources = async (
  invitations,
  { session } = {},
) => {
  const jobIds = uniqueObjectIds(invitations.map((invitation) => invitation.jobId));
  const candidateUserIds = uniqueObjectIds(
    invitations.map((invitation) => invitation.candidateUserId),
  );
  const invitedCvIds = uniqueObjectIds(
    invitations.map((invitation) => invitation.invitedCvId),
  );
  const senderMembershipIds = uniqueObjectIds(
    invitations.map((invitation) => invitation.sentByRecruiterCompanyMemberId),
  );

  const [jobs, candidateUsers, invitedCvs, senderMemberships] = await Promise.all([
    findByIds(Job, jobIds, { session }),
    findByIds(User, candidateUserIds, { session }),
    findByIds(CandidateCV, invitedCvIds, { session }),
    findByIds(CompanyMember, senderMembershipIds, { session }),
  ]);

  const companyIds = uniqueObjectIds(jobs.map((job) => job.companyId));
  const senderUserIds = uniqueObjectIds(
    senderMemberships.map((membership) => membership.userId),
  );

  const [companies, senderUsers] = await Promise.all([
    findByIds(Company, companyIds, { session }),
    findByIds(User, senderUserIds, { session }),
  ]);

  return {
    jobById: indexById(jobs),
    companyById: indexById(companies),
    candidateUserById: indexById(candidateUsers),
    invitedCvById: indexById(invitedCvs),
    senderMembershipById: indexById(senderMemberships),
    senderUserById: indexById(senderUsers),
  };
};

const resourcesForInvitation = (invitation, resources) => {
  const job = resources.jobById.get(invitation.jobId.toString()) ?? null;
  const senderMembership =
    resources.senderMembershipById.get(
      invitation.sentByRecruiterCompanyMemberId.toString(),
    ) ?? null;

  return {
    job,
    company:
      job == null
        ? null
        : resources.companyById.get(job.companyId.toString()) ?? null,
    candidateUser:
      resources.candidateUserById.get(invitation.candidateUserId.toString()) ??
      null,
    invitedCv:
      resources.invitedCvById.get(invitation.invitedCvId.toString()) ?? null,
    senderMembership,
    senderUser:
      senderMembership == null
        ? null
        : resources.senderUserById.get(senderMembership.userId.toString()) ??
          null,
  };
};

const evaluateJobInvitationCurrentStateFromResources = ({
  invitation,
  resources,
  now = new Date(),
}) => {
  return evaluateJobInvitationCurrentState({
    invitation,
    ...resourcesForInvitation(invitation, resources),
    now,
  });
};

export {
  EXPIRATION_CAUSE_SOURCE,
  evaluateJobInvitationCurrentState,
  evaluateJobInvitationCurrentStateFromResources,
  isRecruiterOnJobTeam,
  loadJobInvitationCurrentStateResources,
  resourcesForInvitation,
};
