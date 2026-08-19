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
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import CV_LANGUAGE_PROFICIENCY from "../../src/constants/cv-language-proficiency.js";
import JOB_INVITATION_INVALIDATION_REASON from "../../src/constants/job-invitation-invalidation-reason.js";
import JOB_INVITATION_STATUS from "../../src/constants/job-invitation-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import JobInvitation from "../../src/models/job-invitation.model.js";
import Message from "../../src/models/message.model.js";
import Notification from "../../src/models/notification.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import { directApplyToJob } from "../../src/services/application.service.js";
import * as fileService from "../../src/services/file.service.js";
import {
  rejectOwnJobInvitation,
  sendJobInvitation,
} from "../../src/services/job-invitation.service.js";
import * as notificationService from "../../src/services/notification.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const FUTURE_DEADLINE = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

const completeGeneratedContent = (fullName = "Jane Candidate") => ({
  personalInfo: {
    fullName,
    email: "jane@example.com",
    phone: "+84901234567",
    displayLocation: "Ha Noi",
    links: ["https://example.com"],
    avatarUrl: null,
  },
  professionalSummary: "Backend engineer summary",
  educations: [
    {
      institutionName: "Example University",
      degree: "BSc",
      fieldOfStudy: "CS",
    },
  ],
  skills: ["Node.js", "MongoDB"],
  workExperiences: [
    {
      companyName: "Example Co",
      position: "Engineer",
      description: "Built APIs",
    },
  ],
  projects: [
    {
      name: "JobHub",
      role: "Backend",
      technologies: ["Node.js"],
      description: "Recruitment platform",
    },
  ],
  certifications: [
    {
      name: "AWS Certified",
      issuer: "Amazon",
    },
  ],
  languages: [
    {
      name: "English",
      proficiency: CV_LANGUAGE_PROFICIENCY.FLUENT,
    },
  ],
  hiddenSections: [],
});

const createFieldCategory = async (name = "Software Engineering") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
    parentCategoryId: null,
  });
};

const createGeneratedCv = async ({
  candidateUserId,
  categoryId,
  name = "Public Generated CV",
  status = CANDIDATE_CV_STATUS.ACTIVE,
  visibility = CANDIDATE_CV_VISIBILITY.PUBLIC,
  archivedAt = null,
  generatedContent = completeGeneratedContent(),
} = {}) => {
  return CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status,
    visibility,
    categoryId,
    experienceLevelId: null,
    preferredLocations: [],
    skillTags: [],
    employmentTypes: [],
    workModes: [],
    isDefault: false,
    archivedAt,
    generatedContent,
  });
};

const createPublishedJob = async ({
  companyId,
  primaryMemberId,
  supportingIds = [],
  applicationDeadline = FUTURE_DEADLINE(),
  title = "Backend Engineer",
} = {}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingIds,
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline,
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

const mockInvitationSnapshotUpload = () => {
  vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
    assetId: "asset-invitation",
    publicId:
      "jobhub/job-invitations/invited-cv-snapshots/invited-snapshot.pdf",
    resourceType: "raw",
    deliveryType: "authenticated",
    format: "pdf",
    bytes: 2048,
    width: null,
    height: null,
    secureUrl: "https://example.invalid/invited-snapshot.pdf",
    version: 1,
    assetFolder: "jobhub/job-invitations/invited-cv-snapshots",
  });
};

const seedSendableContext = async ({
  candidateEmail = "invitee.reject@example.com",
  recruiterEmail = "recruiter.reject@example.com",
  managerEmail = "manager.reject@example.com",
  applicationDeadline = FUTURE_DEADLINE(),
} = {}) => {
  const { user: candidate } = await createVerifiedUser({
    email: candidateEmail,
  });
  const manager = await createActiveCompanyManagerContext({
    email: managerEmail,
    businessRegistrationNumber: `BRN-${managerEmail}`,
  });
  const recruiter = await createActiveRecruiterContext({
    email: recruiterEmail,
    company: manager.company,
    employeeCode: `NV-${recruiterEmail}`,
    fullName: "Historical Sender",
    jobTitle: "Primary Recruiter",
  });
  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: recruiter.membership._id,
    applicationDeadline,
  });
  const category = await createFieldCategory(
    `Software Engineering ${candidateEmail}`,
  );
  const candidateCv = await createGeneratedCv({
    candidateUserId: candidate._id,
    categoryId: category._id,
  });

  return {
    candidate,
    manager,
    recruiter,
    job,
    category,
    candidateCv,
  };
};

const sendPendingInvitation = async (context, greetingMessage = "Hello") => {
  mockInvitationSnapshotUpload();
  return sendJobInvitation({
    recruiterUser: context.recruiter.user,
    jobId: context.job._id.toString(),
    candidateCvId: context.candidateCv._id.toString(),
    greetingMessage,
  });
};

