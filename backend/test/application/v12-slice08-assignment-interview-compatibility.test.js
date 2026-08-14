import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

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
  automaticallyUnassignApplication,
  cancelRecruiterInterviewProposal,
  confirmCandidateInterviewProposal,
  createInterviewProposal,
  firstAssignApplication,
  getCandidateMyApplication,
  getRecruiterMyApplication,
  listPrimaryJobApplications,
  reassignApplication,
  submitCandidateAvailabilityFirstTime,
  unassignApplication,
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
const FUTURE_DATE = "2026-08-20";

const createJob = async ({
  companyId,
  primaryMemberId,
  supportingMemberIds,
  status = JOB_STATUS.PUBLISHED,
}) =>
  Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status,
    publishedAt: new Date("2026-01-15T00:00:00.000Z"),
    applicationDeadline: new Date("2026-12-31T00:00:00.000Z"),
    title: "Slice 08 Interview compatibility",
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

const setup = async ({ jobStatus } = {}) => {
  const manager = await createActiveCompanyManagerContext({
    email: "v12.s08.manager@example.com",
    businessRegistrationNumber: "BRN-V12-S08",
  });
  const recruiterA = await createActiveRecruiterContext({
    email: "v12.s08.recruiter-a@example.com",
    company: manager.company,
    employeeCode: "V12-S08-A",
  });
  const recruiterB = await createActiveRecruiterContext({
    email: "v12.s08.recruiter-b@example.com",
    company: manager.company,
    employeeCode: "V12-S08-B",
  });
  const candidate = await createVerifiedUser({
    email: "v12.s08.candidate@example.com",
  });
  const job = await createJob({
    companyId: manager.company._id,
    primaryMemberId: recruiterA.membership._id,
    supportingMemberIds: [recruiterB.membership._id],
    status: jobStatus,
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
        storageKey: "applications/v12-s08.pdf",
        originalFileName: "v12-s08.pdf",
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
        status: APPLICATION_STATUS.CONTACTED,
        assignedRecruiterCompanyMemberId: recruiterA.membership._id,
        version: 1,
      },
    },
  );

  return {
    application: await Application.findById(application._id),
    candidate,
    job,
    manager,
    recruiterA,
    recruiterB,
  };
};

const submitAvailabilityAndCreateProposal = async (context) => {
  await submitCandidateAvailabilityFirstTime({
    candidateUserId: context.candidate.user._id,
    actorUser: context.candidate.user,
    applicationId: context.application._id,
    timezone: "UTC",
    slots: [{ date: FUTURE_DATE, dayPart: "MORNING" }],
    now: NOW,
  });

  return createInterviewProposal({
    actorUser: context.recruiterA.user,
    jobId: context.job._id,
    applicationId: context.application._id,
    date: FUTURE_DATE,
    dayPart: "MORNING",
    expectedAvailabilityRevision: 0,
    now: NOW,
  });
};

