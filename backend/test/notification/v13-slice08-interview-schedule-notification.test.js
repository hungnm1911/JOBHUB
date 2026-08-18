import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import INTERVIEW_SCHEDULE_STATUS from "../../src/constants/interview-schedule-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import Application from "../../src/models/application.model.js";
import InterviewSchedule from "../../src/models/interview-schedule.model.js";
import Job from "../../src/models/job.model.js";
import Notification from "../../src/models/notification.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import {
  cancelRecruiterInterviewProposal,
  confirmCandidateInterviewProposal,
  createInterviewProposal,
  declineCandidateInterviewProposal,
  expireDueInterviewProposalsForApplication,
  submitCandidateAvailabilityFirstTime,
  updateApplicationRecruitmentPipelineStatus,
} from "../../src/services/application.service.js";
import { recoverPendingNotificationEvents } from "../../src/services/notification.service.js";
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

const NOW = new Date("2026-08-14T12:00:00.000Z");
const DATE = "2026-08-20";

const setup = async ({ assigned = true, suffix = "" } = {}) => {
  const manager = await createActiveCompanyManagerContext({
    email: `v13.s08.manager${suffix}@example.com`,
    businessRegistrationNumber: `BRN-V13-S08${suffix}`,
  });
  const recruiter = await createActiveRecruiterContext({
    email: `v13.s08.recruiter${suffix}@example.com`,
    company: manager.company,
    employeeCode: "V13-S08-R",
  });
  const replacement = await createActiveRecruiterContext({
    email: `v13.s08.replacement${suffix}@example.com`,
    company: manager.company,
    employeeCode: "V13-S08-R2",
  });
  const candidate = await createVerifiedUser({
    email: `v13.s08.candidate${suffix}@example.com`,
  });
  const job = await Job.create({
    companyId: manager.company._id,
    createdByCompanyMemberId: recruiter.membership._id,
    primaryRecruiterCompanyMemberId: recruiter.membership._id,
    supportingRecruiterCompanyMemberIds: [replacement.membership._id],
    status: JOB_STATUS.PUBLISHED,
    publishedAt: NOW,
    applicationDeadline: new Date("2030-01-01"),
    title: "Schedule Engineer",
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
  const application = await Application.create({
    candidateUserId: candidate.user._id,
    jobId: job._id,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    assignedRecruiterCompanyMemberId: null,
    submittedCvSnapshot: {
      sourceCandidateCvId: new mongoose.Types.ObjectId(),
      name: "CV",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      pdfFile: {
        storageKey: "v13-s08.pdf",
        originalFileName: "v13-s08.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: 100,
        pageCount: 1,
      },
      capturedAt: NOW,
    },
    appliedAt: NOW,
    version: 0,
  });
  await Application.updateOne(
    { _id: application._id },
    {
      $set: {
        status: APPLICATION_STATUS.CONTACTED,
        assignedRecruiterCompanyMemberId: assigned ? recruiter.membership._id : null,
        version: 1,
      },
    },
  );
  return {
    application: await Application.findById(application._id),
    candidate,
    job,
    recruiter,
    replacement,
  };
};

const propose = async (context) => {
  await submitCandidateAvailabilityFirstTime({
    candidateUserId: context.candidate.user._id,
    actorUser: context.candidate.user,
    applicationId: context.application._id,
    timezone: "UTC",
    slots: [{ date: DATE, dayPart: "MORNING" }],
    now: NOW,
  });
  return createInterviewProposal({
    actorUser: context.recruiter.user,
    jobId: context.job._id,
    applicationId: context.application._id,
    date: DATE,
    dayPart: "MORNING",
    expectedAvailabilityRevision: 0,
    now: NOW,
  });
};

const findEvent = (context, type) =>
  NotificationEvent.findOne({ applicationId: context.application._id, type });

describe("V13 Slice 08 — Interview Schedule Notification", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  it("creates the independent CREATED obligation for a winning first proposal", async () => {
    const context = await setup();
    const proposal = await propose(context);
    const [created, statusChanged] = await Promise.all([
      findEvent(context, NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CREATED),
      findEvent(context, NOTIFICATION_TYPE.APPLICATION_STATUS_CHANGED),
    ]);

    expect(created.interviewScheduleId.toString()).toBe(proposal.interviewSchedule.id);
    expect(created.recipients[0].recipientUserId.toString()).toBe(
      context.candidate.user._id.toString(),
    );
    expect(statusChanged).not.toBeNull();
    expect(await Notification.countDocuments({ eventId: created._id })).toBe(1);
  });

  it("creates CHANGED for recruiter cancellation and only the winning response event", async () => {
    const context = await setup();
    const proposal = await propose(context);
    await cancelRecruiterInterviewProposal({
      actorUser: context.recruiter.user,
      jobId: context.job._id,
      applicationId: context.application._id,
      interviewScheduleId: proposal.interviewSchedule.id,
    });
    const changed = await findEvent(context, NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CHANGED);
    expect(changed.interviewScheduleId.toString()).toBe(proposal.interviewSchedule.id);

    const next = await createInterviewProposal({
      actorUser: context.recruiter.user,
      jobId: context.job._id,
      applicationId: context.application._id,
      date: DATE,
      dayPart: "MORNING",
      expectedAvailabilityRevision: 1,
      now: NOW,
    });
    const outcomes = await Promise.allSettled([
      confirmCandidateInterviewProposal({
        candidateUserId: context.candidate.user._id,
        actorUser: context.candidate.user,
        applicationId: context.application._id,
        interviewScheduleId: next.interviewSchedule.id,
        now: NOW,
      }),
      declineCandidateInterviewProposal({
        candidateUserId: context.candidate.user._id,
        actorUser: context.candidate.user,
        applicationId: context.application._id,
        interviewScheduleId: next.interviewSchedule.id,
        now: NOW,
      }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(
      await NotificationEvent.countDocuments({
        applicationId: context.application._id,
        type: {
          $in: [
            NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CONFIRMED,
            NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_DECLINED,
          ],
        },
      }),
    ).toBe(1);
  });

  it("snapshots the current Assignee for Candidate response and has no UNASSIGNED fallback", async () => {
    const assigned = await setup();
    const proposal = await propose(assigned);
    await confirmCandidateInterviewProposal({
      candidateUserId: assigned.candidate.user._id,
      actorUser: assigned.candidate.user,
      applicationId: assigned.application._id,
      interviewScheduleId: proposal.interviewSchedule.id,
      now: NOW,
    });
    const confirmed = await findEvent(assigned, NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CONFIRMED);
    expect(confirmed.recipients[0].recipientUserId.toString()).toBe(
      assigned.recruiter.user._id.toString(),
    );

    const unassigned = await setup({ assigned: false, suffix: ".unassigned" });
    const schedule = await InterviewSchedule.create({
      applicationId: unassigned.application._id,
      status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
      date: DATE,
      dayPart: "MORNING",
      timezone: "UTC",
      expiresAt: new Date("2026-08-21T00:00:00.000Z"),
      createdByUserId: unassigned.recruiter.user._id,
      createdByCompanyMemberId: unassigned.recruiter.membership._id,
    });
    await declineCandidateInterviewProposal({
      candidateUserId: unassigned.candidate.user._id,
      actorUser: unassigned.candidate.user,
      applicationId: unassigned.application._id,
      interviewScheduleId: schedule._id,
      now: NOW,
    });
    expect(
      await NotificationEvent.countDocuments({
        applicationId: unassigned.application._id,
        type: NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_DECLINED,
      }),
    ).toBe(0);
  });

  it("persists an expiration obligation only for the guarded cancellation winner", async () => {
    const context = await setup();
    const schedule = await InterviewSchedule.create({
      applicationId: context.application._id,
      status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
      date: DATE,
      dayPart: "MORNING",
      timezone: "UTC",
      expiresAt: NOW,
      createdByUserId: context.recruiter.user._id,
      createdByCompanyMemberId: context.recruiter.membership._id,
    });
    const [first, second] = await Promise.all([
      expireDueInterviewProposalsForApplication({
        applicationId: context.application._id,
        now: NOW,
      }),
      expireDueInterviewProposalsForApplication({
        applicationId: context.application._id,
        now: NOW,
      }),
    ]);
    expect(first.modifiedCount + second.modifiedCount).toBe(1);
    expect(
      await NotificationEvent.countDocuments({
        interviewScheduleId: schedule._id,
        type: NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CHANGED,
      }),
    ).toBe(1);
  });

  it("keeps terminal Application and Schedule Changed obligations independent", async () => {
    const context = await setup();
    const schedule = await InterviewSchedule.create({
      applicationId: context.application._id,
      status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
      date: DATE,
      dayPart: "MORNING",
      timezone: "UTC",
      expiresAt: new Date("2026-08-21T00:00:00.000Z"),
      createdByUserId: context.recruiter.user._id,
      createdByCompanyMemberId: context.recruiter.membership._id,
    });

    await updateApplicationRecruitmentPipelineStatus({
      actorUser: context.recruiter.user,
      jobId: context.job._id,
      applicationId: context.application._id,
      targetStatus: APPLICATION_STATUS.REJECTED,
      expectedStatus: APPLICATION_STATUS.CONTACTED,
      expectedVersion: 1,
    });

    expect(
      await NotificationEvent.exists({
        applicationId: context.application._id,
        type: NOTIFICATION_TYPE.APPLICATION_REJECTED,
      }),
    ).not.toBeNull();
    expect(
      await NotificationEvent.exists({
        interviewScheduleId: schedule._id,
        type: NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CHANGED,
      }),
    ).not.toBeNull();
  });

  it("rolls back terminal source state when the required Schedule obligation fails", async () => {
    const context = await setup();
    await InterviewSchedule.create({
      applicationId: context.application._id,
      status: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
      date: DATE,
      dayPart: "MORNING",
      timezone: "UTC",
      expiresAt: new Date("2026-08-21T00:00:00.000Z"),
      createdByUserId: context.recruiter.user._id,
      createdByCompanyMemberId: context.recruiter.membership._id,
    });
    vi.spyOn(NotificationEvent, "create").mockRejectedValue(new Error("event write failed"));

    await expect(
      updateApplicationRecruitmentPipelineStatus({
        actorUser: context.recruiter.user,
        jobId: context.job._id,
        applicationId: context.application._id,
        targetStatus: APPLICATION_STATUS.REJECTED,
        expectedStatus: APPLICATION_STATUS.CONTACTED,
        expectedVersion: 1,
      }),
    ).rejects.toThrow("event write failed");
    expect((await Application.findById(context.application._id)).status).toBe(
      APPLICATION_STATUS.CONTACTED,
    );
  });

  it("recovers Schedule materialization idempotently after a temporary failure", async () => {
    const context = await setup();
    vi.spyOn(Notification, "updateOne").mockRejectedValue(new Error("temporary inbox failure"));
    const proposal = await propose(context);
    const event = await NotificationEvent.findOne({
      interviewScheduleId: proposal.interviewSchedule.id,
      type: NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CREATED,
    });
    expect(event.materializedAt).toBeNull();

    vi.restoreAllMocks();
    await recoverPendingNotificationEvents();
    await recoverPendingNotificationEvents();
    expect(await Notification.countDocuments({ eventId: event._id })).toBe(1);
  });
});
