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
import USER_ROLE from "../../src/constants/user-role.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import JobInvitation from "../../src/models/job-invitation.model.js";
import Message from "../../src/models/message.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import { directApplyToJob } from "../../src/services/application.service.js";
import * as fileService from "../../src/services/file.service.js";
import {
  deriveInvitationExpiresAt,
  sendJobInvitation,
} from "../../src/services/job-invitation.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createUnverifiedUserWithVerificationToken,
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
  status = JOB_STATUS.PUBLISHED,
} = {}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingIds,
    status,
    publishedAt: status === JOB_STATUS.PUBLISHED ? new Date("2026-01-15") : null,
    applicationDeadline,
    title,
    description: "Build APIs",
    skills: ["Node.js"],
    salaryMin: 1000,
    salaryMax: 2000,
    categoryIds: [],
    locations: [],
    employmentTypes: [],
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
  candidateEmail = "invitee@example.com",
  recruiterEmail = "recruiter.invite@example.com",
  managerEmail = "manager.invite@example.com",
  supportingEmail = null,
  applicationDeadline = FUTURE_DEADLINE(),
  cvOverrides = {},
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
  });
  let supporting = null;
  if (supportingEmail) {
    supporting = await createActiveRecruiterContext({
      email: supportingEmail,
      company: manager.company,
      employeeCode: `NV-${supportingEmail}`,
    });
  }
  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: recruiter.membership._id,
    supportingIds: supporting ? [supporting.membership._id] : [],
    applicationDeadline,
  });
  const category = await createFieldCategory();
  const candidateCv = await createGeneratedCv({
    candidateUserId: candidate._id,
    categoryId: category._id,
    ...cvOverrides,
  });

  return {
    candidate,
    manager,
    recruiter,
    supporting,
    job,
    category,
    candidateCv,
  };
};

