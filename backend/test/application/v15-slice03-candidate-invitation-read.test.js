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
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import CV_LANGUAGE_PROFICIENCY from "../../src/constants/cv-language-proficiency.js";
import JOB_INVITATION_INVALIDATION_REASON from "../../src/constants/job-invitation-invalidation-reason.js";
import JOB_INVITATION_STATUS from "../../src/constants/job-invitation-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import USER_STATUS from "../../src/constants/user-status.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import JobInvitation from "../../src/models/job-invitation.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import User from "../../src/models/user.model.js";
import * as fileService from "../../src/services/file.service.js";
import {
  evaluateJobInvitationCurrentState,
  EXPIRATION_CAUSE_SOURCE,
} from "../../src/services/job-invitation-current-state.service.js";
import {
  getOwnJobInvitation,
  listOwnJobInvitations,
  sendJobInvitation,
} from "../../src/services/job-invitation.service.js";
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
  candidateEmail = "invitee.read@example.com",
  recruiterEmail = "recruiter.read@example.com",
  managerEmail = "manager.read@example.com",
  supportingEmail = null,
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
  let supporting = null;
  if (supportingEmail) {
    supporting = await createActiveRecruiterContext({
      email: supportingEmail,
      company: manager.company,
      employeeCode: `NV-${supportingEmail}`,
      fullName: "Replacement Primary",
      jobTitle: "Supporting Recruiter",
    });
  }
  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: recruiter.membership._id,
    supportingIds: supporting ? [supporting.membership._id] : [],
    applicationDeadline,
  });
  const category = await createFieldCategory(`Software Engineering ${candidateEmail}`);
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

