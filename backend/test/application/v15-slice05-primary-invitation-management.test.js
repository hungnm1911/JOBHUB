import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import CV_LANGUAGE_PROFICIENCY from "../../src/constants/cv-language-proficiency.js";
import JOB_INVITATION_INVALIDATION_REASON from "../../src/constants/job-invitation-invalidation-reason.js";
import JOB_INVITATION_STATUS from "../../src/constants/job-invitation-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import USER_ROLE from "../../src/constants/user-role.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Company from "../../src/models/company.model.js";
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import JobInvitation from "../../src/models/job-invitation.model.js";
import Message from "../../src/models/message.model.js";
import Notification from "../../src/models/notification.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import * as fileService from "../../src/services/file.service.js";
import {
  getPrimaryJobInvitation,
  listPrimaryJobInvitations,
  rejectOwnJobInvitation,
  revokePrimaryJobInvitation,
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

const seedManagedInvitationContext = async ({
  candidateEmail = "invitee.manage@example.com",
  recruiterEmail = "primary.manage@example.com",
  supportingEmail = "supporting.manage@example.com",
  managerEmail = "manager.manage@example.com",
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
    fullName: "Current Primary",
    jobTitle: "Primary Recruiter",
  });
  const supporting = await createActiveRecruiterContext({
    email: supportingEmail,
    company: manager.company,
    employeeCode: `NV-${supportingEmail}`,
    fullName: "Historical Sender",
    jobTitle: "Supporting Recruiter",
  });
  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: recruiter.membership._id,
    supportingIds: [supporting.membership._id],
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
    supporting,
    job,
    category,
    candidateCv,
  };
};