describe("V12 Slice 08 — Assignment + Interview read compatibility", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  it("preserves Interview state across A → B and transfers recruiter mutation authority", async () => {
    const context = await setup();
    const proposal = await submitAvailabilityAndCreateProposal(context);
    const availabilityBefore = await CandidateAvailability.findOne({
      applicationId: context.application._id,
    }).lean();
    const scheduleBefore = await InterviewSchedule.findById(
      proposal.interviewSchedule.id,
    ).lean();

    const reassigned = await reassignApplication({
      actorUser: context.recruiterA.user,
      jobId: context.job._id,
      applicationId: context.application._id,
      assigneeCompanyMemberId: context.recruiterB.membership._id,
      expectedAssigneeCompanyMemberId: context.recruiterA.membership._id,
      expectedVersion: 2,
    });

    expect(reassigned.application.availability).toEqual({
      status: "SUBMITTED",
      timezone: "UTC",
      slots: [{ date: FUTURE_DATE, dayPart: "MORNING" }],
      revision: 1,
    });
    expect(reassigned.application.interviewSchedules).toMatchObject([
      {
        id: proposal.interviewSchedule.id,
        status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
        createdByCompanyMemberId: context.recruiterA.membership._id.toString(),
      },
    ]);

    await expect(
      cancelRecruiterInterviewProposal({
        actorUser: context.recruiterA.user,
        jobId: context.job._id,
        applicationId: context.application._id,
        interviewScheduleId: proposal.interviewSchedule.id,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const cancelled = await cancelRecruiterInterviewProposal({
      actorUser: context.recruiterB.user,
      jobId: context.job._id,
      applicationId: context.application._id,
      interviewScheduleId: proposal.interviewSchedule.id,
    });

    const [application, availabilityAfter, scheduleAfter] = await Promise.all([
      Application.findById(context.application._id).lean(),
      CandidateAvailability.findOne({ applicationId: context.application._id }).lean(),
      InterviewSchedule.findById(proposal.interviewSchedule.id).lean(),
    ]);
    expect(application).toMatchObject({
      status: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
      assignedRecruiterCompanyMemberId: context.recruiterB.membership._id,
    });
    expect(cancelled.status).toBe(INTERVIEW_SCHEDULE_STATUS.CANCELLED);
    expect(availabilityAfter).toMatchObject({
      timezone: availabilityBefore.timezone,
      slots: availabilityBefore.slots,
      revision: availabilityBefore.revision,
    });
    expect(scheduleAfter).toMatchObject({
      createdByUserId: scheduleBefore.createdByUserId,
      createdByCompanyMemberId: context.recruiterA.membership._id,
      date: scheduleBefore.date,
      dayPart: scheduleBefore.dayPart,
      timezone: scheduleBefore.timezone,
      status: INTERVIEW_SCHEDULE_STATUS.CANCELLED,
    });
  });

  it.each(["manual", "automatic"])(
    "%s Unassign preserves Interview data while preventing recruiter mutations",
    async (kind) => {
      const context = await setup();
      const proposal = await submitAvailabilityAndCreateProposal(context);
      const availabilityBefore = await CandidateAvailability.findOne({
        applicationId: context.application._id,
      }).lean();

      let unassigned;
      if (kind === "manual") {
        unassigned = await unassignApplication({
          actorUser: context.recruiterA.user,
          jobId: context.job._id,
          applicationId: context.application._id,
          expectedAssigneeCompanyMemberId: context.recruiterA.membership._id,
          expectedVersion: 2,
        });
      } else {
        await automaticallyUnassignApplication({
          applicationId: context.application._id,
          expectedAssigneeCompanyMemberId: context.recruiterA.membership._id,
          expectedVersion: 2,
        });
      }

      if (kind === "manual") {
        expect(unassigned.application.availability).toEqual({
          status: "SUBMITTED",
          timezone: "UTC",
          slots: [{ date: FUTURE_DATE, dayPart: "MORNING" }],
          revision: 1,
        });
        expect(unassigned.application.interviewSchedules).toMatchObject([
          {
            id: proposal.interviewSchedule.id,
            status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
          },
        ]);
        expect(unassigned.application.assignedRecruiter).toBeNull();
      }

      await expect(
        cancelRecruiterInterviewProposal({
          actorUser: context.recruiterA.user,
          jobId: context.job._id,
          applicationId: context.application._id,
          interviewScheduleId: proposal.interviewSchedule.id,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      const [application, availabilityAfter, schedule] = await Promise.all([
        Application.findById(context.application._id).lean(),
        CandidateAvailability.findOne({ applicationId: context.application._id }).lean(),
        InterviewSchedule.findById(proposal.interviewSchedule.id).lean(),
      ]);
      expect(application).toMatchObject({
        status: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        assignedRecruiterCompanyMemberId: null,
      });
      expect(availabilityAfter).toMatchObject({
        timezone: availabilityBefore.timezone,
        slots: availabilityBefore.slots,
        revision: availabilityBefore.revision,
      });
      expect(schedule.status).toBe(INTERVIEW_SCHEDULE_STATUS.PROPOSED);
    },
  );

  it("keeps Candidate response available while UNASSIGNED and resumes responsibility on Assign again", async () => {
    const context = await setup();
    const proposal = await submitAvailabilityAndCreateProposal(context);

    await unassignApplication({
      actorUser: context.recruiterA.user,
      jobId: context.job._id,
      applicationId: context.application._id,
      expectedAssigneeCompanyMemberId: context.recruiterA.membership._id,
      expectedVersion: 2,
    });
    const confirmed = await confirmCandidateInterviewProposal({
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      interviewScheduleId: proposal.interviewSchedule.id,
      now: NOW,
    });

    await firstAssignApplication({
      actorUser: context.recruiterA.user,
      jobId: context.job._id,
      applicationId: context.application._id,
      assigneeCompanyMemberId: context.recruiterB.membership._id,
      expectedVersion: 3,
    });

    const application = await Application.findById(context.application._id).lean();
    expect(confirmed.status).toBe(INTERVIEW_SCHEDULE_STATUS.CONFIRMED);
    expect(application).toMatchObject({
      status: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
      assignedRecruiterCompanyMemberId: context.recruiterB.membership._id,
    });
  });

  it("hydrates Interview data only through existing Application read authority", async () => {
    const context = await setup();
    await submitCandidateAvailabilityFirstTime({
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      timezone: "UTC",
      slots: [],
      now: NOW,
    });
    await InterviewSchedule.create({
      applicationId: context.application._id,
      status: INTERVIEW_SCHEDULE_STATUS.DECLINED,
      date: FUTURE_DATE,
      dayPart: "MORNING",
      timezone: "UTC",
      expiresAt: new Date("2026-08-21T00:00:00.000Z"),
      createdByUserId: context.recruiterA.user._id,
      createdByCompanyMemberId: context.recruiterA.membership._id,
    });
    const outsider = await createActiveRecruiterContext({
      email: "v12.s08.outsider@example.com",
      company: context.manager.company,
      employeeCode: "V12-S08-O",
    });

    const [candidate, recruiter, manager] = await Promise.all([
      getCandidateMyApplication({
        candidateUserId: context.candidate.user._id,
        actorUser: context.candidate.user,
        applicationId: context.application._id,
        now: NOW,
      }),
      getRecruiterMyApplication({
        actorUser: context.recruiterA.user,
        applicationId: context.application._id,
      }),
      listPrimaryJobApplications({
        actorUser: context.manager.user,
        jobId: context.job._id,
      }),
    ]);

    await expect(
      getRecruiterMyApplication({
        actorUser: outsider.user,
        applicationId: context.application._id,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    for (const application of [
      candidate.application,
      recruiter.application,
      manager.applications[0],
    ]) {
      expect(application.availability).toEqual({
        status: "SUBMITTED",
        timezone: "UTC",
        slots: [],
        revision: 0,
      });
      expect(application.interviewSchedules).toMatchObject([
        { status: INTERVIEW_SCHEDULE_STATUS.DECLINED },
      ]);
    }
  });

  it.each([JOB_STATUS.CLOSED, JOB_STATUS.EXPIRED])(
    "retains Interview state when the Job is %s",
    async (jobStatus) => {
      const context = await setup({ jobStatus });
      const proposal = await submitAvailabilityAndCreateProposal(context);
      const agent = createTestAgent();
      const token = await loginAndGetAccessToken(agent, {
        email: context.candidate.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/candidate/applications/${context.application._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.application.interviewSchedules).toMatchObject([
        {
          id: proposal.interviewSchedule.id,
          status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
        },
      ]);
    },
  );
});
