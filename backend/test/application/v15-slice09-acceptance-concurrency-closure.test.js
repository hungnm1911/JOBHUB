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
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import CV_LANGUAGE_PROFICIENCY from "../../src/constants/cv-language-proficiency.js";
import JOB_INVITATION_INVALIDATION_REASON from "../../src/constants/job-invitation-invalidation-reason.js";
import JOB_INVITATION_STATUS from "../../src/constants/job-invitation-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import CandidateAvailability from "../../src/models/candidate-availability.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Company from "../../src/models/company.model.js";
import Category from "../../src/models/category.model.js";
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import JobInvitation, {
  IMMUTABLE_JOB_INVITATION_IDENTITY_FIELDS,
} from "../../src/models/job-invitation.model.js";
import Notification from "../../src/models/notification.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import User from "../../src/models/user.model.js";
import {
  createFirstInterviewProposal,
  directApplyToJob,
  getCandidateApplicationConversation,
  getCandidateMyApplication,
  getRecruiterApplicationConversation,
  reassignApplication,
  replaceSubmittedCv,
  sendCandidateApplicationConversationNormalMessage,
  submitCandidateAvailabilityFirstTime,
  unassignApplication,
  withdrawApplication,
} from "../../src/services/application.service.js";
import {
  archiveOwnCandidateCv,
  listCandidateSearchEligibleCandidateCvs,
  saveOwnGeneratedContent,
  updateOwnCandidateCvMetadata,
} from "../../src/services/candidate-cv.service.js";
import * as fileService from "../../src/services/file.service.js";
import { closePublishedJob, removeSupportingRecruiter } from "../../src/services/job.service.js";
import {
  acceptOwnJobInvitation,
  materializeJobInvitationIfDue,
  rejectOwnJobInvitation,
  revokePrimaryJobInvitation,
  sendJobInvitation,
} from "../../src/services/job-invitation.service.js";
import * as notificationService from "../../src/services/notification.service.js";
import {
  lockAccount,
  lockCompany,
} from "../../src/services/platform-admin.service.js";
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
const SENT_AT = new Date("2026-08-01T03:00:00.000Z");
const BEFORE_CUTOFF = new Date("2026-08-10T03:00:00.000Z");
const AFTER_CUTOFF = new Date("2026-08-20T03:00:00.000Z");

