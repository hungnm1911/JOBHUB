import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import JOB_INVITATION_STATUS from "../../src/constants/job-invitation-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import MESSAGE_TYPE from "../../src/constants/message-type.js";
import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import Application from "../../src/models/application.model.js";
import CandidateAvailability from "../../src/models/candidate-availability.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import JobInvitation from "../../src/models/job-invitation.model.js";
import Message from "../../src/models/message.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import {
  createFirstInterviewProposal,
  firstAssignApplication,
  getCandidateApplicationConversation,
  getCandidateMyApplication,
  getRecruiterApplicationConversation,
  getRecruiterMyApplication,
  listCandidateMyApplications,
  listManagedJobs,
  listPrimaryJobApplications,
  listRecruiterMyApplications,
  reassignApplication,
  replaceSubmittedCv,
  sendCandidateApplicationConversationNormalMessage,
  submitCandidateAvailabilityFirstTime,
  unassignApplication,
  updateApplicationRecruitmentPipelineStatus,
  withdrawApplication,
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

const FUTURE_DEADLINE = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const CAPTURED_AT = new Date("2026-08-19T04:00:00.000Z");
const SENT_AT = new Date("2026-08-19T03:00:00.000Z");
const EXPIRES_AT = new Date("2026-09-03T16:59:59.999Z");
const APPLIED_AT = new Date("2026-08-19T04:30:00.000Z");

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Invitation Application Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v15-s07.pdf",
    originalFileName: "v15-s07.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 2,
  },
  capturedAt: CAPTURED_AT,
  ...overrides,
});

