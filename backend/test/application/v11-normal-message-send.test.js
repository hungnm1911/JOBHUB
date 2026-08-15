import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import MESSAGE_TYPE from "../../src/constants/message-type.js";
import SYSTEM_MESSAGE_CONTENT from "../../src/constants/system-message-content.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import Message from "../../src/models/message.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import Notification from "../../src/models/notification.model.js";
import User from "../../src/models/user.model.js";
import {
  firstAssignApplication,
  reassignApplication,
  sendCandidateApplicationConversationNormalMessage,
  sendRecruiterApplicationConversationNormalMessage,
  unassignApplication,
  withdrawApplication,
} from "../../src/services/application.service.js";
import {
  lockAccount,
  lockCompany,
} from "../../src/services/platform-admin.service.js";
import { recoverPendingNotificationEvents } from "../../src/services/notification.service.js";
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

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const APPLIED_AT = new Date("2026-08-14T10:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-14T10:00:00.000Z");

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v11-s06.pdf",
    originalFileName: "v11-s06.pdf",
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
  status = JOB_STATUS.PUBLISHED,
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: FUTURE_DEADLINE(),
    title: "Backend Engineer",
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

const createUnassignedAppliedApplication = async ({
  candidateUserId,
  jobId,
}) => {
  return Application.create({
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot: buildUploadedSnapshot(),
    appliedAt: APPLIED_AT,
    withdrawnAt: null,
    withdrawReason: null,
    assignedRecruiterCompanyMemberId: null,
    version: 0,
  });
};

const installSendPreAcquireGate = (applicationId) => {
  let releaseGate;
  let signalReached;
  let hasGated = false;
  const gate = new Promise((resolve) => {
    releaseGate = resolve;
  });
  const reached = new Promise((resolve) => {
    signalReached = resolve;
  });

  const originalFindOne = Conversation.findOne.bind(Conversation);
  vi.spyOn(Conversation, "findOne").mockImplementation(function mockFindOne(
    ...args
  ) {
    const query = originalFindOne(...args);
    const originalExec = query.exec.bind(query);

    query.exec = async function mockExec(...execArgs) {
      const result = await originalExec(...execArgs);
      if (
        !hasGated &&
        result &&
        String(result.applicationId) === String(applicationId)
      ) {
        hasGated = true;
        signalReached();
        await gate;
      }
      return result;
    };

    return query;
  });

  return {
    release: () => releaseGate(),
    reached,
  };
};

