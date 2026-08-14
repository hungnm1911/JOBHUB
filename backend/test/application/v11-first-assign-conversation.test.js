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
import Application from "../../src/models/application.model.js";
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import Message from "../../src/models/message.model.js";
import { firstAssignApplication } from "../../src/services/application.service.js";
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
const APPLIED_AT = new Date("2026-08-13T06:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-13T06:00:00.000Z");

const NON_TERMINAL_STATUSES = [
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
];

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v11-s01.pdf",
    originalFileName: "v11-s01.pdf",
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
  submittedCvSnapshot = buildUploadedSnapshot(),
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

const createUnassignedApplication = async ({
  candidateUserId,
  jobId,
  status = APPLICATION_STATUS.APPLIED,
}) => {
  const created = await createUnassignedAppliedApplication({
    candidateUserId,
    jobId,
  });

  if (status === APPLICATION_STATUS.APPLIED) {
    return created;
  }

  await Application.updateOne(
    { _id: created._id },
    { $set: { status, version: 1 } },
  );

  return Application.findById(created._id);
};

const expectedVersionForUnassignedStatus = (status) => {
  return status === APPLICATION_STATUS.APPLIED ? 0 : 1;
};

const setupCompanyWithTeam = async ({ emailPrefix = "v11.s01" } = {}) => {
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

  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: primary.membership._id,
    supportingMemberIds: [supporting.membership._id],
  });

  const candidate = await createVerifiedUser({
    email: `${emailPrefix}.candidate@example.com`,
    fullName: "Assign Candidate",
  });

  return { manager, primary, supporting, job, candidate };
};

const countConversationsForApplication = (applicationId) => {
  return Conversation.countDocuments({ applicationId });
};

const countMessagesForApplication = async (applicationId) => {
  const conversations = await Conversation.find({ applicationId }).lean();
  if (conversations.length === 0) {
    return 0;
  }

  return Message.countDocuments({
    conversationId: { $in: conversations.map((conversation) => conversation._id) },
  });
};

