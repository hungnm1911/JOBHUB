import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import INTERVIEW_SCHEDULE_STATUS from "../../src/constants/interview-schedule-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import Application from "../../src/models/application.model.js";
import CandidateAvailability from "../../src/models/candidate-availability.model.js";
import InterviewSchedule from "../../src/models/interview-schedule.model.js";
import Job from "../../src/models/job.model.js";
import {
  confirmCandidateInterviewProposal,
  createInterviewProposal,
  updateApplicationRecruitmentPipelineStatus,
} from "../../src/services/application.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  DEFAULT_PASSWORD,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const NOW = new Date("2026-08-14T12:00:00.000Z");
const FUTURE_EXPIRES_AT = new Date("2026-08-21T07:00:00.000Z");

const createJob = async ({ companyId, primaryMemberId }) =>
  Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: [],
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    title: "Terminal cancellation job",
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

const setup = async ({
  applicationStatus = APPLICATION_STATUS.INTERVIEW_SCHEDULED,
} = {}) => {
  const manager = await createActiveCompanyManagerContext({
    email: "v12.s07.manager@example.com",
    businessRegistrationNumber: "BRN-V12-S07",
  });
  const recruiter = await createActiveRecruiterContext({
    email: "v12.s07.recruiter@example.com",
    company: manager.company,
    employeeCode: "V12-S07-R",
  });
  const candidate = await createVerifiedUser({
    email: "v12.s07.candidate@example.com",
  });
  const job = await createJob({
    companyId: manager.company._id,
    primaryMemberId: recruiter.membership._id,
  });
  const application = await Application.create({
    candidateUserId: candidate.user._id,
    jobId: job._id,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    appliedAt: NOW,
    assignedRecruiterCompanyMemberId: null,
    submittedCvSnapshot: {
      sourceCandidateCvId: new mongoose.Types.ObjectId(),
      name: "Submitted CV",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      pdfFile: {
        storageKey: "applications/v12-s07.pdf",
        originalFileName: "v12-s07.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: 100,
        pageCount: 1,
      },
      capturedAt: NOW,
    },
    version: 0,
  });
  await Application.updateOne(
    { _id: application._id },
    {
      $set: {
        status: applicationStatus,
        assignedRecruiterCompanyMemberId: recruiter.membership._id,
        version: 1,
      },
    },
  );

  return {
    application: await Application.findById(application._id),
    candidate,
    job,
    recruiter,
  };
};

const createSchedule = async (
  context,
  { status = INTERVIEW_SCHEDULE_STATUS.PROPOSED, date = "2026-08-20" } = {},
) =>
  InterviewSchedule.create({
    applicationId: context.application._id,
    status,
    date,
    dayPart: "MORNING",
    timezone: "America/Los_Angeles",
    expiresAt: FUTURE_EXPIRES_AT,
    createdByUserId: context.recruiter.user._id,
    createdByCompanyMemberId: context.recruiter.membership._id,
  });

const rejectApplication = (
  context,
  {
    expectedStatus = APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    expectedVersion = 1,
    targetStatus = APPLICATION_STATUS.REJECTED,
  } = {},
) =>
  updateApplicationRecruitmentPipelineStatus({
    actorUser: context.recruiter.user,
    jobId: context.job._id,
    applicationId: context.application._id,
    targetStatus,
    expectedStatus,
    expectedVersion,
  });