const createPublishedJob = async ({
  companyId,
  primaryMemberId,
  supportingMemberIds = [],
  title = "Invitation Compatibility Job",
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: FUTURE_DEADLINE(),
    title,
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
};

const createInvitationSourceApplication = async ({
  candidateUserId,
  jobId,
  assigneeMemberId,
  sourceInvitationId = new mongoose.Types.ObjectId(),
  submittedCvSnapshot = buildUploadedSnapshot(),
}) => {
  return Application.create({
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.RECRUITER_INVITATION,
    sourceInvitationId,
    status: APPLICATION_STATUS.CONTACTED,
    assignedRecruiterCompanyMemberId: assigneeMemberId,
    submittedCvSnapshot,
    appliedAt: null,
    withdrawnAt: null,
    withdrawReason: null,
    version: 0,
  });
};

const createDirectApplication = async ({
  candidateUserId,
  jobId,
  submittedCvSnapshot = buildUploadedSnapshot({
    name: "Direct Apply Snapshot",
    pdfFile: {
      storageKey: "applications/submitted-cv-snapshots/v15-s07-direct.pdf",
      originalFileName: "v15-s07-direct.pdf",
      mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
      sizeBytes: 1024,
      pageCount: 1,
    },
  }),
}) => {
  return Application.create({
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot,
    appliedAt: APPLIED_AT,
    withdrawnAt: null,
    withdrawReason: null,
    assignedRecruiterCompanyMemberId: null,
    version: 0,
  });
};

const setupInvitationApplicationContext = async ({
  emailPrefix,
  supporting = true,
} = {}) => {
  const manager = await createActiveCompanyManagerContext({
    email: `${emailPrefix}.manager@example.com`,
    businessRegistrationNumber: `BRN-${emailPrefix.toUpperCase().replace(/\./g, "-")}`,
  });
  const primary = await createActiveRecruiterContext({
    email: `${emailPrefix}.primary@example.com`,
    fullName: "Primary Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-P`,
    jobTitle: "Lead Recruiter",
  });
  const sender = supporting
    ? await createActiveRecruiterContext({
        email: `${emailPrefix}.sender@example.com`,
        fullName: "Invitation Sender",
        company: manager.company,
        employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-S`,
        jobTitle: "Supporting Recruiter",
      })
    : primary;
  const candidate = await createVerifiedUser({
    email: `${emailPrefix}.candidate@example.com`,
    fullName: "Invitation Candidate",
  });
  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: primary.membership._id,
    supportingMemberIds:
      sender.membership._id.toString() === primary.membership._id.toString()
        ? []
        : [sender.membership._id],
  });

  return { manager, primary, sender, candidate, job };
};

describe("V15 Slice 07 — Invitation-source Application compatibility (F04 partial, F10)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("reads Invitation-source CONTACTED Applications under canonical owner, tenant, and current-assignee rules", async () => {
    const { manager, primary, sender, candidate, job } =
      await setupInvitationApplicationContext({
        emailPrefix: "v15.s07.read",
      });
    const application = await createInvitationSourceApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: sender.membership._id,
    });

    const candidateList = await listCandidateMyApplications({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
    });
    expect(candidateList.applications).toHaveLength(1);
    expect(candidateList.applications[0]).toMatchObject({
      id: application._id.toString(),
      source: APPLICATION_SOURCE.RECRUITER_INVITATION,
      status: APPLICATION_STATUS.CONTACTED,
      isUnassigned: false,
      appliedAt: null,
    });

    const candidateDetail = await getCandidateMyApplication({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
    });
    expect(candidateDetail.application.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(candidateDetail.application.assignedRecruiter.fullName).toBe(
      "Invitation Sender",
    );
    expect(candidateDetail.application.availability.status).toBe("NOT_SUBMITTED");

    const senderMyApplications = await listRecruiterMyApplications({
      actorUser: sender.user,
    });
    expect(senderMyApplications.applications).toHaveLength(1);
    expect(senderMyApplications.applications[0].id).toBe(
      application._id.toString(),
    );

    const primaryMyApplications = await listRecruiterMyApplications({
      actorUser: primary.user,
    });
    expect(primaryMyApplications.applications).toHaveLength(0);

    await expect(
      getRecruiterMyApplication({
        actorUser: primary.user,
        applicationId: application._id.toString(),
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { field: "assignedRecruiterCompanyMemberId" },
    });

    const primaryView = await listPrimaryJobApplications({
      actorUser: primary.user,
      jobId: job._id,
    });
    expect(primaryView.applications).toHaveLength(1);
    expect(primaryView.applications[0].source).toBe(
      APPLICATION_SOURCE.RECRUITER_INVITATION,
    );

    const managerView = await listPrimaryJobApplications({
      actorUser: manager.user,
      jobId: job._id,
    });
    expect(managerView.applications[0].id).toBe(application._id.toString());

    const managedJobs = await listManagedJobs({ actorUser: primary.user });
    expect(managedJobs.managedJobs[0].applicationCount).toBe(1);
    expect(managedJobs.managedJobs[0].countsByStatus.CONTACTED).toBe(1);
  });

  it("keeps sourceInvitationId immutable and follows current Assignee after Reassign, not historical sender", async () => {
    const { primary, sender, candidate, job } =
      await setupInvitationApplicationContext({
        emailPrefix: "v15.s07.reassign",
      });
    const invitation = await JobInvitation.create({
      candidateUserId: candidate.user._id,
      invitedCvId: new mongoose.Types.ObjectId(),
      jobId: job._id,
      sentByRecruiterCompanyMemberId: sender.membership._id,
      invitedCvSnapshot: buildUploadedSnapshot({
        name: "Invited CV Snapshot",
      }),
      greetingMessage: "Join us",
      status: JOB_INVITATION_STATUS.PENDING,
      sentAt: SENT_AT,
      expiresAt: EXPIRES_AT,
    });
    invitation.status = JOB_INVITATION_STATUS.ACCEPTED;
    invitation.acceptedAt = new Date("2026-08-19T05:00:00.000Z");
    await invitation.save();

    const application = await createInvitationSourceApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: sender.membership._id,
      sourceInvitationId: invitation._id,
    });

    const reassigned = await reassignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: primary.membership._id.toString(),
      expectedAssigneeCompanyMemberId: sender.membership._id.toString(),
      expectedVersion: 0,
    });

    expect(reassigned.application.assignedRecruiterCompanyMemberId).toBe(
      primary.membership._id.toString(),
    );
    expect(reassigned.application.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(reassigned.application).not.toHaveProperty(
      "sourceRecruiterCompanyMemberId",
    );

    const persisted = await Application.findById(application._id).lean();
    expect(persisted.source).toBe(APPLICATION_SOURCE.RECRUITER_INVITATION);
    expect(persisted.sourceInvitationId.toString()).toBe(
      invitation._id.toString(),
    );
    expect(persisted).not.toHaveProperty("sourceRecruiterCompanyMemberId");
    expect(persisted.assignedRecruiterCompanyMemberId.toString()).toBe(
      primary.membership._id.toString(),
    );

    const refreshedInvitation = await JobInvitation.findById(invitation._id).lean();
    expect(refreshedInvitation.sentByRecruiterCompanyMemberId.toString()).toBe(
      sender.membership._id.toString(),
    );

    await expect(
      Application.updateOne(
        { _id: application._id },
        { $set: { sourceInvitationId: new mongoose.Types.ObjectId() } },
      ),
    ).rejects.toThrow("Application business identity fields are immutable after creation");

    const senderMyApplications = await listRecruiterMyApplications({
      actorUser: sender.user,
    });
    expect(senderMyApplications.applications).toHaveLength(0);

    const currentAssigneeView = await getRecruiterMyApplication({
      actorUser: primary.user,
      applicationId: application._id.toString(),
    });
    expect(currentAssigneeView.application.assignedRecruiterCompanyMemberId).toBe(
      primary.membership._id.toString(),
    );

    await expect(
      updateApplicationRecruitmentPipelineStatus({
        actorUser: sender.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedStatus: APPLICATION_STATUS.CONTACTED,
        targetStatus: APPLICATION_STATUS.REJECTED,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { field: "role" },
    });
  });

  it("lets current Assignee Unassign and First Assign again from CONTACTED without fake APPLIED or SCREENING", async () => {
    const { primary, sender, candidate, job } =
      await setupInvitationApplicationContext({
        emailPrefix: "v15.s07.assign",
      });
    const application = await createInvitationSourceApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: sender.membership._id,
    });

    const unassigned = await unassignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      expectedAssigneeCompanyMemberId: sender.membership._id.toString(),
      expectedVersion: 0,
    });
    expect(unassigned.application.isUnassigned).toBe(true);
    expect(unassigned.application.status).toBe(APPLICATION_STATUS.CONTACTED);

    const assignedAgain = await firstAssignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: primary.membership._id.toString(),
      expectedVersion: 1,
    });
    expect(assignedAgain.application.assignedRecruiterCompanyMemberId).toBe(
      primary.membership._id.toString(),
    );
    expect(assignedAgain.application.status).toBe(APPLICATION_STATUS.CONTACTED);

    const persisted = await Application.findById(application._id).lean();
    expect(persisted.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(persisted.appliedAt).toBeNull();
    expect(persisted.withdrawnAt).toBeNull();
    expect(persisted.sourceInvitationId).toBeTruthy();
  });

  it("reuses canonical pipeline from CONTACTED without a source-specific pipeline", async () => {
    const { sender, candidate, job } =
      await setupInvitationApplicationContext({
        emailPrefix: "v15.s07.pipeline",
      });
    const application = await createInvitationSourceApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: sender.membership._id,
    });

    await expect(
      updateApplicationRecruitmentPipelineStatus({
        actorUser: sender.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedStatus: APPLICATION_STATUS.CONTACTED,
        targetStatus: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    await expect(
      updateApplicationRecruitmentPipelineStatus({
        actorUser: sender.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedStatus: APPLICATION_STATUS.APPLIED,
        targetStatus: APPLICATION_STATUS.SCREENING,
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    const rejected = await updateApplicationRecruitmentPipelineStatus({
      actorUser: sender.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      expectedStatus: APPLICATION_STATUS.CONTACTED,
      targetStatus: APPLICATION_STATUS.REJECTED,
      expectedVersion: 0,
    });
    expect(rejected.application.status).toBe(APPLICATION_STATUS.REJECTED);
    expect(rejected.application.source).toBe(
      APPLICATION_SOURCE.RECRUITER_INVITATION,
    );
  });

  it("authorizes Conversation from Application owner and current Assignee when Conversation already exists", async () => {
    const { primary, sender, candidate, job } =
      await setupInvitationApplicationContext({
        emailPrefix: "v15.s07.chat",
      });
    const application = await createInvitationSourceApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: sender.membership._id,
    });

    await expect(
      getCandidateApplicationConversation({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id.toString(),
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      details: { field: "applicationId" },
    });
    expect(await Conversation.countDocuments()).toBe(0);

    const [conversation] = await Conversation.create([
      { applicationId: application._id },
    ]);
    await Message.create([
      {
        conversationId: conversation._id,
        type: MESSAGE_TYPE.NORMAL,
        senderUserId: candidate.user._id,
        content: "Hello from Candidate",
      },
    ]);

    const candidateHistory = await getCandidateApplicationConversation({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id.toString(),
    });
    expect(candidateHistory.authority.canSendNormal).toBe(true);
    expect(candidateHistory.messages).toHaveLength(1);

    const senderHistory = await getRecruiterApplicationConversation({
      actorUser: sender.user,
      applicationId: application._id.toString(),
    });
    expect(senderHistory.authority.canSendNormal).toBe(true);

    await sendCandidateApplicationConversationNormalMessage({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id.toString(),
      content: "Still chatting after Invitation-source create",
    });

    await reassignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: primary.membership._id.toString(),
      expectedAssigneeCompanyMemberId: sender.membership._id.toString(),
      expectedVersion: 0,
    });

    await expect(
      getRecruiterApplicationConversation({
        actorUser: sender.user,
        applicationId: application._id.toString(),
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const currentAssigneeHistory = await getRecruiterApplicationConversation({
      actorUser: primary.user,
      applicationId: application._id.toString(),
    });
    expect(currentAssigneeHistory.authority.canSendNormal).toBe(true);
    expect(await Conversation.countDocuments()).toBe(1);
  });

  it("accepts Invitation-source Availability and first Interview proposal at CONTACTED without inventing Availability first", async () => {
    const { sender, candidate, job } = await setupInvitationApplicationContext({
      emailPrefix: "v15.s07.availability",
    });
    const application = await createInvitationSourceApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: sender.membership._id,
    });

    expect(await CandidateAvailability.countDocuments()).toBe(0);
    const before = await getCandidateMyApplication({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
    });
    expect(before.application.availability.status).toBe("NOT_SUBMITTED");
    expect(before.application.status).toBe(APPLICATION_STATUS.CONTACTED);

    const availability = await submitCandidateAvailabilityFirstTime({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
      timezone: "Asia/Ho_Chi_Minh",
      slots: [{ date: "2026-08-20", dayPart: "MORNING" }],
      now: new Date("2026-08-19T04:00:00.000Z"),
    });
    expect(availability).toMatchObject({
      status: "SUBMITTED",
      timezone: "Asia/Ho_Chi_Minh",
      revision: 0,
    });
    expect(await CandidateAvailability.countDocuments()).toBe(1);

    const persistedApplication = await Application.findById(application._id).lean();
    expect(persistedApplication.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(persistedApplication.version).toBe(0);

    const proposal = await createFirstInterviewProposal({
      actorUser: sender.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      date: "2026-08-20",
      dayPart: "MORNING",
      expectedAvailabilityRevision: 0,
      now: new Date("2026-08-19T04:00:00.000Z"),
    });
    expect(proposal.interviewSchedule.status).toBe("PROPOSED");

    const afterProposal = await Application.findById(application._id).lean();
    expect(afterProposal.status).toBe(APPLICATION_STATUS.INTERVIEW_SCHEDULED);
    expect(afterProposal.source).toBe(APPLICATION_SOURCE.RECRUITER_INVITATION);
  });

  it("keeps submitted CV snapshot independent of live CandidateCV and source Invitation", async () => {
    const { sender, candidate, job } = await setupInvitationApplicationContext({
      emailPrefix: "v15.s07.snapshot",
    });
    const category = await Category.create({
      name: "Software Engineering",
      level: CATEGORY_LEVEL.FIELD,
      parentCategoryId: null,
    });
    const liveCv = await CandidateCV.create({
      candidateUserId: candidate.user._id,
      name: "Live Candidate CV",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      categoryId: category._id,
      experienceLevelId: null,
      preferredLocations: [],
      skillTags: ["Live"],
      employmentTypes: [],
      workModes: [],
      isDefault: false,
      archivedAt: null,
      uploadedFile: {
        storageKey: "candidate-cvs/uploaded/live-v15-s07.pdf",
        originalFileName: "live.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: 4096,
        pageCount: 3,
        uploadedAt: CAPTURED_AT,
      },
    });
    const invitation = await JobInvitation.create({
      candidateUserId: candidate.user._id,
      invitedCvId: liveCv._id,
      jobId: job._id,
      sentByRecruiterCompanyMemberId: sender.membership._id,
      invitedCvSnapshot: buildUploadedSnapshot({
        sourceCandidateCvId: liveCv._id,
        name: "Invitation Locked Snapshot",
      }),
      status: JOB_INVITATION_STATUS.PENDING,
      sentAt: SENT_AT,
      expiresAt: EXPIRES_AT,
    });
    const application = await createInvitationSourceApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: sender.membership._id,
      sourceInvitationId: invitation._id,
      submittedCvSnapshot: buildUploadedSnapshot({
        sourceCandidateCvId: liveCv._id,
        name: "Application Historical Snapshot",
      }),
    });

    liveCv.name = "Edited Live Candidate CV";
    liveCv.skillTags = ["Changed"];
    await liveCv.save();

    const detail = await getCandidateMyApplication({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id,
    });
    expect(detail.application.submittedCvSnapshot.name).toBe(
      "Application Historical Snapshot",
    );
    expect(detail.application.submittedCvSnapshot.name).not.toBe(liveCv.name);
    expect(detail.application.submittedCvSnapshot.name).not.toBe(
      "Invitation Locked Snapshot",
    );

    const persistedInvitation = await JobInvitation.findById(invitation._id).lean();
    expect(persistedInvitation.invitedCvSnapshot.name).toBe(
      "Invitation Locked Snapshot",
    );
  });

  it("denies Replace CV and Withdraw for Invitation-source while keeping Direct Apply behavior", async () => {
    const { sender, candidate, job } = await setupInvitationApplicationContext({
      emailPrefix: "v15.s07.replace",
    });
    const invitationApplication = await createInvitationSourceApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: sender.membership._id,
    });
    const directJob = await createPublishedJob({
      companyId: job.companyId,
      primaryMemberId: job.primaryRecruiterCompanyMemberId,
      title: "Direct Apply Compatibility Job",
    });
    const directApplication = await createDirectApplication({
      candidateUserId: candidate.user._id,
      jobId: directJob._id,
    });

    await expect(
      replaceSubmittedCv({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: invitationApplication._id.toString(),
        candidateCvId: new mongoose.Types.ObjectId().toString(),
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { field: "source" },
    });

    await expect(
      withdrawApplication({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: invitationApplication._id.toString(),
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { field: "source" },
    });

    const withdrawn = await withdrawApplication({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: directApplication._id.toString(),
      expectedVersion: 0,
    });
    expect(withdrawn.source).toBe(APPLICATION_SOURCE.DIRECT_APPLICATION);
    expect(withdrawn.status).toBe(APPLICATION_STATUS.WITHDRAWN);

    const invitationPersisted = await Application.findById(
      invitationApplication._id,
    ).lean();
    expect(invitationPersisted.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(invitationPersisted.withdrawnAt).toBeNull();
  });

  it("does not emit Accept-only Invitation or fake assignment/status Notifications from compatibility mutations", async () => {
    const { primary, sender, candidate, job } =
      await setupInvitationApplicationContext({
        emailPrefix: "v15.s07.notify",
      });
    const application = await createInvitationSourceApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: sender.membership._id,
    });

    await reassignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: primary.membership._id.toString(),
      expectedAssigneeCompanyMemberId: sender.membership._id.toString(),
      expectedVersion: 0,
    });

    const eventTypes = await NotificationEvent.find().distinct("type");
    expect(eventTypes).not.toContain(NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED);
    expect(eventTypes).not.toContain(NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED);
    expect(eventTypes).not.toContain(
      NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED,
    );
    expect(await Conversation.countDocuments()).toBe(0);
  });
});
