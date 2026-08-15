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
import JOB_STATUS from "../../src/constants/job-status.js";
import MESSAGE_TYPE from "../../src/constants/message-type.js";
import SYSTEM_MESSAGE_CONTENT from "../../src/constants/system-message-content.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import Message from "../../src/models/message.model.js";
import User from "../../src/models/user.model.js";
import {
  firstAssignApplication,
  getCandidateApplicationConversation,
  getRecruiterApplicationConversation,
  reassignApplication,
  sendCandidateApplicationConversationNormalMessage,
  sendRecruiterApplicationConversationNormalMessage,
  unassignApplication,
  updateApplicationRecruitmentPipelineStatus,
  withdrawApplication,
} from "../../src/services/application.service.js";
import {
  lockAccount,
  lockCompany,
} from "../../src/services/platform-admin.service.js";
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
const APPLIED_AT = new Date("2026-08-14T12:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-14T12:00:00.000Z");

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v11-s07.pdf",
    originalFileName: "v11-s07.pdf",
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

const listMessages = async (conversationId) => {
  return Message.find({ conversationId }).sort({ createdAt: 1, _id: 1 }).lean();
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

const createTeamFixture = async ({
  emailPrefix,
  supporting = true,
  assignTo = "primary",
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
  const foreignCandidate = await createVerifiedUser({
    email: `${emailPrefix}.foreign@example.com`,
    fullName: "Foreign Candidate",
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

  const assigneeMembership =
    assignTo === "supporting" && supportingRecruiter
      ? supportingRecruiter.membership
      : primary.membership;

  const assigned = await firstAssignApplication({
    actorUser: primary.user,
    jobId: job._id.toString(),
    applicationId: application._id.toString(),
    assigneeCompanyMemberId: assigneeMembership._id.toString(),
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
    foreignCandidate,
    platformAdmin,
    job,
    application: assigned.application,
    conversation,
    assigneeMembership,
  };
};

describe("V11 Slice 07 — Final acceptance + regression closure", () => {
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

  // ─── Lifecycle unity (F01 → F10) ───

  describe("Lifecycle unity across responsibility transitions", () => {
    it("keeps one Conversation through First Assign → Reassign → Unassign → Assign again → terminal", async () => {
      const fixture = await createTeamFixture({
        emailPrefix: "v11.s07.life",
        supporting: true,
      });

      expect(await Message.countDocuments({ conversationId: fixture.conversation._id })).toBe(0);

      await sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "hello after first assign",
      });

      const afterReassign = await reassignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        assigneeCompanyMemberId: fixture.supportingRecruiter.membership._id.toString(),
        expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
        expectedVersion: fixture.application.version,
      });

      await sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.supportingRecruiter.user,
        applicationId: fixture.application.id,
        content: "hello from new assignee",
      });

      await expect(
        sendRecruiterApplicationConversationNormalMessage({
          actorUser: fixture.primary.user,
          applicationId: fixture.application.id,
          content: "former assignee send",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      const afterUnassign = await unassignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        expectedAssigneeCompanyMemberId:
          fixture.supportingRecruiter.membership._id.toString(),
        expectedVersion: afterReassign.application.version,
      });

      const paused = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
      });
      expect(paused.conversation.mode).toBe("PAUSED_UNASSIGNED");
      expect(paused.authority.canSendNormal).toBe(false);

      await expect(
        getRecruiterApplicationConversation({
          actorUser: fixture.supportingRecruiter.user,
          applicationId: fixture.application.id,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      const afterAssignAgain = await firstAssignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        assigneeCompanyMemberId: fixture.primary.membership._id.toString(),
        expectedVersion: afterUnassign.application.version,
      });

      const activeAgain = await sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "hello after assign again",
      });
      expect(activeAgain.conversation.mode).toBe("ACTIVE");

      await expect(
        sendRecruiterApplicationConversationNormalMessage({
          actorUser: fixture.supportingRecruiter.user,
          applicationId: fixture.application.id,
          content: "former after assign again",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await Application.updateOne(
        { _id: fixture.application.id },
        { $set: { status: APPLICATION_STATUS.HIRED } },
      );

      const terminal = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
      });
      expect(terminal.conversation.mode).toBe("READ_ONLY");
      expect(terminal.authority.canSendNormal).toBe(false);

      await expect(
        sendCandidateApplicationConversationNormalMessage({
          candidateUserId: fixture.candidate.user._id,
          actorUser: fixture.candidate.user,
          applicationId: fixture.application.id,
          content: "after hired",
        }),
      ).rejects.toMatchObject({ statusCode: 403, details: { mode: "READ_ONLY" } });

      const conversations = await Conversation.find({
        applicationId: fixture.application.id,
      }).lean();
      expect(conversations).toHaveLength(1);
      expect(String(conversations[0]._id)).toBe(String(fixture.conversation._id));

      const messages = await listMessages(fixture.conversation._id);
      const systemMessages = messages.filter((m) => m.type === MESSAGE_TYPE.SYSTEM);
      const normalMessages = messages.filter((m) => m.type === MESSAGE_TYPE.NORMAL);

      expect(systemMessages).toHaveLength(3);
      expect(systemMessages.map((m) => m.content)).toEqual([
        SYSTEM_MESSAGE_CONTENT.RESPONSIBILITY_CHANGED,
        SYSTEM_MESSAGE_CONTENT.AWAITING_NEW_ASSIGNEE,
        SYSTEM_MESSAGE_CONTENT.NEW_ASSIGNEE,
      ]);
      expect(systemMessages.every((m) => m.senderUserId == null)).toBe(true);
      expect(systemMessages.every((m) => m.senderCompanyMemberId == null)).toBe(
        true,
      );

      expect(normalMessages).toHaveLength(3);
      expect(String(normalMessages[0].senderUserId)).toBe(
        String(fixture.candidate.user._id),
      );
      expect(normalMessages[0].senderCompanyMemberId).toBeNull();
      expect(String(normalMessages[1].senderUserId)).toBe(
        String(fixture.supportingRecruiter.user._id),
      );
      expect(String(normalMessages[1].senderCompanyMemberId)).toBe(
        String(fixture.supportingRecruiter.membership._id),
      );

      const app = await Application.findById(fixture.application.id).lean();
      expect(app.status).toBe(APPLICATION_STATUS.HIRED);
      expect(String(app.assignedRecruiterCompanyMemberId)).toBe(
        String(fixture.primary.membership._id),
      );
      expect(afterAssignAgain.application.status).toBe(APPLICATION_STATUS.APPLIED);
    });

    it("creates independent Conversations for two Applications of the same Candidate (BR-02 / BR-03)", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "v11.s07.two.manager@example.com",
        businessRegistrationNumber: "BRN-V11-S07-TWO",
      });
      const primary = await createActiveRecruiterContext({
        email: "v11.s07.two.primary@example.com",
        company: manager.company,
        employeeCode: "NV-V11-S07-TWO-P",
      });
      const candidate = await createVerifiedUser({
        email: "v11.s07.two.candidate@example.com",
      });

      const jobA = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
      });
      const jobB = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
      });

      const applicationA = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: jobA._id,
      });
      const applicationB = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: jobB._id,
      });

      await firstAssignApplication({
        actorUser: primary.user,
        jobId: jobA._id.toString(),
        applicationId: applicationA._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedVersion: 0,
      });
      await firstAssignApplication({
        actorUser: primary.user,
        jobId: jobB._id.toString(),
        applicationId: applicationB._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedVersion: 0,
      });

      const conversations = await Conversation.find({
        applicationId: { $in: [applicationA._id, applicationB._id] },
      }).lean();
      expect(conversations).toHaveLength(2);
      expect(String(conversations[0]._id)).not.toBe(String(conversations[1]._id));
    });
  });

  // ─── Authorization matrix gaps ───

  describe("Authorization matrix closure", () => {
    it("denies Platform Admin, Company Manager, foreign Candidate, and Primary-not-Assignee Chat access (BR-07–BR-12)", async () => {
      const fixture = await createTeamFixture({
        emailPrefix: "v11.s07.auth",
        supporting: true,
        assignTo: "supporting",
      });
      const agent = createTestAgent();

      const candidateToken = await loginAndGetAccessToken(agent, {
        email: fixture.candidate.user.email,
        password: DEFAULT_PASSWORD,
      });
      const foreignToken = await loginAndGetAccessToken(agent, {
        email: fixture.foreignCandidate.user.email,
        password: DEFAULT_PASSWORD,
      });
      const primaryToken = await loginAndGetAccessToken(agent, {
        email: fixture.primary.user.email,
        password: DEFAULT_PASSWORD,
      });
      const managerToken = await loginAndGetAccessToken(agent, {
        email: fixture.manager.user.email,
        password: DEFAULT_PASSWORD,
      });
      const platformToken = await loginAndGetAccessToken(agent, {
        email: fixture.platformAdmin.user.email,
        password: DEFAULT_PASSWORD,
      });
      const assigneeToken = await loginAndGetAccessToken(agent, {
        email: fixture.supportingRecruiter.user.email,
        password: DEFAULT_PASSWORD,
      });

      const ownerRead = await agent
        .get(
          `/api/candidate/applications/${fixture.application.id}/conversation`,
        )
        .set("Authorization", `Bearer ${candidateToken}`);
      expect(ownerRead.status).toBe(200);

      const foreignRead = await agent
        .get(
          `/api/candidate/applications/${fixture.application.id}/conversation`,
        )
        .set("Authorization", `Bearer ${foreignToken}`);
      expect([403, 404]).toContain(foreignRead.status);

      const foreignSend = await agent
        .post(
          `/api/candidate/applications/${fixture.application.id}/conversation/messages`,
        )
        .set("Authorization", `Bearer ${foreignToken}`)
        .send({ content: "foreign send" });
      expect([403, 404]).toContain(foreignSend.status);

      const primaryRead = await agent
        .get(`/api/jobs/my-applications/${fixture.application.id}/conversation`)
        .set("Authorization", `Bearer ${primaryToken}`);
      expect(primaryRead.status).toBe(403);

      const primarySend = await agent
        .post(
          `/api/jobs/my-applications/${fixture.application.id}/conversation/messages`,
        )
        .set("Authorization", `Bearer ${primaryToken}`)
        .send({ content: "primary not assignee" });
      expect(primarySend.status).toBe(403);

      const managerRead = await agent
        .get(`/api/jobs/my-applications/${fixture.application.id}/conversation`)
        .set("Authorization", `Bearer ${managerToken}`);
      expect(managerRead.status).toBe(403);

      const managerSend = await agent
        .post(
          `/api/jobs/my-applications/${fixture.application.id}/conversation/messages`,
        )
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ content: "cm send" });
      expect(managerSend.status).toBe(403);

      const platformRead = await agent
        .get(`/api/jobs/my-applications/${fixture.application.id}/conversation`)
        .set("Authorization", `Bearer ${platformToken}`);
      expect([401, 403, 404]).toContain(platformRead.status);

      const platformSend = await agent
        .post(
          `/api/jobs/my-applications/${fixture.application.id}/conversation/messages`,
        )
        .set("Authorization", `Bearer ${platformToken}`)
        .send({ content: "admin send" });
      expect([401, 403, 404]).toContain(platformSend.status);

      const assigneeSend = await agent
        .post(
          `/api/jobs/my-applications/${fixture.application.id}/conversation/messages`,
        )
        .set("Authorization", `Bearer ${assigneeToken}`)
        .send({ content: "assignee ok" });
      expect(assigneeSend.status).toBe(201);
    });

    it("does not grant Chat authority from historical NORMAL or SYSTEM Messages (BR-48)", async () => {
      const fixture = await createTeamFixture({
        emailPrefix: "v11.s07.br48",
        supporting: true,
      });

      await sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "seed history",
      });

      const afterReassign = await reassignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        assigneeCompanyMemberId:
          fixture.supportingRecruiter.membership._id.toString(),
        expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
        expectedVersion: fixture.application.version,
      });

      expect(afterReassign.application.assignedRecruiterCompanyMemberId).toBe(
        fixture.supportingRecruiter.membership._id.toString(),
      );

      const messages = await listMessages(fixture.conversation._id);
      expect(
        messages.some(
          (m) =>
            m.type === MESSAGE_TYPE.SYSTEM &&
            m.content === SYSTEM_MESSAGE_CONTENT.RESPONSIBILITY_CHANGED,
        ),
      ).toBe(true);

      await expect(
        getRecruiterApplicationConversation({
          actorUser: fixture.primary.user,
          applicationId: fixture.application.id,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        sendRecruiterApplicationConversationNormalMessage({
          actorUser: fixture.primary.user,
          applicationId: fixture.application.id,
          content: "history does not authorize",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("grants Take over Assignee full Chat authority on the same Conversation (F03)", async () => {
      const fixture = await createTeamFixture({
        emailPrefix: "v11.s07.take",
        supporting: true,
        assignTo: "supporting",
      });

      // Take over = Primary Reassign onto self (V10/V11 F03).
      await reassignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        assigneeCompanyMemberId: fixture.primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          fixture.supportingRecruiter.membership._id.toString(),
        expectedVersion: fixture.application.version,
      });

      const history = await getRecruiterApplicationConversation({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
      });
      expect(history.conversation.mode).toBe("ACTIVE");
      expect(history.authority.canSendNormal).toBe(true);

      const send = await sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "takeover send",
      });
      expect(send.message.senderCompanyMemberId).toBe(
        fixture.primary.membership._id.toString(),
      );

      await expect(
        sendRecruiterApplicationConversationNormalMessage({
          actorUser: fixture.supportingRecruiter.user,
          applicationId: fixture.application.id,
          content: "former after takeover",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ─── Company lock / terminal / Job continuity ───

  describe("Company lock, terminal, and Job CLOSED/EXPIRED closure", () => {
    it("Company lock freezes Send without Unassign or SYSTEM Message (F07 / BR-31)", async () => {
      const fixture = await createTeamFixture({
        emailPrefix: "v11.s07.lock",
        supporting: false,
      });

      const before = await Application.findById(fixture.application.id).lean();
      const messageCountBefore = await Message.countDocuments({
        conversationId: fixture.conversation._id,
      });

      await lockCompany({
        companyId: fixture.manager.company._id.toString(),
      });

      const after = await Application.findById(fixture.application.id).lean();
      expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
        String(before.assignedRecruiterCompanyMemberId),
      );
      expect(after.status).toBe(before.status);
      expect(
        await Message.countDocuments({
          conversationId: fixture.conversation._id,
        }),
      ).toBe(messageCountBefore);

      const history = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
      });
      expect(history.conversation.mode).toBe("FROZEN_COMPANY");

      await expect(
        sendCandidateApplicationConversationNormalMessage({
          candidateUserId: fixture.candidate.user._id,
          actorUser: fixture.candidate.user,
          applicationId: fixture.application.id,
          content: "frozen",
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        details: { mode: "FROZEN_COMPANY" },
      });
    });

    it("HIRED and REJECTED keep history, deny Send, create no terminal SYSTEM, and block Assign reopen (F08 / BR-34–BR-36)", async () => {
      for (const terminalStatus of [
        APPLICATION_STATUS.HIRED,
        APPLICATION_STATUS.REJECTED,
      ]) {
        const fixture = await createTeamFixture({
          emailPrefix: `v11.s07.${terminalStatus.toLowerCase()}`,
          supporting: false,
        });

        await sendCandidateApplicationConversationNormalMessage({
          candidateUserId: fixture.candidate.user._id,
          actorUser: fixture.candidate.user,
          applicationId: fixture.application.id,
          content: `before ${terminalStatus}`,
        });

        await Application.updateOne(
          { _id: fixture.application.id },
          { $set: { status: terminalStatus } },
        );

        const history = await getCandidateApplicationConversation({
          candidateUserId: fixture.candidate.user._id,
          actorUser: fixture.candidate.user,
          applicationId: fixture.application.id,
        });
        expect(history.conversation.mode).toBe("READ_ONLY");
        expect(history.messages).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ content: `before ${terminalStatus}` }),
          ]),
        );

        await expect(
          sendCandidateApplicationConversationNormalMessage({
            candidateUserId: fixture.candidate.user._id,
            actorUser: fixture.candidate.user,
            applicationId: fixture.application.id,
            content: "terminal send",
          }),
        ).rejects.toMatchObject({
          statusCode: 403,
          details: { mode: "READ_ONLY" },
        });

        await expect(
          firstAssignApplication({
            actorUser: fixture.primary.user,
            jobId: fixture.job._id.toString(),
            applicationId: fixture.application.id,
            assigneeCompanyMemberId: fixture.primary.membership._id.toString(),
            expectedVersion: fixture.application.version,
          }),
        ).rejects.toMatchObject({ statusCode: expect.any(Number) });

        expect(
          await Message.countDocuments({
            conversationId: fixture.conversation._id,
            type: MESSAGE_TYPE.SYSTEM,
          }),
        ).toBe(0);
        expect(
          await Conversation.countDocuments({
            applicationId: fixture.application.id,
          }),
        ).toBe(1);

        await clearDatabase();
      }
    });

    it("Withdraw before First Assign leaves no Conversation (BR-04 / BR-38)", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "v11.s07.wd.manager@example.com",
        businessRegistrationNumber: "BRN-V11-S07-WD",
      });
      const primary = await createActiveRecruiterContext({
        email: "v11.s07.wd.primary@example.com",
        company: manager.company,
        employeeCode: "NV-V11-S07-WD-P",
      });
      const candidate = await createVerifiedUser({
        email: "v11.s07.wd.candidate@example.com",
      });
      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await withdrawApplication({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id.toString(),
        expectedVersion: 0,
      });

      expect(
        await Conversation.countDocuments({ applicationId: application._id }),
      ).toBe(0);

      await expect(
        firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: primary.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: expect.any(Number) });
    });

    it("Job CLOSED/EXPIRED does not override PAUSED_UNASSIGNED (F09 / BR-39 / BR-40)", async () => {
      const fixture = await createTeamFixture({
        emailPrefix: "v11.s07.jobend",
        supporting: false,
      });

      await unassignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        expectedAssigneeCompanyMemberId:
          fixture.primary.membership._id.toString(),
        expectedVersion: fixture.application.version,
      });

      await Job.updateOne(
        { _id: fixture.job._id },
        { $set: { status: JOB_STATUS.CLOSED } },
      );

      const closedPaused = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
      });
      expect(closedPaused.conversation.mode).toBe("PAUSED_UNASSIGNED");
      expect(closedPaused.authority.canSendNormal).toBe(false);

      await Job.updateOne(
        { _id: fixture.job._id },
        { $set: { status: JOB_STATUS.EXPIRED } },
      );

      const expiredPaused = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
      });
      expect(expiredPaused.conversation.mode).toBe("PAUSED_UNASSIGNED");
    });
  });

  // ─── TX complementary races ───

  describe("TX-06–TX-08 complementary keep/fail races", () => {
    it("keeps Message completed before Reassign and rejects stale Send after Take over (BR-41 / F10)", async () => {
      const keepFixture = await createTeamFixture({
        emailPrefix: "v11.s07.keep.re",
        supporting: true,
      });

      const keepGate = installSendPreAcquireGate(keepFixture.application.id);
      const keepSendPromise =
        sendCandidateApplicationConversationNormalMessage({
          candidateUserId: keepFixture.candidate.user._id,
          actorUser: keepFixture.candidate.user,
          applicationId: keepFixture.application.id,
          content: "completed before reassign",
        });
      await keepGate.reached;
      keepGate.release();
      const kept = await keepSendPromise;
      expect(kept.message.content).toBe("completed before reassign");

      await reassignApplication({
        actorUser: keepFixture.primary.user,
        jobId: keepFixture.job._id.toString(),
        applicationId: keepFixture.application.id,
        assigneeCompanyMemberId:
          keepFixture.supportingRecruiter.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          keepFixture.primary.membership._id.toString(),
        expectedVersion: keepFixture.application.version,
      });

      expect(
        await Message.countDocuments({
          conversationId: keepFixture.conversation._id,
          type: MESSAGE_TYPE.NORMAL,
          content: "completed before reassign",
        }),
      ).toBe(1);

      vi.restoreAllMocks();
      await clearDatabase();

      const raceFixture = await createTeamFixture({
        emailPrefix: "v11.s07.race.take",
        supporting: true,
        assignTo: "supporting",
      });

      const raceGate = installSendPreAcquireGate(raceFixture.application.id);
      const staleSend = sendRecruiterApplicationConversationNormalMessage({
        actorUser: raceFixture.supportingRecruiter.user,
        applicationId: raceFixture.application.id,
        content: "stale after takeover",
      });
      await raceGate.reached;

      await reassignApplication({
        actorUser: raceFixture.primary.user,
        jobId: raceFixture.job._id.toString(),
        applicationId: raceFixture.application.id,
        assigneeCompanyMemberId: raceFixture.primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          raceFixture.supportingRecruiter.membership._id.toString(),
        expectedVersion: raceFixture.application.version,
      });

      raceGate.release();
      await expect(staleSend).rejects.toMatchObject({ statusCode: 403 });
      expect(
        await Message.countDocuments({
          conversationId: raceFixture.conversation._id,
          type: MESSAGE_TYPE.NORMAL,
        }),
      ).toBe(0);
    });

    it("keeps Message completed before Unassign and rejects stale Recruiter Send during Unassign (BR-42)", async () => {
      const keepFixture = await createTeamFixture({
        emailPrefix: "v11.s07.keep.un",
        supporting: false,
      });

      const keepGate = installSendPreAcquireGate(keepFixture.application.id);
      const keepSendPromise =
        sendCandidateApplicationConversationNormalMessage({
          candidateUserId: keepFixture.candidate.user._id,
          actorUser: keepFixture.candidate.user,
          applicationId: keepFixture.application.id,
          content: "completed before unassign",
        });
      await keepGate.reached;
      keepGate.release();
      await keepSendPromise;

      await unassignApplication({
        actorUser: keepFixture.primary.user,
        jobId: keepFixture.job._id.toString(),
        applicationId: keepFixture.application.id,
        expectedAssigneeCompanyMemberId:
          keepFixture.primary.membership._id.toString(),
        expectedVersion: keepFixture.application.version,
      });

      expect(
        await Message.countDocuments({
          conversationId: keepFixture.conversation._id,
          content: "completed before unassign",
        }),
      ).toBe(1);

      vi.restoreAllMocks();
      await clearDatabase();

      const raceFixture = await createTeamFixture({
        emailPrefix: "v11.s07.race.un",
        supporting: false,
      });
      const raceGate = installSendPreAcquireGate(raceFixture.application.id);
      const staleSend = sendRecruiterApplicationConversationNormalMessage({
        actorUser: raceFixture.primary.user,
        applicationId: raceFixture.application.id,
        content: "stale recruiter unassign",
      });
      await raceGate.reached;

      await unassignApplication({
        actorUser: raceFixture.primary.user,
        jobId: raceFixture.job._id.toString(),
        applicationId: raceFixture.application.id,
        expectedAssigneeCompanyMemberId:
          raceFixture.primary.membership._id.toString(),
        expectedVersion: raceFixture.application.version,
      });

      raceGate.release();
      await expect(staleSend).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects stale Send when Reassign wins after Assign-again restored ACTIVE (F10 Send ↔ Reassign post-Assign-again)", async () => {
      const fixture = await createTeamFixture({
        emailPrefix: "v11.s07.race.aa",
        supporting: true,
      });

      const unassigned = await unassignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        expectedAssigneeCompanyMemberId:
          fixture.primary.membership._id.toString(),
        expectedVersion: fixture.application.version,
      });

      const assignedAgain = await firstAssignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        assigneeCompanyMemberId: fixture.primary.membership._id.toString(),
        expectedVersion: unassigned.application.version,
      });

      const gate = installSendPreAcquireGate(fixture.application.id);
      const staleFormer = sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "stale during post-assign-again reassign",
      });
      await gate.reached;

      await reassignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        assigneeCompanyMemberId:
          fixture.supportingRecruiter.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          fixture.primary.membership._id.toString(),
        expectedVersion: assignedAgain.application.version,
      });

      gate.release();
      await expect(staleFormer).rejects.toMatchObject({ statusCode: 403 });

      const newAssigneeSend =
        await sendRecruiterApplicationConversationNormalMessage({
          actorUser: fixture.supportingRecruiter.user,
          applicationId: fixture.application.id,
          content: "new assignee after assign again chain",
        });
      expect(newAssigneeSend.conversation.mode).toBe("ACTIVE");
    });

    it("TX-06: rejects Send evaluated under PAUSED_UNASSIGNED before Assign again completes (F06 / F10 / BR-25 / BR-46 Send ↔ Assign lại)", async () => {
      const fixture = await createTeamFixture({
        emailPrefix: "v11.s07.race.assignagain.send",
        supporting: true,
      });

      const advanced = await updateApplicationRecruitmentPipelineStatus({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        expectedStatus: APPLICATION_STATUS.APPLIED,
        targetStatus: APPLICATION_STATUS.SCREENING,
        expectedVersion: fixture.application.version,
      });

      const unassigned = await unassignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        expectedAssigneeCompanyMemberId:
          fixture.primary.membership._id.toString(),
        expectedVersion: advanced.application.version,
      });

      const paused = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
      });
      expect(paused.conversation.mode).toBe("PAUSED_UNASSIGNED");
      expect(paused.authority.canSendNormal).toBe(false);

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

      expect(assignedAgain.application).toMatchObject({
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId:
          fixture.supportingRecruiter.membership._id.toString(),
      });

      expect(
        await Conversation.countDocuments({
          applicationId: fixture.application.id,
        }),
      ).toBe(1);

      const messages = await listMessages(fixture.conversation._id);
      expect(
        messages.filter(
          (message) =>
            message.type === MESSAGE_TYPE.NORMAL &&
            message.content === "rejected before assign again",
        ),
      ).toHaveLength(0);
      expect(
        messages.some(
          (message) =>
            message.type === MESSAGE_TYPE.SYSTEM &&
            message.content === SYSTEM_MESSAGE_CONTENT.NEW_ASSIGNEE,
        ),
      ).toBe(true);

      const active = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
      });
      expect(active.conversation.mode).toBe("ACTIVE");
      expect(active.authority.canSendNormal).toBe(true);
    });

    it("TX-06: Assign again completing before Send reuses Conversation and enables new authority (F06 / BR-29 / BR-30 / F10 Send ↔ Assign lại)", async () => {
      const fixture = await createTeamFixture({
        emailPrefix: "v11.s07.keep.assignagain",
        supporting: true,
      });

      const advanced = await updateApplicationRecruitmentPipelineStatus({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        expectedStatus: APPLICATION_STATUS.APPLIED,
        targetStatus: APPLICATION_STATUS.SCREENING,
        expectedVersion: fixture.application.version,
      });

      const unassigned = await unassignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        expectedAssigneeCompanyMemberId:
          fixture.primary.membership._id.toString(),
        expectedVersion: advanced.application.version,
      });

      const gate = installSendPreAcquireGate(fixture.application.id);
      const candidateSendPromise =
        sendCandidateApplicationConversationNormalMessage({
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
      const sent = await candidateSendPromise;

      expect(sent.conversation.mode).toBe("ACTIVE");
      expect(sent.message.content).toBe("completed after assign again");
      expect(assignedAgain.application).toMatchObject({
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId:
          fixture.supportingRecruiter.membership._id.toString(),
      });

      expect(
        await Conversation.countDocuments({
          applicationId: fixture.application.id,
        }),
      ).toBe(1);
      expect(String(sent.conversation.id)).toBe(
        fixture.conversation._id.toString(),
      );

      const messages = await listMessages(fixture.conversation._id);
      expect(
        messages.some(
          (message) =>
            message.type === MESSAGE_TYPE.SYSTEM &&
            message.content === SYSTEM_MESSAGE_CONTENT.NEW_ASSIGNEE,
        ),
      ).toBe(true);

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
          content: "former assignee after assign again to B",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("keeps Message completed before terminal Withdraw and before Company lock (BR-44 / BR-45)", async () => {
      const terminalFixture = await createTeamFixture({
        emailPrefix: "v11.s07.keep.term",
        supporting: false,
      });

      const terminalGate = installSendPreAcquireGate(
        terminalFixture.application.id,
      );
      const terminalSendPromise =
        sendCandidateApplicationConversationNormalMessage({
          candidateUserId: terminalFixture.candidate.user._id,
          actorUser: terminalFixture.candidate.user,
          applicationId: terminalFixture.application.id,
          content: "completed before withdraw",
        });
      await terminalGate.reached;
      terminalGate.release();
      await terminalSendPromise;

      await withdrawApplication({
        candidateUserId: terminalFixture.candidate.user._id,
        actorUser: terminalFixture.candidate.user,
        applicationId: terminalFixture.application.id,
        expectedVersion: terminalFixture.application.version,
      });

      expect(
        await Message.countDocuments({
          conversationId: terminalFixture.conversation._id,
          content: "completed before withdraw",
        }),
      ).toBe(1);

      vi.restoreAllMocks();
      await clearDatabase();

      const lockFixture = await createTeamFixture({
        emailPrefix: "v11.s07.keep.lock",
        supporting: false,
      });
      const lockGate = installSendPreAcquireGate(lockFixture.application.id);
      const lockSendPromise =
        sendCandidateApplicationConversationNormalMessage({
          candidateUserId: lockFixture.candidate.user._id,
          actorUser: lockFixture.candidate.user,
          applicationId: lockFixture.application.id,
          content: "completed before company lock",
        });
      await lockGate.reached;
      lockGate.release();
      await lockSendPromise;

      await lockCompany({
        companyId: lockFixture.manager.company._id.toString(),
      });

      expect(
        await Message.countDocuments({
          conversationId: lockFixture.conversation._id,
          content: "completed before company lock",
        }),
      ).toBe(1);
    });

    it("keeps Message completed before Platform eligibility loss and completes Automatic Unassign consequence (BR-43 / BR-55 / F10)", async () => {
      const keepFixture = await createTeamFixture({
        emailPrefix: "v11.s07.keep.elig",
        supporting: true,
      });

      const sent = await sendRecruiterApplicationConversationNormalMessage({
        actorUser: keepFixture.primary.user,
        applicationId: keepFixture.application.id,
        content: "completed before eligibility loss",
      });

      await lockAccount({
        targetUserId: keepFixture.primary.user._id.toString(),
        actorUserId: keepFixture.platformAdmin.user._id,
      });

      const persisted = await Message.findById(sent.message.id).lean();
      expect(persisted.content).toBe("completed before eligibility loss");
      expect(String(persisted.senderUserId)).toBe(
        keepFixture.primary.user._id.toString(),
      );
      expect(String(persisted.senderCompanyMemberId)).toBe(
        keepFixture.primary.membership._id.toString(),
      );

      expect(
        (await User.findById(keepFixture.primary.user._id).lean()).status,
      ).toBe(USER_STATUS.LOCKED);

      const application = await Application.findById(
        keepFixture.application.id,
      ).lean();
      expect(application.assignedRecruiterCompanyMemberId).toBeNull();
      expect(application.status).toBe(APPLICATION_STATUS.APPLIED);

      expect(
        await Conversation.countDocuments({
          applicationId: keepFixture.application.id,
        }),
      ).toBe(1);

      const messages = await listMessages(keepFixture.conversation._id);
      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({
        type: MESSAGE_TYPE.NORMAL,
        content: "completed before eligibility loss",
      });
      expect(String(messages[0].senderUserId)).toBe(
        keepFixture.primary.user._id.toString(),
      );
      expect(String(messages[0].senderCompanyMemberId)).toBe(
        keepFixture.primary.membership._id.toString(),
      );
      expect(messages[1]).toMatchObject({
        type: MESSAGE_TYPE.SYSTEM,
        content: SYSTEM_MESSAGE_CONTENT.AWAITING_NEW_ASSIGNEE,
        senderUserId: null,
        senderCompanyMemberId: null,
      });

      const paused = await getCandidateApplicationConversation({
        candidateUserId: keepFixture.candidate.user._id,
        actorUser: keepFixture.candidate.user,
        applicationId: keepFixture.application.id,
      });
      expect(paused.conversation.mode).toBe("PAUSED_UNASSIGNED");
      expect(paused.authority.canSendNormal).toBe(false);
    });

    it("rejects outgoing Recruiter Send when Platform eligibility loss wins the race (BR-43 / BR-55)", async () => {
      const fixture = await createTeamFixture({
        emailPrefix: "v11.s07.race.elig",
        supporting: true,
      });

      const gate = installSendPreAcquireGate(fixture.application.id);
      const staleSend = sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "stale after eligibility loss",
      });
      await gate.reached;

      await lockAccount({
        targetUserId: fixture.primary.user._id.toString(),
        actorUserId: fixture.platformAdmin.user._id,
      });

      gate.release();
      await expect(staleSend).rejects.toMatchObject({ statusCode: 403 });
      expect(
        await Message.countDocuments({
          conversationId: fixture.conversation._id,
          type: MESSAGE_TYPE.NORMAL,
        }),
      ).toBe(0);
    });
  });

  // ─── Persistence + deferred absence ───

  describe("Persistence invariants and deferred scope absence", () => {
    it("Conversation/Message schemas exclude deferred Chat capabilities", () => {
      const conversationPaths = Object.keys(Conversation.schema.paths);
      expect(conversationPaths).not.toContain("candidateUserId");
      expect(conversationPaths).not.toContain("assigneeCompanyMemberId");
      expect(conversationPaths).not.toContain("participantIds");
      expect(conversationPaths).not.toContain("status");
      expect(conversationPaths).not.toContain("mode");
      expect(conversationPaths).not.toContain("jobId");
      expect(conversationPaths).not.toContain("companyId");

      const messagePaths = Object.keys(Message.schema.paths);
      expect(messagePaths).not.toContain("attachmentUrl");
      expect(messagePaths).not.toContain("attachments");
      expect(messagePaths).not.toContain("editedAt");
      expect(messagePaths).not.toContain("deletedAt");
      expect(messagePaths).not.toContain("reactions");
      expect(messagePaths).not.toContain("readBy");
      expect(messagePaths).not.toContain("typing");
    });

    it("does not create deferred Chat / Assignment History collections", async () => {
      const collections = await Conversation.db.db.listCollections().toArray();
      const names = collections.map((c) => c.name);
      expect(names).not.toContain("direct_conversations");
      expect(names).not.toContain("chat_rooms");
      expect(names).not.toContain("assignment_histories");
      expect(names).not.toContain("status_histories");
      expect(names).not.toContain("application_timelines");
      expect(names).not.toContain("read_receipts");
      expect(names).not.toContain("message_reactions");
    });
  });

  // ─── V10 regression ───

  describe("V10 regression with Conversation side effects", () => {
    it("Assign / Reassign / Unassign / pipeline do not invent Chat authority for Company Manager and keep Recruitment Status ownership", async () => {
      const fixture = await createTeamFixture({
        emailPrefix: "v11.s07.v10",
        supporting: true,
      });

      const afterReassign = await reassignApplication({
        actorUser: fixture.manager.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        assigneeCompanyMemberId:
          fixture.supportingRecruiter.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          fixture.primary.membership._id.toString(),
        expectedVersion: fixture.application.version,
      });
      expect(afterReassign.application.status).toBe(APPLICATION_STATUS.APPLIED);

      await expect(
        getRecruiterApplicationConversation({
          actorUser: fixture.manager.user,
          applicationId: fixture.application.id,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      const advanced = await updateApplicationRecruitmentPipelineStatus({
        actorUser: fixture.supportingRecruiter.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        expectedStatus: APPLICATION_STATUS.APPLIED,
        targetStatus: APPLICATION_STATUS.SCREENING,
        expectedVersion: afterReassign.application.version,
      });
      expect(advanced.application.status).toBe(APPLICATION_STATUS.SCREENING);

      const afterUnassign = await unassignApplication({
        actorUser: fixture.manager.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        expectedAssigneeCompanyMemberId:
          fixture.supportingRecruiter.membership._id.toString(),
        expectedVersion: advanced.application.version,
      });
      expect(afterUnassign.application.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(afterUnassign.application.assignedRecruiterCompanyMemberId).toBeNull();

      await Job.updateOne(
        { _id: fixture.job._id },
        { $set: { status: JOB_STATUS.CLOSED } },
      );
      const appAfterJobClose = await Application.findById(
        fixture.application.id,
      ).lean();
      expect(appAfterJobClose.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(appAfterJobClose.withdrawnAt).toBeNull();
    });
  });
});