describe("V15 Slice 03 — Candidate Invitation Read + Current-State Evaluation", () => {
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

  describe("F03 / BR-26 Candidate ownership", () => {
    it("lets a Candidate list and read only their own Invitations, including Job/Company/sender/snapshot context", async () => {
      const owner = await seedSendableContext({
        candidateEmail: "owner.read@example.com",
        recruiterEmail: "owner.recruiter@example.com",
        managerEmail: "owner.manager@example.com",
      });
      const foreign = await seedSendableContext({
        candidateEmail: "foreign.read@example.com",
        recruiterEmail: "foreign.recruiter@example.com",
        managerEmail: "foreign.manager@example.com",
      });
      const ownInvitation = await sendPendingInvitation(owner, "Join us");
      const foreignInvitation = await sendPendingInvitation(foreign, "Other");

      const listed = await listOwnJobInvitations({
        candidateUser: owner.candidate,
      });
      expect(listed.invitations).toHaveLength(1);
      expect(listed.invitations[0].id).toBe(ownInvitation.id.toString());
      expect(listed.invitations[0].status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(listed.invitations[0].canAccept).toBe(true);
      expect(listed.invitations[0].canReject).toBe(true);
      expect(listed.invitations[0].greetingMessage).toBe("Join us");
      expect(listed.invitations[0].job.title).toBe("Backend Engineer");
      expect(listed.invitations[0].company.id).toBe(
        owner.manager.company._id.toString(),
      );
      expect(listed.invitations[0].sender.fullName).toBe("Historical Sender");
      expect(listed.invitations[0].sender.jobTitle).toBe("Primary Recruiter");
      expect(listed.invitations[0].invitedCvSnapshot.name).toBe(
        "Public Generated CV",
      );
      expect(listed.invitations[0].invitedCvSnapshot.pdfFile).not.toHaveProperty(
        "storageKey",
      );

      const detail = await getOwnJobInvitation({
        candidateUser: owner.candidate,
        invitationId: ownInvitation.id.toString(),
      });
      expect(detail.invitation.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(detail.invitation.sentAt).toBeTruthy();
      expect(detail.invitation.expiresAt).toBeTruthy();

      await expect(
        getOwnJobInvitation({
          candidateUser: owner.candidate,
          invitationId: foreignInvitation.id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("keeps terminal Invitation history readable and does not return it to PENDING", async () => {
      const statuses = [
        JOB_INVITATION_STATUS.ACCEPTED,
        JOB_INVITATION_STATUS.REJECTED,
        JOB_INVITATION_STATUS.REVOKED,
        JOB_INVITATION_STATUS.EXPIRED,
        JOB_INVITATION_STATUS.INVALIDATED,
      ];

      for (const status of statuses) {
        const context = await seedSendableContext({
          candidateEmail: `terminal.${status.toLowerCase()}@example.com`,
          recruiterEmail: `terminal.${status.toLowerCase()}.recruiter@example.com`,
          managerEmail: `terminal.${status.toLowerCase()}.manager@example.com`,
        });
        const sent = await sendPendingInvitation(context);
        await persistTerminalStatus(sent.id, status);

        const detail = await getOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
        });
        expect(detail.invitation.status).toBe(status);
        expect(detail.invitation.canAccept).toBe(false);
        expect(detail.invitation.canReject).toBe(false);

        await CandidateCV.updateOne(
          { _id: context.candidateCv._id },
          { $set: { archivedAt: new Date() } },
        );
        await Job.updateOne(
          { _id: context.job._id },
          { $set: { status: JOB_STATUS.CLOSED } },
        );

        const afterCause = await getOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
        });
        expect(afterCause.invitation.status).toBe(status);
        expect((await readPersistedInvitation(sent.id)).status).toBe(status);
      }
    });
  });

  describe("Current-state evaluation for persisted PENDING", () => {
    it("treats Invitation cutoff, Job CLOSED, and effective Job EXPIRED as EXPIRED without persisting the transition", async () => {
      const cutoffContext = await seedSendableContext({
        candidateEmail: "expire.cutoff@example.com",
        recruiterEmail: "expire.cutoff.recruiter@example.com",
        managerEmail: "expire.cutoff.manager@example.com",
      });
      const cutoffInvitation = await sendPendingInvitation(cutoffContext);
      const pastCutoff = new Date("2026-01-01T00:00:00.000Z");
      await JobInvitation.updateOne(
        { _id: cutoffInvitation.id },
        { $set: { expiresAt: pastCutoff } },
        { timestamps: false },
      );

      const cutoffRead = await getOwnJobInvitation({
        candidateUser: cutoffContext.candidate,
        invitationId: cutoffInvitation.id.toString(),
        now: new Date("2026-01-16T00:00:00.000Z"),
      });
      expect(cutoffRead.invitation.status).toBe(JOB_INVITATION_STATUS.EXPIRED);
      expect(cutoffRead.invitation.canAccept).toBe(false);
      expect((await readPersistedInvitation(cutoffInvitation.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );

      const closedContext = await seedSendableContext({
        candidateEmail: "expire.closed@example.com",
        recruiterEmail: "expire.closed.recruiter@example.com",
        managerEmail: "expire.closed.manager@example.com",
      });
      const closedInvitation = await sendPendingInvitation(closedContext);
      await Job.updateOne(
        { _id: closedContext.job._id },
        { $set: { status: JOB_STATUS.CLOSED } },
      );
      const closedRead = await getOwnJobInvitation({
        candidateUser: closedContext.candidate,
        invitationId: closedInvitation.id.toString(),
      });
      expect(closedRead.invitation.status).toBe(JOB_INVITATION_STATUS.EXPIRED);
      expect((await readPersistedInvitation(closedInvitation.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );

      const deadlineContext = await seedSendableContext({
        candidateEmail: "expire.deadline@example.com",
        recruiterEmail: "expire.deadline.recruiter@example.com",
        managerEmail: "expire.deadline.manager@example.com",
      });
      const deadlineInvitation = await sendPendingInvitation(deadlineContext);
      const pastDeadline = new Date("2026-02-01T00:00:00.000Z");
      await Job.updateOne(
        { _id: deadlineContext.job._id },
        { $set: { applicationDeadline: pastDeadline } },
        { timestamps: false },
      );
      const deadlineRead = await getOwnJobInvitation({
        candidateUser: deadlineContext.candidate,
        invitationId: deadlineInvitation.id.toString(),
        now: new Date("2026-02-02T00:00:00.000Z"),
      });
      expect(deadlineRead.invitation.status).toBe(JOB_INVITATION_STATUS.EXPIRED);
      expect((await readPersistedInvitation(deadlineInvitation.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );
      expect(
        Object.prototype.hasOwnProperty.call(
          await readPersistedInvitation(deadlineInvitation.id),
          "canAccept",
        ),
      ).toBe(false);
    });

    it("invalidates PENDING when Candidate, invited CV, Company, or sender eligibility is lost", async () => {
      const cases = [
        {
          label: "candidate locked",
          email: "invalid.candidate",
          mutate: async (context) => {
            await User.updateOne(
              { _id: context.candidate._id },
              { $set: { status: USER_STATUS.LOCKED } },
            );
          },
          reason: JOB_INVITATION_INVALIDATION_REASON.CANDIDATE_NOT_ACTIVE,
        },
        {
          label: "candidate email unverified",
          email: "invalid.email",
          mutate: async (context) => {
            await User.updateOne(
              { _id: context.candidate._id },
              { $set: { emailVerifiedAt: null } },
            );
          },
          reason: JOB_INVITATION_INVALIDATION_REASON.CANDIDATE_EMAIL_UNVERIFIED,
        },
        {
          label: "invited CV archived",
          email: "invalid.archive",
          mutate: async (context) => {
            await CandidateCV.updateOne(
              { _id: context.candidateCv._id },
              { $set: { archivedAt: new Date("2026-03-01T00:00:00.000Z") } },
              { timestamps: false },
            );
          },
          reason: JOB_INVITATION_INVALIDATION_REASON.INVITED_CV_ARCHIVED,
        },
        {
          label: "company locked",
          email: "invalid.company",
          mutate: async (context) => {
            await Company.updateOne(
              { _id: context.manager.company._id },
              {
                $set: {
                  operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
                },
              },
            );
          },
          reason: JOB_INVITATION_INVALIDATION_REASON.COMPANY_NOT_OPERATIONAL,
        },
        {
          label: "sender locked",
          email: "invalid.sender",
          mutate: async (context) => {
            await User.updateOne(
              { _id: context.recruiter.user._id },
              { $set: { status: USER_STATUS.LOCKED } },
            );
          },
          reason: JOB_INVITATION_INVALIDATION_REASON.SENDER_NOT_ACTIVE,
        },
        {
          label: "sender membership locked",
          email: "invalid.membership",
          mutate: async (context) => {
            await CompanyMember.updateOne(
              { _id: context.recruiter.membership._id },
              { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
            );
          },
          reason:
            JOB_INVITATION_INVALIDATION_REASON.SENDER_COMPANY_MEMBERSHIP_INVALID,
        },
        {
          label: "sender removed from job team",
          email: "invalid.team",
          supportingEmail: "invalid.team.support@example.com",
          mutate: async (context) => {
            await Job.updateOne(
              { _id: context.job._id },
              {
                $set: {
                  primaryRecruiterCompanyMemberId: context.supporting.membership._id,
                  supportingRecruiterCompanyMemberIds: [],
                },
              },
            );
          },
          reason:
            JOB_INVITATION_INVALIDATION_REASON.SENDER_REMOVED_FROM_JOB_TEAM,
        },
      ];

      for (const testCase of cases) {
        const context = await seedSendableContext({
          candidateEmail: `${testCase.email}@example.com`,
          recruiterEmail: `${testCase.email}.recruiter@example.com`,
          managerEmail: `${testCase.email}.manager@example.com`,
          supportingEmail: testCase.supportingEmail,
        });
        const sent = await sendPendingInvitation(context);
        await testCase.mutate(context);

        const detail = await getOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
        });
        expect(detail.invitation.status, testCase.label).toBe(
          JOB_INVITATION_STATUS.INVALIDATED,
        );
        expect(detail.invitation.canAccept, testCase.label).toBe(false);
        expect(detail.invitation.invalidationReason, testCase.label).toBe(
          testCase.reason,
        );
        expect((await readPersistedInvitation(sent.id)).status, testCase.label).toBe(
          JOB_INVITATION_STATUS.PENDING,
        );
        expect(
          (await readPersistedInvitation(sent.id)).invalidationReason,
          testCase.label,
        ).toBeNull();
      }
    });

    it("does not invalidate when CV becomes PRIVATE, Generated loses ACTIVE, or the live CV is edited", async () => {
      const context = await seedSendableContext({
        candidateEmail: "keep.pending@example.com",
        recruiterEmail: "keep.pending.recruiter@example.com",
        managerEmail: "keep.pending.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

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

      const detail = await getOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: sent.id.toString(),
      });
      expect(detail.invitation.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(detail.invitation.canAccept).toBe(true);
      expect(detail.invitation.invitedCvSnapshot.name).toBe("Public Generated CV");
      expect(detail.invitation.invitedCvSnapshot.generatedContent.professionalSummary).toBe(
        "Backend engineer summary",
      );
      expect((await readPersistedInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );
    });

    it("uses earlier effective business cause time, not evaluator now, when EXPIRED and INVALIDATED both apply", async () => {
      const archiveFirst = await seedSendableContext({
        candidateEmail: "prec.archive@example.com",
        recruiterEmail: "prec.archive.recruiter@example.com",
        managerEmail: "prec.archive.manager@example.com",
      });
      const archiveInvitation = await sendPendingInvitation(archiveFirst);
      const archiveAt = new Date("2026-04-01T00:00:00.000Z");
      const laterCutoff = new Date("2026-04-10T00:00:00.000Z");
      await CandidateCV.updateOne(
        { _id: archiveFirst.candidateCv._id },
        { $set: { archivedAt: archiveAt } },
        { timestamps: false },
      );
      await JobInvitation.updateOne(
        { _id: archiveInvitation.id },
        { $set: { expiresAt: laterCutoff } },
        { timestamps: false },
      );
      const archivedDoc = await JobInvitation.findById(archiveInvitation.id);
      const archivedCv = await CandidateCV.findById(archiveFirst.candidateCv._id);
      const archivedJob = await Job.findById(archiveFirst.job._id);
      const archivedCompany = await Company.findById(archiveFirst.manager.company._id);
      const archivedMembership = await CompanyMember.findById(
        archiveFirst.recruiter.membership._id,
      );
      const evaluationArchiveFirst = evaluateJobInvitationCurrentState({
        invitation: archivedDoc,
        job: archivedJob,
        company: archivedCompany,
        candidateUser: archiveFirst.candidate,
        invitedCv: archivedCv,
        senderMembership: archivedMembership,
        senderUser: archiveFirst.recruiter.user,
        now: new Date("2026-04-20T00:00:00.000Z"),
      });
      expect(evaluationArchiveFirst.currentStatus).toBe(
        JOB_INVITATION_STATUS.INVALIDATED,
      );
      expect(evaluationArchiveFirst.winningCause.reason).toBe(
        JOB_INVITATION_INVALIDATION_REASON.INVITED_CV_ARCHIVED,
      );
      expect(evaluationArchiveFirst.winningCause.causeAt.getTime()).toBe(
        archiveAt.getTime(),
      );

      const expireFirst = await seedSendableContext({
        candidateEmail: "prec.expire@example.com",
        recruiterEmail: "prec.expire.recruiter@example.com",
        managerEmail: "prec.expire.manager@example.com",
      });
      const expireInvitation = await sendPendingInvitation(expireFirst);
      const earlierCutoff = new Date("2026-04-01T00:00:00.000Z");
      const laterArchive = new Date("2026-04-10T00:00:00.000Z");
      await JobInvitation.updateOne(
        { _id: expireInvitation.id },
        { $set: { expiresAt: earlierCutoff } },
        { timestamps: false },
      );
      await CandidateCV.updateOne(
        { _id: expireFirst.candidateCv._id },
        { $set: { archivedAt: laterArchive } },
        { timestamps: false },
      );
      const expiredDoc = await JobInvitation.findById(expireInvitation.id);
      const expiredCv = await CandidateCV.findById(expireFirst.candidateCv._id);
      const expiredJob = await Job.findById(expireFirst.job._id);
      const expiredCompany = await Company.findById(expireFirst.manager.company._id);
      const expiredMembership = await CompanyMember.findById(
        expireFirst.recruiter.membership._id,
      );
      const evaluationExpireFirst = evaluateJobInvitationCurrentState({
        invitation: expiredDoc,
        job: expiredJob,
        company: expiredCompany,
        candidateUser: expireFirst.candidate,
        invitedCv: expiredCv,
        senderMembership: expiredMembership,
        senderUser: expireFirst.recruiter.user,
        now: new Date("2026-04-20T00:00:00.000Z"),
      });
      expect(evaluationExpireFirst.currentStatus).toBe(
        JOB_INVITATION_STATUS.EXPIRED,
      );
      expect(evaluationExpireFirst.winningCause.source).toBe(
        EXPIRATION_CAUSE_SOURCE.INVITATION_CUTOFF,
      );
      expect(evaluationExpireFirst.winningCause.causeAt.getTime()).toBe(
        earlierCutoff.getTime(),
      );
    });
  });

  describe("BR-53 / BR-58 / BR-59 Notification is not Invitation authority", () => {
    it("does not treat JOB_INVITATION_RECEIVED as proof that a PENDING Invitation is still actionable", async () => {
      const context = await seedSendableContext({
        candidateEmail: "notify.read@example.com",
        recruiterEmail: "notify.recruiter@example.com",
        managerEmail: "notify.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      const received = await NotificationEvent.findOne({
        type: NOTIFICATION_TYPE.JOB_INVITATION_RECEIVED,
        jobInvitationId: sent.id,
      });
      expect(received).toBeTruthy();

      await JobInvitation.updateOne(
        { _id: sent.id },
        { $set: { expiresAt: new Date("2026-01-01T00:00:00.000Z") } },
        { timestamps: false },
      );

      const detail = await getOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: sent.id.toString(),
        now: new Date("2026-01-20T00:00:00.000Z"),
      });
      expect(detail.invitation.status).toBe(JOB_INVITATION_STATUS.EXPIRED);
      expect(detail.invitation.canAccept).toBe(false);
      expect(received.type).toBe(NOTIFICATION_TYPE.JOB_INVITATION_RECEIVED);
      expect((await readPersistedInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );
    });
  });

  describe("HTTP", () => {
    it("exposes Candidate GET list/detail and denies foreign, Recruiter, and anonymous access", async () => {
      const context = await seedSendableContext({
        candidateEmail: "http.read@example.com",
        recruiterEmail: "http.read.recruiter@example.com",
        managerEmail: "http.read.manager@example.com",
      });
      const foreign = await seedSendableContext({
        candidateEmail: "http.foreign@example.com",
        recruiterEmail: "http.foreign.recruiter@example.com",
        managerEmail: "http.foreign.manager@example.com",
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

      const listResponse = await agent
        .get("/api/candidate/invitations")
        .set("Authorization", `Bearer ${candidateToken}`);
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.invitations).toHaveLength(1);
      expect(listResponse.body.invitations[0].id).toBe(
        ownInvitation.id.toString(),
      );

      const detailResponse = await agent
        .get(`/api/candidate/invitations/${ownInvitation.id}`)
        .set("Authorization", `Bearer ${candidateToken}`);
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.invitation.status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );

      expect(
        (
          await agent.get(
            `/api/candidate/invitations/${foreignInvitation.id}`,
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await agent
            .get(`/api/candidate/invitations/${foreignInvitation.id}`)
            .set("Authorization", `Bearer ${candidateToken}`)
        ).status,
      ).toBe(404);
      expect(
        (
          await agent
            .get("/api/candidate/invitations")
            .set("Authorization", `Bearer ${recruiterToken}`)
        ).status,
      ).toBe(403);
    });
  });
});
