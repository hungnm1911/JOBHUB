import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import Application from "../../src/models/application.model.js";
import CandidateAvailability from "../../src/models/candidate-availability.model.js";
import InterviewSchedule from "../../src/models/interview-schedule.model.js";
import Job from "../../src/models/job.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import Notification from "../../src/models/notification.model.js";
import {
  editCandidateAvailability,
  submitCandidateAvailabilityFirstTime,
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

const NOW = new Date("2026-08-14T01:00:00.000Z");
const FUTURE_DATE = "2026-08-20";
const CAPTURED_AT = new Date("2026-08-14T00:00:00.000Z");

const createJob = async ({ companyId, primaryMemberId, supportingMemberId }) =>
  Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: [supportingMemberId],
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15T00:00:00.000Z"),
    applicationDeadline: new Date("2030-08-30T00:00:00.000Z"),
    title: "Backend Engineer",
    jobDescription: "Build reliable APIs",
    requiredSkills: ["Node.js"],
    salaryText: "1000-2000",
    fieldCategoryIds: [],
    positionCategoryIds: [],
    location: null,
    employmentType: null,
    workModes: [],
    experienceLevelId: null,
  });

const createContactedApplication = async ({
  candidateUserId,
  jobId,
  assigneeCompanyMemberId,
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
        storageKey: "applications/v13-s07.pdf",
        originalFileName: "v13-s07.pdf",
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
        assignedRecruiterCompanyMemberId: assigneeCompanyMemberId,
        version: 1,
      },
    },
  );

  return Application.findById(application._id);
};

const setup = async ({ assigned = true } = {}) => {
  const manager = await createActiveCompanyManagerContext({
    email: "v13.s07.manager@example.com",
    businessRegistrationNumber: "BRN-V13-S07",
  });
  const primary = await createActiveRecruiterContext({
    email: "v13.s07.primary@example.com",
    company: manager.company,
    employeeCode: "V13-S07-P",
  });
  const assignee = await createActiveRecruiterContext({
    email: "v13.s07.assignee@example.com",
    company: manager.company,
    employeeCode: "V13-S07-A",
  });
  const candidate = await createVerifiedUser({
    email: "v13.s07.candidate@example.com",
  });
  const job = await createJob({
    companyId: manager.company._id,
    primaryMemberId: primary.membership._id,
    supportingMemberId: assignee.membership._id,
  });
  const application = await createContactedApplication({
    candidateUserId: candidate.user._id,
    jobId: job._id,
    assigneeCompanyMemberId: assigned ? assignee.membership._id : null,
  });

  return { application, assignee, candidate, job, manager, primary };
};

const firstSubmit = ({ application, candidate }) =>
  submitCandidateAvailabilityFirstTime({
    candidateUserId: candidate.user._id,
    actorUser: candidate.user,
    applicationId: application._id,
    timezone: "UTC",
    slots: [{ date: FUTURE_DATE, dayPart: "MORNING" }],
    now: NOW,
  });