const completeGeneratedContent = (
  fullName = "Jane Candidate",
  professionalSummary = "Backend engineer summary",
) => ({
  personalInfo: {
    fullName,
    email: "jane@example.com",
    phone: "+84901234567",
    displayLocation: "Ha Noi",
    links: ["https://example.com"],
    avatarUrl: null,
  },
  professionalSummary,
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
  certifications: [{ name: "AWS Certified", issuer: "Amazon" }],
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

const createUploadedCv = async ({
  candidateUserId,
  categoryId,
  name = "Public Uploaded CV",
  visibility = CANDIDATE_CV_VISIBILITY.PUBLIC,
  archivedAt = null,
} = {}) => {
  return CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    visibility,
    categoryId,
    experienceLevelId: null,
    preferredLocations: [],
    skillTags: [],
    employmentTypes: [],
    workModes: [],
    isDefault: false,
    archivedAt,
    uploadedFile: {
      storageKey: "jobhub/candidate-cvs/uploaded/v15-s09-source.pdf",
      originalFileName: "resume.pdf",
      mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
      sizeBytes: 2048,
      pageCount: 2,
      uploadedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
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

const mockUploadedSnapshotCapture = () => {
  vi.spyOn(fileService, "downloadFileBuffer").mockResolvedValue(
    Buffer.from("%PDF-1.4 uploaded-cv"),
  );
  mockInvitationSnapshotUpload();
};

const incompleteGeneratedContent = () => ({
  personalInfo: {
    fullName: "Jane Candidate",
    email: null,
    phone: null,
  },
  professionalSummary: null,
  educations: [],
  skills: [],
  workExperiences: [],
  projects: [],
  certifications: [],
  languages: [],
});

const invitationSnapshotUploadResult = {
  assetId: "asset-invitation",
  publicId: "jobhub/job-invitations/invited-cv-snapshots/invited-snapshot.pdf",
  resourceType: "raw",
  deliveryType: "authenticated",
  format: "pdf",
  bytes: 2048,
  width: null,
  height: null,
  secureUrl: "https://example.invalid/invited-snapshot.pdf",
  version: 1,
  assetFolder: "jobhub/job-invitations/invited-cv-snapshots",
};

const mutateGeneratedContent = async (context) => {
  await saveOwnGeneratedContent({
    candidateUserId: context.candidate._id,
    actorUser: context.candidate,
    candidateCvId: context.candidateCv._id.toString(),
    generatedContent: completeGeneratedContent(
      "Jane Candidate",
      "Mutated live summary after capture",
    ),
  });
};

const mutateVisibilityPrivate = async (context) => {
  await updateOwnCandidateCvMetadata({
    candidateUserId: context.candidate._id,
    actorUser: context.candidate,
    candidateCvId: context.candidateCv._id.toString(),
    patch: { visibility: CANDIDATE_CV_VISIBILITY.PRIVATE },
  });
};

const mutateGeneratedActiveToDraft = async (context) => {
  await saveOwnGeneratedContent({
    candidateUserId: context.candidate._id,
    actorUser: context.candidate,
    candidateCvId: context.candidateCv._id.toString(),
    generatedContent: incompleteGeneratedContent(),
  });
};

const mutateArchive = async (context) => {
  await archiveOwnCandidateCv({
    candidateUserId: context.candidate._id,
    actorUser: context.candidate,
    candidateCvId: context.candidateCv._id.toString(),
  });
};

const sendWithCaptureRaceMutation = async (context, mutate) => {
  vi.spyOn(fileService, "uploadFileBuffer").mockImplementation(async () => {
    await mutate(context);
    return invitationSnapshotUploadResult;
  });

  return sendJobInvitation({
    recruiterUser: context.recruiter.user,
    jobId: context.job._id.toString(),
    candidateCvId: context.candidateCv._id.toString(),
  });
};

const expectStaleSendRejected = async (context, mutate) => {
  try {
    await sendWithCaptureRaceMutation(context, mutate);
    throw new Error("expected stale Send to fail");
  } catch (error) {
    expect(error.message).not.toBe("expected stale Send to fail");
    expect([404, 409]).toContain(error.statusCode);
  }

  expect(
    await JobInvitation.countDocuments({
      candidateUserId: context.candidate._id,
      jobId: context.job._id,
    }),
  ).toBe(0);
};

const seedSendableContext = async ({
  candidateEmail,
  recruiterEmail,
  managerEmail,
  supportingEmail = null,
  applicationDeadline = FUTURE_DEADLINE(),
  uploadedCv = false,
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
  const candidateCv = uploadedCv
    ? await createUploadedCv({
        candidateUserId: candidate._id,
        categoryId: category._id,
      })
    : await createGeneratedCv({
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
    candidateCvId = context.candidateCv._id,
    now = new Date(),
  } = {},
) => {
  if (context.candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
    mockUploadedSnapshotCapture();
  } else {
    mockInvitationSnapshotUpload();
  }

  return sendJobInvitation({
    recruiterUser,
    jobId: context.job._id.toString(),
    candidateCvId: candidateCvId.toString(),
    greetingMessage,
    now,
  });
};

const readInvitation = async (invitationId) => {
  return JobInvitation.findById(invitationId).lean();
};

const readInvitationSourceApplication = async (invitationId) => {
  return Application.findOne({ sourceInvitationId: invitationId }).lean();
};

const countEvents = async ({ invitationId, type }) => {
  return NotificationEvent.countDocuments({
    ...(invitationId ? { jobInvitationId: invitationId } : {}),
    type,
  });
};

const expectNoPartialAcceptState = async (invitationId) => {
  expect(
    await Application.countDocuments({ sourceInvitationId: invitationId }),
  ).toBe(0);
  expect(
    await countEvents({
      invitationId,
      type: NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED,
    }),
  ).toBe(0);
  expect(
    await countEvents({
      invitationId,
      type: NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED,
    }),
  ).toBe(0);
};

const isDummyUpdatedAtAcquire = (update) => {
  const assigned = update?.$set ?? {};
  return (
    Object.keys(assigned).length === 1 && assigned.updatedAt instanceof Date
  );
};

const createHoldBarrier = () => {
  let release;
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  return {
    hold,
    awaitReady: () => ready,
    release: () => release(),
    markReady: () => resolveReady(),
  };
};

const installTransactionalDummyAcquireBarrier = (Model) => {
  const originalFindOneAndUpdate = Model.findOneAndUpdate.bind(Model);
  const barrier = createHoldBarrier();
  let armed = true;

  vi.spyOn(Model, "findOneAndUpdate").mockImplementation(
    async (filter, update, options, callback) => {
      if (
        armed &&
        options?.session &&
        isDummyUpdatedAtAcquire(update)
      ) {
        armed = false;
        barrier.markReady();
        await barrier.hold;
      }

      return originalFindOneAndUpdate(filter, update, options, callback);
    },
  );

  return barrier;
};

const installArchiveWriteBarrier = () => {
  const originalFindOneAndUpdate = CandidateCV.findOneAndUpdate.bind(CandidateCV);
  const barrier = createHoldBarrier();
  let armed = true;

  vi.spyOn(CandidateCV, "findOneAndUpdate").mockImplementation(
    async (filter, update, options, callback) => {
      if (armed && update?.$set?.archivedAt != null) {
        armed = false;
        barrier.markReady();
        await barrier.hold;
      }

      return originalFindOneAndUpdate(filter, update, options, callback);
    },
  );

  return barrier;
};

const installCompanyLockSaveBarrier = () => {
  const originalSave = Company.prototype.save;
  const barrier = createHoldBarrier();
  let armed = true;

  vi.spyOn(Company.prototype, "save").mockImplementation(async function saveWithBarrier(
    ...args
  ) {
    if (
      armed &&
      this.operationalStatus === COMPANY_OPERATIONAL_STATUS.LOCKED
    ) {
      armed = false;
      barrier.markReady();
      await barrier.hold;
    }

    return originalSave.apply(this, args);
  });

  return barrier;
};

const installUserLockSaveBarrier = () => {
  const originalSave = User.prototype.save;
  const barrier = createHoldBarrier();
  let armed = true;

  vi.spyOn(User.prototype, "save").mockImplementation(async function saveWithBarrier(
    ...args
  ) {
    if (armed && this.status === USER_STATUS.LOCKED) {
      armed = false;
      barrier.markReady();
      await barrier.hold;
    }

    return originalSave.apply(this, args);
  });

  return barrier;
};

const installSupportingRemovalStartBarrier = () => {
  const originalFindById = Job.findById.bind(Job);
  const barrier = createHoldBarrier();
  let armed = true;

  vi.spyOn(Job, "findById").mockImplementation((id, ...rest) => {
    const query = originalFindById(id, ...rest);
    if (!armed) {
      return query;
    }

    const originalThen = query.then.bind(query);
    query.then = (onFulfilled, onRejected) => {
      const run = async () => {
        if (armed) {
          armed = false;
          barrier.markReady();
          await barrier.hold;
        }

        return originalThen();
      };

      return run().then(onFulfilled, onRejected);
    };

    return query;
  });

  return barrier;
};

const expectInvalidatedWithoutAccept = async ({
  invitationId,
  invalidationReason,
}) => {
  const persisted = await readInvitation(invitationId);
  expect(persisted.status).toBe(JOB_INVITATION_STATUS.INVALIDATED);
  expect(persisted.invalidationReason).toBe(invalidationReason);
  await expectNoPartialAcceptState(invitationId);
};

const expectAcceptedNotOverwritten = async (invitationId) => {
  const persisted = await readInvitation(invitationId);
  expect(persisted.status).toBe(JOB_INVITATION_STATUS.ACCEPTED);
  expect(persisted.invalidatedAt).toBeNull();
  expect(persisted.invalidationReason).toBeNull();
  expect(await readInvitationSourceApplication(invitationId)).toBeTruthy();
};

const runSourceWinsBeforeTerminalAction = async ({
  action,
  mutate,
  holdModel,
}) => {
  const barrier = installTransactionalDummyAcquireBarrier(holdModel);
  const actionPromise = action();
  await barrier.awaitReady();
  await mutate();
  barrier.release();

  try {
    await actionPromise;
    throw new Error("expected terminal action to fail after source mutation");
  } catch (error) {
    expect(error.message).not.toBe(
      "expected terminal action to fail after source mutation",
    );
    expect(error.statusCode).toBe(409);
  }
};

const runActionWinsBeforeSourceMutation = async ({
  action,
  mutate,
  holdSource,
}) => {
  const barrier = holdSource();
  const mutatePromise = mutate();
  await barrier.awaitReady();
  await action();
  barrier.release();
  await mutatePromise;
};

const settledStatus = (result) => {
  if (result.status === "fulfilled") {
    return "ok";
  }

  return result.reason?.statusCode ?? result.reason?.message;
};

describe("V15 Slice 09 — Acceptance + concurrency closure", () => {
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

  describe("Candidate-Job exclusion across the lifecycle", () => {
    it("does not let concurrent Accept and Send create Application plus a competing PENDING Invitation", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.accept.send@example.com",
        recruiterEmail: "race.accept.send.recruiter@example.com",
        managerEmail: "race.accept.send.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      const secondCv = await createGeneratedCv({
        candidateUserId: context.candidate._id,
        categoryId: context.category._id,
        name: "Second Public CV",
      });

      const outcomes = await Promise.allSettled([
        acceptOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
        }),
        sendJobInvitation({
          recruiterUser: context.recruiter.user,
          jobId: context.job._id.toString(),
          candidateCvId: secondCv._id.toString(),
        }),
      ]);

      expect(outcomes.some((result) => result.status === "fulfilled")).toBe(true);
      expect(outcomes.some((result) => settledStatus(result) === 409)).toBe(true);
      expect(await JobInvitation.countDocuments({})).toBe(1);
      expect(
        await JobInvitation.countDocuments({ status: JOB_INVITATION_STATUS.PENDING }),
      ).toBe(0);
      expect(await Application.countDocuments({})).toBe(1);
      expect((await Application.findOne({}).lean()).source).toBe(
        APPLICATION_SOURCE.RECRUITER_INVITATION,
      );
    });

    it("allows resend after EXPIRED REVOKED and INVALIDATED, permanently blocks REJECTED, and blocks Send after Accept Application", async () => {
      const expiredContext = await seedSendableContext({
        candidateEmail: "resend.expired@example.com",
        recruiterEmail: "resend.expired.recruiter@example.com",
        managerEmail: "resend.expired.manager@example.com",
      });
      const expiredSent = await sendPendingInvitation(expiredContext, {
        now: SENT_AT,
      });
      await materializeJobInvitationIfDue({
        invitation: await JobInvitation.findById(expiredSent.id),
        now: AFTER_CUTOFF,
      });
      expect((await readInvitation(expiredSent.id)).status).toBe(
        JOB_INVITATION_STATUS.EXPIRED,
      );
      const expiredResend = await sendPendingInvitation(expiredContext, {
        now: AFTER_CUTOFF,
      });
      expect(expiredResend.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(expiredResend.id.toString()).not.toBe(expiredSent.id.toString());

      const revokedContext = await seedSendableContext({
        candidateEmail: "resend.revoked@example.com",
        recruiterEmail: "resend.revoked.recruiter@example.com",
        managerEmail: "resend.revoked.manager@example.com",
      });
      const revokedSent = await sendPendingInvitation(revokedContext);
      await revokePrimaryJobInvitation({
        recruiterUser: revokedContext.recruiter.user,
        jobId: revokedContext.job._id.toString(),
        invitationId: revokedSent.id.toString(),
      });
      const revokedResend = await sendPendingInvitation(revokedContext);
      expect(revokedResend.status).toBe(JOB_INVITATION_STATUS.PENDING);

      const invalidatedContext = await seedSendableContext({
        candidateEmail: "resend.invalidated@example.com",
        recruiterEmail: "resend.invalidated.recruiter@example.com",
        managerEmail: "resend.invalidated.manager@example.com",
      });
      const invalidatedSent = await sendPendingInvitation(invalidatedContext);
      await archiveOwnCandidateCv({
        candidateUserId: invalidatedContext.candidate._id,
        actorUser: invalidatedContext.candidate,
        candidateCvId: invalidatedContext.candidateCv._id.toString(),
      });
      expect((await readInvitation(invalidatedSent.id)).status).toBe(
        JOB_INVITATION_STATUS.INVALIDATED,
      );
      const replacementCv = await createGeneratedCv({
        candidateUserId: invalidatedContext.candidate._id,
        categoryId: invalidatedContext.category._id,
        name: "Replacement Public CV",
      });
      const invalidatedResend = await sendPendingInvitation(invalidatedContext, {
        candidateCvId: replacementCv._id,
      });
      expect(invalidatedResend.status).toBe(JOB_INVITATION_STATUS.PENDING);

      const rejectedContext = await seedSendableContext({
        candidateEmail: "resend.rejected@example.com",
        recruiterEmail: "resend.rejected.recruiter@example.com",
        managerEmail: "resend.rejected.manager@example.com",
      });
      const rejectedSent = await sendPendingInvitation(rejectedContext);
      await rejectOwnJobInvitation({
        candidateUser: rejectedContext.candidate,
        invitationId: rejectedSent.id.toString(),
      });
      await expect(
        sendPendingInvitation(rejectedContext),
      ).rejects.toMatchObject({ statusCode: 409 });
      const directAfterReject = await directApplyToJob({
        candidateUserId: rejectedContext.candidate._id,
        actorUser: rejectedContext.candidate,
        jobId: rejectedContext.job._id.toString(),
        candidateCvId: rejectedContext.candidateCv._id.toString(),
      });
      expect(directAfterReject.source).toBe(
        APPLICATION_SOURCE.DIRECT_APPLICATION,
      );
      expect(directAfterReject.status).toBe(APPLICATION_STATUS.APPLIED);

      const acceptedContext = await seedSendableContext({
        candidateEmail: "resend.accepted@example.com",
        recruiterEmail: "resend.accepted.recruiter@example.com",
        managerEmail: "resend.accepted.manager@example.com",
      });
      const acceptedSent = await sendPendingInvitation(acceptedContext);
      await acceptOwnJobInvitation({
        candidateUser: acceptedContext.candidate,
        invitationId: acceptedSent.id.toString(),
      });
      await expect(
        sendPendingInvitation(acceptedContext),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe("Terminal-action concurrency and stale PENDING authority", () => {
    it("lets only one of concurrent Accept and Reject persist a terminal outcome without losing-action side effects", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.accept.reject@example.com",
        recruiterEmail: "race.accept.reject.recruiter@example.com",
        managerEmail: "race.accept.reject.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      const outcomes = await Promise.allSettled([
        acceptOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
        }),
        rejectOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
        }),
      ]);

      expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(
        1,
      );
      expect(outcomes.filter((result) => settledStatus(result) === 409)).toHaveLength(
        1,
      );

      const persisted = await readInvitation(sent.id);
      expect([
        JOB_INVITATION_STATUS.ACCEPTED,
        JOB_INVITATION_STATUS.REJECTED,
      ]).toContain(persisted.status);

      if (persisted.status === JOB_INVITATION_STATUS.ACCEPTED) {
        expect(await readInvitationSourceApplication(sent.id)).toBeTruthy();
        expect(
          await countEvents({
            invitationId: sent.id,
            type: NOTIFICATION_TYPE.JOB_INVITATION_REJECTED,
          }),
        ).toBe(0);
      } else {
        await expectNoPartialAcceptState(sent.id);
        expect(
          await countEvents({
            invitationId: sent.id,
            type: NOTIFICATION_TYPE.JOB_INVITATION_REJECTED,
          }),
        ).toBe(1);
      }
    });

    it("lets only one of concurrent Accept and Revoke persist a terminal outcome without losing-action side effects", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.accept.revoke@example.com",
        recruiterEmail: "race.accept.revoke.recruiter@example.com",
        managerEmail: "race.accept.revoke.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      const outcomes = await Promise.allSettled([
        acceptOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
        }),
        revokePrimaryJobInvitation({
          recruiterUser: context.recruiter.user,
          jobId: context.job._id.toString(),
          invitationId: sent.id.toString(),
        }),
      ]);

      expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(
        1,
      );
      const persisted = await readInvitation(sent.id);
      expect([
        JOB_INVITATION_STATUS.ACCEPTED,
        JOB_INVITATION_STATUS.REVOKED,
      ]).toContain(persisted.status);

      if (persisted.status === JOB_INVITATION_STATUS.ACCEPTED) {
        expect(await readInvitationSourceApplication(sent.id)).toBeTruthy();
        expect(
          await countEvents({
            invitationId: sent.id,
            type: NOTIFICATION_TYPE.JOB_INVITATION_REVOKED,
          }),
        ).toBe(0);
      } else {
        await expectNoPartialAcceptState(sent.id);
        expect(
          await countEvents({
            invitationId: sent.id,
            type: NOTIFICATION_TYPE.JOB_INVITATION_REVOKED,
          }),
        ).toBe(1);
      }
    });

    it("lets only one of concurrent Accept and delayed expiration persist, with no mixed Application + EXPIRED state", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.accept.expire@example.com",
        recruiterEmail: "race.accept.expire.recruiter@example.com",
        managerEmail: "race.accept.expire.manager@example.com",
      });
      const sent = await sendPendingInvitation(context, { now: SENT_AT });
      const invitation = await JobInvitation.findById(sent.id);

      const outcomes = await Promise.allSettled([
        acceptOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
          now: BEFORE_CUTOFF,
        }),
        materializeJobInvitationIfDue({
          invitation,
          now: AFTER_CUTOFF,
        }),
      ]);

      const persisted = await readInvitation(sent.id);
      expect([
        JOB_INVITATION_STATUS.ACCEPTED,
        JOB_INVITATION_STATUS.EXPIRED,
      ]).toContain(persisted.status);
      expect(outcomes.filter((result) => result.status === "fulfilled").length).toBeGreaterThan(
        0,
      );

      if (persisted.status === JOB_INVITATION_STATUS.ACCEPTED) {
        expect(await readInvitationSourceApplication(sent.id)).toBeTruthy();
        expect(await Conversation.countDocuments({})).toBe(1);
      } else {
        await expectNoPartialAcceptState(sent.id);
        expect(await Conversation.countDocuments({})).toBe(0);
      }

      expect(
        await NotificationEvent.countDocuments({
          type: "JOB_INVITATION_EXPIRED",
        }),
      ).toBe(0);
    });

    it("keeps a committed Accept winner when later expiration/invalidation materialization is delayed", async () => {
      const context = await seedSendableContext({
        candidateEmail: "delayed.accept.winner@example.com",
        recruiterEmail: "delayed.accept.winner.recruiter@example.com",
        managerEmail: "delayed.accept.winner.manager@example.com",
      });
      const sent = await sendPendingInvitation(context, { now: SENT_AT });
      await acceptOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: sent.id.toString(),
        now: BEFORE_CUTOFF,
      });

      await materializeJobInvitationIfDue({
        invitation: await JobInvitation.findById(sent.id),
        now: AFTER_CUTOFF,
      });
      await archiveOwnCandidateCv({
        candidateUserId: context.candidate._id,
        actorUser: context.candidate,
        candidateCvId: context.candidateCv._id.toString(),
      });
      await materializeJobInvitationIfDue({
        invitation: await JobInvitation.findById(sent.id),
        now: AFTER_CUTOFF,
      });

      const persisted = await readInvitation(sent.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.ACCEPTED);
      expect(persisted.invalidatedAt).toBeNull();
      expect(await readInvitationSourceApplication(sent.id)).toBeTruthy();
    });

    it("denies Accept and Revoke on stale PENDING after cutoff, then lets Direct Apply and a new Send proceed", async () => {
      const context = await seedSendableContext({
        candidateEmail: "stale.pending@example.com",
        recruiterEmail: "stale.pending.recruiter@example.com",
        managerEmail: "stale.pending.manager@example.com",
      });
      const sent = await sendPendingInvitation(context, { now: SENT_AT });

      await expect(
        acceptOwnJobInvitation({
          candidateUser: context.candidate,
          invitationId: sent.id.toString(),
          now: AFTER_CUTOFF,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        revokePrimaryJobInvitation({
          recruiterUser: context.recruiter.user,
          jobId: context.job._id.toString(),
          invitationId: sent.id.toString(),
          now: AFTER_CUTOFF,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expectNoPartialAcceptState(sent.id);

      const applied = await directApplyToJob({
        candidateUserId: context.candidate._id,
        actorUser: context.candidate,
        jobId: context.job._id.toString(),
        candidateCvId: context.candidateCv._id.toString(),
        now: AFTER_CUTOFF,
      });
      expect(applied.source).toBe(
        APPLICATION_SOURCE.DIRECT_APPLICATION,
      );
      expect((await readInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.EXPIRED,
      );

      const other = await seedSendableContext({
        candidateEmail: "stale.send@example.com",
        recruiterEmail: "stale.send.recruiter@example.com",
        managerEmail: "stale.send.manager@example.com",
      });
      const staleSend = await sendPendingInvitation(other, { now: SENT_AT });
      const replacement = await sendPendingInvitation(other, { now: AFTER_CUTOFF });
      expect((await readInvitation(staleSend.id)).status).toBe(
        JOB_INVITATION_STATUS.EXPIRED,
      );
      expect(replacement.status).toBe(JOB_INVITATION_STATUS.PENDING);
    });
  });

  describe("Cause precedence, CV snapshot, and downstream Application", () => {
    it("maps Job CLOSED to EXPIRED with no INVALIDATED notification and keeps delayed invalidatedAt as source-cause time", async () => {
      const closedContext = await seedSendableContext({
        candidateEmail: "cause.closed@example.com",
        recruiterEmail: "cause.closed.recruiter@example.com",
        managerEmail: "cause.closed.manager@example.com",
      });
      const closedSent = await sendPendingInvitation(closedContext);
      await closePublishedJob({
        actorUser: closedContext.recruiter.user,
        jobId: closedContext.job._id.toString(),
      });
      expect((await readInvitation(closedSent.id)).status).toBe(
        JOB_INVITATION_STATUS.EXPIRED,
      );
      expect(
        await countEvents({
          invitationId: closedSent.id,
          type: NOTIFICATION_TYPE.JOB_INVITATION_INVALIDATED,
        }),
      ).toBe(0);

      const archiveContext = await seedSendableContext({
        candidateEmail: "cause.archive@example.com",
        recruiterEmail: "cause.archive.recruiter@example.com",
        managerEmail: "cause.archive.manager@example.com",
      });
      const archiveSent = await sendPendingInvitation(archiveContext);
      const archivedAt = new Date("2026-08-19T01:00:00.000Z");
      await CandidateCV.updateOne(
        { _id: archiveContext.candidateCv._id },
        { $set: { archivedAt } },
      );
      const processingNow = new Date("2026-08-19T08:00:00.000Z");
      await materializeJobInvitationIfDue({
        invitation: await JobInvitation.findById(archiveSent.id),
        now: processingNow,
      });
      const invalidated = await readInvitation(archiveSent.id);
      expect(invalidated.status).toBe(JOB_INVITATION_STATUS.INVALIDATED);
      expect(invalidated.invalidationReason).toBe(
        JOB_INVITATION_INVALIDATION_REASON.INVITED_CV_ARCHIVED,
      );
      expect(new Date(invalidated.invalidatedAt).getTime()).toBe(archivedAt.getTime());
      expect(new Date(invalidated.invalidatedAt).getTime()).not.toBe(
        processingNow.getTime(),
      );
    });

    it("keeps V14 Generated and Uploaded Send eligibility and does not rewrite snapshots after live CV changes", async () => {
      const generatedContext = await seedSendableContext({
        candidateEmail: "snapshot.generated@example.com",
        recruiterEmail: "snapshot.generated.recruiter@example.com",
        managerEmail: "snapshot.generated.manager@example.com",
      });
      await expect(
        sendJobInvitation({
          recruiterUser: generatedContext.recruiter.user,
          jobId: generatedContext.job._id.toString(),
          candidateCvId: (
            await createGeneratedCv({
              candidateUserId: generatedContext.candidate._id,
              categoryId: generatedContext.category._id,
              name: "Draft Public",
              status: CANDIDATE_CV_STATUS.DRAFT,
            })
          )._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      const uploadedContext = await seedSendableContext({
        candidateEmail: "snapshot.uploaded@example.com",
        recruiterEmail: "snapshot.uploaded.recruiter@example.com",
        managerEmail: "snapshot.uploaded.manager@example.com",
        uploadedCv: true,
      });
      await expect(
        sendJobInvitation({
          recruiterUser: uploadedContext.recruiter.user,
          jobId: uploadedContext.job._id.toString(),
          candidateCvId: (
            await createUploadedCv({
              candidateUserId: uploadedContext.candidate._id,
              categoryId: uploadedContext.category._id,
              name: "Private Uploaded",
              visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
            })
          )._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      const sent = await sendPendingInvitation(uploadedContext, {
        greetingMessage: "Join from uploaded CV",
      });
      const invitedName = (await readInvitation(sent.id)).invitedCvSnapshot.name;
      expect(invitedName).toBe("Public Uploaded CV");

      uploadedContext.candidateCv.name = "Edited live uploaded CV";
      uploadedContext.candidateCv.skillTags = ["Changed"];
      await uploadedContext.candidateCv.save();

      await acceptOwnJobInvitation({
        candidateUser: uploadedContext.candidate,
        invitationId: sent.id.toString(),
      });

      const invitation = await readInvitation(sent.id);
      const application = await readInvitationSourceApplication(sent.id);
      expect(invitation.invitedCvSnapshot.name).toBe(invitedName);
      expect(application.submittedCvSnapshot.name).toBe(invitedName);
      expect(application.submittedCvSnapshot.sourceType).toBe(
        CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      );
      expect(application.submittedCvSnapshot.generatedContent).toBeUndefined();
      expect(
        application.submittedCvSnapshot.pdfFile.storageKey,
      ).not.toBe(uploadedContext.candidateCv.uploadedFile.storageKey);
    });

    it("hands Accept-created Application to canonical V10-V12 owners without historical-sender authority or Direct-Apply-only actions", async () => {
      const context = await seedSendableContext({
        candidateEmail: "downstream.accept@example.com",
        recruiterEmail: "downstream.accept.sender@example.com",
        managerEmail: "downstream.accept.manager@example.com",
        supportingEmail: "downstream.accept.supporting@example.com",
      });
      const sent = await sendPendingInvitation(context, {
        recruiterUser: context.supporting.user,
        greetingMessage: "Supporting sourced this Candidate",
      });
      const accepted = await acceptOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: sent.id.toString(),
      });
      const applicationId = accepted.applicationId.toString();

      expect(await Conversation.countDocuments({})).toBe(1);
      expect(await CandidateAvailability.countDocuments({})).toBe(0);
      const created = await Application.findById(accepted.applicationId).lean();
      expect(created).toMatchObject({
        source: APPLICATION_SOURCE.RECRUITER_INVITATION,
        status: APPLICATION_STATUS.CONTACTED,
        appliedAt: null,
        withdrawnAt: null,
      });
      expect(created.assignedRecruiterCompanyMemberId.toString()).toBe(
        context.supporting.membership._id.toString(),
      );

      await sendCandidateApplicationConversationNormalMessage({
        candidateUserId: context.candidate._id,
        actorUser: context.candidate,
        applicationId,
        content: "Hello after Accept",
      });
      await submitCandidateAvailabilityFirstTime({
        candidateUserId: context.candidate._id,
        actorUser: context.candidate,
        applicationId,
        timezone: "Asia/Ho_Chi_Minh",
        slots: [{ date: "2026-08-25", dayPart: "MORNING" }],
      });
      const proposal = await createFirstInterviewProposal({
        actorUser: context.supporting.user,
        jobId: context.job._id.toString(),
        applicationId,
        date: "2026-08-25",
        dayPart: "MORNING",
        expectedAvailabilityRevision: 0,
      });
      expect(proposal.interviewSchedule.status).toBe("PROPOSED");
      expect((await Application.findById(accepted.applicationId).lean()).status).toBe(
        APPLICATION_STATUS.INTERVIEW_SCHEDULED,
      );

      const reassigned = await reassignApplication({
        actorUser: context.recruiter.user,
        jobId: context.job._id.toString(),
        applicationId,
        assigneeCompanyMemberId: context.recruiter.membership._id.toString(),
        expectedAssigneeCompanyMemberId: context.supporting.membership._id.toString(),
        expectedVersion: 1,
      });
      expect(reassigned.application.assignedRecruiterCompanyMemberId).toBe(
        context.recruiter.membership._id.toString(),
      );
      expect((await readInvitation(sent.id)).sentByRecruiterCompanyMemberId.toString()).toBe(
        context.supporting.membership._id.toString(),
      );
      await expect(
        getRecruiterApplicationConversation({
          actorUser: context.supporting.user,
          applicationId,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      const currentAssigneeHistory = await getRecruiterApplicationConversation({
        actorUser: context.recruiter.user,
        applicationId,
      });
      expect(currentAssigneeHistory.authority.canSendNormal).toBe(true);

      const unassigned = await unassignApplication({
        actorUser: context.recruiter.user,
        jobId: context.job._id.toString(),
        applicationId,
        expectedAssigneeCompanyMemberId: context.recruiter.membership._id.toString(),
        expectedVersion: reassigned.application.version,
      });
      const candidateHistory = await getCandidateApplicationConversation({
        candidateUserId: context.candidate._id,
        actorUser: context.candidate,
        applicationId,
      });
      expect(candidateHistory.conversation.mode).toBe("PAUSED_UNASSIGNED");

      await expect(
        replaceSubmittedCv({
          candidateUserId: context.candidate._id,
          actorUser: context.candidate,
          applicationId,
          candidateCvId: context.candidateCv._id.toString(),
          expectedVersion: unassigned.application.version,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        withdrawApplication({
          candidateUserId: context.candidate._id,
          actorUser: context.candidate,
          applicationId,
          expectedVersion: unassigned.application.version,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const myApplication = await getCandidateMyApplication({
        candidateUserId: context.candidate._id,
        actorUser: context.candidate,
        applicationId,
      });
      expect(myApplication.application.status).not.toBe(APPLICATION_STATUS.APPLIED);
      expect(myApplication.application.status).not.toBe(APPLICATION_STATUS.SCREENING);
    });
  });

  describe("Tenant boundary, notifications, durability, and deferred-scope absence", () => {
    it("keeps Candidate ownership, current-Primary management, and denies Supporting CM Platform Admin and client companyId expansion", async () => {
      const context = await seedSendableContext({
        candidateEmail: "tenant.owner@example.com",
        recruiterEmail: "tenant.primary@example.com",
        managerEmail: "tenant.manager@example.com",
        supportingEmail: "tenant.supporting@example.com",
      });
      const foreign = await seedSendableContext({
        candidateEmail: "tenant.foreign@example.com",
        recruiterEmail: "tenant.foreign.recruiter@example.com",
        managerEmail: "tenant.foreign.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      const managed = sent;
      const agent = createTestAgent();
      const candidateToken = await loginAndGetAccessToken(agent, {
        email: context.candidate.email,
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
        email: "tenant.admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      const adminToken = await loginAndGetAccessToken(agent, {
        email: admin.email,
      });

      const otherSent = await sendPendingInvitation(foreign);
      expect(
        (
          await agent
            .post(`/api/candidate/invitations/${otherSent.id}/accept`)
            .set("Authorization", `Bearer ${candidateToken}`)
        ).status,
      ).toBe(404);

      const jobInvitationsPath = `/api/jobs/${context.job._id}/invitations`;
      expect(
        (
          await agent
            .get(jobInvitationsPath)
            .set("Authorization", `Bearer ${supportingToken}`)
        ).status,
      ).toBe(403);
      expect(
        (
          await agent
            .post(`${jobInvitationsPath}/${managed.id}/revoke`)
            .set("Authorization", `Bearer ${supportingToken}`)
        ).status,
      ).toBe(403);
      expect(
        (
          await agent
            .post(jobInvitationsPath)
            .set("Authorization", `Bearer ${managerToken}`)
            .send({ candidateCvId: context.candidateCv._id.toString() })
        ).status,
      ).toBe(403);
      expect(
        (
          await agent
            .post(jobInvitationsPath)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ candidateCvId: context.candidateCv._id.toString() })
        ).status,
      ).toBe(403);

      await expect(
        sendJobInvitation({
          recruiterUser: context.recruiter.user,
          clientCompanyId: foreign.job.companyId.toString(),
          jobId: foreign.job._id.toString(),
          candidateCvId: foreign.candidateCv._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("keeps the Notification reference matrix, V13 recovery snapshots, and no synthetic Accept Assignment events", async () => {
      const context = await seedSendableContext({
        candidateEmail: "notify.matrix@example.com",
        recruiterEmail: "notify.matrix.recruiter@example.com",
        managerEmail: "notify.matrix.manager@example.com",
      });
      const materializeSpy = vi
        .spyOn(notificationService, "materializeNotificationEvent")
        .mockRejectedValue(new Error("inbox unavailable"));
      const sent = await sendPendingInvitation(context);
      const accepted = await acceptOwnJobInvitation({
        candidateUser: context.candidate,
        invitationId: sent.id.toString(),
      });
      materializeSpy.mockRestore();

      expect((await readInvitation(sent.id)).status).toBe(
        JOB_INVITATION_STATUS.ACCEPTED,
      );
      expect(await readInvitationSourceApplication(sent.id)).toBeTruthy();

      const events = await NotificationEvent.find({
        $or: [
          { jobInvitationId: sent.id },
          { applicationId: accepted.applicationId },
        ],
      }).lean();
      const byType = Object.fromEntries(events.map((event) => [event.type, event]));
      expect(byType[NOTIFICATION_TYPE.JOB_INVITATION_RECEIVED].applicationId).toBeNull();
      expect(byType[NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED].applicationId).toBeNull();
      expect(
        byType[NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED].applicationId.toString(),
      ).toBe(accepted.applicationId.toString());
      expect(
        byType[NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED].jobInvitationId.toString(),
      ).toBe(sent.id.toString());
      expect(
        byType[NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED].jobInvitationId,
      ).toBeNull();
      expect(
        events.some((event) =>
          [
            NOTIFICATION_TYPE.APPLICATION_ASSIGNED,
            NOTIFICATION_TYPE.APPLICATION_STATUS_CHANGED,
          ].includes(event.type),
        ),
      ).toBe(false);
      expect(Object.values(NOTIFICATION_TYPE)).not.toContain("JOB_INVITATION_EXPIRED");

      const acceptedEvent = byType[NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED];
      const originalRecipients = acceptedEvent.recipients.map((recipient) => ({
        recipientUserId: recipient.recipientUserId.toString(),
        content: recipient.content,
      }));
      await notificationService.recoverPendingNotificationEvents();
      const inbox = await Notification.find({
        eventId: acceptedEvent._id,
      }).lean();
      expect(inbox).toHaveLength(1);
      expect(inbox[0].recipientUserId.toString()).toBe(
        context.recruiter.user._id.toString(),
      );
      expect(inbox[0].content).toBe(originalRecipients[0].content);
      expect(inbox[0].jobInvitationId.toString()).toBe(sent.id.toString());
    });

    it("keeps V14 Search read-only after Send, Direct Apply V9 semantics, and excludes deferred V15 persistence", async () => {
      const context = await seedSendableContext({
        candidateEmail: "regression.search@example.com",
        recruiterEmail: "regression.search.recruiter@example.com",
        managerEmail: "regression.search.manager@example.com",
      });
      const beforeSearch = await listCandidateSearchEligibleCandidateCvs({
        actorUser: context.recruiter.user,
      });
      const sent = await sendPendingInvitation(context);
      await updateOwnCandidateCvMetadata({
        candidateUserId: context.candidate._id,
        actorUser: context.candidate,
        candidateCvId: context.candidateCv._id.toString(),
        patch: { name: "Live name after Send" },
      });
      const afterSearch = await listCandidateSearchEligibleCandidateCvs({
        actorUser: context.recruiter.user,
      });
      expect(afterSearch.map((item) => item.cvId)).toEqual(
        expect.arrayContaining(beforeSearch.map((item) => item.cvId)),
      );
      expect((await readInvitation(sent.id)).invitedCvSnapshot.name).toBe(
        "Public Generated CV",
      );
      expect(await Application.countDocuments({})).toBe(0);
      expect(await Conversation.countDocuments({})).toBe(0);

      const invitationPaths = JobInvitation.schema.paths;
      expect(invitationPaths.canAccept).toBeUndefined();
      expect(invitationPaths.companyId).toBeUndefined();
      expect(invitationPaths.rejectReason).toBeUndefined();
      expect(Application.schema.paths.sourceRecruiterCompanyMemberId).toBeUndefined();
      expect(IMMUTABLE_JOB_INVITATION_IDENTITY_FIELDS).toEqual(
        expect.arrayContaining([
          "invitedCvSnapshot",
          "sentByRecruiterCompanyMemberId",
          "greetingMessage",
        ]),
      );

      const collectionNames = (
        await mongoose.connection.db.listCollections().toArray()
      ).map((collection) => collection.name);
      expect(collectionNames).not.toEqual(
        expect.arrayContaining([
          "job_invitation_events",
          "job_invitation_audits",
          "job_invitation_histories",
          "sourcing_metrics",
          "sourcing_statistics",
        ]),
      );
    });
  });

  describe("Terminal actions serialize with authoritative invalidation sources", () => {
    const seedWithSupportingSender = async (prefix) => {
      const context = await seedSendableContext({
        candidateEmail: `${prefix}.candidate@example.com`,
        recruiterEmail: `${prefix}.recruiter@example.com`,
        managerEmail: `${prefix}.manager@example.com`,
        supportingEmail: `${prefix}.supporting@example.com`,
      });
      const sent = await sendPendingInvitation(context, {
        recruiterUser: context.supporting.user,
      });
      return { context, sent };
    };

    const seedPrimarySender = async (prefix) => {
      const context = await seedSendableContext({
        candidateEmail: `${prefix}.candidate@example.com`,
        recruiterEmail: `${prefix}.recruiter@example.com`,
        managerEmail: `${prefix}.manager@example.com`,
      });
      const sent = await sendPendingInvitation(context);
      return { context, sent };
    };

    it("does not let Accept commit after CandidateCV Archive wins first", async () => {
      const { context, sent } = await seedPrimarySender("race.cv.archive.accept.lose");
      await runSourceWinsBeforeTerminalAction({
        holdModel: CandidateCV,
        action: () =>
          acceptOwnJobInvitation({
            candidateUser: context.candidate,
            invitationId: sent.id.toString(),
          }),
        mutate: () => mutateArchive(context),
      });
      await expectInvalidatedWithoutAccept({
        invitationId: sent.id,
        invalidationReason: JOB_INVITATION_INVALIDATION_REASON.INVITED_CV_ARCHIVED,
      });
    });

    it("keeps Accept when it wins before a later CandidateCV Archive catch-up", async () => {
      const { context, sent } = await seedPrimarySender("race.cv.archive.accept.win");
      await runActionWinsBeforeSourceMutation({
        holdSource: installArchiveWriteBarrier,
        action: () =>
          acceptOwnJobInvitation({
            candidateUser: context.candidate,
            invitationId: sent.id.toString(),
          }),
        mutate: () => mutateArchive(context),
      });
      await expectAcceptedNotOverwritten(sent.id);
    });

    it("does not let Accept commit after Company becomes non-operational first", async () => {
      const { context, sent } = await seedPrimarySender("race.company.accept.lose");
      await runSourceWinsBeforeTerminalAction({
        holdModel: Company,
        action: () =>
          acceptOwnJobInvitation({
            candidateUser: context.candidate,
            invitationId: sent.id.toString(),
          }),
        mutate: () =>
          lockCompany({
            companyId: context.manager.company._id.toString(),
          }),
      });
      await expectInvalidatedWithoutAccept({
        invitationId: sent.id,
        invalidationReason:
          JOB_INVITATION_INVALIDATION_REASON.COMPANY_NOT_OPERATIONAL,
      });
    });

    it("keeps Accept when it wins before a later Company lock catch-up", async () => {
      const { context, sent } = await seedPrimarySender("race.company.accept.win");
      await runActionWinsBeforeSourceMutation({
        holdSource: installCompanyLockSaveBarrier,
        action: () =>
          acceptOwnJobInvitation({
            candidateUser: context.candidate,
            invitationId: sent.id.toString(),
          }),
        mutate: () =>
          lockCompany({
            companyId: context.manager.company._id.toString(),
          }),
      });
      await expectAcceptedNotOverwritten(sent.id);
    });

    it("does not let Accept commit after historical sender User loses ACTIVE first", async () => {
      const { context, sent } = await seedWithSupportingSender(
        "race.sender.user.accept.lose",
      );
      const { user: admin } = await createVerifiedUser({
        email: "race.sender.user.accept.lose.admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      await runSourceWinsBeforeTerminalAction({
        holdModel: User,
        action: () =>
          acceptOwnJobInvitation({
            candidateUser: context.candidate,
            invitationId: sent.id.toString(),
          }),
        mutate: () =>
          lockAccount({
            targetUserId: context.supporting.user._id.toString(),
            actorUserId: admin._id,
          }),
      });
      await expectInvalidatedWithoutAccept({
        invitationId: sent.id,
        invalidationReason: JOB_INVITATION_INVALIDATION_REASON.SENDER_NOT_ACTIVE,
      });
    });

    it("keeps Accept when it wins before a later historical sender User lock catch-up", async () => {
      const { context, sent } = await seedWithSupportingSender(
        "race.sender.user.accept.win",
      );
      const { user: admin } = await createVerifiedUser({
        email: "race.sender.user.accept.win.admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      await runActionWinsBeforeSourceMutation({
        holdSource: installUserLockSaveBarrier,
        action: () =>
          acceptOwnJobInvitation({
            candidateUser: context.candidate,
            invitationId: sent.id.toString(),
          }),
        mutate: () =>
          lockAccount({
            targetUserId: context.supporting.user._id.toString(),
            actorUserId: admin._id,
          }),
      });
      await expectAcceptedNotOverwritten(sent.id);
    });

    it("does not let Accept commit after sender Job-team eligibility is lost first", async () => {
      const { context, sent } = await seedWithSupportingSender(
        "race.sender.team.accept.lose",
      );
      await runSourceWinsBeforeTerminalAction({
        holdModel: Company,
        action: () =>
          acceptOwnJobInvitation({
            candidateUser: context.candidate,
            invitationId: sent.id.toString(),
          }),
        mutate: () =>
          removeSupportingRecruiter({
            actorUser: context.recruiter.user,
            jobId: context.job._id.toString(),
            supportingRecruiterCompanyMemberId:
              context.supporting.membership._id.toString(),
          }),
      });
      await expectInvalidatedWithoutAccept({
        invitationId: sent.id,
        invalidationReason:
          JOB_INVITATION_INVALIDATION_REASON.SENDER_REMOVED_FROM_JOB_TEAM,
      });
    });

    it("keeps Accept when it wins before a later sender Job-team removal catch-up", async () => {
      const { context, sent } = await seedWithSupportingSender(
        "race.sender.team.accept.win",
      );
      await runActionWinsBeforeSourceMutation({
        holdSource: installSupportingRemovalStartBarrier,
        action: () =>
          acceptOwnJobInvitation({
            candidateUser: context.candidate,
            invitationId: sent.id.toString(),
          }),
        mutate: () =>
          removeSupportingRecruiter({
            actorUser: context.recruiter.user,
            jobId: context.job._id.toString(),
            supportingRecruiterCompanyMemberId:
              context.supporting.membership._id.toString(),
          }),
      });
      await expectAcceptedNotOverwritten(sent.id);
    });

    it("does not let Reject commit after CandidateCV Archive wins first", async () => {
      const { context, sent } = await seedPrimarySender("race.cv.archive.reject.lose");
      await runSourceWinsBeforeTerminalAction({
        holdModel: CandidateCV,
        action: () =>
          rejectOwnJobInvitation({
            candidateUser: context.candidate,
            invitationId: sent.id.toString(),
          }),
        mutate: () => mutateArchive(context),
      });
      const persisted = await readInvitation(sent.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.INVALIDATED);
      expect(persisted.invalidationReason).toBe(
        JOB_INVITATION_INVALIDATION_REASON.INVITED_CV_ARCHIVED,
      );
      expect(persisted.status).not.toBe(JOB_INVITATION_STATUS.REJECTED);
      expect(
        await countEvents({
          invitationId: sent.id,
          type: NOTIFICATION_TYPE.JOB_INVITATION_REJECTED,
        }),
      ).toBe(0);
    });

    it("keeps Reject when it wins before a later CandidateCV Archive catch-up", async () => {
      const { context, sent } = await seedPrimarySender("race.cv.archive.reject.win");
      await runActionWinsBeforeSourceMutation({
        holdSource: installArchiveWriteBarrier,
        action: () =>
          rejectOwnJobInvitation({
            candidateUser: context.candidate,
            invitationId: sent.id.toString(),
          }),
        mutate: () => mutateArchive(context),
      });
      const persisted = await readInvitation(sent.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.REJECTED);
      expect(persisted.invalidatedAt).toBeNull();
      expect(
        await countEvents({
          invitationId: sent.id,
          type: NOTIFICATION_TYPE.JOB_INVITATION_REJECTED,
        }),
      ).toBe(1);
    });

    it("does not let Revoke commit after CandidateCV Archive wins first", async () => {
      const { context, sent } = await seedPrimarySender("race.cv.archive.revoke.lose");
      await runSourceWinsBeforeTerminalAction({
        holdModel: CandidateCV,
        action: () =>
          revokePrimaryJobInvitation({
            recruiterUser: context.recruiter.user,
            jobId: context.job._id.toString(),
            invitationId: sent.id.toString(),
          }),
        mutate: () => mutateArchive(context),
      });
      const persisted = await readInvitation(sent.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.INVALIDATED);
      expect(persisted.invalidationReason).toBe(
        JOB_INVITATION_INVALIDATION_REASON.INVITED_CV_ARCHIVED,
      );
      expect(persisted.status).not.toBe(JOB_INVITATION_STATUS.REVOKED);
      expect(
        await countEvents({
          invitationId: sent.id,
          type: NOTIFICATION_TYPE.JOB_INVITATION_REVOKED,
        }),
      ).toBe(0);
    });

    it("keeps Revoke when it wins before a later CandidateCV Archive catch-up", async () => {
      const { context, sent } = await seedPrimarySender("race.cv.archive.revoke.win");
      await runActionWinsBeforeSourceMutation({
        holdSource: installArchiveWriteBarrier,
        action: () =>
          revokePrimaryJobInvitation({
            recruiterUser: context.recruiter.user,
            jobId: context.job._id.toString(),
            invitationId: sent.id.toString(),
          }),
        mutate: () => mutateArchive(context),
      });
      const persisted = await readInvitation(sent.id);
      expect(persisted.status).toBe(JOB_INVITATION_STATUS.REVOKED);
      expect(persisted.invalidatedAt).toBeNull();
      expect(
        await countEvents({
          invitationId: sent.id,
          type: NOTIFICATION_TYPE.JOB_INVITATION_REVOKED,
        }),
      ).toBe(1);
    });
  });

  describe("Send binds InvitedCvSnapshot to the re-checked CandidateCV revision", () => {
    it("rejects stale Send when Generated content changes after snapshot capture", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.cv.content.lose@example.com",
        recruiterEmail: "race.cv.content.lose.recruiter@example.com",
        managerEmail: "race.cv.content.lose.manager@example.com",
      });

      await expectStaleSendRejected(context, mutateGeneratedContent);
      const liveCv = await CandidateCV.findById(context.candidateCv._id);
      expect(liveCv.generatedContent.professionalSummary).toBe(
        "Mutated live summary after capture",
      );
    });

    it("keeps the captured snapshot when Send wins before a later Generated content change", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.cv.content.win@example.com",
        recruiterEmail: "race.cv.content.win.recruiter@example.com",
        managerEmail: "race.cv.content.win.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      await mutateGeneratedContent(context);

      const invitation = await readInvitation(sent.id);
      const liveCv = await CandidateCV.findById(context.candidateCv._id);
      expect(invitation.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(invitation.invitedCvSnapshot.generatedContent.professionalSummary).toBe(
        "Backend engineer summary",
      );
      expect(liveCv.generatedContent.professionalSummary).toBe(
        "Mutated live summary after capture",
      );
    });

    it("rejects stale Send when visibility becomes PRIVATE after snapshot capture", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.cv.private.lose@example.com",
        recruiterEmail: "race.cv.private.lose.recruiter@example.com",
        managerEmail: "race.cv.private.lose.manager@example.com",
      });

      await expectStaleSendRejected(context, mutateVisibilityPrivate);
      const liveCv = await CandidateCV.findById(context.candidateCv._id);
      expect(liveCv.visibility).toBe(CANDIDATE_CV_VISIBILITY.PRIVATE);
    });

    it("keeps the captured snapshot when Send wins before a later PUBLIC → PRIVATE change", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.cv.private.win@example.com",
        recruiterEmail: "race.cv.private.win.recruiter@example.com",
        managerEmail: "race.cv.private.win.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      await mutateVisibilityPrivate(context);

      const invitation = await readInvitation(sent.id);
      expect(invitation.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(invitation.invitedCvSnapshot.name).toBe("Public Generated CV");
      expect(
        (await CandidateCV.findById(context.candidateCv._id)).visibility,
      ).toBe(CANDIDATE_CV_VISIBILITY.PRIVATE);
    });

    it("rejects stale Send when Generated ACTIVE demotes to DRAFT after snapshot capture", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.cv.draft.lose@example.com",
        recruiterEmail: "race.cv.draft.lose.recruiter@example.com",
        managerEmail: "race.cv.draft.lose.manager@example.com",
      });

      await expectStaleSendRejected(context, mutateGeneratedActiveToDraft);
      const liveCv = await CandidateCV.findById(context.candidateCv._id);
      expect(liveCv.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
    });

    it("keeps the captured snapshot when Send wins before a later Generated ACTIVE → DRAFT demotion", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.cv.draft.win@example.com",
        recruiterEmail: "race.cv.draft.win.recruiter@example.com",
        managerEmail: "race.cv.draft.win.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);

      await mutateGeneratedActiveToDraft(context);

      const invitation = await readInvitation(sent.id);
      expect(invitation.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(invitation.invitedCvSnapshot.generatedContent.professionalSummary).toBe(
        "Backend engineer summary",
      );
      expect((await CandidateCV.findById(context.candidateCv._id)).status).toBe(
        CANDIDATE_CV_STATUS.DRAFT,
      );
    });

    it("rejects stale Send when Archive wins after snapshot capture", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.cv.archive.lose@example.com",
        recruiterEmail: "race.cv.archive.lose.recruiter@example.com",
        managerEmail: "race.cv.archive.lose.manager@example.com",
      });

      await expectStaleSendRejected(context, mutateArchive);
      const liveCv = await CandidateCV.findById(context.candidateCv._id);
      expect(liveCv.archivedAt).not.toBeNull();
    });

    it("keeps the captured snapshot when Send wins before a later Archive", async () => {
      const context = await seedSendableContext({
        candidateEmail: "race.cv.archive.win@example.com",
        recruiterEmail: "race.cv.archive.win.recruiter@example.com",
        managerEmail: "race.cv.archive.win.manager@example.com",
      });
      const sent = await sendPendingInvitation(context);
      const capturedName = (await readInvitation(sent.id)).invitedCvSnapshot.name;

      await mutateArchive(context);

      const invitation = await readInvitation(sent.id);
      expect(invitation.status).toBe(JOB_INVITATION_STATUS.INVALIDATED);
      expect(invitation.invalidationReason).toBe(
        JOB_INVITATION_INVALIDATION_REASON.INVITED_CV_ARCHIVED,
      );
      expect(invitation.invitedCvSnapshot.name).toBe(capturedName);
    });
  });
});
