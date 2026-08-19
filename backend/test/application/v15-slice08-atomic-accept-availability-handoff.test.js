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
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import CV_LANGUAGE_PROFICIENCY from "../../src/constants/cv-language-proficiency.js";
import JOB_INVITATION_INVALIDATION_REASON from "../../src/constants/job-invitation-invalidation-reason.js";
import JOB_INVITATION_STATUS from "../../src/constants/job-invitation-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import Application from "../../src/models/application.model.js";
import CandidateAvailability from "../../src/models/candidate-availability.model.js";
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
  acceptOwnJobInvitation,
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
  candidateEmail = "invitee.accept@example.com",
  recruiterEmail = "recruiter.accept@example.com",
  managerEmail = "manager.accept@example.com",
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
      fullName: "Supporting Sender",
      jobTitle: "Supporting Recruiter",
    });
  }
  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: recruiter.membership._id,
    supportingIds: supporting ? [supporting.membership._id] : [],
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
  {
    greetingMessage = "Hello",
    recruiterUser = context.recruiter.user,
  } = {},
) => {
  mockInvitationSnapshotUpload();
  return sendJobInvitation({
    recruiterUser,
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

const readInvitationSourceApplication = async (invitationId) => {
  return Application.findOne({ sourceInvitationId: invitationId }).lean();
};

const findAcceptEvents = async (invitationId) => {
  return NotificationEvent.find({
    jobInvitationId: invitationId,
    type: {
      $in: [
        NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED,
        NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED,
      ],
    },
  }).lean();
};

const expectNoPartialAcceptState = async (invitationId) => {
  expect(await Application.countDocuments({ sourceInvitationId: invitationId })).toBe(
    0,
  );
  expect(await Conversation.countDocuments({})).toBe(0);
  expect(await CandidateAvailability.countDocuments({})).toBe(0);
  expect(await findAcceptEvents(invitationId)).toHaveLength(0);
  expect(
    await NotificationEvent.countDocuments({
      type: NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED,
    }),
  ).toBe(0);
};

describe("V15 Slice 08 — Atomic Accept + Availability Handoff", () => {
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

  describe("F04 / BR-26 ownership and successful Accept TX-02", () => {
    it("lets the owner Accept an actionable PENDING Invitation and persists the complete Application outcome atomically", async () => {
      const context = await seedSendableContext({
        candidateEmail: "owner.accept@example.com",
        recruiterEmail: "owner.accept.recruiter@example.com",
        managerEmail: "owner.accept.manager@example.com",
      });
      const sent = await sendPendingInvitation(context, {
        greetingMessage: "Join us",
      });
      const before = await readPersistedInvitation(sent.id);
      const acceptedAt = new Date("2026-08-19T05:00:00.000Z");

      const result = await acceptOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: sent.id.toString(),
        now: acceptedAt,
      });

      expect(result.invitation.status).toBe(JOB_INVITATION_STATUS.ACCEPTED);
      expect(result.invitation.canAccept).toBe(false);
      expect(result.invitation.canReject).toBe(false);
      expect(new Date(result.invitation.acceptedAt).getTime()).toBe(
        acceptedAt.getTime(),
      );
      expect(result.invitation.greetingMessage).toBe("Join us");

      const persistedInvitation = await readPersistedInvitation(sent.id);
      expect(persistedInvitation.status).toBe(JOB_INVITATION_STATUS.ACCEPTED);
      expect(persistedInvitation.acceptedAt.getTime()).toBe(acceptedAt.getTime());
      expect(persistedInvitation.rejectedAt).toBeNull();
      expect(persistedInvitation.sentByRecruiterCompanyMemberId.toString()).toBe(
        before.sentByRecruiterCompanyMemberId.toString(),
      );

      const application = await readInvitationSourceApplication(sent.id);
      expect(application).toBeTruthy();
      expect(application._id.toString()).toBe(result.applicationId.toString());
      expect(application.source).toBe(APPLICATION_SOURCE.RECRUITER_INVITATION);
      expect(application.status).toBe(APPLICATION_STATUS.CONTACTED);
      expect(application.candidateUserId.toString()).toBe(
        context.candidate._id.toString(),
      );
      expect(application.jobId.toString()).toBe(context.job._id.toString());
      expect(application.sourceInvitationId.toString()).toBe(sent.id.toString());
      expect(application.assignedRecruiterCompanyMemberId.toString()).toBe(
        context.recruiter.membership._id.toString(),
      );
      expect(application.appliedAt).toBeNull();
      expect(application.withdrawnAt).toBeNull();
      expect(application.withdrawReason).toBeNull();
      expect(application.version).toBe(0);
      expect(application.submittedCvSnapshot.name).toBe(
        before.invitedCvSnapshot.name,
      );
      expect(application.submittedCvSnapshot.capturedAt.getTime()).toBe(
        before.invitedCvSnapshot.capturedAt.getTime(),
      );
      expect(application.submittedCvSnapshot.pdfFile.storageKey).toBe(
        before.invitedCvSnapshot.pdfFile.storageKey,
      );
      expect(application.submittedCvSnapshot.generatedContent.professionalSummary).toBe(
        before.invitedCvSnapshot.generatedContent.professionalSummary,
      );

      const conversation = await Conversation.findOne({
        applicationId: application._id,
      }).lean();
      expect(conversation).toBeTruthy();
      expect(await Conversation.countDocuments({})).toBe(1);
      expect(await Application.countDocuments({})).toBe(1);
      expect(await CandidateAvailability.countDocuments({})).toBe(0);
      expect(await Message.countDocuments({})).toBe(0);

      const invitationEvents = await findAcceptEvents(sent.id);
      expect(invitationEvents).toHaveLength(2);
      const acceptedEvent = invitationEvents.find(
        (event) => event.type === NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED,
      );
      const createdEvent = invitationEvents.find(
        (event) => event.type === NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED,
      );
      expect(acceptedEvent.eventKey).toBe(
        `job-invitation-accepted:${sent.id.toString()}`,
      );
      expect(acceptedEvent.applicationId ?? null).toBeNull();
      expect(acceptedEvent.actorUserId.toString()).toBe(
        context.candidate._id.toString(),
      );
      expect(acceptedEvent.recipients).toHaveLength(1);
      expect(acceptedEvent.recipients[0].recipientUserId.toString()).toBe(
        context.recruiter.user._id.toString(),
      );
      expect(createdEvent.applicationId.toString()).toBe(
        application._id.toString(),
      );
      expect(createdEvent.jobInvitationId.toString()).toBe(sent.id.toString());
      expect(createdEvent.recipients[0].recipientUserId.toString()).toBe(
        context.recruiter.user._id.toString(),
      );

      const availabilityEvents = await NotificationEvent.find({
        type: NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED,
        applicationId: application._id,
      }).lean();
      expect(availabilityEvents).toHaveLength(1);
      expect(availabilityEvents[0].jobInvitationId ?? null).toBeNull();
      expect(availabilityEvents[0].recipients[0].recipientUserId.toString()).toBe(
        context.candidate._id.toString(),
      );

      expect(
        await NotificationEvent.countDocuments({
          type: {
            $in: [
              NOTIFICATION_TYPE.APPLICATION_ASSIGNED,
              NOTIFICATION_TYPE.APPLICATION_STATUS_CHANGED,
            ],
          },
        }),
      ).toBe(0);
      expect(
        await Notification.countDocuments({
          type: NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED,
          recipientUserId: context.candidate._id,
        }),
      ).toBe(0);
      expect(
        await Notification.countDocuments({
          type: NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED,
          recipientUserId: context.recruiter.user._id,
        }),
      ).toBe(1);
      expect(
        await Notification.countDocuments({
          type: NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED,
          recipientUserId: context.recruiter.user._id,
        }),
      ).toBe(1);
      expect(
        await Notification.countDocuments({
          type: NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED,
          recipientUserId: context.candidate._id,
        }),
      ).toBe(1);
    });

    it("does not authorize Accept from another Candidate who knows the Invitation id", async () => {
      const owner = await seedSendableContext({
        candidateEmail: "owner.auth.accept@example.com",
        recruiterEmail: "owner.auth.accept.recruiter@example.com",
        managerEmail: "owner.auth.accept.manager@example.com",
      });
      const foreign = await seedSendableContext({
        candidateEmail: "foreign.auth.accept@example.com",
        recruiterEmail: "foreign.auth.accept.recruiter@example.com",
        managerEmail: "foreign.auth.accept.manager@example.com",
      });
      const ownInvitation = await sendPendingInvitation(owner);

      await expect(
        acceptOwnJobInvitation({
          candidateUser: foreign.candidate,
          invitationId: ownInvitation.id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect((await readPersistedInvitation(ownInvitation.id)).status).toBe(
        JOB_INVITATION_STATUS.PENDING,
      );
      await expectNoPartialAcceptState(ownInvitation.id);
    });

    it("assigns a Supporting sender as the initial Application Assignee", async () => {
      const context = await seedSendableContext({
        candidateEmail: "supporting.accept@example.com",
        recruiterEmail: "supporting.accept.primary@example.com",
        managerEmail: "supporting.accept.manager@example.com",
        supportingEmail: "supporting.accept.sender@example.com",
      });
      const sent = await sendPendingInvitation(context, {
        recruiterUser: context.supporting.user,
      });

      await acceptOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: sent.id.toString(),
      });

      const application = await readInvitationSourceApplication(sent.id);
      expect(application.assignedRecruiterCompanyMemberId.toString()).toBe(
        context.supporting.membership._id.toString(),
      );
      expect(
        (await readPersistedInvitation(sent.id)).sentByRecruiterCompanyMemberId.toString(),
      ).toBe(context.supporting.membership._id.toString());
    });
  });

  describe("BR-41 snapshot lock and BR-34 current-state re-check", () => {
    it("copies the invited snapshot instead of recapturing the live CandidateCV", async () => {
      const context = await seedSendableContext({
        candidateEmail: "snapshot.accept@example.com",
        recruiterEmail: "snapshot.accept.recruiter@example.com",
        managerEmail: "snapshot.accept.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      const invited = (await readPersistedInvitation(sent.id)).invitedCvSnapshot;

      await CandidateCV.updateOne(
        { _id: context.candidateCv._id },
        {
          $set: {
            name: "Edited After Send",
            "generatedContent.professionalSummary": "Changed after Send",
          },
        },
      );

      await acceptOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: sent.id.toString(),
      });

      const application = await readInvitationSourceApplication(sent.id);
      expect(application.submittedCvSnapshot.name).toBe(invited.name);
      expect(application.submittedCvSnapshot.name).not.toBe("Edited After Send");
      expect(
        application.submittedCvSnapshot.generatedContent.professionalSummary,
      ).toBe(invited.generatedContent.professionalSummary);
      expect(
        application.submittedCvSnapshot.generatedContent.professionalSummary,
      ).not.toBe("Changed after Send");
    });

    it("does not let Accept win when an expiration cause already has earlier effective time", async () => {
      const context = await seedSendableContext({
        candidateEmail: "expire.accept@example.com",
        recruiterEmail: "expire.accept.recruiter@example.com",
        managerEmail: "expire.accept.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      await JobInvitation.updateOne(
        { _id: sent.id },
        { $set: { expiresAt: new Date("2026-01-01T00:00:00.000Z") } },
        { timestamps: false },
      );

      await expect(
        acceptOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
          now: new Date("2026-01-16T00:00:00.000Z"),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await readPersistedInvitation(sent.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(persisted.acceptedAt).toBeNull();
      await expectNoPartialAcceptState(sent.id);
    });

    it("does not let Accept win when an invalidation cause already has earlier effective time", async () => {
      const context = await seedSendableContext({
        candidateEmail: "invalidate.accept@example.com",
        recruiterEmail: "invalidate.accept.recruiter@example.com",
        managerEmail: "invalidate.accept.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      await CandidateCV.updateOne(
        { _id: context.candidateCv._id },
        { $set: { archivedAt: new Date("2026-08-18T10:00:00.000Z") } },
      );

      await expect(
        acceptOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
          now: new Date("2026-08-19T05:00:00.000Z"),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await readPersistedInvitation(sent.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(persisted.acceptedAt).toBeNull();
      await expectNoPartialAcceptState(sent.id);
    });

    it("keeps persisted terminal states terminal and does not create ACCEPTED or Application", async () => {
      const statuses = [
        JOB_INVITATION_STATUS.ACCEPTED,
        JOB_INVITATION_STATUS.REJECTED,
        JOB_INVITATION_STATUS.REVOKED,
        JOB_INVITATION_STATUS.EXPIRED,
        JOB_INVITATION_STATUS.INVALIDATED,
      ];

      for (const status of statuses) {
        const context = await seedSendableContext({
          candidateEmail: `terminal.accept.${status.toLowerCase()}@example.com`,
          recruiterEmail: `terminal.accept.${status.toLowerCase()}.recruiter@example.com`,
          managerEmail: `terminal.accept.${status.toLowerCase()}.manager@example.com`,
        });
        const sent = await sendPendingInvitation(context);
        await persistTerminalStatus(sent.id, status);
        const before = await readPersistedInvitation(sent.id);

        await expect(
          acceptOwnJobInvitation({
            candidateUser: context.candidate,
            invitationId: sent.id.toString(),
          }),
        ).rejects.toMatchObject({ statusCode: 409 });

        const after = await readPersistedInvitation(sent.id);
        expect(after.status).toBe(status);
        if (status !== JOB_INVITATION_STATUS.ACCEPTED) {
          expect(after.acceptedAt).toBeNull();
          expect(
            await Application.countDocuments({ sourceInvitationId: sent.id }),
          ).toBe(0);
        } else {
          expect(after.acceptedAt.getTime()).toBe(before.acceptedAt.getTime());
        }
        expect(await findAcceptEvents(sent.id)).toHaveLength(0);
      }
    });
  });

  describe("F09 serialization / BR-22 uniqueness and BR-56 durability", () => {
    it("blocks Direct Apply after successful Accept because the Application already exists", async () => {
      mockInvitationSnapshotUpload();
      const context = await seedSendableContext({
        candidateEmail: "unique.accept@example.com",
        recruiterEmail: "unique.accept.recruiter@example.com",
        managerEmail: "unique.accept.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      await acceptOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: sent.id.toString(),
      });

      await expect(
        directApplyToJob({
          candidateUserId: context.candidate._id,
          actorUser: context.candidate,
          jobId: context.job._id.toString(),
          candidateCvId: context.candidateCv._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(await Application.countDocuments({})).toBe(1);
      expect((await readPersistedInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.ACCEPTED,
      );
    });

    it("keeps ACCEPTED Application Conversation and durable events when inbox materialization fails after commit", async () => {
      const context = await seedSendableContext({
        candidateEmail: "durable.accept@example.com",
        recruiterEmail: "durable.accept.recruiter@example.com",
        managerEmail: "durable.accept.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      vi.spyOn(notificationService, "materializeNotificationEvent").mockRejectedValue(
        new Error("inbox unavailable"),
      );

      const result = await acceptOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: sent.id.toString(),
      });

      expect(result.invitation.status).toBe(JOB_INVITATION_STATUS.ACCEPTED);
      expect((await readPersistedInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.ACCEPTED,
      );
      expect(await readInvitationSourceApplication(sent.id)).toBeTruthy();
      expect(
        await Conversation.countDocuments({ applicationId: result.applicationId }),
      ).toBe(1);
      const events = await NotificationEvent.find({
        type: {
          $in: [
            NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED,
            NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED,
            NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED,
          ],
        },
      }).lean();
      expect(events).toHaveLength(3);
      expect(events.every((event) => event.materializedAt == null)).toBe(true);
    });
  });

  describe("concurrency", () => {
    it("allows only one concurrent Accept to persist ACCEPTED Application Conversation and the durable events", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.accept@example.com",
        recruiterEmail: "race.accept.recruiter@example.com",
        managerEmail: "race.accept.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      const outcomes = await Promise.allSettled([
        acceptOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
        }),
        acceptOwnJobInvitation({
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
        JOB_INVITATION_STATUS.ACCEPTED,
      );
      expect(await Application.countDocuments({})).toBe(1);
      expect(await Conversation.countDocuments({})).toBe(1);
      expect(await findAcceptEvents(sent.id)).toHaveLength(2);
      expect(
        await NotificationEvent.countDocuments({
          type: NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED,
        }),
      ).toBe(1);
    });

    it("does not let concurrent Direct Apply create a competing Application while Accept is winning", async () => {
      mockInvitationSnapshotUpload();
      const context = await seedSendableContext({
        candidateEmail: "race.apply.accept@example.com",
        recruiterEmail: "race.apply.accept.recruiter@example.com",
        managerEmail: "race.apply.accept.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      const outcomes = await Promise.allSettled([
        acceptOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
        }),
        directApplyToJob({
          candidateUserId: context.candidate._id,
          actorUser: context.candidate,
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
        JOB_INVITATION_STATUS.ACCEPTED,
      );
      expect(await Application.countDocuments({})).toBe(1);
      expect(
        (await Application.findOne({}).lean()).source,
      ).toBe(APPLICATION_SOURCE.RECRUITER_INVITATION);
    });
  });

  describe("HTTP", () => {
    it("exposes Candidate POST accept and denies unauthenticated Recruiter and foreign Candidate", async () => {
      const context = await seedSendableContext({
        candidateEmail: "http.accept@example.com",
        recruiterEmail: "http.accept.recruiter@example.com",
        managerEmail: "http.accept.manager@example.com",
      });
      const foreign = await seedSendableContext({
        candidateEmail: "http.foreign.accept@example.com",
        recruiterEmail: "http.foreign.accept.recruiter@example.com",
        managerEmail: "http.foreign.accept.manager@example.com",
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
        .post(`/api/candidate/invitations/${ownInvitation.id}/accept`)
        .set("Authorization", `Bearer ${candidateToken}`);

      expect(response.status).toBe(200);
      expect(response.body.invitation.status).toBe(JOB_INVITATION_STATUS.ACCEPTED);
      expect(response.body.invitation.canAccept).toBe(false);
      expect(response.body).not.toHaveProperty("application");
      expect(await readInvitationSourceApplication(ownInvitation.id)).toBeTruthy();

      expect(
        (
          await agent.post(
            `/api/candidate/invitations/${foreignInvitation.id}/accept`,
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await agent
            .post(`/api/candidate/invitations/${foreignInvitation.id}/accept`)
            .set("Authorization", `Bearer ${candidateToken}`)
        ).status,
      ).toBe(404);
      expect(
        (
          await agent
            .post(`/api/candidate/invitations/${ownInvitation.id}/accept`)
            .set("Authorization", `Bearer ${recruiterToken}`)
        ).status,
      ).toBe(403);
    });
  });
});