const createAssignedConversationFixture = async ({
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
  const supportingRecruiter = supporting
    ? await createActiveRecruiterContext({
        email: `${emailPrefix}.supporting@example.com`,
        fullName: "Supporting Recruiter",
        company: manager.company,
        employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-S`,
        jobTitle: "Supporting Recruiter",
      })
    : null;
  const candidate = await createVerifiedUser({
    email: `${emailPrefix}.candidate@example.com`,
    fullName: "Conversation Candidate",
  });
  const platformAdmin = await createVerifiedUser({
    email: `${emailPrefix}.platform@example.com`,
    fullName: "Platform Admin",
    role: USER_ROLE.PLATFORM_ADMIN,
  });

  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: primary.membership._id,
    supportingMemberIds: supportingRecruiter
      ? [supportingRecruiter.membership._id]
      : [],
  });

  const application = await createUnassignedAppliedApplication({
    candidateUserId: candidate.user._id,
    jobId: job._id,
  });

  const assigned = await firstAssignApplication({
    actorUser: primary.user,
    jobId: job._id.toString(),
    applicationId: application._id.toString(),
    assigneeCompanyMemberId: primary.membership._id.toString(),
    expectedVersion: application.version,
  });

  const conversation = await Conversation.findOne({
    applicationId: application._id,
  });

  return {
    manager,
    primary,
    supportingRecruiter,
    candidate,
    platformAdmin,
    job,
    application: assigned.application,
    conversation,
  };
};

const loadNormalMessageSendGuardSnapshot = async ({
  applicationId,
  jobId,
  companyId,
  assigneeCompanyMemberId,
  assigneeUserId,
  conversationId,
} = {}) => {
  const [
    application,
    job,
    company,
    companyMember,
    user,
    conversation,
  ] = await Promise.all([
    Application.findById(applicationId).lean(),
    Job.findById(jobId).lean(),
    Company.findById(companyId).lean(),
    CompanyMember.findById(assigneeCompanyMemberId).lean(),
    User.findById(assigneeUserId).lean(),
    Conversation.findById(conversationId).lean(),
  ]);

  return {
    application,
    job,
    company,
    companyMember,
    user,
    conversation,
  };
};

const expectGuardDocumentsUnchangedAfterNormalMessageSend = (
  before,
  after,
) => {
  expect(after.application.status).toBe(before.application.status);
  expect(after.application.version).toBe(before.application.version);
  expect(String(after.application.assignedRecruiterCompanyMemberId)).toBe(
    String(before.application.assignedRecruiterCompanyMemberId),
  );
  expect(after.application.candidateUserId.toString()).toBe(
    before.application.candidateUserId.toString(),
  );
  expect(after.application.jobId.toString()).toBe(
    before.application.jobId.toString(),
  );
  expect(after.application.source).toBe(before.application.source);
  expect(after.application.submittedCvSnapshot).toEqual(
    before.application.submittedCvSnapshot,
  );
  expect(after.application.updatedAt.getTime()).toBe(
    before.application.updatedAt.getTime(),
  );

  expect(after.job.status).toBe(before.job.status);
  expect(String(after.job.primaryRecruiterCompanyMemberId)).toBe(
    String(before.job.primaryRecruiterCompanyMemberId),
  );
  expect(after.job.supportingRecruiterCompanyMemberIds).toEqual(
    before.job.supportingRecruiterCompanyMemberIds,
  );
  expect(after.job.updatedAt.getTime()).toBe(before.job.updatedAt.getTime());

  expect(after.company.approvalStatus).toBe(before.company.approvalStatus);
  expect(after.company.operationalStatus).toBe(
    before.company.operationalStatus,
  );
  expect(after.company.updatedAt.getTime()).toBe(
    before.company.updatedAt.getTime(),
  );

  expect(after.companyMember.status).toBe(before.companyMember.status);
  expect(after.companyMember.role).toBe(before.companyMember.role);
  expect(after.companyMember.updatedAt.getTime()).toBe(
    before.companyMember.updatedAt.getTime(),
  );

  expect(after.user.status).toBe(before.user.status);
  expect(after.user.updatedAt.getTime()).toBe(before.user.updatedAt.getTime());

  expect(after.conversation.applicationId.toString()).toBe(
    before.conversation.applicationId.toString(),
  );
  expect(after.conversation.createdAt.getTime()).toBe(
    before.conversation.createdAt.getTime(),
  );
  expect(after.conversation).not.toHaveProperty("updatedAt");
};

describe("V11 Slice 06 — NORMAL Message Send + Full Chat Concurrency", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("does not mutate guard documents when Candidate or Assignee sends NORMAL Message (F02 / F10 / BR-49 / TX-06)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.send.guard",
    });
    const guardIds = {
      applicationId: fixture.application.id,
      jobId: fixture.job._id,
      companyId: fixture.manager.company._id,
      assigneeCompanyMemberId: fixture.primary.membership._id,
      assigneeUserId: fixture.primary.user._id,
      conversationId: fixture.conversation._id,
    };

    const beforeCandidateSend =
      await loadNormalMessageSendGuardSnapshot(guardIds);

    const candidateSend =
      await sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "Guard-safe candidate send",
      });
    expect(candidateSend.message.type).toBe(MESSAGE_TYPE.NORMAL);

    const afterCandidateSend =
      await loadNormalMessageSendGuardSnapshot(guardIds);
    expectGuardDocumentsUnchangedAfterNormalMessageSend(
      beforeCandidateSend,
      afterCandidateSend,
    );

    const beforeRecruiterSend =
      await loadNormalMessageSendGuardSnapshot(guardIds);

    const recruiterSend =
      await sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "Guard-safe recruiter send",
      });
    expect(recruiterSend.message.type).toBe(MESSAGE_TYPE.NORMAL);

    const afterRecruiterSend =
      await loadNormalMessageSendGuardSnapshot(guardIds);
    expectGuardDocumentsUnchangedAfterNormalMessageSend(
      beforeRecruiterSend,
      afterRecruiterSend,
    );

    const messages = await Message.find({
      conversationId: fixture.conversation._id,
    }).lean();
    expect(messages).toHaveLength(2);
  });

  it("creates one recipient-specific CHAT_MESSAGE_CREATED obligation for each valid NORMAL Message", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v13.s04.normal.recipients",
    });

    const candidateSend = await sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "Message from candidate",
    });
    const recruiterSend = await sendRecruiterApplicationConversationNormalMessage({
      actorUser: fixture.primary.user,
      applicationId: fixture.application.id,
      content: "Message from recruiter",
    });

    const events = await NotificationEvent.find({
      type: "CHAT_MESSAGE_CREATED",
      applicationId: fixture.application.id,
    }).lean();
    expect(events).toHaveLength(2);

    const candidateEvent = events.find(
      (event) => String(event.messageId) === candidateSend.message.id,
    );
    const recruiterEvent = events.find(
      (event) => String(event.messageId) === recruiterSend.message.id,
    );

    expect(candidateEvent).toMatchObject({
      actorUserId: fixture.candidate.user._id,
    });
    expect(String(candidateEvent.applicationId)).toBe(fixture.application.id);
    expect(String(candidateEvent.messageId)).toBe(candidateSend.message.id);
    expect(candidateEvent.recipients).toEqual([
      expect.objectContaining({
        recipientUserId: fixture.primary.user._id,
        content: "The candidate sent you a new message.",
      }),
    ]);
    expect(recruiterEvent).toMatchObject({
      actorUserId: fixture.primary.user._id,
    });
    expect(String(recruiterEvent.applicationId)).toBe(fixture.application.id);
    expect(String(recruiterEvent.messageId)).toBe(recruiterSend.message.id);
    expect(recruiterEvent.recipients).toEqual([
      expect.objectContaining({
        recipientUserId: fixture.candidate.user._id,
        content: "Your recruiter sent you a new message.",
      }),
    ]);
    expect(
      candidateEvent.recipients.some(
        (recipient) =>
          String(recipient.recipientUserId) ===
          fixture.candidate.user._id.toString(),
      ),
    ).toBe(false);
    expect(
      recruiterEvent.recipients.some(
        (recipient) =>
          String(recipient.recipientUserId) === fixture.primary.user._id.toString(),
      ),
    ).toBe(false);
    expect(await Notification.countDocuments({ eventId: candidateEvent._id })).toBe(1);
    expect(await Notification.countDocuments({ eventId: recruiterEvent._id })).toBe(1);
  });

  it("rolls back a NORMAL Message when its required Chat NotificationEvent cannot persist", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v13.s04.normal.rollback",
    });
    vi.spyOn(NotificationEvent, "create").mockRejectedValue(
      new Error("chat event persistence failed"),
    );

    await expect(
      sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "This must roll back",
      }),
    ).rejects.toThrow("chat event persistence failed");

    expect(await Message.countDocuments({ conversationId: fixture.conversation._id })).toBe(0);
    expect(await NotificationEvent.countDocuments()).toBe(0);
  });

  it("leaves no Message or Chat NotificationEvent for an unauthorized send", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v13.s04.normal.unauthorized",
    });

    await expect(
      sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.supportingRecruiter.user,
        applicationId: fixture.application.id,
        content: "Unauthorized recruiter message",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(await Message.countDocuments({ conversationId: fixture.conversation._id })).toBe(0);
    expect(
      await NotificationEvent.countDocuments({
        type: "CHAT_MESSAGE_CREATED",
      }),
    ).toBe(0);
  });

  it("keeps a committed Message pending when materialization fails, then recovers without duplicates", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v13.s04.normal.recovery",
    });
    vi.spyOn(Notification, "updateOne").mockRejectedValue(
      new Error("temporary inbox persistence failure"),
    );

    const sent = await sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "Recover this notification",
    });
    const event = await NotificationEvent.findOne({ messageId: sent.message.id });

    expect(await Message.findById(sent.message.id)).not.toBeNull();
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

  it("lets Candidate and current Assignee send NORMAL Messages with historical sender identity (F02 / BR-13 / BR-14)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.send.ok",
    });
    const applicationBefore = await Application.findById(
      fixture.application.id,
    ).lean();

    const candidateSend =
      await sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "  Hello from candidate  ",
      });

    expect(candidateSend.message.type).toBe(MESSAGE_TYPE.NORMAL);
    expect(candidateSend.message.content).toBe("Hello from candidate");
    expect(candidateSend.message.senderUserId).toBe(
      fixture.candidate.user._id.toString(),
    );
    expect(candidateSend.message.senderCompanyMemberId).toBeNull();
    expect(candidateSend.conversation.mode).toBe("ACTIVE");
    expect(candidateSend.authority).toEqual({
      canRead: true,
      canSendNormal: true,
    });

    const recruiterSend =
      await sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "Hello from recruiter",
      });

    expect(recruiterSend.message.senderUserId).toBe(
      fixture.primary.user._id.toString(),
    );
    expect(recruiterSend.message.senderCompanyMemberId).toBe(
      fixture.primary.membership._id.toString(),
    );

    const applicationAfter = await Application.findById(
      fixture.application.id,
    ).lean();
    expect(applicationAfter.status).toBe(applicationBefore.status);
    expect(applicationAfter.version).toBe(applicationBefore.version);
    expect(String(applicationAfter.assignedRecruiterCompanyMemberId)).toBe(
      String(applicationBefore.assignedRecruiterCompanyMemberId),
    );
    expect(applicationAfter.candidateUserId.toString()).toBe(
      applicationBefore.candidateUserId.toString(),
    );
    expect(applicationAfter.jobId.toString()).toBe(
      applicationBefore.jobId.toString(),
    );
    expect(applicationAfter.source).toBe(applicationBefore.source);

    const messages = await Message.find({
      conversationId: fixture.conversation._id,
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    expect(messages).toHaveLength(2);
    expect(messages[0].senderCompanyMemberId).toBeNull();
    expect(String(messages[1].senderCompanyMemberId)).toBe(
      fixture.primary.membership._id.toString(),
    );

    const agent = createTestAgent();
    const candidateToken = await loginAndGetAccessToken(agent, {
      email: fixture.candidate.user.email,
      password: DEFAULT_PASSWORD,
    });
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: fixture.primary.user.email,
      password: DEFAULT_PASSWORD,
    });

    const candidateHttp = await agent
      .post(
        `/api/candidate/applications/${fixture.application.id}/conversation/messages`,
      )
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({ content: "via http candidate" });
    expect(candidateHttp.status).toBe(201);
    expect(candidateHttp.body.message.senderCompanyMemberId).toBeNull();

    const recruiterHttp = await agent
      .post(
        `/api/jobs/my-applications/${fixture.application.id}/conversation/messages`,
      )
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({ content: "via http recruiter" });
    expect(recruiterHttp.status).toBe(201);
    expect(recruiterHttp.body.message.senderCompanyMemberId).toBe(
      fixture.primary.membership._id.toString(),
    );

    const rejectedClientIdentity = await agent
      .post(
        `/api/candidate/applications/${fixture.application.id}/conversation/messages`,
      )
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({
        content: "spoof",
        type: MESSAGE_TYPE.SYSTEM,
        senderUserId: fixture.primary.user._id.toString(),
      });
    expect(rejectedClientIdentity.status).toBe(400);
  });

  it("denies Send when UNASSIGNED, terminal, Company frozen, or actor is not current Assignee (BR-25 / BR-32 / BR-34 / BR-54)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.send.deny",
    });

    await expect(
      sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.supportingRecruiter.user,
        applicationId: fixture.application.id,
        content: "not assignee",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "ACTIVE" },
    });

    await unassignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
    });

    await expect(
      sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "after unassign",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "PAUSED_UNASSIGNED" },
    });

    await expect(
      sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "former assignee",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "PAUSED_UNASSIGNED" },
    });

    const assignedAgain = await firstAssignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      assigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: (await Application.findById(fixture.application.id))
        .version,
    });

    const candidateOk =
      await sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "after assign again",
      });
    expect(candidateOk.conversation.mode).toBe("ACTIVE");

    await lockCompany({
      companyId: fixture.manager.company._id.toString(),
    });

    await expect(
      sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "frozen company",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "FROZEN_COMPANY" },
    });

    await expect(
      sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "frozen recruiter",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const other = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.send.terminal",
    });
    await withdrawApplication({
      candidateUserId: other.candidate.user._id,
      actorUser: other.candidate.user,
      applicationId: other.application.id,
      expectedVersion: other.application.version,
    });

    await expect(
      sendCandidateApplicationConversationNormalMessage({
        candidateUserId: other.candidate.user._id,
        actorUser: other.candidate.user,
        applicationId: other.application.id,
        content: "terminal",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "READ_ONLY" },
    });

    expect(assignedAgain.application.assignedRecruiterCompanyMemberId).toBe(
      fixture.primary.membership._id.toString(),
    );
  });

  it("keeps Chat writable when Job is CLOSED or EXPIRED (F09 / BR-39 / BR-40)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.job.lifecycle",
    });

    await Job.findByIdAndUpdate(fixture.job._id, {
      $set: { status: JOB_STATUS.CLOSED },
    });

    const closedSend =
      await sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "still writable on closed job",
      });
    expect(closedSend.conversation.mode).toBe("ACTIVE");

    await Job.findByIdAndUpdate(fixture.job._id, {
      $set: { status: JOB_STATUS.EXPIRED },
    });

    const expiredSend =
      await sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "still writable on expired job",
      });
    expect(expiredSend.conversation.mode).toBe("ACTIVE");
  });

  it("locks Send in eligibility-loss window before Automatic Unassign completes (BR-43 / BR-55)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.elig.loss",
    });

    await User.findByIdAndUpdate(fixture.primary.user._id, {
      $set: { status: USER_STATUS.LOCKED },
    });

    await expect(
      sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "candidate during eligibility loss",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "ELIGIBILITY_LOSS_WINDOW" },
    });

    const stillAssigned = await Application.findById(fixture.application.id);
    expect(String(stillAssigned.assignedRecruiterCompanyMemberId)).toBe(
      fixture.primary.membership._id.toString(),
    );

    await expect(
      sendRecruiterApplicationConversationNormalMessage({
        actorUser: {
          ...fixture.primary.user.toObject(),
          status: USER_STATUS.LOCKED,
        },
        applicationId: fixture.application.id,
        content: "outgoing recruiter",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("TX-06: Reassign completing before Send rejects stale outgoing Recruiter Message (BR-41)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.reassign",
    });

    const gate = installSendPreAcquireGate(fixture.application.id);

    const sendPromise = sendRecruiterApplicationConversationNormalMessage({
      actorUser: fixture.primary.user,
      applicationId: fixture.application.id,
      content: "stale outgoing send",
    });

    await gate.reached;

    await reassignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      assigneeCompanyMemberId: fixture.supportingRecruiter.membership._id.toString(),
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
    });

    gate.release();

    await expect(sendPromise).rejects.toMatchObject({
      statusCode: 403,
    });

    const messages = await Message.find({
      conversationId: fixture.conversation._id,
      type: MESSAGE_TYPE.NORMAL,
    }).lean();
    expect(messages).toHaveLength(0);

    const newAssigneeSend =
      await sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.supportingRecruiter.user,
        applicationId: fixture.application.id,
        content: "new assignee after reassign",
      });
    expect(newAssigneeSend.message.senderCompanyMemberId).toBe(
      fixture.supportingRecruiter.membership._id.toString(),
    );
  });

  it("TX-06: Send completing before Reassign keeps Message and preserves sender (BR-13 / BR-41)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.send.wins",
    });

    const sent = await sendRecruiterApplicationConversationNormalMessage({
      actorUser: fixture.primary.user,
      applicationId: fixture.application.id,
      content: "completed before reassign",
    });

    await reassignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      assigneeCompanyMemberId: fixture.supportingRecruiter.membership._id.toString(),
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
    });

    const persisted = await Message.findById(sent.message.id).lean();
    expect(persisted.content).toBe("completed before reassign");
    expect(String(persisted.senderUserId)).toBe(
      fixture.primary.user._id.toString(),
    );
    expect(String(persisted.senderCompanyMemberId)).toBe(
      fixture.primary.membership._id.toString(),
    );
  });

  it("TX-06: Unassign completing before Send rejects pending Candidate and Recruiter Messages (BR-25 / BR-42)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.unassign",
    });

    const gate = installSendPreAcquireGate(fixture.application.id);

    const candidateSendPromise =
      sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "stale after unassign",
      });

    await gate.reached;

    await unassignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
    });

    gate.release();

    await expect(candidateSendPromise).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      await Message.countDocuments({
        conversationId: fixture.conversation._id,
        type: MESSAGE_TYPE.NORMAL,
      }),
    ).toBe(0);
  });

  it("TX-07: terminal Withdraw completing before Send rejects pending Message (BR-45)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.terminal",
    });

    const gate = installSendPreAcquireGate(fixture.application.id);

    const sendPromise = sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "stale after withdraw",
    });

    await gate.reached;

    await withdrawApplication({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      expectedVersion: fixture.application.version,
    });

    gate.release();

    await expect(sendPromise).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      await Message.countDocuments({
        conversationId: fixture.conversation._id,
        type: MESSAGE_TYPE.NORMAL,
      }),
    ).toBe(0);
  });

  it("TX-08: Company lock completing before Send rejects pending Message (BR-44)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.company",
    });

    const gate = installSendPreAcquireGate(fixture.application.id);

    const sendPromise = sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "stale after company lock",
    });

    await gate.reached;

    await lockCompany({
      companyId: fixture.manager.company._id.toString(),
    });

    gate.release();

    await expect(sendPromise).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "FROZEN_COMPANY" },
    });

    expect(
      await Message.countDocuments({
        conversationId: fixture.conversation._id,
        type: MESSAGE_TYPE.NORMAL,
      }),
    ).toBe(0);
  });

  it("TX-06: Send completing before Platform eligibility loss keeps Message and Automatic Unassign consequence (BR-43 / BR-55 / F10)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.send.wins.elig",
      supporting: true,
    });

    const sent = await sendRecruiterApplicationConversationNormalMessage({
      actorUser: fixture.primary.user,
      applicationId: fixture.application.id,
      content: "completed before eligibility loss",
    });

    await lockAccount({
      targetUserId: fixture.primary.user._id.toString(),
      actorUserId: fixture.platformAdmin.user._id,
    });

    const persisted = await Message.findById(sent.message.id).lean();
    expect(persisted.content).toBe("completed before eligibility loss");
    expect(String(persisted.senderUserId)).toBe(
      fixture.primary.user._id.toString(),
    );
    expect(String(persisted.senderCompanyMemberId)).toBe(
      fixture.primary.membership._id.toString(),
    );

    const lockedUser = await User.findById(fixture.primary.user._id).lean();
    expect(lockedUser.status).toBe(USER_STATUS.LOCKED);

    const application = await Application.findById(fixture.application.id).lean();
    expect(application.assignedRecruiterCompanyMemberId).toBeNull();
    expect(application.status).toBe(APPLICATION_STATUS.APPLIED);

    expect(
      await Conversation.countDocuments({
        applicationId: fixture.application.id,
      }),
    ).toBe(1);

    const messages = await Message.find({
      conversationId: fixture.conversation._id,
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      type: MESSAGE_TYPE.NORMAL,
      content: "completed before eligibility loss",
    });
    expect(String(messages[0].senderUserId)).toBe(
      fixture.primary.user._id.toString(),
    );
    expect(String(messages[0].senderCompanyMemberId)).toBe(
      fixture.primary.membership._id.toString(),
    );
    expect(messages[1]).toMatchObject({
      type: MESSAGE_TYPE.SYSTEM,
      content: SYSTEM_MESSAGE_CONTENT.AWAITING_NEW_ASSIGNEE,
      senderUserId: null,
      senderCompanyMemberId: null,
    });

    const membership = await CompanyMember.findById(
      fixture.primary.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("TX-06: Candidate Send completing before Platform eligibility loss keeps Message (BR-43 / BR-55)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.candidate.wins.elig",
      supporting: true,
    });

    const sent = await sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "candidate before eligibility loss",
    });

    await lockAccount({
      targetUserId: fixture.primary.user._id.toString(),
      actorUserId: fixture.platformAdmin.user._id,
    });

    const persisted = await Message.findById(sent.message.id).lean();
    expect(persisted.content).toBe("candidate before eligibility loss");
    expect(String(persisted.senderUserId)).toBe(
      fixture.candidate.user._id.toString(),
    );
    expect(persisted.senderCompanyMemberId).toBeNull();

    expect(
      await Application.findById(fixture.application.id).lean(),
    ).toMatchObject({
      assignedRecruiterCompanyMemberId: null,
      status: APPLICATION_STATUS.APPLIED,
    });

    expect(
      await Message.countDocuments({
        conversationId: fixture.conversation._id,
        type: MESSAGE_TYPE.NORMAL,
        content: "candidate before eligibility loss",
      }),
    ).toBe(1);
    expect(
      await Message.countDocuments({
        conversationId: fixture.conversation._id,
        type: MESSAGE_TYPE.SYSTEM,
        content: SYSTEM_MESSAGE_CONTENT.AWAITING_NEW_ASSIGNEE,
      }),
    ).toBe(1);
    expect(
      await Conversation.countDocuments({
        applicationId: fixture.application.id,
      }),
    ).toBe(1);
  });

  it("TX-06: rejects Send evaluated under PAUSED_UNASSIGNED before Assign again completes (F06 / F10 / BR-25 / BR-46 Send ↔ Assign lại)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.assignagain.send",
      supporting: true,
    });

    const unassigned = await unassignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
    });

    await expect(
      sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "rejected before assign again",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "PAUSED_UNASSIGNED" },
    });

    const assignedAgain = await firstAssignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      assigneeCompanyMemberId:
        fixture.supportingRecruiter.membership._id.toString(),
      expectedVersion: unassigned.application.version,
    });

    expect(assignedAgain.application.assignedRecruiterCompanyMemberId).toBe(
      fixture.supportingRecruiter.membership._id.toString(),
    );
    expect(assignedAgain.application.status).toBe(APPLICATION_STATUS.APPLIED);

    expect(
      await Conversation.countDocuments({
        applicationId: fixture.application.id,
      }),
    ).toBe(1);

    expect(
      await Message.countDocuments({
        conversationId: fixture.conversation._id,
        type: MESSAGE_TYPE.NORMAL,
        content: "rejected before assign again",
      }),
    ).toBe(0);
    expect(
      await Message.countDocuments({
        conversationId: fixture.conversation._id,
        type: MESSAGE_TYPE.SYSTEM,
        content: SYSTEM_MESSAGE_CONTENT.NEW_ASSIGNEE,
      }),
    ).toBe(1);
  });

  it("TX-06: Assign again completing before Send reuses Conversation and enables new authority (F06 / BR-29 / BR-30 / F10 Send ↔ Assign lại)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.assignagain.keep",
      supporting: true,
    });

    const unassigned = await unassignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
    });

    const gate = installSendPreAcquireGate(fixture.application.id);
    const sendPromise = sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "completed after assign again",
    });
    await gate.reached;

    const assignedAgain = await firstAssignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      assigneeCompanyMemberId:
        fixture.supportingRecruiter.membership._id.toString(),
      expectedVersion: unassigned.application.version,
    });

    gate.release();
    const sent = await sendPromise;

    expect(sent.conversation.mode).toBe("ACTIVE");
    expect(sent.message.content).toBe("completed after assign again");
    expect(assignedAgain.application.assignedRecruiterCompanyMemberId).toBe(
      fixture.supportingRecruiter.membership._id.toString(),
    );
    expect(assignedAgain.application.status).toBe(APPLICATION_STATUS.APPLIED);

    expect(
      await Conversation.countDocuments({
        applicationId: fixture.application.id,
      }),
    ).toBe(1);

    const persisted = await Message.findById(sent.message.id).lean();
    expect(String(persisted.conversationId)).toBe(
      fixture.conversation._id.toString(),
    );

    const newAssigneeSend =
      await sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.supportingRecruiter.user,
        applicationId: fixture.application.id,
        content: "new assignee after assign again",
      });
    expect(newAssigneeSend.message.senderCompanyMemberId).toBe(
      fixture.supportingRecruiter.membership._id.toString(),
    );

    await expect(
      sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "former assignee stale after assign again to B",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("TX-06: Platform eligibility loss completing before Send rejects pending Message (BR-43)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.platform",
      supporting: true,
    });

    expect(fixture.supportingRecruiter).toBeTruthy();

    const gate = installSendPreAcquireGate(fixture.application.id);

    const sendPromise = sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "stale after platform lock",
    });

    await gate.reached;

    await lockAccount({
      targetUserId: fixture.primary.user._id.toString(),
      actorUserId: fixture.platformAdmin.user._id,
    });

    gate.release();

    await expect(sendPromise).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      await Message.countDocuments({
        conversationId: fixture.conversation._id,
        type: MESSAGE_TYPE.NORMAL,
      }),
    ).toBe(0);

    const membership = await CompanyMember.findById(
      fixture.primary.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });
});