describe("V15 Slice 02 — Send Job Invitation + Direct Apply exclusion", () => {
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

  describe("BR-23 Send cutoff", () => {
    it("uses 00:00 of Day 16 in Asia/Ho_Chi_Minh when that is earlier than the Job deadline", () => {
      const sentAt = new Date("2026-08-19T02:00:00.000Z");
      const expiresAt = deriveInvitationExpiresAt({
        sentAt,
        applicationDeadline: new Date("2026-12-01T00:00:00.000Z"),
      });

      expect(expiresAt.toISOString()).toBe("2026-09-02T17:00:00.000Z");
    });

    it("keeps the same Day 16 cutoff for late-in-day sends on Day 1", () => {
      const sentAt = new Date("2026-08-19T16:59:59.999Z");
      const expiresAt = deriveInvitationExpiresAt({
        sentAt,
        applicationDeadline: new Date("2026-12-01T00:00:00.000Z"),
      });

      expect(expiresAt.toISOString()).toBe("2026-09-02T17:00:00.000Z");
    });

    it("uses Job.applicationDeadline when it is earlier than own cutoff", () => {
      const sentAt = new Date("2026-08-19T02:00:00.000Z");
      const applicationDeadline = new Date("2026-08-25T00:00:00.000Z");
      const expiresAt = deriveInvitationExpiresAt({
        sentAt,
        applicationDeadline,
      });

      expect(expiresAt.toISOString()).toBe(applicationDeadline.toISOString());
    });
  });

  describe("successful Send (F01, F02, TX-01)", () => {
    it("lets a current Primary send a PENDING Invitation with snapshot, cutoff, and durable event", async () => {
      mockInvitationSnapshotUpload();
      const sentAt = new Date("2026-08-19T02:00:00.000Z");
      const { candidate, recruiter, job, candidateCv } =
        await seedSendableContext({
          applicationDeadline: new Date("2026-12-01T00:00:00.000Z"),
        });

      const invitation = await sendJobInvitation({
        recruiterUser: recruiter.user,
        jobId: job._id.toString(),
        candidateCvId: candidateCv._id.toString(),
        greetingMessage: "  We would like to talk.  ",
        now: sentAt,
      });

      expect(invitation.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(invitation.candidateUserId.toString()).toBe(
        candidate._id.toString(),
      );
      expect(invitation.invitedCvId.toString()).toBe(candidateCv._id.toString());
      expect(invitation.jobId.toString()).toBe(job._id.toString());
      expect(invitation.sentByRecruiterCompanyMemberId.toString()).toBe(
        recruiter.membership._id.toString(),
      );
      expect(invitation.greetingMessage).toBe("We would like to talk.");
      expect(new Date(invitation.expiresAt).toISOString()).toBe(
        "2026-09-02T17:00:00.000Z",
      );
      expect(invitation.invitedCvSnapshot.sourceType).toBe(
        CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      );
      expect(invitation.invitedCvSnapshot.pdfFile.storageKey).toBeUndefined();
      expect(invitation.invitedCvSnapshot.generatedContent.personalInfo.fullName).toBe(
        "Jane Candidate",
      );

      expect(fileService.uploadFileBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          assetFolder: "jobhub/job-invitations/invited-cv-snapshots",
        }),
      );

      const persisted = await JobInvitation.findById(invitation.id).lean();
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(persisted.invitedCvSnapshot.pdfFile.storageKey).toBe(
        "jobhub/job-invitations/invited-cv-snapshots/invited-snapshot.pdf",
      );

      expect(
        await NotificationEvent.countDocuments({
          type: NOTIFICATION_TYPE.JOB_INVITATION_RECEIVED,
          jobInvitationId: invitation.id,
        }),
      ).toBe(1);
      expect(await Application.countDocuments({})).toBe(0);
      expect(await Conversation.countDocuments({})).toBe(0);
      expect(await Message.countDocuments({})).toBe(0);
    });

    it("lets a current Supporting Recruiter send without creating Chat or Application authority", async () => {
      mockInvitationSnapshotUpload();
      const { supporting, candidateCv, job } = await seedSendableContext({
        supportingEmail: "supporting.invite@example.com",
      });

      const invitation = await sendJobInvitation({
        recruiterUser: supporting.user,
        jobId: job._id.toString(),
        candidateCvId: candidateCv._id.toString(),
      });

      expect(invitation.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(invitation.sentByRecruiterCompanyMemberId.toString()).toBe(
        supporting.membership._id.toString(),
      );
      expect(await Application.countDocuments({})).toBe(0);
      expect(await Conversation.countDocuments({})).toBe(0);
    });

    it("exposes Send through Recruiter HTTP POST /api/jobs/:jobId/invitations", async () => {
      mockInvitationSnapshotUpload();
      const { recruiter, candidateCv, job, candidate } =
        await seedSendableContext({
          recruiterEmail: "http.recruiter.invite@example.com",
          candidateEmail: "http.invitee@example.com",
          managerEmail: "http.manager.invite@example.com",
        });
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: recruiter.password,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/invitations`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          candidateCvId: candidateCv._id.toString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.invitation.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(response.body.invitation.candidateUserId).toBe(
        candidate._id.toString(),
      );
      expect(response.body.invitation.invitedCvSnapshot.pdfFile).not.toHaveProperty(
        "storageKey",
      );
    });
  });

  describe("Send eligibility re-check", () => {
    it("rejects Candidate, Company Manager, Platform Admin, and anonymous senders", async () => {
      mockInvitationSnapshotUpload();
      const { candidate, manager, candidateCv, job } = await seedSendableContext({
        candidateEmail: "denied.invitee@example.com",
        managerEmail: "denied.manager.invite@example.com",
        recruiterEmail: "denied.recruiter.invite@example.com",
      });
      const { user: admin } = await createVerifiedUser({
        email: "denied.admin.invite@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      const agent = createTestAgent();

      const candidateToken = await loginAndGetAccessToken(agent, {
        email: candidate.email,
      });
      const managerToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: manager.password,
      });
      const adminToken = await loginAndGetAccessToken(agent, {
        email: admin.email,
      });

      const payload = { candidateCvId: candidateCv._id.toString() };

      expect(
        (
          await agent
            .post(`/api/jobs/${job._id}/invitations`)
            .send(payload)
        ).status,
      ).toBe(401);
      expect(
        (
          await agent
            .post(`/api/jobs/${job._id}/invitations`)
            .set("Authorization", `Bearer ${candidateToken}`)
            .send(payload)
        ).status,
      ).toBe(403);
      expect(
        (
          await agent
            .post(`/api/jobs/${job._id}/invitations`)
            .set("Authorization", `Bearer ${managerToken}`)
            .send(payload)
        ).status,
      ).toBe(403);
      expect(
        (
          await agent
            .post(`/api/jobs/${job._id}/invitations`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send(payload)
        ).status,
      ).toBe(403);
    });

    it("rejects a same-company Recruiter who is not current Primary or Supporting of the selected Job", async () => {
      mockInvitationSnapshotUpload();
      const { manager, candidateCv, job } = await seedSendableContext({
        recruiterEmail: "onteam.recruiter@example.com",
        managerEmail: "onteam.manager@example.com",
      });
      const outsider = await createActiveRecruiterContext({
        email: "outsider.recruiter@example.com",
        company: manager.company,
        employeeCode: "NV-OUTSIDER",
      });

      await expect(
        sendJobInvitation({
          recruiterUser: outsider.user,
          jobId: job._id.toString(),
          candidateCvId: candidateCv._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects Jobs that are not effectively PUBLISHED and still accepting applications", async () => {
      mockInvitationSnapshotUpload();
      const { recruiter, manager, candidateCv } = await seedSendableContext();
      const draft = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: recruiter.membership._id,
        status: JOB_STATUS.DRAFT,
      });

      await expect(
        sendJobInvitation({
          recruiterUser: recruiter.user,
          jobId: draft._id.toString(),
          candidateCvId: candidateCv._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("reuses V14 Generated eligibility and does not invent Uploaded ACTIVE/DRAFT rules", async () => {
      mockInvitationSnapshotUpload();
      const { recruiter, job, category, candidate } = await seedSendableContext();
      const draftPublic = await createGeneratedCv({
        candidateUserId: candidate._id,
        categoryId: category._id,
        name: "Draft Public",
        status: CANDIDATE_CV_STATUS.DRAFT,
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      });
      const privateActive = await createGeneratedCv({
        candidateUserId: candidate._id,
        categoryId: category._id,
        name: "Private Active",
        visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      });

      await expect(
        sendJobInvitation({
          recruiterUser: recruiter.user,
          jobId: job._id.toString(),
          candidateCvId: draftPublic._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        sendJobInvitation({
          recruiterUser: recruiter.user,
          jobId: job._id.toString(),
          candidateCvId: privateActive._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rejects an unverified Candidate owner even when the CV is PUBLIC", async () => {
      mockInvitationSnapshotUpload();
      const { recruiter, job, category } = await seedSendableContext({
        candidateEmail: "verified.owner@example.com",
      });
      const { user: unverified } =
        await createUnverifiedUserWithVerificationToken({
          email: "unverified.owner@example.com",
        });
      const cv = await createGeneratedCv({
        candidateUserId: unverified._id,
        categoryId: category._id,
      });

      await expect(
        sendJobInvitation({
          recruiterUser: recruiter.user,
          jobId: job._id.toString(),
          candidateCvId: cv._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("Candidate-Job exclusion (F09)", () => {
    it("blocks Send when an Application already exists", async () => {
      mockInvitationSnapshotUpload();
      const { candidate, recruiter, job, candidateCv } =
        await seedSendableContext();
      await directApplyToJob({
        candidateUserId: candidate._id,
        actorUser: candidate,
        jobId: job._id.toString(),
        candidateCvId: candidateCv._id.toString(),
      });

      await expect(
        sendJobInvitation({
          recruiterUser: recruiter.user,
          jobId: job._id.toString(),
          candidateCvId: candidateCv._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("blocks a second PENDING Invitation and REJECTED resend, but allows EXPIRED/REVOKED/INVALIDATED resend", async () => {
      mockInvitationSnapshotUpload();
      const { recruiter, job, candidateCv, candidate } =
        await seedSendableContext({
          recruiterEmail: "resend.recruiter@example.com",
          candidateEmail: "resend.invitee@example.com",
          managerEmail: "resend.manager@example.com",
        });

      const first = await sendJobInvitation({
        recruiterUser: recruiter.user,
        jobId: job._id.toString(),
        candidateCvId: candidateCv._id.toString(),
      });

      await expect(
        sendJobInvitation({
          recruiterUser: recruiter.user,
          jobId: job._id.toString(),
          candidateCvId: candidateCv._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      await JobInvitation.updateOne(
        { _id: first.id },
        {
          $set: {
            status: JOB_INVITATION_STATUS.REJECTED,
            rejectedAt: new Date(),
          },
        },
      );

      await expect(
        sendJobInvitation({
          recruiterUser: recruiter.user,
          jobId: job._id.toString(),
          candidateCvId: candidateCv._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      await JobInvitation.updateOne(
        { _id: first.id },
        {
          $set: {
            status: JOB_INVITATION_STATUS.EXPIRED,
            rejectedAt: null,
          },
        },
      );

      const afterExpired = await sendJobInvitation({
        recruiterUser: recruiter.user,
        jobId: job._id.toString(),
        candidateCvId: candidateCv._id.toString(),
      });
      expect(afterExpired.status).toBe(JOB_INVITATION_STATUS.PENDING);

      await JobInvitation.updateOne(
        { _id: afterExpired.id },
        { $set: { status: JOB_INVITATION_STATUS.REVOKED, revokedAt: new Date() } },
      );
      const afterRevoked = await sendJobInvitation({
        recruiterUser: recruiter.user,
        jobId: job._id.toString(),
        candidateCvId: candidateCv._id.toString(),
      });
      expect(afterRevoked.status).toBe(JOB_INVITATION_STATUS.PENDING);

      await JobInvitation.updateOne(
        { _id: afterRevoked.id },
        {
          $set: {
            status: JOB_INVITATION_STATUS.INVALIDATED,
            invalidatedAt: new Date(),
            invalidationReason:
              JOB_INVITATION_INVALIDATION_REASON.INVITED_CV_ARCHIVED,
            revokedAt: null,
          },
        },
      );
      const afterInvalidated = await sendJobInvitation({
        recruiterUser: recruiter.user,
        jobId: job._id.toString(),
        candidateCvId: candidateCv._id.toString(),
      });
      expect(afterInvalidated.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(afterInvalidated.candidateUserId.toString()).toBe(
        candidate._id.toString(),
      );
    });

    it("blocks Direct Apply while a PENDING Invitation exists and allows it after REJECTED", async () => {
      mockInvitationSnapshotUpload();
      const { candidate, recruiter, job, candidateCv } =
        await seedSendableContext({
          recruiterEmail: "applyblock.recruiter@example.com",
          candidateEmail: "applyblock.invitee@example.com",
          managerEmail: "applyblock.manager@example.com",
        });

      const invitation = await sendJobInvitation({
        recruiterUser: recruiter.user,
        jobId: job._id.toString(),
        candidateCvId: candidateCv._id.toString(),
      });

      await expect(
        directApplyToJob({
          candidateUserId: candidate._id,
          actorUser: candidate,
          jobId: job._id.toString(),
          candidateCvId: candidateCv._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      await JobInvitation.updateOne(
        { _id: invitation.id },
        {
          $set: {
            status: JOB_INVITATION_STATUS.REJECTED,
            rejectedAt: new Date(),
          },
        },
      );

      const application = await directApplyToJob({
        candidateUserId: candidate._id,
        actorUser: candidate,
        jobId: job._id.toString(),
        candidateCvId: candidateCv._id.toString(),
      });
      expect(application.source).toBe(APPLICATION_SOURCE.DIRECT_APPLICATION);
    });
  });

  describe("concurrency", () => {
    it("does not let concurrent Send and Direct Apply both commit", async () => {
      mockInvitationSnapshotUpload();
      const { candidate, recruiter, job, candidateCv } =
        await seedSendableContext({
          recruiterEmail: "race.recruiter@example.com",
          candidateEmail: "race.invitee@example.com",
          managerEmail: "race.manager@example.com",
        });

      const outcomes = await Promise.allSettled([
        sendJobInvitation({
          recruiterUser: recruiter.user,
          jobId: job._id.toString(),
          candidateCvId: candidateCv._id.toString(),
        }),
        directApplyToJob({
          candidateUserId: candidate._id,
          actorUser: candidate,
          jobId: job._id.toString(),
          candidateCvId: candidateCv._id.toString(),
        }),
      ]);

      const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
      const rejected = outcomes.filter((result) => result.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({ statusCode: 409 });

      const applications = await Application.countDocuments({
        candidateUserId: candidate._id,
        jobId: job._id,
      });
      const pendingInvitations = await JobInvitation.countDocuments({
        candidateUserId: candidate._id,
        jobId: job._id,
        status: JOB_INVITATION_STATUS.PENDING,
      });
      expect(applications + pendingInvitations).toBe(1);
      expect(applications === 1 && pendingInvitations === 1).toBe(false);
    });

    it("allows only one PENDING Invitation under concurrent Send", async () => {
      mockInvitationSnapshotUpload();
      const { recruiter, job, candidateCv, candidate } =
        await seedSendableContext({
          recruiterEmail: "twosend.recruiter@example.com",
          candidateEmail: "twosend.invitee@example.com",
          managerEmail: "twosend.manager@example.com",
        });

      const outcomes = await Promise.allSettled([
        sendJobInvitation({
          recruiterUser: recruiter.user,
          jobId: job._id.toString(),
          candidateCvId: candidateCv._id.toString(),
        }),
        sendJobInvitation({
          recruiterUser: recruiter.user,
          jobId: job._id.toString(),
          candidateCvId: candidateCv._id.toString(),
        }),
      ]);

      expect(
        outcomes.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        outcomes.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      expect(
        await JobInvitation.countDocuments({
          candidateUserId: candidate._id,
          jobId: job._id,
          status: JOB_INVITATION_STATUS.PENDING,
        }),
      ).toBe(1);
    });
  });
});
