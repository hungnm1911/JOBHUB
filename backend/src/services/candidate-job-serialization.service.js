import JOB_INVITATION_STATUS from "../constants/job-invitation-status.js";
import Application from "../models/application.model.js";
import Job from "../models/job.model.js";
import JobInvitation from "../models/job-invitation.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/app-error.js";

const APPLICATION_EXISTS_MESSAGE =
  "Application already exists for this Candidate and Job";
const PENDING_INVITATION_EXISTS_MESSAGE =
  "A pending Job Invitation already exists for this Candidate and Job";
const REJECTED_INVITATION_EXISTS_MESSAGE =
  "A rejected Job Invitation already exists for this Candidate and Job";

const acquireDocumentById = async ({ model, id, session }) => {
  const before = await model
    .findById(id)
    .select("updatedAt")
    .session(session)
    .lean();

  if (!before) {
    return null;
  }

  const acquired = await model.findOneAndUpdate(
    { _id: id },
    {
      $set: {
        updatedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
      session,
    },
  );

  if (acquired && before.updatedAt) {
    await model.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          updatedAt: before.updatedAt,
        },
      },
      {
        session,
        timestamps: false,
      },
    );
  }

  return acquired;
};

const acquireCandidateJobSerialization = async ({
  candidateUserId,
  jobId,
  session,
} = {}) => {
  const job = await acquireDocumentById({
    model: Job,
    id: jobId,
    session,
  });

  if (!job) {
    throw new AppError(404, "Job not found", { field: "jobId" });
  }

  const candidateUser = await acquireDocumentById({
    model: User,
    id: candidateUserId,
    session,
  });

  if (!candidateUser) {
    throw new AppError(404, "Candidate not found", {
      field: "candidateUserId",
    });
  }

  return { job, candidateUser };
};

const findApplicationForCandidateJob = async ({
  candidateUserId,
  jobId,
  session = null,
} = {}) => {
  const query = Application.findOne({
    candidateUserId,
    jobId,
  }).select("_id");

  if (session) {
    query.session(session);
  }

  return query;
};

const findPendingInvitationForCandidateJob = async ({
  candidateUserId,
  jobId,
  session = null,
} = {}) => {
  const query = JobInvitation.findOne({
    candidateUserId,
    jobId,
    status: JOB_INVITATION_STATUS.PENDING,
  }).select("_id");

  if (session) {
    query.session(session);
  }

  return query;
};

const findRejectedInvitationForCandidateJob = async ({
  candidateUserId,
  jobId,
  session = null,
} = {}) => {
  const query = JobInvitation.findOne({
    candidateUserId,
    jobId,
    status: JOB_INVITATION_STATUS.REJECTED,
  }).select("_id");

  if (session) {
    query.session(session);
  }

  return query;
};

const assertCandidateJobAllowsDirectApply = async ({
  candidateUserId,
  jobId,
  session = null,
} = {}) => {
  const existingApplication = await findApplicationForCandidateJob({
    candidateUserId,
    jobId,
    session,
  });

  if (existingApplication) {
    throw new AppError(409, APPLICATION_EXISTS_MESSAGE, {
      field: "jobId",
    });
  }

  const pendingInvitation = await findPendingInvitationForCandidateJob({
    candidateUserId,
    jobId,
    session,
  });

  if (pendingInvitation) {
    throw new AppError(409, PENDING_INVITATION_EXISTS_MESSAGE, {
      field: "jobId",
    });
  }
};

const assertCandidateJobAllowsSendInvitation = async ({
  candidateUserId,
  jobId,
  session = null,
} = {}) => {
  await assertCandidateJobAllowsDirectApply({
    candidateUserId,
    jobId,
    session,
  });

  const rejectedInvitation = await findRejectedInvitationForCandidateJob({
    candidateUserId,
    jobId,
    session,
  });

  if (rejectedInvitation) {
    throw new AppError(409, REJECTED_INVITATION_EXISTS_MESSAGE, {
      field: "jobId",
    });
  }
};

export {
  APPLICATION_EXISTS_MESSAGE,
  PENDING_INVITATION_EXISTS_MESSAGE,
  REJECTED_INVITATION_EXISTS_MESSAGE,
  acquireCandidateJobSerialization,
  assertCandidateJobAllowsDirectApply,
  assertCandidateJobAllowsSendInvitation,
  findApplicationForCandidateJob,
  findPendingInvitationForCandidateJob,
  findRejectedInvitationForCandidateJob,
};