describe("V12 Slice 07 — Terminal Application atomic Interview cancellation", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  it.each([
    [
      INTERVIEW_SCHEDULE_STATUS.PROPOSED,
      APPLICATION_STATUS.INTERVIEW_SCHEDULED,
      APPLICATION_STATUS.REJECTED,
    ],
    [
      INTERVIEW_SCHEDULE_STATUS.CONFIRMED,
      APPLICATION_STATUS.INTERVIEW_COMPLETED,
      APPLICATION_STATUS.HIRED,
    ],
  ])(
    "atomically cancels active %s for Application %s → %s",
    async (scheduleStatus, initialStatus, terminalStatus) => {
      const context = await setup({ applicationStatus: initialStatus });
      const schedule = await createSchedule(context, { status: scheduleStatus });

      const result = await rejectApplication(context, {
        expectedStatus: initialStatus,
        targetStatus: terminalStatus,
      });

      expect(result.application.status).toBe(terminalStatus);
      expect(
        (await InterviewSchedule.findById(schedule._id).lean()).status,
      ).toBe(INTERVIEW_SCHEDULE_STATUS.CANCELLED);
      expect(
        await InterviewSchedule.exists({
          applicationId: context.application._id,
          status: {
            $in: [
              INTERVIEW_SCHEDULE_STATUS.PROPOSED,
              INTERVIEW_SCHEDULE_STATUS.CONFIRMED,
            ],
          },
        }),
      ).toBeNull();
    },
  );

  it("keeps a terminal transition valid without an active Schedule", async () => {
    const context = await setup();

    await rejectApplication(context);

    expect((await Application.findById(context.application._id)).status).toBe(
      APPLICATION_STATUS.REJECTED,
    );
    expect(await InterviewSchedule.countDocuments()).toBe(0);
  });

  it("preserves historical terminal Schedules and Availability unchanged", async () => {
    const context = await setup();
    const [declined, cancelled] = await Promise.all([
      createSchedule(context, { status: INTERVIEW_SCHEDULE_STATUS.DECLINED }),
      createSchedule(context, { status: INTERVIEW_SCHEDULE_STATUS.CANCELLED, date: "2026-08-21" }),
    ]);
    const availability = await CandidateAvailability.create({
      applicationId: context.application._id,
      timezone: "America/Los_Angeles",
      slots: [{ date: "2026-08-20", dayPart: "MORNING" }],
      revision: 4,
    });

    await rejectApplication(context);

    expect((await InterviewSchedule.findById(declined._id).lean()).status).toBe(
      INTERVIEW_SCHEDULE_STATUS.DECLINED,
    );
    expect((await InterviewSchedule.findById(cancelled._id).lean()).status).toBe(
      INTERVIEW_SCHEDULE_STATUS.CANCELLED,
    );
    expect(await CandidateAvailability.findById(availability._id).lean()).toMatchObject({
      timezone: availability.timezone,
      slots: availability.toObject().slots,
      revision: availability.revision,
    });
  });

  it("cancels a Candidate-confirmed Schedule in the following terminal transaction", async () => {
    const context = await setup();
    const schedule = await createSchedule(context);

    await confirmCandidateInterviewProposal({
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      interviewScheduleId: schedule._id,
      now: NOW,
    });
    await rejectApplication(context);

    expect((await InterviewSchedule.findById(schedule._id).lean()).status).toBe(
      INTERVIEW_SCHEDULE_STATUS.CANCELLED,
    );
  });

  it("blocks stale Candidate responses after terminal cancellation wins", async () => {
    const context = await setup();
    const schedule = await createSchedule(context);

    await rejectApplication(context);

    await expect(
      confirmCandidateInterviewProposal({
        candidateUserId: context.candidate.user._id,
        actorUser: context.candidate.user,
        applicationId: context.application._id,
        interviewScheduleId: schedule._id,
        now: NOW,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await InterviewSchedule.findById(schedule._id).lean()).status).toBe(
      INTERVIEW_SCHEDULE_STATUS.CANCELLED,
    );
  });

  it("serializes terminal transition against concurrent reproposal creation", async () => {
    const context = await setup();
    await CandidateAvailability.create({
      applicationId: context.application._id,
      timezone: "America/Los_Angeles",
      slots: [{ date: "2026-08-20", dayPart: "MORNING" }],
      revision: 0,
    });

    const outcomes = await Promise.allSettled([
      rejectApplication(context),
      createInterviewProposal({
        actorUser: context.recruiter.user,
        jobId: context.job._id,
        applicationId: context.application._id,
        date: "2026-08-20",
        dayPart: "MORNING",
        expectedAvailabilityRevision: 0,
        now: NOW,
      }),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const afterRace = await Application.findById(context.application._id).lean();
    if (afterRace.status !== APPLICATION_STATUS.REJECTED) {
      await rejectApplication(context, {
        expectedVersion: afterRace.version,
      });
    }
    expect((await Application.findById(context.application._id).lean()).status).toBe(
      APPLICATION_STATUS.REJECTED,
    );
    expect(
      await InterviewSchedule.exists({
        applicationId: context.application._id,
        status: {
          $in: [
            INTERVIEW_SCHEDULE_STATUS.PROPOSED,
            INTERVIEW_SCHEDULE_STATUS.CONFIRMED,
          ],
        },
      }),
    ).toBeNull();
  });

  it("rolls back the terminal Application transition when coupled cancellation fails", async () => {
    const context = await setup();
    const schedule = await createSchedule(context);
    vi.spyOn(InterviewSchedule, "updateOne").mockImplementationOnce(() => ({
      session: () => {
        throw new Error("forced Schedule persistence failure");
      },
    }));

    await expect(rejectApplication(context)).rejects.toThrow("forced Schedule persistence failure");

    expect((await Application.findById(context.application._id).lean()).status).toBe(
      APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    );
    expect((await InterviewSchedule.findById(schedule._id).lean()).status).toBe(
      INTERVIEW_SCHEDULE_STATUS.PROPOSED,
    );
  });

  it("exposes the coupled terminal cancellation through the canonical pipeline HTTP endpoint", async () => {
    const context = await setup();
    const schedule = await createSchedule(context);
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: context.recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${context.job._id}/applications/${context.application._id}/pipeline`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        targetStatus: APPLICATION_STATUS.REJECTED,
        expectedStatus: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        expectedVersion: 1,
      });

    expect(response.status).toBe(200);
    expect(response.body.application.status).toBe(APPLICATION_STATUS.REJECTED);
    expect((await InterviewSchedule.findById(schedule._id).lean()).status).toBe(
      INTERVIEW_SCHEDULE_STATUS.CANCELLED,
    );
  });
});