const persistTerminalStatus = async (invitationId, status) => {
  const now = new Date();
  const update = {
    status,
    acceptedAt: null,
    rejectedAt: null,
    revokedAt: null,
    invalidatedAt: null,
    invalidationReason: null,
  };

  if (status === JOB_INVITATION_STATUS.ACCEPTED) {
    update.acceptedAt = now;
  }
  if (status === JOB_INVITATION_STATUS.REJECTED) {
    update.rejectedAt = now;
  }
  if (status === JOB_INVITATION_STATUS.REVOKED) {
    update.revokedAt = now;
  }
  if (status === JOB_INVITATION_STATUS.INVALIDATED) {
    update.invalidatedAt = now;
    update.invalidationReason =
      JOB_INVITATION_INVALIDATION_REASON.INVITED_CV_ARCHIVED;
  }

  await JobInvitation.updateOne({ _id: invitationId }, { $set: update });
};

const readPersistedInvitation = async (invitationId) => {
  return JobInvitation.findById(invitationId).lean();
};

const findRejectedEvents = async (invitationId) => {
  return NotificationEvent.find({
    type: NOTIFICATION_TYPE.JOB_INVITATION_REJECTED,
    jobInvitationId: invitationId,
  }).lean();
};

describe("V15 Slice 04 — Candidate Reject Job Invitation", () => {
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

  describe("F05 / BR-26 ownership and successful Reject", () => {
    it("lets the owner Reject an actionable PENDING Invitation and persists TX-03 atomically", async () => {
      const context = await seedSendableContext({
        candidateEmail: "owner.reject@example.com",
        recruiterEmail: "owner.reject.recruiter@example.com",
        managerEmail: "owner.reject.manager@example.com",
      });
      const sent = await sendPendingInvitation(context, "Join us");
      const before = await readPersistedInvitation(sent.id);
      const rejectedAt = new Date("2026-08-19T03:00:00.000Z");

      const result = await rejectOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: sent.id.toString(),
        now: rejectedAt,
      });

      expect(result.invitation.status).toBe(JOB_INVITATION_STATUS.REJECTED);
      expect(result.invitation.canReject).toBe(false);
      expect(result.invitation.canAccept).toBe(false);
      expect(new Date(result.invitation.rejectedAt).getTime()).toBe(
        rejectedAt.getTime(),
      );
      expect(result.invitation.greetingMessage).toBe("Join us");
      expect(result.invitation.invitedCvSnapshot.name).toBe(
        "Public Generated CV",
      );
      expect(result.invitation.sender.fullName).toBe("Historical Sender");

      const persisted = await readPersistedInvitation(sent.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.REJECTED);
      expect(persisted.rejectedAt.getTime()).toBe(rejectedAt.getTime());
      expect(persisted.acceptedAt).toBeNull();
      expect(persisted.candidateUserId.toString()).toBe(
        before.candidateUserId.toString(),
      );
      expect(persisted.jobId.toString()).toBe(before.jobId.toString());
      expect(persisted.sentByRecruiterCompanyMemberId.toString()).toBe(
        before.sentByRecruiterCompanyMemberId.toString(),
      );
      expect(persisted.invitedCvId.toString()).toBe(
        before.invitedCvId.toString(),
      );
      expect(persisted.greetingMessage).toBe("Join us");
      expect(persisted.invitedCvSnapshot.name).toBe("Public Generated CV");
      expect(Object.prototype.hasOwnProperty.call(persisted, "rejectReason")).toBe(
        false,
      );

      const events = await findRejectedEvents(sent.id);
      expect(events).toHaveLength(1);
      expect(events[0].eventKey).toBe(
        `job-invitation-rejected:${sent.id.toString()}`,
      );
      expect(events[0].actorUserId.toString()).toBe(
        context.candidate._id.toString(),
      );
      expect(events[0].applicationId ?? null).toBeNull();
      expect(events[0].recipients).toHaveLength(1);
      expect(events[0].recipients[0].recipientUserId.toString()).toBe(
        context.recruiter.user._id.toString(),
      );

      expect(
        await Notification.countDocuments({
          type: NOTIFICATION_TYPE.JOB_INVITATION_REJECTED,
          recipientUserId: context.candidate._id,
        }),
      ).toBe(0);
      expect(
        await Notification.countDocuments({
          type: NOTIFICATION_TYPE.JOB_INVITATION_REJECTED,
          recipientUserId: context.recruiter.user._id,
          jobInvitationId: sent.id,
        }),
      ).toBe(1);
      expect(await Application.countDocuments({})).toBe(0);
      expect(await Conversation.countDocuments({})).toBe(0);
      expect(await Message.countDocuments({})).toBe(0);
    });

    it("does not authorize Reject from another Candidate who knows the Invitation id", async () => {
      const owner = await seedSendableContext({
        candidateEmail: "owner.auth.reject@example.com",
        recruiterEmail: "owner.auth.reject.recruiter@example.com",
        managerEmail: "owner.auth.reject.manager@example.com",
      });
      const foreign = await seedSendableContext({
        candidateEmail: "foreign.auth.reject@example.com",
        recruiterEmail: "foreign.auth.reject.recruiter@example.com",
        managerEmail: "foreign.auth.reject.manager@example.com",
      });
      const ownInvitation = await sendPendingInvitation(owner);

      await expect(
        rejectOwnJobInvitation({
          candidateUser: foreign.candidate,
          invitationId: ownInvitation.id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect((await readPersistedInvitation(ownInvitation.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );
      expect(await findRejectedEvents(ownInvitation.id)).toHaveLength(0);
    });
  });

  describe("BR-34 current-state re-check", () => {
    it("does not let Reject win when an expiration cause already has earlier effective time", async () => {
      const context = await seedSendableContext({
        candidateEmail: "expire.reject@example.com",
        recruiterEmail: "expire.reject.recruiter@example.com",
        managerEmail: "expire.reject.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      const pastCutoff = new Date("2026-01-01T00:00:00.000Z");
      await JobInvitation.updateOne(
        { _id: sent.id },
        { $set: { expiresAt: pastCutoff } },
        { timestamps: false },
      );

      await expect(
        rejectOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
          now: new Date("2026-01-16T00:00:00.000Z"),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await readPersistedInvitation(sent.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(persisted.rejectedAt).toBeNull();
      expect(await findRejectedEvents(sent.id)).toHaveLength(0);
    });

    it("does not let Reject win when an invalidation cause already has earlier effective time", async () => {
      const context = await seedSendableContext({
        candidateEmail: "invalidate.reject@example.com",
        recruiterEmail: "invalidate.reject.recruiter@example.com",
        managerEmail: "invalidate.reject.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      await CandidateCV.updateOne(
        { _id: context.candidateCv._id },
        { $set: { archivedAt: new Date("2026-08-18T10:00:00.000Z") } },
      );

      await expect(
        rejectOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
          now: new Date("2026-08-19T03:00:00.000Z"),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await readPersistedInvitation(sent.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(persisted.rejectedAt).toBeNull();
      expect(await findRejectedEvents(sent.id)).toHaveLength(0);
    });

    it("keeps persisted terminal states terminal and does not create REJECTED", async () => {
      const statuses = [
        JOB_INVITATION_STATUS.ACCEPTED,
        JOB_INVITATION_STATUS.REJECTED,
        JOB_INVITATION_STATUS.REVOKED,
        JOB_INVITATION_STATUS.EXPIRED,
        JOB_INVITATION_STATUS.INVALIDATED,
      ];

      for (const status of statuses) {
        const context = await seedSendableContext({
          candidateEmail: `terminal.reject.${status.toLowerCase()}@example.com`,
          recruiterEmail: `terminal.reject.${status.toLowerCase()}.recruiter@example.com`,
          managerEmail: `terminal.reject.${status.toLowerCase()}.manager@example.com`,
        });
        const sent = await sendPendingInvitation(context);
        await persistTerminalStatus(sent.id, status);
        const before = await readPersistedInvitation(sent.id);

        await expect(
          rejectOwnJobInvitation({
            candidateUser: context.candidate,
            invitationId: sent.id.toString(),
          }),
        ).rejects.toMatchObject({ statusCode: 409 });

        const after = await readPersistedInvitation(sent.id);
        expect(after.status).toBe(status);
        if (status !== JOB_INVITATION_STATUS.REJECTED) {
          expect(after.rejectedAt).toBeNull();
        } else {
          expect(after.rejectedAt.getTime()).toBe(before.rejectedAt.getTime());
        }
        expect(await findRejectedEvents(sent.id)).toHaveLength(0);
      }
    });
  });

  describe("BR-20 / BR-36 resend and Direct Apply", () => {
    it("blocks future Recruiter Invitation after REJECTED but still allows Direct Apply", async () => {
      mockInvitationSnapshotUpload();
      const context = await seedSendableContext({
        candidateEmail: "resend.reject@example.com",
        recruiterEmail: "resend.reject.recruiter@example.com",
        managerEmail: "resend.reject.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      await rejectOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: sent.id.toString(),
      });

      await expect(
        sendJobInvitation({
          recruiterUser: context.recruiter.user,
          jobId: context.job._id.toString(),
          candidateCvId: context.candidateCv._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const application = await directApplyToJob({
        candidateUserId: context.candidate._id,
        actorUser: context.candidate,
        jobId: context.job._id.toString(),
        candidateCvId: context.candidateCv._id.toString(),
      });
      expect(application.source).toBe(APPLICATION_SOURCE.DIRECT_APPLICATION);
      expect(
        (await readPersistedInvitation(sent.id)).status,
      ).toBe(JOB_INVITATION_STATUS.REJECTED);
    });
  });

  describe("BR-56 durability", () => {
    it("keeps REJECTED when inbox materialization fails after commit", async () => {
      const context = await seedSendableContext({
        candidateEmail: "durable.reject@example.com",
        recruiterEmail: "durable.reject.recruiter@example.com",
        managerEmail: "durable.reject.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      vi.spyOn(notificationService, "materializeNotificationEvent").mockRejectedValue(
        new Error("inbox unavailable"),
      );

      const result = await rejectOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: sent.id.toString(),
      });

      expect(result.invitation.status).toBe(JOB_INVITATION_STATUS.REJECTED);
      expect((await readPersistedInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.REJECTED,
      );
      const events = await findRejectedEvents(sent.id);
      expect(events).toHaveLength(1);
      expect(events[0].materializedAt).toBeNull();
    });
  });

  describe("concurrency", () => {
    it("allows only one concurrent Reject to persist REJECTED and the durable event", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.reject@example.com",
        recruiterEmail: "race.reject.recruiter@example.com",
        managerEmail: "race.reject.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      const outcomes = await Promise.allSettled([
        rejectOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
        }),
        rejectOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
        }),
      ]);

      expect(
        outcomes.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        outcomes.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      expect(outcomes.find((result) => result.status === "rejected").reason).toMatchObject(
        { statusCode: 409 },
      );
      expect((await readPersistedInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.REJECTED,
      );
      expect(await findRejectedEvents(sent.id)).toHaveLength(1);
    });

    it("does not let concurrent Send create another Invitation after Reject", async () => {
      mockInvitationSnapshotUpload();
      const context = await seedSendableContext({
        candidateEmail: "race.send.reject@example.com",
        recruiterEmail: "race.send.reject.recruiter@example.com",
        managerEmail: "race.send.reject.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      const outcomes = await Promise.allSettled([
        rejectOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
        }),
        sendJobInvitation({
          recruiterUser: context.recruiter.user,
          jobId: context.job._id.toString(),
          candidateCvId: context.candidateCv._id.toString(),
        }),
      ]);

      const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
      const rejected = outcomes.filter((result) => result.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({ statusCode: 409 });
      expect((await readPersistedInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.REJECTED,
      );
      expect(
        await JobInvitation.countDocuments({
          candidateUserId: context.candidate._id,
          jobId: context.job._id,
        }),
      ).toBe(1);
    });
  });

  describe("HTTP", () => {
    it("exposes Candidate POST reject and ignores a reject reason body", async () => {
      const context = await seedSendableContext({
        candidateEmail: "http.reject@example.com",
        recruiterEmail: "http.reject.recruiter@example.com",
        managerEmail: "http.reject.manager@example.com",
      });
      const foreign = await seedSendableContext({
        candidateEmail: "http.foreign.reject@example.com",
        recruiterEmail: "http.foreign.reject.recruiter@example.com",
        managerEmail: "http.foreign.reject.manager@example.com",
      });
      const ownInvitation = await sendPendingInvitation(context);
      const foreignInvitation = await sendPendingInvitation(foreign);
      const agent = createTestAgent();
      const candidateToken = await loginAndGetAccessToken(agent, {
        email: context.candidate.email,
      });
      const recruiterToken = await loginAndGetAccessToken(agent, {
        email: context.recruiter.user.email,
        password: context.recruiter.password,
      });

      const response = await agent
        .post(`/api/candidate/invitations/${ownInvitation.id}/reject`)
        .set("Authorization", `Bearer ${candidateToken}`)
        .send({ reason: "not a fit" });

      expect(response.status).toBe(200);
      expect(response.body.invitation.status).toBe(JOB_INVITATION_STATUS.REJECTED);
      expect(response.body.invitation).not.toHaveProperty("rejectReason");
      expect(
        Object.prototype.hasOwnProperty.call(
          await readPersistedInvitation(ownInvitation.id),
          "rejectReason",
        ),
      ).toBe(false);

      expect(
        (
          await agent.post(
            `/api/candidate/invitations/${foreignInvitation.id}/reject`,
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await agent
            .post(`/api/candidate/invitations/${foreignInvitation.id}/reject`)
            .set("Authorization", `Bearer ${candidateToken}`)
        ).status,
      ).toBe(404);
      expect(
        (
          await agent
            .post(`/api/candidate/invitations/${ownInvitation.id}/reject`)
            .set("Authorization", `Bearer ${recruiterToken}`)
        ).status,
      ).toBe(403);
    });
  });
});
