import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import Application from "../../src/models/application.model.js";
import CandidateAvailability from "../../src/models/candidate-availability.model.js";
import InterviewSchedule from "../../src/models/interview-schedule.model.js";
import Job from "../../src/models/job.model.js";
import {
  confirmCandidateInterviewProposal,
  createFirstInterviewProposal,
  createInterviewProposal,
  declineCandidateInterviewProposal,
  editCandidateAvailability,
  expireDueInterviewProposals,
  expireDueInterviewProposalsForApplication,
  getCandidateMyApplication,
  submitCandidateAvailabilityFirstTime,
} from "../../src/services/application.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const CAPTURED_AT = new Date("2026-08-14T00:00:00.000Z");
const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PROPOSAL_DATE = "2026-08-20";
const PROPOSAL_TIMEZONE = "America/Los_Angeles";
const EXPIRES_AT = new Date("2026-08-21T07:00:00.000Z");
const BEFORE_EXPIRY = new Date("2026-08-21T06:59:59.999Z");
const AT_EXPIRY = EXPIRES_AT;

const createJob = async ({ companyId, primaryMemberId }) =>
  Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: [],
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: FUTURE_DEADLINE(),
    title: "Expiration Job",
    jobDescription: "Build APIs",
    requiredSkills: ["Node.js"],
    salaryText: "1000-2000",
    fieldCategoryIds: [],
    positionCategoryIds: [],
    location: null,
    employmentType: null,
    workModes: [],
    experienceLevelId: null,
  });

const createApplication = async ({ candidateUserId, jobId, assigneeMemberId }) => {
  const application = await Application.create({
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot: {
      sourceCandidateCvId: new mongoose.Types.ObjectId(),
      name: "Submitted CV",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      pdfFile: {
        storageKey: "applications/v12-s06.pdf",
        originalFileName: "v12-s06.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: 100,
        pageCount: 1,
      },
      capturedAt: CAPTURED_AT,
    },
    appliedAt: CAPTURED_AT,
    assignedRecruiterCompanyMemberId: null,
    version: 0,
  });

  await Application.updateOne(
    { _id: application._id },
    {
      $set: {
        status: APPLICATION_STATUS.CONTACTED,
        assignedRecruiterCompanyMemberId: assigneeMemberId,
        version: 1,
      },
    },
  );

  return Application.findById(application._id);
};

const setup = async () => {
  const manager = await createActiveCompanyManagerContext({
    email: "v12.s06.manager@example.com",
    businessRegistrationNumber: "BRN-V12-S06",
  });
  const recruiter = await createActiveRecruiterContext({
    email: "v12.s06.recruiter@example.com",
    company: manager.company,
    employeeCode: "V12-S06-R",
  });
  const candidate = await createVerifiedUser({
    email: "v12.s06.candidate@example.com",
  });
  const job = await createJob({
    companyId: manager.company._id,
    primaryMemberId: recruiter.membership._id,
  });
  const application = await createApplication({
    candidateUserId: candidate.user._id,
    jobId: job._id,
    assigneeMemberId: recruiter.membership._id,
  });

  return { application, candidate, job, manager, recruiter };
};

const createProposedSchedule = async (
  context,
  { dayPart = "MORNING", proposalNow = new Date("2026-08-14T12:00:00.000Z") } = {},
) => {
  await submitCandidateAvailabilityFirstTime({
    candidateUserId: context.candidate.user._id,
    actorUser: context.candidate.user,
    applicationId: context.application._id,
    timezone: PROPOSAL_TIMEZONE,
    slots: [
      { date: PROPOSAL_DATE, dayPart: "MORNING" },
      { date: PROPOSAL_DATE, dayPart: "AFTERNOON" },
    ],
    now: proposalNow,
  });

  return createFirstInterviewProposal({
    actorUser: context.recruiter.user,
    jobId: context.job._id,
    applicationId: context.application._id,
    date: PROPOSAL_DATE,
    dayPart,
    expectedAvailabilityRevision: 0,
    now: proposalNow,
  });
};

