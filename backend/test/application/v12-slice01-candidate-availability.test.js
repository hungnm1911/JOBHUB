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
  cancelRecruiterInterviewProposal,
  confirmCandidateInterviewProposal,
  createFirstInterviewProposal,
  createInterviewProposal,
  declineCandidateInterviewProposal,
  editCandidateAvailability,
  getCandidateMyApplication,
  getRecruiterMyApplication,
  listPrimaryJobApplications,
  reassignApplication,
  submitCandidateAvailabilityFirstTime,
  updateApplicationRecruitmentPipelineStatus,
} from "../../src/services/application.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const CAPTURED_AT = new Date("2026-08-14T00:00:00.000Z");
const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const createJob = async ({ companyId, primaryMemberId, status = JOB_STATUS.PUBLISHED }) =>
  Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: [],
    status,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: FUTURE_DEADLINE(),
    title: "Availability Job",
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

const createApplication = async ({
  candidateUserId,
  jobId,
  assigneeMemberId,
  status = APPLICATION_STATUS.CONTACTED,
}) => {
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
        storageKey: "applications/v12-s01.pdf",
        originalFileName: "v12-s01.pdf",
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
        status,
        assignedRecruiterCompanyMemberId: assigneeMemberId,
        version: 1,
      },
    },
  );

  return Application.findById(application._id);
};

const setup = async ({ jobStatus } = {}) => {
  const manager = await createActiveCompanyManagerContext({
    email: "v12.s01.manager@example.com",
    businessRegistrationNumber: "BRN-V12-S01",
  });
  const recruiter = await createActiveRecruiterContext({
    email: "v12.s01.recruiter@example.com",
    company: manager.company,
    employeeCode: "V12-S01-R",
  });
  const candidate = await createVerifiedUser({
    email: "v12.s01.candidate@example.com",
  });
  const job = await createJob({
    companyId: manager.company._id,
    primaryMemberId: recruiter.membership._id,
    status: jobStatus,
  });
  const application = await createApplication({
    candidateUserId: candidate.user._id,
    jobId: job._id,
    assigneeMemberId: recruiter.membership._id,
  });

  return { application, candidate, job, manager, recruiter };
};