describe("V13 Slice 07 — Candidate Availability first-submit Notification", () => {
  beforeAll(connectTestDatabase);

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(disconnectTestDatabase);

  it("notifies exactly the trusted current Assignee on ASSIGNED first-submit", async () => {
    const context = await setup();
    const applicationBefore = await Application.findById(context.application._id).lean();

    const availability = await firstSubmit(context);

    const [applicationAfter, event] = await Promise.all([
      Application.findById(context.application._id).lean(),
      NotificationEvent.findOne({
        applicationId: context.application._id,
        type: NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_SUBMITTED,
      }),
    ]);
    expect(availability).toMatchObject({
      status: "SUBMITTED",
      timezone: "UTC",
      slots: [{ date: FUTURE_DATE, dayPart: "MORNING" }],
      revision: 0,
    });
    expect(event.recipients).toEqual([
      expect.objectContaining({
        recipientUserId: context.assignee.user._id,
        content: "The candidate submitted interview availability for Backend Engineer.",
      }),
    ]);
    expect(event.actorUserId.toString()).toBe(context.candidate.user._id.toString());
    expect(event.recipients[0].recipientUserId.toString()).not.toBe(
      context.primary.user._id.toString(),
    );
    expect(await Notification.countDocuments({ eventId: event._id })).toBe(1);
    expect(applicationAfter).toMatchObject({
      status: applicationBefore.status,
      version: applicationBefore.version,
      assignedRecruiterCompanyMemberId:
        applicationBefore.assignedRecruiterCompanyMemberId,
      updatedAt: applicationBefore.updatedAt,
    });
    expect(await InterviewSchedule.countDocuments()).toBe(0);
  });

  it("commits UNASSIGNED first-submit without an event or fallback recipient", async () => {
    const context = await setup({ assigned: false });

    const availability = await firstSubmit(context);

    expect(availability.status).toBe("SUBMITTED");
    expect(
      await CandidateAvailability.countDocuments({
        applicationId: context.application._id,
      }),
    ).toBe(1);
    expect(
      await NotificationEvent.countDocuments({
        applicationId: context.application._id,
      }),
    ).toBe(0);
    expect(await Notification.countDocuments()).toBe(0);
  });

  it("serializes with Assignment changes and snapshots the Assignee of the winning order", async () => {
    const context = await setup();
    const originalCreate = CandidateAvailability.create.bind(CandidateAvailability);
    let releaseAvailabilityCreate;
    let markApplicationAcquired;
    const applicationAcquired = new Promise((resolve) => {
      markApplicationAcquired = resolve;
    });
    const availabilityCreateReleased = new Promise((resolve) => {
      releaseAvailabilityCreate = resolve;
    });
    vi.spyOn(CandidateAvailability, "create").mockImplementationOnce(
      async (...arguments_) => {
        markApplicationAcquired();
        await availabilityCreateReleased;
        return originalCreate(...arguments_);
      },
    );

    const submission = firstSubmit(context);
    await applicationAcquired;
    const assignmentChange = Application.findOneAndUpdate(
      {
        _id: context.application._id,
        version: 1,
        assignedRecruiterCompanyMemberId: context.assignee.membership._id,
      },
      {
        $set: {
          assignedRecruiterCompanyMemberId: context.primary.membership._id,
        },
        $inc: { version: 1 },
      },
      { returnDocument: "after" },
    );

    releaseAvailabilityCreate();
    await Promise.all([submission, assignmentChange]);

    const [application, event] = await Promise.all([
      Application.findById(context.application._id),
      NotificationEvent.findOne({
        applicationId: context.application._id,
        type: NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_SUBMITTED,
      }),
    ]);
    expect(application.assignedRecruiterCompanyMemberId.toString()).toBe(
      context.primary.membership._id.toString(),
    );
    expect(event.recipients[0].recipientUserId.toString()).toBe(
      context.assignee.user._id.toString(),
    );
  });

  it("does not create another event when Candidate edits current Availability", async () => {
    const context = await setup();
    await firstSubmit(context);

    const edited = await editCandidateAvailability({
      candidateUserId: context.candidate.user._id,
      actorUser: context.candidate.user,
      applicationId: context.application._id,
      timezone: "UTC",
      slots: [],
      expectedRevision: 0,
      now: NOW,
    });

    expect(edited).toMatchObject({ status: "SUBMITTED", slots: [], revision: 1 });
    expect(
      await NotificationEvent.countDocuments({
        applicationId: context.application._id,
        type: NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_SUBMITTED,
      }),
    ).toBe(1);
  });

  it("rolls back Availability when its required NotificationEvent cannot persist", async () => {
    const context = await setup();
    vi.spyOn(NotificationEvent, "create").mockRejectedValue(
      new Error("availability event persistence failed"),
    );

    await expect(firstSubmit(context)).rejects.toThrow(
      "availability event persistence failed",
    );

    expect(
      await CandidateAvailability.countDocuments({
        applicationId: context.application._id,
      }),
    ).toBe(0);
    expect(await NotificationEvent.countDocuments()).toBe(0);
  });

  it("allows only one concurrent first-submit and leaves no orphan event", async () => {
    const context = await setup();

    const outcomes = await Promise.allSettled([
      firstSubmit(context),
      firstSubmit(context),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(
      await CandidateAvailability.countDocuments({
        applicationId: context.application._id,
      }),
    ).toBe(1);
    expect(
      await NotificationEvent.countDocuments({
        applicationId: context.application._id,
        type: NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_SUBMITTED,
      }),
    ).toBe(1);
  });

  it("keeps the durable event pending when materialization fails and recovers once", async () => {
    const context = await setup();
    vi.spyOn(Notification, "updateOne").mockRejectedValue(
      new Error("temporary inbox persistence failure"),
    );

    await firstSubmit(context);

    const event = await NotificationEvent.findOne({
      applicationId: context.application._id,
      type: NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_SUBMITTED,
    });
    expect(await CandidateAvailability.countDocuments()).toBe(1);
    expect(event.materializedAt).toBeNull();
    expect(await Notification.countDocuments({ eventId: event._id })).toBe(0);

    vi.restoreAllMocks();
    await recoverPendingNotificationEvents();
    await recoverPendingNotificationEvents();

    expect(await Notification.countDocuments({ eventId: event._id })).toBe(1);
    expect((await NotificationEvent.findById(event._id)).materializedAt).toBeInstanceOf(
      Date,
    );
  });
});