describe("V12 Slice 06 — Automatic Interview Proposal Expiration", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  it("auto-cancels expired PROPOSED schedules at expiresAt without deleting them", async () => {
    const context = await setup();
    const proposal = await createProposedSchedule(context);

    expect(proposal.interviewSchedule.expiresAt.toISOString()).toBe(
      EXPIRES_AT.toISOString(),
    );

    const { modifiedCount } = await expireDueInterviewProposalsForApplication({
      applicationId: context.application._id,
      now: AT_EXPIRY,
    });

    expect(modifiedCount).toBe(1);
    const persisted = await InterviewSchedule.findById(proposal.interviewSchedule.id).lean();
    expect(persisted.status).toBe("CANCELLED");
    expect(await InterviewSchedule.countDocuments()).toBe(1);
  });

  it("does not cancel PROPOSED schedules before expiresAt", async () => {
    const context = await setup();
    const proposal = await createProposedSchedule(context);

    const { modifiedCount } = await expireDueInterviewProposalsForApplication({
      applicationId: context.application._id,
      now: BEFORE_EXPIRY,
    });

    expect(modifiedCount).toBe(0);
    expect(
      (await InterviewSchedule.findById(proposal.interviewSchedule.id).lean()).status,
    ).toBe("PROPOSED");
  });

  it("treats MORNING and AFTERNOON on the same date as valid through the full calendar day", async () => {
    const context = await setup();
    const morning = await createProposedSchedule(context, { dayPart: "MORNING" });
    await expireDueInterviewProposalsForApplication({
      applicationId: context.application._id,
      now: BEFORE_EXPIRY,
    });
    expect(
      (await InterviewSchedule.findById(morning.interviewSchedule.id).lean()).status,
    ).toBe("PROPOSED");

    await InterviewSchedule.deleteMany({ applicationId: context.application._id });
    // Keep Application.version monotonic. Reusing an earlier version after a
    // first-proposal NotificationEvent was committed makes the next first
    // proposal collide on eventKey inside a Mongo transaction and hang retries.
    await Application.updateOne(
      { _id: context.application._id },
      {
        $set: { status: APPLICATION_STATUS.CONTACTED },
        $inc: { version: 1 },
      },
    );
    await CandidateAvailability.deleteMany({ applicationId: context.application._id });

    const afternoon = await createProposedSchedule(context, {
      dayPart: "AFTERNOON",
    });
    expect(afternoon.interviewSchedule.expiresAt.toISOString()).toBe(
      EXPIRES_AT.toISOString(),
    );
    await expireDueInterviewProposalsForApplication({
      applicationId: context.application._id,
      now: AT_EXPIRY,
    });
    expect(
      (await InterviewSchedule.findById(afternoon.interviewSchedule.id).lean()).status,
    ).toBe("CANCELLED");
  });

  it("does not overwrite CONFIRMED schedules when expiration runs later", async () => {
    const context = await setup();
    const proposal = await createProposedSchedule(context);

    await confirmCandidateInterviewProposal({
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      interviewScheduleId: proposal.interviewSchedule.id,
      now: BEFORE_EXPIRY,
    });

    await expireDueInterviewProposalsForApplication({
      applicationId: context.application._id,
      now: AT_EXPIRY,
    });

    expect(
      (await InterviewSchedule.findById(proposal.interviewSchedule.id).lean()).status,
    ).toBe("CONFIRMED");
  });

  it("does not overwrite DECLINED or Recruiter-cancelled schedules", async () => {
    const declinedContext = await setup();
    const declinedProposal = await createProposedSchedule(declinedContext);
    await declineCandidateInterviewProposal({
      candidateUserId: declinedContext.candidate.user._id,
      actorUser: declinedContext.candidate.user,
      applicationId: declinedContext.application._id,
      interviewScheduleId: declinedProposal.interviewSchedule.id,
      now: BEFORE_EXPIRY,
    });

    await expireDueInterviewProposalsForApplication({
      applicationId: declinedContext.application._id,
      now: AT_EXPIRY,
    });
    expect(
      (await InterviewSchedule.findById(declinedProposal.interviewSchedule.id).lean())
        .status,
    ).toBe("DECLINED");

    await InterviewSchedule.updateOne(
      { _id: declinedProposal.interviewSchedule.id },
      { $set: { status: "CANCELLED" } },
    );
    await expireDueInterviewProposalsForApplication({
      applicationId: declinedContext.application._id,
      now: AT_EXPIRY,
    });
    expect(
      (await InterviewSchedule.findById(declinedProposal.interviewSchedule.id).lean())
        .status,
    ).toBe("CANCELLED");
  });

  it("lets expiration win before Candidate Confirm or Decline", async () => {
    const context = await setup();
    const proposal = await createProposedSchedule(context);
    const input = {
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      interviewScheduleId: proposal.interviewSchedule.id,
      now: AT_EXPIRY,
    };

    await expireDueInterviewProposalsForApplication({
      applicationId: context.application._id,
      now: AT_EXPIRY,
    });

    await expect(confirmCandidateInterviewProposal(input)).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(declineCandidateInterviewProposal(input)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(
      (await InterviewSchedule.findById(proposal.interviewSchedule.id).lean()).status,
    ).toBe("CANCELLED");
  });

  it("lets Candidate Confirm win before expiration and keeps stale expiration from overwriting it", async () => {
    const context = await setup();
    const proposal = await createProposedSchedule(context);

    await confirmCandidateInterviewProposal({
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      interviewScheduleId: proposal.interviewSchedule.id,
      now: BEFORE_EXPIRY,
    });

    await expireDueInterviewProposalsForApplication({
      applicationId: context.application._id,
      now: AT_EXPIRY,
    });

    expect(
      (await InterviewSchedule.findById(proposal.interviewSchedule.id).lean()).status,
    ).toBe("CONFIRMED");
  });

  it("keeps Application INTERVIEW_SCHEDULED and Availability unchanged after auto-cancel", async () => {
    const context = await setup();
    const proposal = await createProposedSchedule(context);
    const availabilityBefore = await CandidateAvailability.findOne({
      applicationId: context.application._id,
    }).lean();

    await expireDueInterviewProposalsForApplication({
      applicationId: context.application._id,
      now: AT_EXPIRY,
    });

    const [application, availabilityAfter] = await Promise.all([
      Application.findById(context.application._id).lean(),
      CandidateAvailability.findOne({ applicationId: context.application._id }).lean(),
    ]);

    expect(application.status).toBe(APPLICATION_STATUS.INTERVIEW_SCHEDULED);
    expect(availabilityAfter).toMatchObject({
      timezone: availabilityBefore.timezone,
      slots: availabilityBefore.slots,
      revision: availabilityBefore.revision,
    });
    expect(
      (await InterviewSchedule.findById(proposal.interviewSchedule.id).lean()).status,
    ).toBe("CANCELLED");
  });

  it("does not create declined-slot exclusion after expiration cancellation", async () => {
    const context = await setup();
    const first = await createProposedSchedule(context);

    await expireDueInterviewProposalsForApplication({
      applicationId: context.application._id,
      now: AT_EXPIRY,
    });

    const declinedHistory = await InterviewSchedule.exists({
      applicationId: context.application._id,
      date: PROPOSAL_DATE,
      dayPart: "MORNING",
      status: "DECLINED",
    });
    expect(declinedHistory).toBeNull();

    await expect(
      createInterviewProposal({
        actorUser: context.recruiter.user,
        jobId: context.job._id,
        applicationId: context.application._id,
        date: PROPOSAL_DATE,
        dayPart: "MORNING",
        expectedAvailabilityRevision: 1,
        now: new Date("2026-08-22T12:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Selected slot is in the past",
    });

    const next = await createInterviewProposal({
      actorUser: context.recruiter.user,
      jobId: context.job._id,
      applicationId: context.application._id,
      date: PROPOSAL_DATE,
      dayPart: "AFTERNOON",
      expectedAvailabilityRevision: 1,
      now: new Date("2026-08-19T12:00:00.000Z"),
    });

    expect(next.interviewSchedule.status).toBe("PROPOSED");
    expect(next.interviewSchedule.id).not.toBe(first.interviewSchedule.id);
    expect(await InterviewSchedule.countDocuments({ applicationId: context.application._id })).toBe(
      2,
    );
  });

  it("is idempotent when expiration runs repeatedly", async () => {
    const context = await setup();
    const proposal = await createProposedSchedule(context);

    await expireDueInterviewProposals({ now: AT_EXPIRY });
    const afterFirst = await InterviewSchedule.findById(proposal.interviewSchedule.id).lean();

    await expireDueInterviewProposals({ now: AT_EXPIRY });
    const afterSecond = await InterviewSchedule.findById(proposal.interviewSchedule.id).lean();

    expect(afterFirst.status).toBe("CANCELLED");
    expect(afterSecond).toMatchObject({
      status: "CANCELLED",
      date: afterFirst.date,
      dayPart: afterFirst.dayPart,
      updatedAt: afterFirst.updatedAt,
    });
  });

  it("persists expiration during Application read hydration", async () => {
    const context = await setup();
    const proposal = await createProposedSchedule(context);

    const result = await getCandidateMyApplication({
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      now: AT_EXPIRY,
    });

    expect(result.application.interviewSchedules[0].status).toBe("CANCELLED");
    expect(
      (await InterviewSchedule.findById(proposal.interviewSchedule.id).lean()).status,
    ).toBe("CANCELLED");
  });

  it("unblocks Availability edit after expiration cancels the stale PROPOSED schedule", async () => {
    const context = await setup();
    await createProposedSchedule(context);

    const availability = await editCandidateAvailability({
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      timezone: PROPOSAL_TIMEZONE,
      slots: [{ date: "2026-08-22", dayPart: "AFTERNOON" }],
      expectedRevision: 1,
      now: AT_EXPIRY,
    });

    expect(availability.revision).toBe(2);
    expect(availability.slots).toEqual([
      { date: "2026-08-22", dayPart: "AFTERNOON" },
    ]);
  });
});
