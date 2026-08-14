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
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import Message from "../../src/models/message.model.js";
import User from "../../src/models/user.model.js";
import {
  automaticallyUnassignApplication,
  automaticallyUnassignCurrentResponsibilitiesOfRecruiter,
  evaluateApplicationConversationChatAuthority,
  firstAssignApplication,
} from "../../src/services/application.service.js";
import { removeSupportingRecruiter } from "../../src/services/job.service.js";
import { lockAccount } from "../../src/services/platform-admin.service.js";
import { lockRecruiter } from "../../src/services/recruiter.service.js";
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

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const APPLIED_AT = new Date("2026-08-14T08:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-14T08:00:00.000Z");

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v11-s04.pdf",
    originalFileName: "v11-s04.pdf",
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

const setupCompanyWithTeam = async ({ emailPrefix = "v11.s04" } = {}) => {
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
  const replacement = await createActiveRecruiterContext({
    email: `${emailPrefix}.replacement@example.com`,
    fullName: "Replacement Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-R`,
    jobTitle: "Replacement Recruiter",
  });

  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: primary.membership._id,
    supportingMemberIds: [
      supporting.membership._id,
      replacement.membership._id,
    ],
  });

  const candidate = await createVerifiedUser({
    email: `${emailPrefix}.candidate@example.com`,
    fullName: "Automatic Unassign Candidate",
  });

  const platformAdmin = await createVerifiedUser({
    email: `${emailPrefix}.platform@example.com`,
    fullName: "Platform Admin",
    role: USER_ROLE.PLATFORM_ADMIN,
  });

  return {
    manager,
    primary,
    supporting,
    replacement,
    job,
    candidate,
    platformAdmin,
  };
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