describe("V12 Slice 01 — Current Availability first submit and read", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  it("represents NOT_SUBMITTED when no document exists, then persists empty SUBMITTED without Application mutation", async () => {
    const { application, candidate } = await setup();

    const before = await getCandidateMyApplication({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
    });
    expect(before.application.availability).toEqual({
      status: "NOT_SUBMITTED",
      timezone: null,
      slots: [],
      revision: null,
    });

    const availability = await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "Asia/Ho_Chi_Minh",
      slots: [],
      now: new Date("2026-08-14T12:00:00.000Z"),
    });

    expect(availability).toEqual({
      status: "SUBMITTED",
      timezone: "Asia/Ho_Chi_Minh",
      slots: [],
      revision: 0,
    });
    const persistedApplication = await Application.findById(application._id).lean();
    expect(persistedApplication.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(persistedApplication.version).toBe(1);
    expect(await CandidateAvailability.countDocuments()).toBe(1);
  });

  it("accepts current timezone-relative slots without Job lifecycle upper bound and exposes them through owner read", async () => {
    const { application, candidate } = await setup({ jobStatus: JOB_STATUS.CLOSED });

    await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "America/Los_Angeles",
      slots: [
        { date: "2026-08-14", dayPart: "MORNING" },
        { date: "2026-08-14", dayPart: "AFTERNOON" },
      ],
      // Still 2026-08-14 in Los Angeles; test must not follow server timezone.
      now: new Date("2026-08-15T06:30:00.000Z"),
    });

    const result = await getCandidateMyApplication({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
    });
    expect(result.application.availability).toEqual({
      status: "SUBMITTED",
      timezone: "America/Los_Angeles",
      slots: [
        { date: "2026-08-14", dayPart: "MORNING" },
        { date: "2026-08-14", dayPart: "AFTERNOON" },
      ],
      revision: 0,
    });
  });

  it("inherits existing Recruiter and Primary/Manager Application read authority", async () => {
    const { application, candidate, job, manager, recruiter } = await setup();
    await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "UTC",
      slots: [{ date: "2026-08-14", dayPart: "AFTERNOON" }],
      now: new Date("2026-08-14T01:00:00.000Z"),
    });

    const recruiterResult = await getRecruiterMyApplication({
      actorUser: recruiter.user,
      applicationId: application._id,
    });
    const managerResult = await listPrimaryJobApplications({
      actorUser: manager.user,
      jobId: job._id,
    });

    expect(recruiterResult.application.availability.status).toBe("SUBMITTED");
    expect(managerResult.applications[0].availability.slots).toEqual([
      { date: "2026-08-14", dayPart: "AFTERNOON" },
    ]);
  });

  it("rejects foreign, duplicate, past, and second submissions", async () => {
    const { application, candidate } = await setup();
    const foreignCandidate = await createVerifiedUser({
      email: "v12.s01.foreign@example.com",
    });

    await expect(
      submitCandidateAvailabilityFirstTime({
        candidateUserId: foreignCandidate.user._id,
        actorUser: foreignCandidate.user,
        applicationId: application._id,
        timezone: "UTC",
        slots: [],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      submitCandidateAvailabilityFirstTime({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id,
        timezone: "UTC",
        slots: [
          { date: "2026-08-14", dayPart: "MORNING" },
          { date: "2026-08-14", dayPart: "MORNING" },
        ],
        now: new Date("2026-08-14T01:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      submitCandidateAvailabilityFirstTime({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id,
        timezone: "UTC",
        slots: [{ date: "2026-08-13", dayPart: "MORNING" }],
        now: new Date("2026-08-14T01:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "UTC",
      slots: [],
      now: new Date("2026-08-14T01:00:00.000Z"),
    });
    await expect(
      submitCandidateAvailabilityFirstTime({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id,
        timezone: "UTC",
        slots: [],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("provides the authenticated Candidate HTTP submit surface", async () => {
    const { application, candidate } = await setup();
    const agent = createTestAgent();
    const token = await loginAndGetAccessToken(agent, {
      email: candidate.user.email,
    });

    const response = await agent
      .post(`/api/candidate/applications/${application._id}/availability`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        timezone: "UTC",
        slots: [{ date: "2026-08-14", dayPart: "MORNING" }],
      });

    expect(response.status).toBe(201);
    expect(response.body.availability.status).toBe("SUBMITTED");
  });

  it("blocks the independent CONTACTED → INTERVIEW_SCHEDULED pipeline transition", async () => {
    const { application, job, recruiter } = await setup();

    await expect(
      updateApplicationRecruitmentPipelineStatus({
        actorUser: recruiter.user,
        jobId: job._id,
        applicationId: application._id,
        expectedStatus: APPLICATION_STATUS.CONTACTED,
        targetStatus: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("creates the first proposal atomically with the CONTACTED pipeline cutover and Availability revision advance", async () => {
    const { application, candidate, job, recruiter } = await setup();
    await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "America/Los_Angeles",
      slots: [{ date: "2026-08-20", dayPart: "AFTERNOON" }],
      now: new Date("2026-08-14T12:00:00.000Z"),
    });

    const result = await createFirstInterviewProposal({
      actorUser: recruiter.user,
      jobId: job._id,
      applicationId: application._id,
      date: "2026-08-20",
      dayPart: "AFTERNOON",
      expectedAvailabilityRevision: 0,
      now: new Date("2026-08-14T12:00:00.000Z"),
    });

    expect(result.interviewSchedule).toMatchObject({
      applicationId: application._id.toString(),
      status: "PROPOSED",
      date: "2026-08-20",
      dayPart: "AFTERNOON",
      timezone: "America/Los_Angeles",
      createdByUserId: recruiter.user._id.toString(),
      createdByCompanyMemberId: recruiter.membership._id.toString(),
    });
    expect(result.interviewSchedule.expiresAt.toISOString()).toBe(
      "2026-08-21T07:00:00.000Z",
    );

    const [persistedApplication, availability, schedule] = await Promise.all([
      Application.findById(application._id).lean(),
      CandidateAvailability.findOne({ applicationId: application._id }).lean(),
      InterviewSchedule.findOne({ applicationId: application._id }).lean(),
    ]);
    expect(persistedApplication.status).toBe(APPLICATION_STATUS.INTERVIEW_SCHEDULED);
    expect(persistedApplication.version).toBe(2);
    expect(availability.revision).toBe(1);
    expect(schedule.status).toBe("PROPOSED");
  });

  it("rejects non-assignees, stale Availability, missing slots, and a second active proposal", async () => {
    const { application, candidate, job, manager, recruiter } = await setup();
    const otherRecruiter = await createActiveRecruiterContext({
      email: "v12.s02.other@example.com",
      company: manager.company,
      employeeCode: "V12-S02-OTHER",
    });
    await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "UTC",
      slots: [{ date: "2026-08-20", dayPart: "MORNING" }],
      now: new Date("2026-08-14T00:00:00.000Z"),
    });

    const proposal = {
      jobId: job._id,
      applicationId: application._id,
      date: "2026-08-20",
      dayPart: "MORNING",
      expectedAvailabilityRevision: 0,
      now: new Date("2026-08-14T00:00:00.000Z"),
    };
    await expect(
      createFirstInterviewProposal({ ...proposal, actorUser: otherRecruiter.user }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      createFirstInterviewProposal({
        ...proposal,
        actorUser: recruiter.user,
        expectedAvailabilityRevision: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      createFirstInterviewProposal({
        ...proposal,
        actorUser: recruiter.user,
        date: "2026-08-21",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await createFirstInterviewProposal({ ...proposal, actorUser: recruiter.user });
    await expect(
      createFirstInterviewProposal({ ...proposal, actorUser: recruiter.user }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("exposes the authenticated Recruiter proposal HTTP surface", async () => {
    const { application, candidate, job, recruiter } = await setup({
      jobStatus: JOB_STATUS.CLOSED,
    });
    await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "UTC",
      slots: [{ date: "2026-08-20", dayPart: "MORNING" }],
      now: new Date("2026-08-14T00:00:00.000Z"),
    });
    const agent = createTestAgent();
    const token = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
    });

    const response = await agent
      .post(`/api/jobs/${job._id}/applications/${application._id}/interview-proposals`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        date: "2026-08-20",
        dayPart: "MORNING",
        expectedAvailabilityRevision: 0,
      });

    expect(response.status).toBe(201);
    expect(response.body.interviewSchedule.status).toBe("PROPOSED");
  });

  it("replaces the current Availability set, advances revision, and preserves Application and Schedule state", async () => {
    const { application, candidate } = await setup({ jobStatus: JOB_STATUS.EXPIRED });
    await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "UTC",
      slots: [{ date: "2026-08-20", dayPart: "MORNING" }],
      now: new Date("2026-08-14T00:00:00.000Z"),
    });

    const availability = await editCandidateAvailability({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "America/Los_Angeles",
      slots: [
        { date: "2026-08-14", dayPart: "AFTERNOON" },
        { date: "2026-08-20", dayPart: "AFTERNOON" },
      ],
      expectedRevision: 0,
      now: new Date("2026-08-15T06:30:00.000Z"),
    });

    expect(availability).toEqual({
      status: "SUBMITTED",
      timezone: "America/Los_Angeles",
      slots: [
        { date: "2026-08-14", dayPart: "AFTERNOON" },
        { date: "2026-08-20", dayPart: "AFTERNOON" },
      ],
      revision: 1,
    });
    expect((await Application.findById(application._id)).status).toBe(
      APPLICATION_STATUS.CONTACTED,
    );
    expect(await InterviewSchedule.countDocuments({ applicationId: application._id })).toBe(0);
  });

  it("provides the authenticated Candidate HTTP edit surface", async () => {
    const { application, candidate } = await setup();
    await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "UTC",
      slots: [{ date: "2026-08-20", dayPart: "MORNING" }],
      now: new Date("2026-08-14T00:00:00.000Z"),
    });
    const agent = createTestAgent();
    const token = await loginAndGetAccessToken(agent, {
      email: candidate.user.email,
    });

    const response = await agent
      .put(`/api/candidate/applications/${application._id}/availability`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        timezone: "UTC",
        slots: [],
        expectedRevision: 0,
      });

    expect(response.status).toBe(200);
    expect(response.body.availability).toMatchObject({
      status: "SUBMITTED",
      slots: [],
      revision: 1,
    });
  });

  it("deterministically rejects a stale proposal after Availability edit wins", async () => {
    const { application, candidate, job, recruiter } = await setup();
    await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "UTC",
      slots: [{ date: "2026-08-20", dayPart: "MORNING" }],
      now: new Date("2026-08-14T00:00:00.000Z"),
    });

    await editCandidateAvailability({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "UTC",
      slots: [],
      expectedRevision: 0,
      now: new Date("2026-08-14T00:00:00.000Z"),
    });

    await expect(
      createFirstInterviewProposal({
        actorUser: recruiter.user,
        jobId: job._id,
        applicationId: application._id,
        date: "2026-08-20",
        dayPart: "MORNING",
        expectedAvailabilityRevision: 0,
        now: new Date("2026-08-14T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await InterviewSchedule.countDocuments({ applicationId: application._id })).toBe(0);
  });

  it("deterministically rejects a stale Availability edit after proposal wins", async () => {
    const { application, candidate, job, recruiter } = await setup();
    await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "UTC",
      slots: [{ date: "2026-08-20", dayPart: "MORNING" }],
      now: new Date("2026-08-14T00:00:00.000Z"),
    });
    await createFirstInterviewProposal({
      actorUser: recruiter.user,
      jobId: job._id,
      applicationId: application._id,
      date: "2026-08-20",
      dayPart: "MORNING",
      expectedAvailabilityRevision: 0,
      now: new Date("2026-08-14T00:00:00.000Z"),
    });

    await expect(
      editCandidateAvailability({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id,
        timezone: "UTC",
        slots: [],
        expectedRevision: 0,
        now: new Date("2026-08-14T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      (await CandidateAvailability.findOne({ applicationId: application._id })).revision,
    ).toBe(1);
  });

  it("does not allow a stale Availability revision to overwrite newer slots", async () => {
    const { application, candidate } = await setup();
    await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "UTC",
      slots: [{ date: "2026-08-20", dayPart: "MORNING" }],
      now: new Date("2026-08-14T00:00:00.000Z"),
    });
    await editCandidateAvailability({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "UTC",
      slots: [{ date: "2026-08-21", dayPart: "AFTERNOON" }],
      expectedRevision: 0,
      now: new Date("2026-08-14T00:00:00.000Z"),
    });

    await expect(
      editCandidateAvailability({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id,
        timezone: "UTC",
        slots: [],
        expectedRevision: 0,
        now: new Date("2026-08-14T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      (await CandidateAvailability.findOne({ applicationId: application._id }).lean()).slots,
    ).toEqual([{ date: "2026-08-21", dayPart: "AFTERNOON" }]);
  });
});

describe("V12 Slice 04 — Candidate Confirm / Decline Interview Proposal", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  const createProposal = async ({ application, candidate, job, recruiter }) => {
    await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "UTC",
      slots: [{ date: "2030-08-20", dayPart: "MORNING" }],
      now: new Date("2026-08-14T00:00:00.000Z"),
    });

    return createFirstInterviewProposal({
      actorUser: recruiter.user,
      jobId: job._id,
      applicationId: application._id,
      date: "2030-08-20",
      dayPart: "MORNING",
      expectedAvailabilityRevision: 0,
      now: new Date("2026-08-14T00:00:00.000Z"),
    });
  };

  it("confirms an owner proposal without changing the Application or Availability, including while UNASSIGNED", async () => {
    const context = await setup();
    const proposal = await createProposal(context);
    await Application.updateOne(
      { _id: context.application._id },
      { $set: { assignedRecruiterCompanyMemberId: null } },
    );

    const interviewSchedule = await confirmCandidateInterviewProposal({
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      interviewScheduleId: proposal.interviewSchedule.id,
      now: new Date("2026-08-14T00:00:00.000Z"),
    });

    expect(interviewSchedule.status).toBe("CONFIRMED");
    expect((await Application.findById(context.application._id)).status).toBe(
      APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    );
    expect(
      (await CandidateAvailability.findOne({ applicationId: context.application._id })).revision,
    ).toBe(1);
    expect(await InterviewSchedule.countDocuments({ applicationId: context.application._id })).toBe(
      1,
    );
  });

  it("declines an owner proposal while preserving Availability and immutable proposal history", async () => {
    const context = await setup();
    const proposal = await createProposal(context);
    const before = await InterviewSchedule.findById(proposal.interviewSchedule.id).lean();
    const availabilityBefore = await CandidateAvailability.findOne({
      applicationId: context.application._id,
    }).lean();

    const interviewSchedule = await declineCandidateInterviewProposal({
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      interviewScheduleId: proposal.interviewSchedule.id,
      now: new Date("2026-08-14T00:00:00.000Z"),
    });
    const [persisted, availabilityAfter, application] = await Promise.all([
      InterviewSchedule.findById(proposal.interviewSchedule.id).lean(),
      CandidateAvailability.findOne({ applicationId: context.application._id }).lean(),
      Application.findById(context.application._id).lean(),
    ]);

    expect(interviewSchedule.status).toBe("DECLINED");
    expect(application.status).toBe(APPLICATION_STATUS.INTERVIEW_SCHEDULED);
    expect(availabilityAfter).toMatchObject({
      timezone: availabilityBefore.timezone,
      slots: availabilityBefore.slots,
      revision: availabilityBefore.revision,
    });
    expect(persisted).toMatchObject({
      applicationId: before.applicationId,
      date: before.date,
      dayPart: before.dayPart,
      timezone: before.timezone,
      createdByUserId: before.createdByUserId,
      createdByCompanyMemberId: before.createdByCompanyMemberId,
      status: "DECLINED",
    });
  });

  it("exposes the authenticated Candidate confirm HTTP surface", async () => {
    const context = await setup();
    const proposal = await createProposal(context);
    const agent = createTestAgent();
    const token = await loginAndGetAccessToken(agent, {
      email: context.candidate.user.email,
    });

    const response = await agent
      .post(
        `/api/candidate/applications/${context.application._id}/interview-proposals/${proposal.interviewSchedule.id}/confirm`,
      )
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.interviewSchedule.status).toBe("CONFIRMED");
  });

  it("rejects a non-owner, a non-PROPOSED Schedule, expired proposals, and terminal Applications", async () => {
    const context = await setup();
    const proposal = await createProposal(context);
    const foreignCandidate = await createVerifiedUser({
      email: "v12.s04.foreign@example.com",
    });
    const respond = (overrides = {}) =>
      confirmCandidateInterviewProposal({
        candidateUserId: context.candidate.user._id,
        actorUser: context.candidate.user,
        applicationId: context.application._id,
        interviewScheduleId: proposal.interviewSchedule.id,
        now: new Date("2026-08-14T00:00:00.000Z"),
        ...overrides,
      });

    await expect(
      respond({
        candidateUserId: foreignCandidate.user._id,
        actorUser: foreignCandidate.user,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    await InterviewSchedule.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(proposal.interviewSchedule.id) },
      { $set: { status: "CANCELLED" } },
    );
    await expect(respond()).rejects.toMatchObject({ statusCode: 409 });

    await InterviewSchedule.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(proposal.interviewSchedule.id) },
      { $set: { status: "PROPOSED", expiresAt: new Date("2026-08-14T00:00:00.000Z") } },
    );
    await expect(respond()).rejects.toMatchObject({ statusCode: 409 });

    await Application.updateOne(
      { _id: context.application._id },
      { $set: { status: APPLICATION_STATUS.REJECTED } },
    );
    await expect(respond({ now: new Date("2026-08-13T00:00:00.000Z") })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("allows only one concurrent Confirm or Decline transition to win", async () => {
    const context = await setup();
    const proposal = await createProposal(context);
    const input = {
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      interviewScheduleId: proposal.interviewSchedule.id,
      now: new Date("2026-08-14T00:00:00.000Z"),
    };

    const results = await Promise.allSettled([
      confirmCandidateInterviewProposal(input),
      declineCandidateInterviewProposal(input),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const persisted = await InterviewSchedule.findById(proposal.interviewSchedule.id).lean();
    expect(["CONFIRMED", "DECLINED"]).toContain(persisted.status);
  });
});

describe("V12 Slice 05 — Recruiter Cancel, Reproposal, and Schedule History", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  const createProposal = async (
    context,
    slots = [
      { date: "2030-08-20", dayPart: "MORNING" },
      { date: "2030-08-21", dayPart: "AFTERNOON" },
    ],
  ) => {
    await submitCandidateAvailabilityFirstTime({
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      timezone: "UTC",
      slots,
      now: new Date("2026-08-14T00:00:00.000Z"),
    });
    return createFirstInterviewProposal({
      actorUser: context.recruiter.user,
      jobId: context.job._id,
      applicationId: context.application._id,
      date: slots[0].date,
      dayPart: slots[0].dayPart,
      expectedAvailabilityRevision: 0,
      now: new Date("2026-08-14T00:00:00.000Z"),
    });
  };

  it("lets only the current eligible Assignee cancel PROPOSED after Reassign", async () => {
    const context = await setup();
    const proposal = await createProposal(context);
    const replacement = await createActiveRecruiterContext({
      email: "v12.s05.replacement@example.com",
      company: context.manager.company,
      employeeCode: "V12-S05-R",
    });
    await Job.updateOne(
      { _id: context.job._id },
      { $set: { supportingRecruiterCompanyMemberIds: [replacement.membership._id] } },
    );
    await reassignApplication({
      actorUser: context.recruiter.user,
      jobId: context.job._id,
      applicationId: context.application._id,
      assigneeCompanyMemberId: replacement.membership._id,
      expectedAssigneeCompanyMemberId: context.recruiter.membership._id,
      expectedVersion: 2,
    });

    const input = {
      jobId: context.job._id,
      applicationId: context.application._id,
      interviewScheduleId: proposal.interviewSchedule.id,
    };
    await expect(
      cancelRecruiterInterviewProposal({ ...input, actorUser: context.recruiter.user }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const availabilityBefore = await CandidateAvailability.findOne({
      applicationId: context.application._id,
    }).lean();
    const agent = createTestAgent();
    const token = await loginAndGetAccessToken(agent, {
      email: replacement.user.email,
    });
    const response = await agent
      .post(
        `/api/jobs/${context.job._id}/applications/${context.application._id}/interview-proposals/${proposal.interviewSchedule.id}/cancel`,
      )
      .set("Authorization", `Bearer ${token}`)
      .send({});
    const [application, availability, persisted] = await Promise.all([
      Application.findById(context.application._id).lean(),
      CandidateAvailability.findOne({ applicationId: context.application._id }).lean(),
      InterviewSchedule.findById(proposal.interviewSchedule.id).lean(),
    ]);

    expect(response.status).toBe(200);
    expect(response.body.interviewSchedule.status).toBe("CANCELLED");
    expect(application.status).toBe(APPLICATION_STATUS.INTERVIEW_SCHEDULED);
    expect(availability).toMatchObject({
      slots: availabilityBefore.slots,
      timezone: availabilityBefore.timezone,
      revision: availabilityBefore.revision,
    });
    expect(persisted).toMatchObject({
      status: "CANCELLED",
      date: "2030-08-20",
      dayPart: "MORNING",
      createdByCompanyMemberId: context.recruiter.membership._id,
    });
  });

  it("creates a new proposal after DECLINED, but never reuses the declined slot", async () => {
    const context = await setup();
    const first = await createProposal(context);
    await declineCandidateInterviewProposal({
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      interviewScheduleId: first.interviewSchedule.id,
      now: new Date("2026-08-14T00:00:00.000Z"),
    });

    await expect(
      createInterviewProposal({
        actorUser: context.recruiter.user,
        jobId: context.job._id,
        applicationId: context.application._id,
        date: "2030-08-20",
        dayPart: "MORNING",
        expectedAvailabilityRevision: 1,
        now: new Date("2026-08-14T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const next = await createInterviewProposal({
      actorUser: context.recruiter.user,
      jobId: context.job._id,
      applicationId: context.application._id,
      date: "2030-08-21",
      dayPart: "AFTERNOON",
      expectedAvailabilityRevision: 1,
      now: new Date("2026-08-14T00:00:00.000Z"),
    });
    const schedules = await InterviewSchedule.find({
      applicationId: context.application._id,
    }).sort({ createdAt: 1 });

    expect(next.application.status).toBe(APPLICATION_STATUS.INTERVIEW_SCHEDULED);
    expect(schedules).toHaveLength(2);
    expect(schedules.map((schedule) => schedule.status)).toEqual(["DECLINED", "PROPOSED"]);
    expect(schedules[0]._id.toString()).toBe(first.interviewSchedule.id);
  });

  it("permits a still-valid CANCELLED slot to be proposed again and projects history only through Application reads", async () => {
    const context = await setup();
    const first = await createProposal(context, [
      { date: "2030-08-20", dayPart: "MORNING" },
    ]);
    await cancelRecruiterInterviewProposal({
      actorUser: context.recruiter.user,
      jobId: context.job._id,
      applicationId: context.application._id,
      interviewScheduleId: first.interviewSchedule.id,
    });

    const next = await createInterviewProposal({
      actorUser: context.recruiter.user,
      jobId: context.job._id,
      applicationId: context.application._id,
      date: "2030-08-20",
      dayPart: "MORNING",
      expectedAvailabilityRevision: 1,
      now: new Date("2026-08-14T00:00:00.000Z"),
    });
    const candidateRead = await getCandidateMyApplication({
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
    });
    const managerRead = await listPrimaryJobApplications({
      actorUser: context.manager.user,
      jobId: context.job._id,
    });
    const agent = createTestAgent();
    const managerToken = await loginAndGetAccessToken(agent, {
      email: context.manager.user.email,
    });
    const chatRead = await agent
      .get(`/api/jobs/my-applications/${context.application._id}/conversation`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(next.interviewSchedule.id).not.toBe(first.interviewSchedule.id);
    expect(candidateRead.application.interviewSchedules.map(({ status }) => status)).toEqual([
      "PROPOSED",
      "CANCELLED",
    ]);
    expect(managerRead.applications[0].interviewSchedules).toHaveLength(2);
    expect(chatRead.status).toBe(403);
  });
});