const sendPendingInvitation = async (
  context,
  greetingMessage = null,
  sender = context.supporting,
) => {
  mockInvitationSnapshotUpload();
  return sendJobInvitation({
    recruiterUser: sender.user,
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

const findRevokedEvents = async (invitationId) => {
  return NotificationEvent.find({
    type: NOTIFICATION_TYPE.JOB_INVITATION_REVOKED,
    jobInvitationId: invitationId,
  }).lean();
};

describe("V15 Slice 05 — Primary Invitation Management + Revoke", () => {
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

  describe("F06 / BR-27 / BR-51 / TX-04 successful Revoke", () => {
    it("lets current Primary Revoke a Supporting-sent PENDING Invitation without becoming sender", async () => {
      const context = await seedManagedInvitationContext({
        candidateEmail: "owner.revoke@example.com",
        recruiterEmail: "owner.revoke.primary@example.com",
        supportingEmail: "owner.revoke.supporting@example.com",
        managerEmail: "owner.revoke.manager@example.com",
      });
      const sent = await sendPendingInvitation(context, "Join us");
      const before = await readPersistedInvitation(sent.id);
      const revokedAt = new Date("2026-08-19T04:00:00.000Z");

      const result = await revokePrimaryJobInvitation({
        recruiterUser: context.recruiter.user,
        jobId: context.job._id.toString(),
        invitationId: sent.id.toString(),
        now: revokedAt,
      });

      expect(result.invitation.status).toBe(JOB_INVITATION_STATUS.REVOKED);
      expect(result.invitation.canRevoke).toBe(false);
      expect(new Date(result.invitation.revokedAt).getTime()).toBe(
        revokedAt.getTime(),
      );
      expect(result.invitation.greetingMessage).toBe("Join us");
      expect(result.invitation.invitedCvSnapshot.name).toBe(
        "Public Generated CV",
      );
      expect(result.invitation.sender.fullName).toBe("Historical Sender");
      expect(result.invitation.candidate.fullName).toBe("Jane Candidate");
      expect(result.invitation.sentByRecruiterCompanyMemberId).toBe(
        context.supporting.membership._id.toString(),
      );
      expect(result.invitation).not.toHaveProperty("canAccept");
      expect(result.invitation).not.toHaveProperty("canReject");

      const persisted = await readPersistedInvitation(sent.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.REVOKED);
      expect(persisted.revokedAt.getTime()).toBe(revokedAt.getTime());
      expect(persisted.acceptedAt).toBeNull();
      expect(persisted.rejectedAt).toBeNull();
      expect(persisted.candidateUserId.toString()).toBe(
        before.candidateUserId.toString(),
      );
      expect(persisted.jobId.toString()).toBe(before.jobId.toString());
      expect(persisted.sentByRecruiterCompanyMemberId.toString()).toBe(
        context.supporting.membership._id.toString(),
      );
      expect(persisted.invitedCvId.toString()).toBe(
        before.invitedCvId.toString(),
      );
      expect(persisted.greetingMessage).toBe("Join us");
      expect(persisted.invitedCvSnapshot.name).toBe("Public Generated CV");

      const events = await findRevokedEvents(sent.id);
      expect(events).toHaveLength(1);
      expect(events[0].eventKey).toBe(
        `job-invitation-revoked:${sent.id.toString()}`,
      );
      expect(events[0].actorUserId.toString()).toBe(
        context.recruiter.user._id.toString(),
      );
      expect(events[0].applicationId ?? null).toBeNull();
      expect(events[0].recipients).toHaveLength(1);
      expect(events[0].recipients[0].recipientUserId.toString()).toBe(
        context.candidate._id.toString(),
      );

      expect(
        await Notification.countDocuments({
          type: NOTIFICATION_TYPE.JOB_INVITATION_REVOKED,
          recipientUserId: context.candidate._id,
          jobInvitationId: sent.id,
        }),
      ).toBe(1);
      expect(
        await Notification.countDocuments({
          type: NOTIFICATION_TYPE.JOB_INVITATION_REVOKED,
          recipientUserId: context.recruiter.user._id,
        }),
      ).toBe(0);
      expect(
        await Notification.countDocuments({
          type: NOTIFICATION_TYPE.JOB_INVITATION_REVOKED,
          recipientUserId: context.supporting.user._id,
        }),
      ).toBe(0);
      expect(await Application.countDocuments({})).toBe(0);
      expect(await Conversation.countDocuments({})).toBe(0);
      expect(await Message.countDocuments({})).toBe(0);
    });
  });

  describe("BR-27 / BR-28 list and detail authority", () => {
    it("lets current Primary read historical Job Invitations including terminals and Supporting-sent ones", async () => {
      const context = await seedManagedInvitationContext({
        candidateEmail: "history.invitee@example.com",
        recruiterEmail: "history.primary@example.com",
        supportingEmail: "history.supporting@example.com",
        managerEmail: "history.manager@example.com",
      });
      const pending = await sendPendingInvitation(context, "Join us");
      const { user: secondCandidate } = await createVerifiedUser({
        email: "history.second@example.com",
      });
      const secondCv = await createGeneratedCv({
        candidateUserId: secondCandidate._id,
        categoryId: context.category._id,
        name: "Second Public CV",
      });
      mockInvitationSnapshotUpload();
      const second = await sendJobInvitation({
        recruiterUser: context.recruiter.user,
        jobId: context.job._id.toString(),
        candidateCvId: secondCv._id.toString(),
      });
      await persistTerminalStatus(second.id, JOB_INVITATION_STATUS.REJECTED);

      const listed = await listPrimaryJobInvitations({
        recruiterUser: context.recruiter.user,
        jobId: context.job._id.toString(),
      });
      expect(listed.invitations).toHaveLength(2);
      expect(listed.invitations.map((invitation) => invitation.id).sort()).toEqual(
        [pending.id.toString(), second.id.toString()].sort(),
      );
      const pendingView = listed.invitations.find(
        (invitation) => invitation.id === pending.id.toString(),
      );
      const rejectedView = listed.invitations.find(
        (invitation) => invitation.id === second.id.toString(),
      );
      expect(pendingView.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(pendingView.canRevoke).toBe(true);
      expect(pendingView.sender.fullName).toBe("Historical Sender");
      expect(rejectedView.status).toBe(JOB_INVITATION_STATUS.REJECTED);
      expect(rejectedView.canRevoke).toBe(false);

      const detail = await getPrimaryJobInvitation({
        recruiterUser: context.recruiter.user,
        jobId: context.job._id.toString(),
        invitationId: pending.id.toString(),
      });
      expect(detail.invitation.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(detail.invitation.canRevoke).toBe(true);
      expect(detail.invitation.invitedCvSnapshot.pdfFile).not.toHaveProperty(
        "storageKey",
      );
    });

    it("does not grant Supporting sender list, detail, or Revoke authority", async () => {
      const context = await seedManagedInvitationContext({
        candidateEmail: "sender.auth@example.com",
        recruiterEmail: "sender.auth.primary@example.com",
        supportingEmail: "sender.auth.supporting@example.com",
        managerEmail: "sender.auth.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      await expect(
        listPrimaryJobInvitations({
          recruiterUser: context.supporting.user,
          jobId: context.job._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        getPrimaryJobInvitation({
          recruiterUser: context.supporting.user,
          jobId: context.job._id.toString(),
          invitationId: sent.id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        revokePrimaryJobInvitation({
          recruiterUser: context.supporting.user,
          jobId: context.job._id.toString(),
          invitationId: sent.id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      expect((await readPersistedInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );
      expect(await findRevokedEvents(sent.id)).toHaveLength(0);
    });

    it("does not authorize management from Invitation id, former Primary, or another Job's Primary", async () => {
      const owner = await seedManagedInvitationContext({
        candidateEmail: "id.auth.invitee@example.com",
        recruiterEmail: "id.auth.primary@example.com",
        supportingEmail: "id.auth.supporting@example.com",
        managerEmail: "id.auth.manager@example.com",
      });
      const foreign = await seedManagedInvitationContext({
        candidateEmail: "id.auth.foreign.invitee@example.com",
        recruiterEmail: "id.auth.foreign.primary@example.com",
        supportingEmail: "id.auth.foreign.supporting@example.com",
        managerEmail: "id.auth.foreign.manager@example.com",
      });
      const sent = await sendPendingInvitation(owner);
      const replacement = await createActiveRecruiterContext({
        email: "id.auth.replacement@example.com",
        company: owner.manager.company,
        employeeCode: "NV-REPLACEMENT",
      });
      await Job.updateOne(
        { _id: owner.job._id },
        { $set: { primaryRecruiterCompanyMemberId: replacement.membership._id } },
      );

      await expect(
        getPrimaryJobInvitation({
          recruiterUser: foreign.recruiter.user,
          jobId: owner.job._id.toString(),
          invitationId: sent.id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        getPrimaryJobInvitation({
          recruiterUser: foreign.recruiter.user,
          jobId: foreign.job._id.toString(),
          invitationId: sent.id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        revokePrimaryJobInvitation({
          recruiterUser: owner.recruiter.user,
          jobId: owner.job._id.toString(),
          invitationId: sent.id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        listPrimaryJobInvitations({
          recruiterUser: owner.recruiter.user,
          clientCompanyId: foreign.manager.company._id.toString(),
          jobId: owner.job._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      expect((await readPersistedInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );
    });
  });

  describe("BR-24 / BR-34 current-state re-check", () => {
    it("does not let Revoke win when an expiration or Job-closed cause already has earlier effective time", async () => {
      const cutoffContext = await seedManagedInvitationContext({
        candidateEmail: "expire.revoke@example.com",
        recruiterEmail: "expire.revoke.primary@example.com",
        supportingEmail: "expire.revoke.supporting@example.com",
        managerEmail: "expire.revoke.manager@example.com",
      });
      const cutoffSent = await sendPendingInvitation(cutoffContext);
      await JobInvitation.updateOne(
        { _id: cutoffSent.id },
        { $set: { expiresAt: new Date("2026-01-01T00:00:00.000Z") } },
        { timestamps: false },
      );

      await expect(
        revokePrimaryJobInvitation({
          recruiterUser: cutoffContext.recruiter.user,
          jobId: cutoffContext.job._id.toString(),
          invitationId: cutoffSent.id.toString(),
          now: new Date("2026-01-16T00:00:00.000Z"),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect((await readPersistedInvitation(cutoffSent.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );
      expect((await readPersistedInvitation(cutoffSent.id)).revokedAt).toBeNull();
      expect(await findRevokedEvents(cutoffSent.id)).toHaveLength(0);

      const closedContext = await seedManagedInvitationContext({
        candidateEmail: "closed.revoke@example.com",
        recruiterEmail: "closed.revoke.primary@example.com",
        supportingEmail: "closed.revoke.supporting@example.com",
        managerEmail: "closed.revoke.manager@example.com",
      });
      const closedSent = await sendPendingInvitation(closedContext);
      await Job.updateOne(
        { _id: closedContext.job._id },
        { $set: { status: JOB_STATUS.CLOSED } },
      );

      const listed = await listPrimaryJobInvitations({
        recruiterUser: closedContext.recruiter.user,
        jobId: closedContext.job._id.toString(),
      });
      expect(listed.invitations[0].status).toBe(JOB_INVITATION_STATUS.EXPIRED);
      expect(listed.invitations[0].canRevoke).toBe(false);

      await expect(
        revokePrimaryJobInvitation({
          recruiterUser: closedContext.recruiter.user,
          jobId: closedContext.job._id.toString(),
          invitationId: closedSent.id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect((await readPersistedInvitation(closedSent.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );
      expect(await findRevokedEvents(closedSent.id)).toHaveLength(0);
    });

    it("does not let Revoke win when an invalidation cause already has earlier effective time", async () => {
      const context = await seedManagedInvitationContext({
        candidateEmail: "invalidate.revoke@example.com",
        recruiterEmail: "invalidate.revoke.primary@example.com",
        supportingEmail: "invalidate.revoke.supporting@example.com",
        managerEmail: "invalidate.revoke.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      await CandidateCV.updateOne(
        { _id: context.candidateCv._id },
        { $set: { archivedAt: new Date("2026-08-18T10:00:00.000Z") } },
      );

      await expect(
        revokePrimaryJobInvitation({
          recruiterUser: context.recruiter.user,
          jobId: context.job._id.toString(),
          invitationId: sent.id.toString(),
          now: new Date("2026-08-19T04:00:00.000Z"),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await readPersistedInvitation(sent.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(persisted.revokedAt).toBeNull();
      expect(await findRevokedEvents(sent.id)).toHaveLength(0);
    });

    it("keeps persisted terminal states terminal and does not create REVOKED", async () => {
      const statuses = [
        JOB_INVITATION_STATUS.ACCEPTED,
        JOB_INVITATION_STATUS.REJECTED,
        JOB_INVITATION_STATUS.REVOKED,
        JOB_INVITATION_STATUS.EXPIRED,
        JOB_INVITATION_STATUS.INVALIDATED,
      ];

      for (const status of statuses) {
        const context = await seedManagedInvitationContext({
          candidateEmail: `terminal.revoke.${status.toLowerCase()}@example.com`,
          recruiterEmail: `terminal.revoke.${status.toLowerCase()}.primary@example.com`,
          supportingEmail: `terminal.revoke.${status.toLowerCase()}.supporting@example.com`,
          managerEmail: `terminal.revoke.${status.toLowerCase()}.manager@example.com`,
        });
        const sent = await sendPendingInvitation(context);
        await persistTerminalStatus(sent.id, status);
        const before = await readPersistedInvitation(sent.id);

        await expect(
          revokePrimaryJobInvitation({
            recruiterUser: context.recruiter.user,
            jobId: context.job._id.toString(),
            invitationId: sent.id.toString(),
          }),
        ).rejects.toMatchObject({ statusCode: 409 });

        const after = await readPersistedInvitation(sent.id);
        expect(after.status).toBe(status);
        if (status !== JOB_INVITATION_STATUS.REVOKED) {
          expect(after.revokedAt).toBeNull();
        } else {
          expect(after.revokedAt.getTime()).toBe(before.revokedAt.getTime());
        }
        expect(await findRevokedEvents(sent.id)).toHaveLength(0);
      }
    });
  });

  describe("BR-56 durability and REVOKED resend", () => {
    it("keeps REVOKED when inbox materialization fails after commit", async () => {
      const context = await seedManagedInvitationContext({
        candidateEmail: "durable.revoke@example.com",
        recruiterEmail: "durable.revoke.primary@example.com",
        supportingEmail: "durable.revoke.supporting@example.com",
        managerEmail: "durable.revoke.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      vi.spyOn(notificationService, "materializeNotificationEvent").mockRejectedValue(
        new Error("inbox unavailable"),
      );

      const result = await revokePrimaryJobInvitation({
        recruiterUser: context.recruiter.user,
        jobId: context.job._id.toString(),
        invitationId: sent.id.toString(),
      });

      expect(result.invitation.status).toBe(JOB_INVITATION_STATUS.REVOKED);
      expect((await readPersistedInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.REVOKED,
      );
      const events = await findRevokedEvents(sent.id);
      expect(events).toHaveLength(1);
      expect(events[0].materializedAt).toBeNull();
    });

    it("allows a later Send after successful Revoke when other current Send conditions remain valid", async () => {
      const context = await seedManagedInvitationContext({
        candidateEmail: "resend.revoke@example.com",
        recruiterEmail: "resend.revoke.primary@example.com",
        supportingEmail: "resend.revoke.supporting@example.com",
        managerEmail: "resend.revoke.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      await revokePrimaryJobInvitation({
        recruiterUser: context.recruiter.user,
        jobId: context.job._id.toString(),
        invitationId: sent.id.toString(),
      });

      mockInvitationSnapshotUpload();
      const resent = await sendJobInvitation({
        recruiterUser: context.recruiter.user,
        jobId: context.job._id.toString(),
        candidateCvId: context.candidateCv._id.toString(),
      });

      expect(resent.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(resent.id.toString()).not.toBe(sent.id.toString());
      expect((await readPersistedInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.REVOKED,
      );
      expect(
        await JobInvitation.countDocuments({
          candidateUserId: context.candidate._id,
          jobId: context.job._id,
        }),
      ).toBe(2);
    });
  });

  describe("concurrency", () => {
    it("allows only one concurrent Revoke to persist REVOKED and the durable event", async () => {
      const context = await seedManagedInvitationContext({
        candidateEmail: "race.revoke@example.com",
        recruiterEmail: "race.revoke.primary@example.com",
        supportingEmail: "race.revoke.supporting@example.com",
        managerEmail: "race.revoke.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      const outcomes = await Promise.allSettled([
        revokePrimaryJobInvitation({
          recruiterUser: context.recruiter.user,
          jobId: context.job._id.toString(),
          invitationId: sent.id.toString(),
        }),
        revokePrimaryJobInvitation({
          recruiterUser: context.recruiter.user,
          jobId: context.job._id.toString(),
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
        JOB_INVITATION_STATUS.REVOKED,
      );
      expect(await findRevokedEvents(sent.id)).toHaveLength(1);
    });

    it("lets only one of concurrent Revoke and Reject persist a terminal outcome", async () => {
      const context = await seedManagedInvitationContext({
        candidateEmail: "race.reject.revoke@example.com",
        recruiterEmail: "race.reject.revoke.primary@example.com",
        supportingEmail: "race.reject.revoke.supporting@example.com",
        managerEmail: "race.reject.revoke.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      const outcomes = await Promise.allSettled([
        revokePrimaryJobInvitation({
          recruiterUser: context.recruiter.user,
          jobId: context.job._id.toString(),
          invitationId: sent.id.toString(),
        }),
        rejectOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
        }),
      ]);

      const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
      const rejected = outcomes.filter((result) => result.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({ statusCode: 409 });

      const persisted = await readPersistedInvitation(sent.id);
      expect([
        JOB_INVITATION_STATUS.REVOKED,
        JOB_INVITATION_STATUS.REJECTED,
      ]).toContain(persisted.status);
      expect(await findRevokedEvents(sent.id)).toHaveLength(
        persisted.status === JOB_INVITATION_STATUS.REVOKED ? 1 : 0,
      );
      expect(
        await NotificationEvent.countDocuments({
          type: NOTIFICATION_TYPE.JOB_INVITATION_REJECTED,
          jobInvitationId: sent.id,
        }),
      ).toBe(persisted.status === JOB_INVITATION_STATUS.REJECTED ? 1 : 0);
    });
  });

  describe("HTTP", () => {
    it("exposes Primary list/detail/revoke and denies Supporting, Manager, and anonymous callers", async () => {
      const context = await seedManagedInvitationContext({
        candidateEmail: "http.revoke.invitee@example.com",
        recruiterEmail: "http.revoke.primary@example.com",
        supportingEmail: "http.revoke.supporting@example.com",
        managerEmail: "http.revoke.manager@example.com",
      });
      const sent = await sendPendingInvitation(context, "Join us");
      const agent = createTestAgent();
      const primaryToken = await loginAndGetAccessToken(agent, {
        email: context.recruiter.user.email,
        password: context.recruiter.password,
      });
      const supportingToken = await loginAndGetAccessToken(agent, {
        email: context.supporting.user.email,
        password: context.supporting.password,
      });
      const managerToken = await loginAndGetAccessToken(agent, {
        email: context.manager.user.email,
        password: context.manager.password,
      });
      const { user: admin } = await createVerifiedUser({
        email: "http.revoke.admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      const adminToken = await loginAndGetAccessToken(agent, {
        email: admin.email,
      });

      const listResponse = await agent
        .get(`/api/jobs/${context.job._id}/invitations`)
        .set("Authorization", `Bearer ${primaryToken}`);
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.invitations).toHaveLength(1);
      expect(listResponse.body.invitations[0].canRevoke).toBe(true);

      const detailResponse = await agent
        .get(`/api/jobs/${context.job._id}/invitations/${sent.id}`)
        .set("Authorization", `Bearer ${primaryToken}`);
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.invitation.status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );

      expect(
        (
          await agent.get(`/api/jobs/${context.job._id}/invitations`)
        ).status,
      ).toBe(401);
      expect(
        (
          await agent
            .get(`/api/jobs/${context.job._id}/invitations`)
            .set("Authorization", `Bearer ${supportingToken}`)
        ).status,
      ).toBe(403);
      expect(
        (
          await agent
            .post(`/api/jobs/${context.job._id}/invitations/${sent.id}/revoke`)
            .set("Authorization", `Bearer ${supportingToken}`)
        ).status,
      ).toBe(403);
      expect(
        (
          await agent
            .post(`/api/jobs/${context.job._id}/invitations/${sent.id}/revoke`)
            .set("Authorization", `Bearer ${managerToken}`)
        ).status,
      ).toBe(403);
      expect(
        (
          await agent
            .post(`/api/jobs/${context.job._id}/invitations/${sent.id}/revoke`)
            .set("Authorization", `Bearer ${adminToken}`)
        ).status,
      ).toBe(403);

      const revokeResponse = await agent
        .post(`/api/jobs/${context.job._id}/invitations/${sent.id}/revoke`)
        .set("Authorization", `Bearer ${primaryToken}`);
      expect(revokeResponse.status).toBe(200);
      expect(revokeResponse.body.invitation.status).toBe(
        JOB_INVITATION_STATUS.REVOKED,
      );
      expect(revokeResponse.body.invitation.canRevoke).toBe(false);
    });
  });

  describe("BR-61 tenant and operational Company", () => {
    it("requires the actor's operational Company relationship and does not trust client companyId", async () => {
      const context = await seedManagedInvitationContext({
        candidateEmail: "tenant.revoke@example.com",
        recruiterEmail: "tenant.revoke.primary@example.com",
        supportingEmail: "tenant.revoke.supporting@example.com",
        managerEmail: "tenant.revoke.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      await Company.updateOne(
        { _id: context.manager.company._id },
        { $set: { operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED } },
      );

      await expect(
        listPrimaryJobInvitations({
          recruiterUser: context.recruiter.user,
          jobId: context.job._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        revokePrimaryJobInvitation({
          recruiterUser: context.recruiter.user,
          jobId: context.job._id.toString(),
          invitationId: sent.id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect((await readPersistedInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );
    });
  });
});