describe("V11 Slice 04 — Automatic Unassign Chat Consequence (F05)", () => {
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

  describe("service — automaticallyUnassignApplication (F05 / TX-04)", () => {
    it("keeps Conversation/history/status and adds awaiting-assignee SYSTEM Message (BR-23/BR-27/BR-28/BR-51)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s04.primitive",
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
        content: "Historical NORMAL before Automatic Unassign",
      });

      await Application.updateOne(
        { _id: application._id },
        { $set: { status: APPLICATION_STATUS.SCREENING } },
      );
      const before = await Application.findById(application._id).lean();

      const unassigned = await automaticallyUnassignApplication({
        applicationId: application._id,
        expectedAssigneeCompanyMemberId: supporting.membership._id,
        expectedVersion: before.version,
      });

      expect(unassigned.assignedRecruiterCompanyMemberId).toBeNull();
      expect(unassigned.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(unassigned.version).toBe(before.version + 1);

      const conversationsAfter = await listConversations(application._id);
      expect(conversationsAfter).toHaveLength(1);
      expect(String(conversationsAfter[0]._id)).toBe(String(conversationId));

      const messages = await listMessagesForApplication(application._id);
      expect(messages).toHaveLength(2);
      expect(String(messages[0]._id)).toBe(String(historicalMessage._id));
      expect(messages[0]).toMatchObject({
        type: MESSAGE_TYPE.NORMAL,
        content: "Historical NORMAL before Automatic Unassign",
        senderUserId: supporting.user._id,
        senderCompanyMemberId: supporting.membership._id,
      });
      expect(messages[1]).toMatchObject({
        type: MESSAGE_TYPE.SYSTEM,
        content: SYSTEM_MESSAGE_CONTENT.AWAITING_NEW_ASSIGNEE,
        senderUserId: null,
        senderCompanyMemberId: null,
      });
      expect(messages[1].content).not.toMatch(/lock|terminat|team|member/i);
    });

    it("does not create Conversation or SYSTEM Message when none existed (V10-compatible)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s04.noconv",
      });
      const created = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });
      await Application.updateOne(
        { _id: created._id },
        {
          $set: {
            assignedRecruiterCompanyMemberId: supporting.membership._id,
            version: 1,
            status: APPLICATION_STATUS.CONTACTED,
          },
        },
      );

      await automaticallyUnassignApplication({
        applicationId: created._id,
        expectedAssigneeCompanyMemberId: supporting.membership._id,
        expectedVersion: 1,
      });

      await expect(listConversations(created._id)).resolves.toHaveLength(0);
      await expect(Message.countDocuments({})).resolves.toBe(0);

      const persisted = await Application.findById(created._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      expect(persisted.status).toBe(APPLICATION_STATUS.CONTACTED);
    });

    it("rolls back Automatic Unassign when SYSTEM Message creation fails (TX-04/BR-47)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s04.tx04",
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
        .mockRejectedValue(
          new Error("forced automatic unassign system message failure"),
        );

      try {
        await expect(
          automaticallyUnassignApplication({
            applicationId: application._id,
            expectedAssigneeCompanyMemberId: supporting.membership._id,
            expectedVersion: 1,
          }),
        ).rejects.toThrow("forced automatic unassign system message failure");
      } finally {
        createSpy.mockRestore();
      }

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

    it("does not write SYSTEM Message when Automatic Unassign CAS fails (TX-04/BR-47)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s04.casfail",
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
        automaticallyUnassignApplication({
          applicationId: application._id,
          expectedAssigneeCompanyMemberId: supporting.membership._id,
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

    it("detaches multiple Applications independently with per-Conversation SYSTEM Message only", async () => {
      const { manager, primary, supporting, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v11.s04.multi",
        });
      const jobA = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const jobB = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidateB = await createVerifiedUser({
        email: "v11.s04.multi.candidateb@example.com",
        fullName: "Automatic Unassign Candidate B",
      });

      const withConversation = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: jobA._id,
      });
      const withoutConversation = await createUnassignedAppliedApplication({
        candidateUserId: candidateB.user._id,
        jobId: jobB._id,
      });

      await firstAssignWithConversation({
        actorUser: primary.user,
        jobId: jobA._id,
        applicationId: withConversation._id,
        assigneeCompanyMemberId: supporting.membership._id,
      });

      await Application.updateOne(
        { _id: withoutConversation._id },
        {
          $set: {
            assignedRecruiterCompanyMemberId: supporting.membership._id,
            version: 1,
            status: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
          },
        },
      );

      const result =
        await automaticallyUnassignCurrentResponsibilitiesOfRecruiter({
          outgoingRecruiterCompanyMemberId: supporting.membership._id,
        });

      expect(result.failed).toHaveLength(0);
      expect(result.detached).toHaveLength(2);

      const messagesWithConversation = await listMessagesForApplication(
        withConversation._id,
      );
      expect(messagesWithConversation).toHaveLength(1);
      expect(messagesWithConversation[0].content).toBe(
        SYSTEM_MESSAGE_CONTENT.AWAITING_NEW_ASSIGNEE,
      );

      await expect(
        listConversations(withoutConversation._id),
      ).resolves.toHaveLength(0);
      await expect(
        listMessagesForApplication(withoutConversation._id),
      ).resolves.toHaveLength(0);
    });
  });

  describe("lifecycle / team triggers reuse F05 consequence", () => {
    it("CompanyMember LOCK Automatic Unassign writes awaiting SYSTEM Message when Conversation exists", async () => {
      const { manager, primary, supporting, replacement, job, candidate } =
        await setupCompanyWithTeam({ emailPrefix: "v11.s04.lockcm" });
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

      await lockRecruiter({
        managerUser: manager.user,
        recruiterId: supporting.user._id.toString(),
        transfers: [],
      });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);

      const messages = await listMessagesForApplication(application._id);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        type: MESSAGE_TYPE.SYSTEM,
        content: SYSTEM_MESSAGE_CONTENT.AWAITING_NEW_ASSIGNEE,
        senderUserId: null,
        senderCompanyMemberId: null,
      });
      expect(messages[0].content).not.toMatch(/lock|terminat/i);

      // Replacement Primary remains available for Job-team; Application has no
      // replacement Assignee from Automatic Unassign.
      expect(String(replacement.membership._id)).toBeTruthy();
    });

    it("Recruitment Team removal Automatic Unassign writes awaiting SYSTEM Message when Conversation exists", async () => {
      const { manager, primary, supporting, job, candidate } =
        await setupCompanyWithTeam({ emailPrefix: "v11.s04.team" });
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

      await removeSupportingRecruiter({
        actorUser: manager.user,
        jobId: job._id.toString(),
        supportingRecruiterCompanyMemberId:
          supporting.membership._id.toString(),
      });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();

      const messages = await listMessagesForApplication(application._id);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe(
        SYSTEM_MESSAGE_CONTENT.AWAITING_NEW_ASSIGNEE,
      );
      expect(messages[0].content).not.toMatch(/team|remov/i);
    });

    it("Platform Admin User LOCK Automatic Unassign writes awaiting SYSTEM Message when Conversation exists", async () => {
      const { primary, supporting, job, candidate, platformAdmin } =
        await setupCompanyWithTeam({ emailPrefix: "v11.s04.lockuser" });
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

      await lockAccount({
        targetUserId: supporting.user._id.toString(),
        actorUserId: platformAdmin.user._id,
      });

      expect((await User.findById(supporting.user._id).lean()).status).toBe(
        USER_STATUS.LOCKED,
      );

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();

      const messages = await listMessagesForApplication(application._id);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe(
        SYSTEM_MESSAGE_CONTENT.AWAITING_NEW_ASSIGNEE,
      );
      expect(messages[0].content).not.toMatch(/lock|terminat|platform/i);
    });
  });

  describe("evaluateApplicationConversationChatAuthority (BR-26/BR-54/BR-55)", () => {
    const candidateActor = {
      kind: "CANDIDATE",
      userId: "candidate-1",
    };

    const assigneeActor = {
      kind: "RECRUITER",
      userId: "recruiter-1",
      companyMemberId: "member-1",
      membershipStatus: COMPANY_MEMBER_STATUS.ACTIVE,
      userStatus: USER_STATUS.ACTIVE,
    };

    it("locks Send immediately in eligibility-loss window while Assignee is still persisted", () => {
      const ineligibleAssignee = {
        companyMemberId: "member-1",
        userId: "recruiter-1",
        membershipStatus: COMPANY_MEMBER_STATUS.ACTIVE,
        userStatus: USER_STATUS.LOCKED,
        isContinuouslyEligible: false,
      };

      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.SCREENING,
          isUnassigned: false,
          companyIsOperational: true,
          currentAssignee: ineligibleAssignee,
          actor: candidateActor,
        }),
      ).toEqual({
        canRead: true,
        canSendNormal: false,
        mode: "ELIGIBILITY_LOSS_WINDOW",
      });

      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.SCREENING,
          isUnassigned: false,
          companyIsOperational: true,
          currentAssignee: ineligibleAssignee,
          actor: assigneeActor,
        }),
      ).toEqual({
        canRead: false,
        canSendNormal: false,
        mode: "ELIGIBILITY_LOSS_WINDOW",
      });
    });

    it("keeps Candidate read-only and Recruiter denied after Automatic Unassign", () => {
      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.SCREENING,
          isUnassigned: true,
          companyIsOperational: true,
          currentAssignee: null,
          actor: candidateActor,
        }),
      ).toEqual({
        canRead: true,
        canSendNormal: false,
        mode: "PAUSED_UNASSIGNED",
      });

      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.SCREENING,
          isUnassigned: true,
          companyIsOperational: true,
          currentAssignee: null,
          actor: assigneeActor,
        }),
      ).toEqual({
        canRead: false,
        canSendNormal: false,
        mode: "PAUSED_UNASSIGNED",
      });
    });

    it("denies LOCKED/TERMINATED Recruiter Chat access despite historical association (BR-54)", () => {
      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.HIRED,
          isUnassigned: false,
          companyIsOperational: true,
          currentAssignee: {
            companyMemberId: "member-1",
            userId: "recruiter-1",
            membershipStatus: COMPANY_MEMBER_STATUS.TERMINATED,
            userStatus: USER_STATUS.ACTIVE,
            isContinuouslyEligible: false,
          },
          actor: {
            ...assigneeActor,
            membershipStatus: COMPANY_MEMBER_STATUS.TERMINATED,
          },
        }),
      ).toEqual({
        canRead: false,
        canSendNormal: false,
        mode: "READ_ONLY",
      });

      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.SCREENING,
          isUnassigned: false,
          companyIsOperational: false,
          currentAssignee: {
            companyMemberId: "member-1",
            userId: "recruiter-1",
            membershipStatus: COMPANY_MEMBER_STATUS.ACTIVE,
            userStatus: USER_STATUS.LOCKED,
            isContinuouslyEligible: false,
          },
          actor: {
            ...assigneeActor,
            userStatus: USER_STATUS.LOCKED,
          },
        }),
      ).toEqual({
        canRead: false,
        canSendNormal: false,
        mode: "ELIGIBILITY_LOSS_WINDOW",
      });
    });

    it("allows Candidate and eligible Assignee Send only while ACTIVE and continuously eligible", () => {
      const eligibleAssignee = {
        companyMemberId: "member-1",
        userId: "recruiter-1",
        membershipStatus: COMPANY_MEMBER_STATUS.ACTIVE,
        userStatus: USER_STATUS.ACTIVE,
        isContinuouslyEligible: true,
      };

      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.APPLIED,
          isUnassigned: false,
          companyIsOperational: true,
          currentAssignee: eligibleAssignee,
          actor: candidateActor,
        }),
      ).toEqual({
        canRead: true,
        canSendNormal: true,
        mode: "ACTIVE",
      });

      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.APPLIED,
          isUnassigned: false,
          companyIsOperational: true,
          currentAssignee: eligibleAssignee,
          actor: assigneeActor,
        }),
      ).toEqual({
        canRead: true,
        canSendNormal: true,
        mode: "ACTIVE",
      });
    });
  });
});
