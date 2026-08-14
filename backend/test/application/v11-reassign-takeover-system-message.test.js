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
import Application from "../../src/models/application.model.js";
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import Message from "../../src/models/message.model.js";
import {
  firstAssignApplication,
  forceReassignApplication,
  reassignApplication,
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

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const APPLIED_AT = new Date("2026-08-14T06:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-14T06:00:00.000Z");

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v11-s02.pdf",
    originalFileName: "v11-s02.pdf",
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
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status: JOB_STATUS.PUBLISHED,
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

const createAssignedApplicationWithoutConversation = async ({
  candidateUserId,
  jobId,
  assigneeMemberId,
  status = APPLICATION_STATUS.APPLIED,
  version = 1,
}) => {
  const created = await Application.create({
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

  await Application.updateOne(
    { _id: created._id },
    {
      $set: {
        status,
        assignedRecruiterCompanyMemberId: assigneeMemberId,
        version,
      },
    },
  );

  return Application.findById(created._id);
};

const setupCompanyWithTeam = async ({ emailPrefix = "v11.s02" } = {}) => {
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
  const supporting = await createActiveRecruiterContext({
    email: `${emailPrefix}.supporting@example.com`,
    fullName: "Supporting Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-S`,
    jobTitle: "Supporting Recruiter",
  });
  const supportingB = await createActiveRecruiterContext({
    email: `${emailPrefix}.supportingb@example.com`,
    fullName: "Supporting Recruiter B",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-SB`,
    jobTitle: "Supporting Recruiter B",
  });

  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: primary.membership._id,
    supportingMemberIds: [
      supporting.membership._id,
      supportingB.membership._id,
    ],
  });

  const candidate = await createVerifiedUser({
    email: `${emailPrefix}.candidate@example.com`,
    fullName: "Reassign Candidate",
  });

  return { manager, primary, supporting, supportingB, job, candidate };
};

const firstAssignWithConversation = async ({
  actorUser,
  jobId,
  applicationId,
  assigneeCompanyMemberId,
  expectedVersion = 0,
}) => {
  return firstAssignApplication({
    actorUser,
    jobId: jobId.toString(),
    applicationId: applicationId.toString(),
    assigneeCompanyMemberId: assigneeCompanyMemberId.toString(),
    expectedVersion,
  });
};

const listConversations = (applicationId) => {
  return Conversation.find({ applicationId }).lean();
};

const listMessagesForApplication = async (applicationId) => {
  const conversations = await Conversation.find({ applicationId }).lean();
  if (conversations.length === 0) {
    return [];
  }

  return Message.find({
    conversationId: { $in: conversations.map((item) => item._id) },
  })
    .sort({ createdAt: 1 })
    .lean();
};

describe("V11 Slice 02 — Reassign / Take over SYSTEM Message (F03)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
    await Conversation.syncIndexes();
    await Message.syncIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("service — reassignApplication", () => {
    it("keeps Conversation, preserves history, and adds one SYSTEM Message on A → B (BR-15–BR-20/BR-51)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v11.s02.a2b",
        });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await firstAssignWithConversation({
        actorUser: primary.user,
        jobId: job._id,
        applicationId: application._id,
        assigneeCompanyMemberId: supporting.membership._id,
      });

      const conversationsBefore = await listConversations(application._id);
      expect(conversationsBefore).toHaveLength(1);
      const conversationId = conversationsBefore[0]._id;

      const historicalMessage = await Message.create({
        conversationId,
        type: MESSAGE_TYPE.NORMAL,
        senderUserId: supporting.user._id,
        senderCompanyMemberId: supporting.membership._id,
        content: "Historical NORMAL from A",
      });

      const before = await Application.findById(application._id).lean();

      const result = await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      expect(result.application).toMatchObject({
        status: APPLICATION_STATUS.APPLIED,
        isUnassigned: false,
        assignedRecruiterCompanyMemberId: supportingB.membership._id.toString(),
        version: 2,
      });

      const after = await Application.findById(application._id).lean();
      expect(after.status).toBe(before.status);
      expect(String(after.candidateUserId)).toBe(String(before.candidateUserId));
      expect(String(after.jobId)).toBe(String(before.jobId));
      expect(after.source).toBe(before.source);
      expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
      expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );

      const conversationsAfter = await listConversations(application._id);
      expect(conversationsAfter).toHaveLength(1);
      expect(String(conversationsAfter[0]._id)).toBe(conversationId.toString());

      const messages = await listMessagesForApplication(application._id);
      expect(messages).toHaveLength(2);

      const preserved = messages.find(
        (message) => String(message._id) === historicalMessage._id.toString(),
      );
      expect(preserved).toMatchObject({
        type: MESSAGE_TYPE.NORMAL,
        content: "Historical NORMAL from A",
      });
      expect(String(preserved.senderUserId)).toBe(supporting.user._id.toString());
      expect(String(preserved.senderCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );

      const systemMessages = messages.filter(
        (message) => message.type === MESSAGE_TYPE.SYSTEM,
      );
      expect(systemMessages).toHaveLength(1);
      expect(systemMessages[0]).toMatchObject({
        type: MESSAGE_TYPE.SYSTEM,
        senderUserId: null,
        senderCompanyMemberId: null,
        content: SYSTEM_MESSAGE_CONTENT.RESPONSIBILITY_CHANGED,
      });
      expect(String(systemMessages[0].conversationId)).toBe(
        conversationId.toString(),
      );
    });

    it("Take over onto Primary creates the same SYSTEM Message consequence", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s02.takeover",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await firstAssignWithConversation({
        actorUser: primary.user,
        jobId: job._id,
        applicationId: application._id,
        assigneeCompanyMemberId: supporting.membership._id,
      });

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      const conversations = await listConversations(application._id);
      expect(conversations).toHaveLength(1);
      const messages = await listMessagesForApplication(application._id);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        type: MESSAGE_TYPE.SYSTEM,
        senderUserId: null,
        senderCompanyMemberId: null,
        content: SYSTEM_MESSAGE_CONTENT.RESPONSIBILITY_CHANGED,
      });
    });

    it("lets Company Manager Reassign create SYSTEM Message on existing Conversation", async () => {
      const { manager, primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v11.s02.cm",
        });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await firstAssignWithConversation({
        actorUser: primary.user,
        jobId: job._id,
        applicationId: application._id,
        assigneeCompanyMemberId: supporting.membership._id,
      });

      await reassignApplication({
        actorUser: manager.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      const messages = await listMessagesForApplication(application._id);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe(MESSAGE_TYPE.SYSTEM);
    });

    it("lets Company Manager force-reassign create SYSTEM Message on existing Conversation", async () => {
      const { manager, primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v11.s02.force",
        });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await firstAssignWithConversation({
        actorUser: primary.user,
        jobId: job._id,
        applicationId: application._id,
        assigneeCompanyMemberId: supporting.membership._id,
      });

      await forceReassignApplication({
        actorUser: manager.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      const messages = await listMessagesForApplication(application._id);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        type: MESSAGE_TYPE.SYSTEM,
        content: SYSTEM_MESSAGE_CONTENT.RESPONSIBILITY_CHANGED,
      });
    });

    it("does not create Conversation or SYSTEM Message when none existed (BR-18)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v11.s02.noconv",
        });
      const application = await createAssignedApplicationWithoutConversation({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      const conversations = await listConversations(application._id);
      expect(conversations).toHaveLength(0);
      await expect(listMessagesForApplication(application._id)).resolves.toEqual(
        [],
      );

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );
    });

    it("creates awaiting-assignee SYSTEM Message on Unassign when Conversation exists (F04)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s02.unassign",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await firstAssignWithConversation({
        actorUser: primary.user,
        jobId: job._id,
        applicationId: application._id,
        assigneeCompanyMemberId: supporting.membership._id,
      });

      await unassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      const conversations = await listConversations(application._id);
      expect(conversations).toHaveLength(1);
      const messages = await listMessagesForApplication(application._id);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        type: MESSAGE_TYPE.SYSTEM,
        senderUserId: null,
        senderCompanyMemberId: null,
        content: SYSTEM_MESSAGE_CONTENT.AWAITING_NEW_ASSIGNEE,
      });
    });

    it("rolls back A → B when SYSTEM Message creation fails (TX-02/BR-47)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v11.s02.tx02",
        });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await firstAssignWithConversation({
        actorUser: primary.user,
        jobId: job._id,
        applicationId: application._id,
        assigneeCompanyMemberId: supporting.membership._id,
      });

      const createSpy = vi
        .spyOn(Message, "create")
        .mockRejectedValue(new Error("forced system message create failure"));

      try {
        await expect(
          reassignApplication({
            actorUser: primary.user,
            jobId: job._id.toString(),
            applicationId: application._id.toString(),
            assigneeCompanyMemberId: supportingB.membership._id.toString(),
            expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
            expectedVersion: 1,
          }),
        ).rejects.toThrow("forced system message create failure");
      } finally {
        createSpy.mockRestore();
      }

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
      expect(persisted.version).toBe(1);
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);

      const conversations = await listConversations(application._id);
      expect(conversations).toHaveLength(1);
      await expect(
        Message.countDocuments({ conversationId: conversations[0]._id }),
      ).resolves.toBe(0);
    });

    it("does not write SYSTEM Message when Reassign CAS fails (TX-02/BR-47)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v11.s02.casfail",
        });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await firstAssignWithConversation({
        actorUser: primary.user,
        jobId: job._id,
        applicationId: application._id,
        assigneeCompanyMemberId: supporting.membership._id,
      });

      await expect(
        reassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 99,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
      expect(persisted.version).toBe(1);

      const conversations = await listConversations(application._id);
      expect(conversations).toHaveLength(1);
      await expect(
        Message.countDocuments({ conversationId: conversations[0]._id }),
      ).resolves.toBe(0);
    });
  });

  describe("HTTP — POST /api/jobs/:jobId/applications/:applicationId/reassign", () => {
    it("creates SYSTEM Message on successful Reassign when Conversation exists", async () => {
      const agent = createTestAgent();
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v11.s02.http",
        });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await firstAssignWithConversation({
        actorUser: primary.user,
        jobId: job._id,
        applicationId: application._id,
        assigneeCompanyMemberId: supporting.membership._id,
      });

      const token = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/reassign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.application).toMatchObject({
        status: APPLICATION_STATUS.APPLIED,
        assignedRecruiterCompanyMemberId: supportingB.membership._id.toString(),
        version: 2,
      });
      expect(response.body.conversation).toBeUndefined();
      expect(response.body.message).toBeUndefined();

      const conversations = await listConversations(application._id);
      expect(conversations).toHaveLength(1);
      const messages = await listMessagesForApplication(application._id);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        type: MESSAGE_TYPE.SYSTEM,
        content: SYSTEM_MESSAGE_CONTENT.RESPONSIBILITY_CHANGED,
      });
    });

    it("does not persist SYSTEM Message when HTTP Reassign is forbidden", async () => {
      const agent = createTestAgent();
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v11.s02.http.deny",
        });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await firstAssignWithConversation({
        actorUser: primary.user,
        jobId: job._id,
        applicationId: application._id,
        assigneeCompanyMemberId: supporting.membership._id,
      });

      const token = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/reassign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

      expect(response.status).toBe(403);

      const conversations = await listConversations(application._id);
      expect(conversations).toHaveLength(1);
      await expect(
        Message.countDocuments({ conversationId: conversations[0]._id }),
      ).resolves.toBe(0);

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
      expect(persisted.version).toBe(1);
    });
  });
});
