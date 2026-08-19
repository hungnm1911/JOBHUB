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
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import CV_LANGUAGE_PROFICIENCY from "../../src/constants/cv-language-proficiency.js";
import JOB_INVITATION_INVALIDATION_REASON from "../../src/constants/job-invitation-invalidation-reason.js";
import JOB_INVITATION_STATUS from "../../src/constants/job-invitation-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import JobInvitation from "../../src/models/job-invitation.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import User from "../../src/models/user.model.js";
import { directApplyToJob } from "../../src/services/application.service.js";
import { archiveOwnCandidateCv } from "../../src/services/candidate-cv.service.js";
import * as fileService from "../../src/services/file.service.js";
import {
  closePublishedJob,
  expirePublishedJobIfDue,
  removeSupportingRecruiter,
  replacePrimaryRecruiter,
} from "../../src/services/job.service.js";
import {
  materializeDueExpiredJobInvitations,
  materializeJobInvitationIfDue,
  rejectOwnJobInvitation,
  sendJobInvitation,
} from "../../src/services/job-invitation.service.js";
import * as jobInvitationService from "../../src/services/job-invitation.service.js";
import * as notificationService from "../../src/services/notification.service.js";
import {
  lockAccount,
  lockCompany,
} from "../../src/services/platform-admin.service.js";
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