describe("V11 Slice 01 — First Assign Conversation creation (F01)", () => {
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

  describe("service — firstAssignApplication", () => {
    it("creates exactly one Conversation with zero Messages and keeps Recruitment Status (BR-05/BR-06)", async () => {
      const { primary, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s01.self",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });
      const before = await Application.findById(application._id).lean();

      const result = await firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedVersion: 0,
      });

      expect(result.application).toMatchObject({
        status: APPLICATION_STATUS.APPLIED,
        isUnassigned: false,
        assignedRecruiterCompanyMemberId: primary.membership._id.toString(),
        version: 1,
      });

      const after = await Application.findById(application._id).lean();
      expect(after.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(String(after.candidateUserId)).toBe(String(before.candidateUserId));
      expect(String(after.jobId)).toBe(String(before.jobId));
      expect(after.source).toBe(before.source);
      expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);

      const conversations = await Conversation.find({
        applicationId: application._id,
      }).lean();
      expect(conversations).toHaveLength(1);
      expect(conversations[0].createdAt).toBeInstanceOf(Date);
      expect(conversations[0]).not.toHaveProperty("candidateUserId");
      expect(conversations[0]).not.toHaveProperty(
        "assignedRecruiterCompanyMemberId",
      );
      expect(conversations[0]).not.toHaveProperty("status");
      await expect(
        Message.countDocuments({ conversationId: conversations[0]._id }),
      ).resolves.toBe(0);
    });

    it("lets owning-Company Manager First Assign create the same Conversation consequence", async () => {
      const { manager, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s01.cm",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await firstAssignApplication({
        actorUser: manager.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 0,
      });

      await expect(
        countConversationsForApplication(application._id),
      ).resolves.toBe(1);
      await expect(countMessagesForApplication(application._id)).resolves.toBe(
        0,
      );
    });

    it.each(NON_TERMINAL_STATUSES)(
      "creates Conversation for Unassigned %s without changing status",
      async (status) => {
        const { primary, supporting, job, candidate } =
          await setupCompanyWithTeam({
            emailPrefix: `v11.s01.status.${status.toLowerCase()}`,
          });
        const application = await createUnassignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          status,
        });

        const result = await firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: expectedVersionForUnassignedStatus(status),
        });

        expect(result.application.status).toBe(status);
        await expect(
          countConversationsForApplication(application._id),
        ).resolves.toBe(1);
        await expect(
          countMessagesForApplication(application._id),
        ).resolves.toBe(0);
      },
    );

    it("does not create Conversation when Application was never Assigned (BR-04/BR-53)", async () => {
      const { job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s01.never",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await expect(
        countConversationsForApplication(application._id),
      ).resolves.toBe(0);
      await expect(countMessagesForApplication(application._id)).resolves.toBe(
        0,
      );
    });

    it("does not create Conversation when Assign is rejected", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s01.deny",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await expect(
        firstAssignApplication({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      await expect(
        countConversationsForApplication(application._id),
      ).resolves.toBe(0);
    });

    it("rolls back Assign when Conversation creation fails (TX-01)", async () => {
      const { primary, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s01.tx01",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });
      const createSpy = vi
        .spyOn(Conversation, "create")
        .mockRejectedValue(new Error("forced conversation create failure"));

      try {
        await expect(
          firstAssignApplication({
            actorUser: primary.user,
            jobId: job._id.toString(),
            applicationId: application._id.toString(),
            assigneeCompanyMemberId: primary.membership._id.toString(),
            expectedVersion: 0,
          }),
        ).rejects.toThrow("forced conversation create failure");
      } finally {
        createSpy.mockRestore();
      }

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(persisted.version).toBe(0);
      await expect(
        countConversationsForApplication(application._id),
      ).resolves.toBe(0);
    });

    it("creates only one Conversation when two First Assigns compete (TX-01)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s01.race",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      const results = await Promise.allSettled([
        firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: primary.membership._id.toString(),
          expectedVersion: 0,
        }),
        firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 0,
        }),
      ]);

      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.statusCode).toBe(409);

      await expect(
        countConversationsForApplication(application._id),
      ).resolves.toBe(1);
      await expect(countMessagesForApplication(application._id)).resolves.toBe(
        0,
      );
    });

    it("does not create a second Conversation or Message when Conversation already exists", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s01.existing",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });
      const existing = await Conversation.create({
        applicationId: application._id,
      });

      await firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 0,
      });

      const conversations = await Conversation.find({
        applicationId: application._id,
      }).lean();
      expect(conversations).toHaveLength(1);
      expect(String(conversations[0]._id)).toBe(existing._id.toString());
      await expect(
        Message.countDocuments({ conversationId: existing._id }),
      ).resolves.toBe(0);
    });
  });

  describe("HTTP — POST /api/jobs/:jobId/applications/:applicationId/assign", () => {
    it("creates Conversation with zero Messages on successful First Assign", async () => {
      const agent = createTestAgent();
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s01.http",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/assign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 0,
        });

      expect(response.status).toBe(200);
      expect(response.body.application).toMatchObject({
        status: APPLICATION_STATUS.APPLIED,
        isUnassigned: false,
        assignedRecruiterCompanyMemberId: supporting.membership._id.toString(),
      });
      expect(response.body.conversation).toBeUndefined();

      await expect(
        countConversationsForApplication(application._id),
      ).resolves.toBe(1);
      await expect(countMessagesForApplication(application._id)).resolves.toBe(
        0,
      );
    });

    it("does not persist Conversation when HTTP Assign is forbidden", async () => {
      const agent = createTestAgent();
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v11.s01.http.deny",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/assign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 0,
        });

      expect(response.status).toBe(403);
      await expect(
        countConversationsForApplication(application._id),
      ).resolves.toBe(0);
    });
  });
});
