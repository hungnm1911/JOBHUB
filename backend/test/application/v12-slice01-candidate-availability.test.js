import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import Application from "../../src/models/application.model.js";
import CandidateAvailability from "../../src/models/candidate-availability.model.js";
import Job from "../../src/models/job.model.js";
import {
  getCandidateMyApplication,
  getRecruiterMyApplication,
  listPrimaryJobApplications,
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
});