const mockSnapshotUpload = () => {
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

const seedInvitationContext = async ({
  candidateEmail = "invitee.expire@example.com",
  recruiterEmail = "primary.expire@example.com",
  supportingEmail = "supporting.expire@example.com",
  managerEmail = "manager.expire@example.com",
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

const sendPendingInvitation = async (context, sender = context.supporting) => {
  mockSnapshotUpload();
  return sendJobInvitation({
    recruiterUser: sender.user,
    jobId: context.job._id.toString(),
    candidateCvId: context.candidateCv._id.toString(),
    greetingMessage: "Join us",
  });
};

const readInvitation = async (invitationId) => {
  return JobInvitation.findById(invitationId);
};

const countInvitationEvents = async (invitationId, type) => {
  return NotificationEvent.countDocuments({
    jobInvitationId: invitationId,
    type,
  });
};

describe("V15 Slice 06 — Invitation Expiration + Invalidation Materialization", () => {
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

  describe("F07 expiration materialization", () => {
    it("persists PENDING → EXPIRED for BR-23 cutoff, Job CLOSED, and Job deadline without JOB_INVITATION_EXPIRED", async () => {
      const cutoffContext = await seedInvitationContext({
        candidateEmail: "expire.cutoff@example.com",
        recruiterEmail: "expire.cutoff.recruiter@example.com",
        supportingEmail: "expire.cutoff.supporting@example.com",
        managerEmail: "expire.cutoff.manager@example.com",
      });
      const cutoffInvitation = await sendPendingInvitation(cutoffContext);
      const pastCutoff = new Date("2026-01-16T00:00:00.000Z");
      await JobInvitation.updateOne(
        { _id: cutoffInvitation.id },
        { $set: { expiresAt: pastCutoff } },
        { timestamps: false },
      );

      await materializeDueExpiredJobInvitations({
        now: new Date("2026-01-16T00:00:01.000Z"),
      });
      const cutoffPersisted = await readInvitation(cutoffInvitation.id);
      expect(cutoffPersisted.status).toBe(JOB_INVITATION_STATUS.EXPIRED);
      expect(cutoffPersisted.invalidatedAt).toBeNull();
      expect(
        await countInvitationEvents(
          cutoffInvitation.id,
          "JOB_INVITATION_EXPIRED",
        ),
      ).toBe(0);

      const closedContext = await seedInvitationContext({
        candidateEmail: "expire.closed@example.com",
        recruiterEmail: "expire.closed.recruiter@example.com",
        supportingEmail: "expire.closed.supporting@example.com",
        managerEmail: "expire.closed.manager@example.com",
      });
      const closedInvitation = await sendPendingInvitation(closedContext);
      await closePublishedJob({
        actorUser: closedContext.recruiter.user,
        jobId: closedContext.job._id.toString(),
      });
      const closedPersisted = await readInvitation(closedInvitation.id);
      expect(closedPersisted.status).toBe(JOB_INVITATION_STATUS.EXPIRED);
      expect(
        await countInvitationEvents(
          closedInvitation.id,
          NOTIFICATION_TYPE.JOB_INVITATION_INVALIDATED,
        ),
      ).toBe(0);

      const deadlineContext = await seedInvitationContext({
        candidateEmail: "expire.deadline@example.com",
        recruiterEmail: "expire.deadline.recruiter@example.com",
        supportingEmail: "expire.deadline.supporting@example.com",
        managerEmail: "expire.deadline.manager@example.com",
      });
      const deadlineInvitation = await sendPendingInvitation(deadlineContext);
      const pastDeadline = new Date("2026-02-01T00:00:00.000Z");
      await Job.updateOne(
        { _id: deadlineContext.job._id },
        { $set: { applicationDeadline: pastDeadline } },
        { timestamps: false },
      );
      await expirePublishedJobIfDue({
        jobId: deadlineContext.job._id.toString(),
        now: new Date("2026-02-01T00:00:01.000Z"),
      });
      expect((await readInvitation(deadlineInvitation.id)).status).toBe(
        JOB_INVITATION_STATUS.EXPIRED,
      );
      expect(
        await countInvitationEvents(
          deadlineInvitation.id,
          "JOB_INVITATION_EXPIRED",
        ),
      ).toBe(0);
    });
  });

  describe("F08 invalidation materialization and TX-05", () => {
    it("materializes PENDING → INVALIDATED from source owners with effective invalidatedAt and dual recipients", async () => {
      const context = await seedInvitationContext({
        candidateEmail: "invalidate.archive@example.com",
        recruiterEmail: "invalidate.archive.recruiter@example.com",
        supportingEmail: "invalidate.archive.supporting@example.com",
        managerEmail: "invalidate.archive.manager@example.com",
      });
      const invitation = await sendPendingInvitation(context);
      const snapshotName = invitation.invitedCvSnapshot.name;

      await archiveOwnCandidateCv({
        candidateUserId: context.candidate._id,
        actorUser: context.candidate,
        candidateCvId: context.candidateCv._id.toString(),
      });

      const archivedCv = await CandidateCV.findById(context.candidateCv._id);
      const persisted = await readInvitation(invitation.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.INVALIDATED);
      expect(persisted.invalidationReason).toBe(
        JOB_INVITATION_INVALIDATION_REASON.INVITED_CV_ARCHIVED,
      );
      expect(persisted.invalidatedAt.toISOString()).toBe(
        archivedCv.archivedAt.toISOString(),
      );
      expect(persisted.invitedCvSnapshot.name).toBe(snapshotName);

      const event = await NotificationEvent.findOne({
        jobInvitationId: invitation.id,
        type: NOTIFICATION_TYPE.JOB_INVITATION_INVALIDATED,
      });
      expect(event).not.toBeNull();
      expect(event.recipients.map((recipient) => recipient.recipientUserId.toString()).sort()).toEqual(
        [context.candidate._id.toString(), context.supporting.user._id.toString()].sort(),
      );
      expect(event.recipients.map((recipient) => recipient.recipientUserId.toString())).not.toContain(
        context.recruiter.user._id.toString(),
      );
    });

    it("keeps invalidatedAt as the source-cause time when materialization runs later", async () => {
      const context = await seedInvitationContext({
        candidateEmail: "invalidate.delay@example.com",
        recruiterEmail: "invalidate.delay.recruiter@example.com",
        supportingEmail: "invalidate.delay.supporting@example.com",
        managerEmail: "invalidate.delay.manager@example.com",
      });
      const invitation = await sendPendingInvitation(context);
      const causeAt = new Date("2026-04-01T08:00:00.000Z");
      const laterNow = new Date("2026-04-01T10:10:00.000Z");

      await User.updateOne(
        { _id: context.candidate._id },
        {
          $set: {
            status: USER_STATUS.LOCKED,
            updatedAt: causeAt,
          },
        },
        { timestamps: false },
      );

      const persistedInvitation = await readInvitation(invitation.id);
      expect(persistedInvitation.status).toBe(JOB_INVITATION_STATUS.PENDING);

      await materializeJobInvitationIfDue({
        invitation: persistedInvitation,
        now: laterNow,
      });

      const materialized = await readInvitation(invitation.id);
      expect(materialized.status).toBe(JOB_INVITATION_STATUS.INVALIDATED);
      expect(materialized.invalidationReason).toBe(
        JOB_INVITATION_INVALIDATION_REASON.CANDIDATE_NOT_ACTIVE,
      );
      expect(materialized.invalidatedAt.toISOString()).toBe(causeAt.toISOString());
      expect(materialized.invalidatedAt.toISOString()).not.toBe(
        laterNow.toISOString(),
      );
    });

    it("lets the earliest authoritative cause win over later materialization time", async () => {
      const context = await seedInvitationContext({
        candidateEmail: "invalidate.earliest@example.com",
        recruiterEmail: "invalidate.earliest.recruiter@example.com",
        supportingEmail: "invalidate.earliest.supporting@example.com",
        managerEmail: "invalidate.earliest.manager@example.com",
      });
      const invitation = await sendPendingInvitation(context);
      const jobClosedAt = new Date("2026-05-01T09:00:00.000Z");
      const candidateLockedAt = new Date("2026-05-01T10:00:00.000Z");
      const materializedAt = new Date("2026-05-01T12:00:00.000Z");

      await Job.updateOne(
        { _id: context.job._id },
        {
          $set: {
            status: JOB_STATUS.CLOSED,
            updatedAt: jobClosedAt,
          },
        },
        { timestamps: false },
      );
      await User.updateOne(
        { _id: context.candidate._id },
        {
          $set: {
            status: USER_STATUS.LOCKED,
            updatedAt: candidateLockedAt,
          },
        },
        { timestamps: false },
      );

      await materializeJobInvitationIfDue({
        invitation: await readInvitation(invitation.id),
        now: materializedAt,
      });

      const persisted = await readInvitation(invitation.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.EXPIRED);
      expect(persisted.invalidatedAt).toBeNull();
      expect(persisted.invalidationReason).toBeNull();
      expect(
        await countInvitationEvents(
          invitation.id,
          NOTIFICATION_TYPE.JOB_INVITATION_INVALIDATED,
        ),
      ).toBe(0);
    });

    it("rolls back INVALIDATED when the TX-05 NotificationEvent cannot persist", async () => {
      const context = await seedInvitationContext({
        candidateEmail: "invalidate.tx@example.com",
        recruiterEmail: "invalidate.tx.recruiter@example.com",
        supportingEmail: "invalidate.tx.supporting@example.com",
        managerEmail: "invalidate.tx.manager@example.com",
      });
      const invitation = await sendPendingInvitation(context);
      await CandidateCV.updateOne(
        { _id: context.candidateCv._id },
        { $set: { archivedAt: new Date("2026-06-01T00:00:00.000Z") } },
      );

      vi.spyOn(notificationService, "createNotificationEvent").mockRejectedValue(
        new Error("notification event write failed"),
      );

      await expect(
        materializeJobInvitationIfDue({
          invitation: await readInvitation(invitation.id),
        }),
      ).rejects.toThrow("notification event write failed");

      const persisted = await readInvitation(invitation.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(persisted.invalidationReason).toBeNull();
      expect(
        await countInvitationEvents(
          invitation.id,
          NOTIFICATION_TYPE.JOB_INVITATION_INVALIDATED,
        ),
      ).toBe(0);
    });

    it("does not invalidate or rewrite the invited snapshot for PRIVATE, Generated DRAFT, or live CV edits", async () => {
      const context = await seedInvitationContext({
        candidateEmail: "keep.pending@example.com",
        recruiterEmail: "keep.pending.recruiter@example.com",
        supportingEmail: "keep.pending.supporting@example.com",
        managerEmail: "keep.pending.manager@example.com",
      });
      const invitation = await sendPendingInvitation(context);
      const originalSnapshot = invitation.invitedCvSnapshot;

      await CandidateCV.updateOne(
        { _id: context.candidateCv._id },
        {
          $set: {
            visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
            status: CANDIDATE_CV_STATUS.DRAFT,
            name: "Edited live CV",
            "generatedContent.professionalSummary": "Changed after Send",
          },
        },
      );

      await materializeJobInvitationIfDue({
        invitation: await readInvitation(invitation.id),
      });

      const persisted = await readInvitation(invitation.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(persisted.invitedCvSnapshot.name).toBe(originalSnapshot.name);
      expect(persisted.invitedCvSnapshot.generatedContent.professionalSummary).toBe(
        originalSnapshot.generatedContent.professionalSummary,
      );
      expect(
        await countInvitationEvents(
          invitation.id,
          NOTIFICATION_TYPE.JOB_INVITATION_INVALIDATED,
        ),
      ).toBe(0);
    });

    it("invalidates from Candidate, Company, sender User, membership, and Job-team source owners", async () => {
      const candidateContext = await seedInvitationContext({
        candidateEmail: "src.candidate@example.com",
        recruiterEmail: "src.candidate.recruiter@example.com",
        supportingEmail: "src.candidate.supporting@example.com",
        managerEmail: "src.candidate.manager@example.com",
      });
      const candidateInvitation = await sendPendingInvitation(candidateContext);
      const { user: admin } = await createVerifiedUser({
        email: "src.candidate.admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      await lockAccount({
        targetUserId: candidateContext.candidate._id.toString(),
        actorUserId: admin._id,
      });
      expect((await readInvitation(candidateInvitation.id)).status).toBe(
        JOB_INVITATION_STATUS.INVALIDATED,
      );
      expect((await readInvitation(candidateInvitation.id)).invalidationReason).toBe(
        JOB_INVITATION_INVALIDATION_REASON.CANDIDATE_NOT_ACTIVE,
      );

      const companyContext = await seedInvitationContext({
        candidateEmail: "src.company@example.com",
        recruiterEmail: "src.company.recruiter@example.com",
        supportingEmail: "src.company.supporting@example.com",
        managerEmail: "src.company.manager@example.com",
      });
      const companyInvitation = await sendPendingInvitation(companyContext);
      await lockCompany({
        companyId: companyContext.manager.company._id.toString(),
      });
      expect((await readInvitation(companyInvitation.id)).invalidationReason).toBe(
        JOB_INVITATION_INVALIDATION_REASON.COMPANY_NOT_OPERATIONAL,
      );

      const senderContext = await seedInvitationContext({
        candidateEmail: "src.sender@example.com",
        recruiterEmail: "src.sender.recruiter@example.com",
        supportingEmail: "src.sender.supporting@example.com",
        managerEmail: "src.sender.manager@example.com",
      });
      const senderInvitation = await sendPendingInvitation(senderContext);
      const { user: senderAdmin } = await createVerifiedUser({
        email: "src.sender.admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      await lockAccount({
        targetUserId: senderContext.supporting.user._id.toString(),
        actorUserId: senderAdmin._id,
      });
      expect((await readInvitation(senderInvitation.id)).invalidationReason).toBe(
        JOB_INVITATION_INVALIDATION_REASON.SENDER_NOT_ACTIVE,
      );

      const membershipContext = await seedInvitationContext({
        candidateEmail: "src.membership@example.com",
        recruiterEmail: "src.membership.recruiter@example.com",
        supportingEmail: "src.membership.supporting@example.com",
        managerEmail: "src.membership.manager@example.com",
      });
      const membershipInvitation = await sendPendingInvitation(membershipContext);
      await CompanyMember.updateOne(
        { _id: membershipContext.supporting.membership._id },
        { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
      );
      await materializeJobInvitationIfDue({
        invitation: await readInvitation(membershipInvitation.id),
      });
      expect((await readInvitation(membershipInvitation.id)).invalidationReason).toBe(
        JOB_INVITATION_INVALIDATION_REASON.SENDER_COMPANY_MEMBERSHIP_INVALID,
      );

      const teamContext = await seedInvitationContext({
        candidateEmail: "src.team@example.com",
        recruiterEmail: "src.team.recruiter@example.com",
        supportingEmail: "src.team.supporting@example.com",
        managerEmail: "src.team.manager@example.com",
      });
      const teamInvitation = await sendPendingInvitation(teamContext);
      await removeSupportingRecruiter({
        actorUser: teamContext.recruiter.user,
        jobId: teamContext.job._id.toString(),
        supportingRecruiterCompanyMemberId:
          teamContext.supporting.membership._id.toString(),
      });
      expect((await readInvitation(teamInvitation.id)).invalidationReason).toBe(
        JOB_INVITATION_INVALIDATION_REASON.SENDER_REMOVED_FROM_JOB_TEAM,
      );

      const stayContext = await seedInvitationContext({
        candidateEmail: "src.stay@example.com",
        recruiterEmail: "src.stay.recruiter@example.com",
        supportingEmail: "src.stay.supporting@example.com",
        managerEmail: "src.stay.manager@example.com",
      });
      const stayInvitation = await sendPendingInvitation(stayContext, stayContext.recruiter);
      await replacePrimaryRecruiter({
        managerUser: stayContext.manager.user,
        jobId: stayContext.job._id.toString(),
        newPrimaryCompanyMemberId: stayContext.supporting.membership._id,
        keepOldPrimaryAsSupporting: true,
      });
      expect((await readInvitation(stayInvitation.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );
    });
  });

  describe("F09 Direct Apply stale-PENDING closure", () => {
    it("lets Direct Apply succeed after an effectively EXPIRED stale PENDING and persists EXPIRED", async () => {
      const context = await seedInvitationContext({
        candidateEmail: "apply.expired@example.com",
        recruiterEmail: "apply.expired.recruiter@example.com",
        supportingEmail: "apply.expired.supporting@example.com",
        managerEmail: "apply.expired.manager@example.com",
      });
      const invitation = await sendPendingInvitation(context);
      const pastCutoff = new Date("2026-01-16T00:00:00.000Z");
      await JobInvitation.updateOne(
        { _id: invitation.id },
        { $set: { expiresAt: pastCutoff } },
        { timestamps: false },
      );

      mockSnapshotUpload();
      const application = await directApplyToJob({
        candidateUserId: context.candidate._id,
        actorUser: context.candidate,
        jobId: context.job._id.toString(),
        candidateCvId: context.candidateCv._id.toString(),
        now: new Date("2026-01-16T00:00:01.000Z"),
      });

      expect(application.source).toBe(APPLICATION_SOURCE.DIRECT_APPLICATION);
      expect((await readInvitation(invitation.id)).status).toBe(
        JOB_INVITATION_STATUS.EXPIRED,
      );
      expect(await Application.countDocuments({ jobId: context.job._id })).toBe(1);
    });

    it("lets Direct Apply succeed after sender-team invalidation and commits TX-05 in the same apply boundary", async () => {
      const context = await seedInvitationContext({
        candidateEmail: "apply.invalid@example.com",
        recruiterEmail: "apply.invalid.recruiter@example.com",
        supportingEmail: "apply.invalid.supporting@example.com",
        managerEmail: "apply.invalid.manager@example.com",
      });
      const invitation = await sendPendingInvitation(context);
      await Job.updateOne(
        { _id: context.job._id },
        {
          $set: {
            supportingRecruiterCompanyMemberIds: [],
          },
        },
      );

      mockSnapshotUpload();
      const application = await directApplyToJob({
        candidateUserId: context.candidate._id,
        actorUser: context.candidate,
        jobId: context.job._id.toString(),
        candidateCvId: context.candidateCv._id.toString(),
      });

      expect(application.source).toBe(APPLICATION_SOURCE.DIRECT_APPLICATION);
      const persisted = await readInvitation(invitation.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.INVALIDATED);
      expect(persisted.invalidationReason).toBe(
        JOB_INVITATION_INVALIDATION_REASON.SENDER_REMOVED_FROM_JOB_TEAM,
      );
      expect(
        await countInvitationEvents(
          invitation.id,
          NOTIFICATION_TYPE.JOB_INVITATION_INVALIDATED,
        ),
      ).toBe(1);
    });

    it("still blocks Direct Apply while the Invitation is effectively PENDING", async () => {
      const context = await seedInvitationContext({
        candidateEmail: "apply.pending@example.com",
        recruiterEmail: "apply.pending.recruiter@example.com",
        supportingEmail: "apply.pending.supporting@example.com",
        managerEmail: "apply.pending.manager@example.com",
      });
      await sendPendingInvitation(context);

      await expect(
        directApplyToJob({
          candidateUserId: context.candidate._id,
          actorUser: context.candidate,
          jobId: context.job._id.toString(),
          candidateCvId: context.candidateCv._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe("concurrency and source-delay", () => {
    it("keeps REJECTED when Reject commits before a later invalidation materialization", async () => {
      const context = await seedInvitationContext({
        candidateEmail: "race.reject@example.com",
        recruiterEmail: "race.reject.recruiter@example.com",
        supportingEmail: "race.reject.supporting@example.com",
        managerEmail: "race.reject.manager@example.com",
      });
      const invitation = await sendPendingInvitation(context);
      await rejectOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: invitation.id.toString(),
      });

      await CandidateCV.updateOne(
        { _id: context.candidateCv._id },
        { $set: { archivedAt: new Date() } },
      );
      await materializeJobInvitationIfDue({
        invitation: await readInvitation(invitation.id),
      });

      const persisted = await readInvitation(invitation.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.REJECTED);
      expect(persisted.invalidationReason).toBeNull();
    });

    it("does not roll back a successful Job close when Invitation materialization fails", async () => {
      const context = await seedInvitationContext({
        candidateEmail: "delay.close@example.com",
        recruiterEmail: "delay.close.recruiter@example.com",
        supportingEmail: "delay.close.supporting@example.com",
        managerEmail: "delay.close.manager@example.com",
      });
      const invitation = await sendPendingInvitation(context);
      vi.spyOn(
        jobInvitationService,
        "materializePendingJobInvitationsBestEffort",
      ).mockRejectedValue(new Error("materialization delayed"));

      const closed = await closePublishedJob({
        actorUser: context.recruiter.user,
        jobId: context.job._id.toString(),
      });

      expect(closed.status).toBe(JOB_STATUS.CLOSED);
      expect((await readInvitation(invitation.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );
    });

    it("lets only one concurrent materialization persist the terminal Invitation", async () => {
      const context = await seedInvitationContext({
        candidateEmail: "race.materialize@example.com",
        recruiterEmail: "race.materialize.recruiter@example.com",
        supportingEmail: "race.materialize.supporting@example.com",
        managerEmail: "race.materialize.manager@example.com",
      });
      const invitation = await sendPendingInvitation(context);
      await CandidateCV.updateOne(
        { _id: context.candidateCv._id },
        { $set: { archivedAt: new Date("2026-07-01T00:00:00.000Z") } },
      );
      const current = await readInvitation(invitation.id);

      const [first, second] = await Promise.all([
        materializeJobInvitationIfDue({ invitation: current }),
        materializeJobInvitationIfDue({ invitation: current }),
      ]);

      expect(
        [first.invitation.status, second.invitation.status].every(
          (status) => status === JOB_INVITATION_STATUS.INVALIDATED,
        ),
      ).toBe(true);
      expect(
        await countInvitationEvents(
          invitation.id,
          NOTIFICATION_TYPE.JOB_INVITATION_INVALIDATED,
        ),
      ).toBe(1);
    });
  });
});
