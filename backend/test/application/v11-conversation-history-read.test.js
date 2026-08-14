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
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import MESSAGE_TYPE from "../../src/constants/message-type.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import Company from "../../src/models/company.model.js";
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import Message from "../../src/models/message.model.js";
import { evaluateApplicationConversationChatAuthority } from "../../src/services/application-chat-authority.service.js";
import {
  firstAssignApplication,
  getCandidateApplicationConversation,
  getRecruiterApplicationConversation,
  reassignApplication,
  unassignApplication,
  withdrawApplication,
} from "../../src/services/application.service.js";
import { lockCompany } from "../../src/services/platform-admin.service.js";
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
const APPLIED_AT = new Date("2026-08-14T09:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-14T09:00:00.000Z");

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v11-s05.pdf",
    originalFileName: "v11-s05.pdf",
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

const seedNormalMessage = async ({
  conversationId,
  senderUserId,
  senderCompanyMemberId = null,
  content,
}) => {
  const [message] = await Message.create([
    {
      conversationId,
      type: MESSAGE_TYPE.NORMAL,
      senderUserId,
      senderCompanyMemberId,
      content,
    },
  ]);
  return message;
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
    job,
    application: assigned.application,
    conversation,
  };
};

describe("V11 Slice 05 — Conversation History Read + Authorization Modes", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("evaluateApplicationConversationChatAuthority (Slice 05 modes)", () => {
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

    const eligibleAssignee = {
      companyMemberId: "member-1",
      userId: "recruiter-1",
      membershipStatus: COMPANY_MEMBER_STATUS.ACTIVE,
      userStatus: USER_STATUS.ACTIVE,
      isContinuouslyEligible: true,
    };

    it("allows Candidate and ACTIVE persisted Assignee to read FROZEN_COMPANY history", () => {
      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.SCREENING,
          isUnassigned: false,
          companyIsOperational: false,
          currentAssignee: {
            ...eligibleAssignee,
            isContinuouslyEligible: false,
          },
          actor: candidateActor,
        }),
      ).toEqual({
        canRead: true,
        canSendNormal: false,
        mode: "FROZEN_COMPANY",
      });

      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.SCREENING,
          isUnassigned: false,
          companyIsOperational: false,
          currentAssignee: {
            ...eligibleAssignee,
            isContinuouslyEligible: false,
          },
          actor: assigneeActor,
        }),
      ).toEqual({
        canRead: true,
        canSendNormal: false,
        mode: "FROZEN_COMPANY",
      });

      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.SCREENING,
          isUnassigned: false,
          companyIsOperational: false,
          currentAssignee: {
            ...eligibleAssignee,
            isContinuouslyEligible: false,
          },
          actor: {
            ...assigneeActor,
            companyMemberId: "other-member",
          },
        }),
      ).toEqual({
        canRead: false,
        canSendNormal: false,
        mode: "FROZEN_COMPANY",
      });
    });

    it("allows Candidate and ACTIVE final Assignee to read terminal history", () => {
      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.HIRED,
          isUnassigned: false,
          companyIsOperational: false,
          currentAssignee: {
            ...eligibleAssignee,
            isContinuouslyEligible: false,
          },
          actor: candidateActor,
        }),
      ).toEqual({
        canRead: true,
        canSendNormal: false,
        mode: "READ_ONLY",
      });

      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.HIRED,
          isUnassigned: false,
          companyIsOperational: true,
          currentAssignee: {
            ...eligibleAssignee,
            isContinuouslyEligible: false,
          },
          actor: assigneeActor,
        }),
      ).toEqual({
        canRead: true,
        canSendNormal: false,
        mode: "READ_ONLY",
      });
    });

    it("denies Recruiter historical read for WITHDRAWN + UNASSIGNED", () => {
      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.WITHDRAWN,
          isUnassigned: true,
          companyIsOperational: true,
          currentAssignee: null,
          actor: candidateActor,
        }),
      ).toEqual({
        canRead: true,
        canSendNormal: false,
        mode: "READ_ONLY",
      });

      expect(
        evaluateApplicationConversationChatAuthority({
          conversationExists: true,
          applicationStatus: APPLICATION_STATUS.WITHDRAWN,
          isUnassigned: true,
          companyIsOperational: true,
          currentAssignee: null,
          actor: assigneeActor,
        }),
      ).toEqual({
        canRead: false,
        canSendNormal: false,
        mode: "READ_ONLY",
      });
    });
  });

  describe("service / HTTP Conversation history read", () => {
    it("lets Candidate and current eligible Assignee read ACTIVE Conversation history", async () => {
      const fixture = await createAssignedConversationFixture({
        emailPrefix: "v11.s05.active",
      });

      await seedNormalMessage({
        conversationId: fixture.conversation._id,
        senderUserId: fixture.candidate.user._id,
        content: "Hello from candidate",
      });
      await seedNormalMessage({
        conversationId: fixture.conversation._id,
        senderUserId: fixture.primary.user._id,
        senderCompanyMemberId: fixture.primary.membership._id,
        content: "Hello from recruiter",
      });

      const candidateHistory = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
      });

      expect(candidateHistory.conversation.mode).toBe("ACTIVE");
      expect(candidateHistory.authority).toEqual({
        canRead: true,
        canSendNormal: true,
      });
      expect(candidateHistory.messages).toHaveLength(2);
      expect(candidateHistory.messages[0]).toMatchObject({
        type: MESSAGE_TYPE.NORMAL,
        content: "Hello from candidate",
        senderUserId: fixture.candidate.user._id.toString(),
        senderCompanyMemberId: null,
      });
      expect(candidateHistory.messages[1]).toMatchObject({
        content: "Hello from recruiter",
        senderUserId: fixture.primary.user._id.toString(),
        senderCompanyMemberId: fixture.primary.membership._id.toString(),
      });

      const recruiterHistory = await getRecruiterApplicationConversation({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
      });
      expect(recruiterHistory.conversation.mode).toBe("ACTIVE");
      expect(recruiterHistory.messages).toHaveLength(2);

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
        .get(
          `/api/candidate/applications/${fixture.application.id}/conversation`,
        )
        .set("Authorization", `Bearer ${candidateToken}`);
      expect(candidateHttp.status).toBe(200);
      expect(candidateHttp.body.conversation.mode).toBe("ACTIVE");
      expect(candidateHttp.body.messages).toHaveLength(2);

      const recruiterHttp = await agent
        .get(
          `/api/jobs/my-applications/${fixture.application.id}/conversation`,
        )
        .set("Authorization", `Bearer ${recruiterToken}`);
      expect(recruiterHttp.status).toBe(200);
      expect(recruiterHttp.body.conversation.mode).toBe("ACTIVE");
    });

    it("denies Primary/Supporting/CM/cross-tenant and Former Assignee on ACTIVE Conversation", async () => {
      const fixture = await createAssignedConversationFixture({
        emailPrefix: "v11.s05.deny",
      });
      const otherCompany = await createActiveCompanyManagerContext({
        email: "v11.s05.other.manager@example.com",
        businessRegistrationNumber: "BRN-V11-S05-OTHER",
      });
      const foreignRecruiter = await createActiveRecruiterContext({
        email: "v11.s05.other.recruiter@example.com",
        company: otherCompany.company,
        employeeCode: "NV-V11-S05-OTHER",
      });

      await expect(
        getRecruiterApplicationConversation({
          actorUser: fixture.supportingRecruiter.user,
          applicationId: fixture.application.id,
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      await expect(
        getRecruiterApplicationConversation({
          actorUser: fixture.manager.user,
          applicationId: fixture.application.id,
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      await expect(
        getRecruiterApplicationConversation({
          actorUser: foreignRecruiter.user,
          applicationId: fixture.application.id,
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      const reassigned = await reassignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        assigneeCompanyMemberId:
          fixture.supportingRecruiter.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          fixture.primary.membership._id.toString(),
        expectedVersion: fixture.application.version,
      });

      await expect(
        getRecruiterApplicationConversation({
          actorUser: fixture.primary.user,
          applicationId: reassigned.application.id,
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      const newAssigneeHistory = await getRecruiterApplicationConversation({
        actorUser: fixture.supportingRecruiter.user,
        applicationId: reassigned.application.id,
      });
      expect(newAssigneeHistory.conversation.mode).toBe("ACTIVE");
    });

    it("keeps Candidate read and denies all Recruiters while PAUSED_UNASSIGNED", async () => {
      const fixture = await createAssignedConversationFixture({
        emailPrefix: "v11.s05.pause",
      });

      await seedNormalMessage({
        conversationId: fixture.conversation._id,
        senderUserId: fixture.candidate.user._id,
        content: "Keep me",
      });

      const unassigned = await unassignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        expectedAssigneeCompanyMemberId:
          fixture.primary.membership._id.toString(),
        expectedVersion: fixture.application.version,
      });

      const candidateHistory = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: unassigned.application.id,
      });
      expect(candidateHistory.conversation.mode).toBe("PAUSED_UNASSIGNED");
      expect(candidateHistory.authority.canSendNormal).toBe(false);
      expect(candidateHistory.messages.length).toBeGreaterThanOrEqual(1);

      await expect(
        getRecruiterApplicationConversation({
          actorUser: fixture.primary.user,
          applicationId: unassigned.application.id,
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      const conversationCount = await Conversation.countDocuments({
        applicationId: fixture.application.id,
      });
      expect(conversationCount).toBe(1);
    });

    it("denies outgoing Recruiter immediately in eligibility-loss window without waiting for Unassign", async () => {
      const fixture = await createAssignedConversationFixture({
        emailPrefix: "v11.s05.elig",
        supporting: false,
      });

      // Simulate eligibility loss before Automatic Unassign: leave team while
      // Application still persists the Assignee.
      await Job.updateOne(
        { _id: fixture.job._id },
        {
          $set: {
            primaryRecruiterCompanyMemberId: new mongoose.Types.ObjectId(),
            supportingRecruiterCompanyMemberIds: [],
          },
        },
      );

      const application = await Application.findById(fixture.application.id);
      expect(application.assignedRecruiterCompanyMemberId.toString()).toBe(
        fixture.primary.membership._id.toString(),
      );

      const candidateHistory = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
      });
      expect(candidateHistory.conversation.mode).toBe(
        "ELIGIBILITY_LOSS_WINDOW",
      );
      expect(candidateHistory.authority).toEqual({
        canRead: true,
        canSendNormal: false,
      });

      await expect(
        getRecruiterApplicationConversation({
          actorUser: fixture.primary.user,
          applicationId: fixture.application.id,
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("keeps Candidate + ACTIVE persisted Assignee read when Company is LOCKED", async () => {
      const fixture = await createAssignedConversationFixture({
        emailPrefix: "v11.s05.freeze",
        supporting: false,
      });

      await seedNormalMessage({
        conversationId: fixture.conversation._id,
        senderUserId: fixture.candidate.user._id,
        content: "Frozen history",
      });

      await lockCompany({ companyId: fixture.manager.company._id.toString() });
      const company = await Company.findById(fixture.manager.company._id);
      expect(company.operationalStatus).toBe(COMPANY_OPERATIONAL_STATUS.LOCKED);

      const application = await Application.findById(fixture.application.id);
      expect(application.assignedRecruiterCompanyMemberId.toString()).toBe(
        fixture.primary.membership._id.toString(),
      );

      const candidateHistory = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
      });
      expect(candidateHistory.conversation.mode).toBe("FROZEN_COMPANY");
      expect(candidateHistory.authority.canSendNormal).toBe(false);
      expect(candidateHistory.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ content: "Frozen history" }),
        ]),
      );

      const assigneeHistory = await getRecruiterApplicationConversation({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
      });
      expect(assigneeHistory.conversation.mode).toBe("FROZEN_COMPANY");
      expect(assigneeHistory.authority.canRead).toBe(true);

      const agent = createTestAgent();
      const recruiterToken = await loginAndGetAccessToken(agent, {
        email: fixture.primary.user.email,
        password: DEFAULT_PASSWORD,
      });
      const http = await agent
        .get(
          `/api/jobs/my-applications/${fixture.application.id}/conversation`,
        )
        .set("Authorization", `Bearer ${recruiterToken}`);
      expect(http.status).toBe(200);
      expect(http.body.conversation.mode).toBe("FROZEN_COMPANY");
    });

    it("allows Candidate + ACTIVE final Assignee terminal read without current team membership", async () => {
      const fixture = await createAssignedConversationFixture({
        emailPrefix: "v11.s05.term",
        supporting: false,
      });

      await seedNormalMessage({
        conversationId: fixture.conversation._id,
        senderUserId: fixture.candidate.user._id,
        content: "Terminal history",
      });

      await Application.updateOne(
        { _id: fixture.application.id },
        { $set: { status: APPLICATION_STATUS.HIRED } },
      );

      // Final Assignee may leave the Recruitment Team; historical read remains.
      await Job.updateOne(
        { _id: fixture.job._id },
        {
          $set: {
            primaryRecruiterCompanyMemberId: new mongoose.Types.ObjectId(),
            supportingRecruiterCompanyMemberIds: [],
          },
        },
      );

      const candidateHistory = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
      });
      expect(candidateHistory.conversation.mode).toBe("READ_ONLY");
      expect(candidateHistory.authority.canSendNormal).toBe(false);

      const finalAssigneeHistory = await getRecruiterApplicationConversation({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
      });
      expect(finalAssigneeHistory.conversation.mode).toBe("READ_ONLY");
      expect(finalAssigneeHistory.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ content: "Terminal history" }),
        ]),
      );
    });

    it("allows only Candidate to read WITHDRAWN + UNASSIGNED Conversation history", async () => {
      const fixture = await createAssignedConversationFixture({
        emailPrefix: "v11.s05.withdrawn",
        supporting: false,
      });

      const unassigned = await unassignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        expectedAssigneeCompanyMemberId:
          fixture.primary.membership._id.toString(),
        expectedVersion: fixture.application.version,
      });

      const withdrawn = await withdrawApplication({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: unassigned.application.id,
        expectedVersion: unassigned.application.version,
      });

      expect(withdrawn.status).toBe(APPLICATION_STATUS.WITHDRAWN);
      expect(withdrawn.assignedRecruiterCompanyMemberId ?? null).toBeNull();

      const candidateHistory = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: withdrawn.id.toString(),
      });
      expect(candidateHistory.conversation.mode).toBe("READ_ONLY");

      await expect(
        getRecruiterApplicationConversation({
          actorUser: fixture.primary.user,
          applicationId: withdrawn.id.toString(),
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("does not revoke ACTIVE Conversation read when Job is CLOSED or EXPIRED", async () => {
      const fixture = await createAssignedConversationFixture({
        emailPrefix: "v11.s05.jobclose",
        supporting: false,
      });

      await Job.updateOne(
        { _id: fixture.job._id },
        { $set: { status: JOB_STATUS.CLOSED } },
      );

      const closedHistory = await getCandidateApplicationConversation({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
      });
      expect(closedHistory.conversation.mode).toBe("ACTIVE");

      const closedRecruiter = await getRecruiterApplicationConversation({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
      });
      expect(closedRecruiter.conversation.mode).toBe("ACTIVE");

      await Job.updateOne(
        { _id: fixture.job._id },
        { $set: { status: JOB_STATUS.EXPIRED } },
      );

      const expiredHistory = await getRecruiterApplicationConversation({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
      });
      expect(expiredHistory.conversation.mode).toBe("ACTIVE");
    });

    it("lets new Assignee after Reassign read full history with unchanged sender identity", async () => {
      const fixture = await createAssignedConversationFixture({
        emailPrefix: "v11.s05.rehist",
      });

      const originalMessage = await seedNormalMessage({
        conversationId: fixture.conversation._id,
        senderUserId: fixture.primary.user._id,
        senderCompanyMemberId: fixture.primary.membership._id,
        content: "From original assignee",
      });

      const reassigned = await reassignApplication({
        actorUser: fixture.primary.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        assigneeCompanyMemberId:
          fixture.supportingRecruiter.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          fixture.primary.membership._id.toString(),
        expectedVersion: fixture.application.version,
      });

      const history = await getRecruiterApplicationConversation({
        actorUser: fixture.supportingRecruiter.user,
        applicationId: reassigned.application.id,
      });

      expect(history.conversation.mode).toBe("ACTIVE");
      const preserved = history.messages.find(
        (message) => message.id === originalMessage._id.toString(),
      );
      expect(preserved).toMatchObject({
        content: "From original assignee",
        senderUserId: fixture.primary.user._id.toString(),
        senderCompanyMemberId: fixture.primary.membership._id.toString(),
      });
    });

    it("returns 404 when Conversation does not exist", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "v11.s05.none.manager@example.com",
        businessRegistrationNumber: "BRN-V11-S05-NONE",
      });
      const primary = await createActiveRecruiterContext({
        email: "v11.s05.none.primary@example.com",
        company: manager.company,
        employeeCode: "NV-V11-S05-NONE",
      });
      const candidate = await createVerifiedUser({
        email: "v11.s05.none.candidate@example.com",
      });
      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await expect(
        getCandidateApplicationConversation({
          candidateUserId: candidate.user._id,
          actorUser: candidate.user,
          applicationId: application._id.toString(),
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
