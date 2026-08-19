import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
import CV_LANGUAGE_PROFICIENCY from "../../src/constants/cv-language-proficiency.js";
import JOB_INVITATION_STATUS from "../../src/constants/job-invitation-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Job from "../../src/models/job.model.js";
import JobInvitation from "../../src/models/job-invitation.model.js";
import * as fileService from "../../src/services/file.service.js";
import { sendJobInvitation } from "../../src/services/job-invitation.service.js";
import * as jobInvitationService from "../../src/services/job-invitation.service.js";
import {
  startJobInvitationExpirationWorker,
  stopJobInvitationExpirationWorker,
} from "../../src/workers/job-invitation-expiration.worker.js";
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

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const productionEntryPath = path.join(backendRoot, "index.js");
const expirationWorkerPath = path.join(
  backendRoot,
  "src/workers/job-invitation-expiration.worker.js",
);

const FUTURE_DEADLINE = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST_CUTOFF = new Date("2026-01-16T00:00:00.000Z");

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

const createGeneratedCv = async ({ candidateUserId, categoryId }) => {
  return CandidateCV.create({
    candidateUserId,
    name: "Public Generated CV",
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
    categoryId,
    experienceLevelId: null,
    preferredLocations: [],
    skillTags: [],
    employmentTypes: [],
    workModes: [],
    isDefault: false,
    archivedAt: null,
    generatedContent: completeGeneratedContent(),
  });
};

const createPublishedJob = async ({
  companyId,
  primaryMemberId,
  supportingIds = [],
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingIds,
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
  candidateEmail,
  recruiterEmail,
  supportingEmail,
  managerEmail,
}) => {
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
  });
  const category = await createFieldCategory(
    `Software Engineering ${candidateEmail}`,
  );
  const candidateCv = await createGeneratedCv({
    candidateUserId: candidate._id,
    categoryId: category._id,
  });

  return { recruiter, supporting, job, candidateCv };
};

const sendPendingInvitation = async (context) => {
  mockSnapshotUpload();
  return sendJobInvitation({
    recruiterUser: context.supporting.user,
    jobId: context.job._id.toString(),
    candidateCvId: context.candidateCv._id.toString(),
    greetingMessage: "Join us",
  });
};

describe("V15 Day-15 Invitation expiration production runtime trigger", () => {
  beforeAll(connectTestDatabase);

  afterEach(async () => {
    await stopJobInvitationExpirationWorker();
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(disconnectTestDatabase);

  it("starts the expiration worker from canonical production bootstrap", () => {
    const entrySource = fs.readFileSync(productionEntryPath, "utf8");

    expect(entrySource).toMatch(
      /import\s*\{[^}]*startJobInvitationExpirationWorker[^}]*\}\s*from\s*["'].*job-invitation-expiration\.worker\.js["']/s,
    );
    expect(entrySource).toMatch(
      /import\s*\{[^}]*stopJobInvitationExpirationWorker[^}]*\}\s*from\s*["'].*job-invitation-expiration\.worker\.js["']/s,
    );

    const startServerMatch = entrySource.match(
      /const startServer = async \(\) => \{([\s\S]*?)\n\};/,
    );
    expect(startServerMatch).not.toBeNull();

    const startServerBody = startServerMatch[1];
    const collectionReadyAt = startServerBody.indexOf(
      "await ensureJobInvitationCollectionInvariants(",
    );
    const startWorkerAt = startServerBody.indexOf(
      "startJobInvitationExpirationWorker(",
    );

    expect(collectionReadyAt).toBeGreaterThanOrEqual(0);
    expect(startWorkerAt).toBeGreaterThan(collectionReadyAt);

    const shutdownMatch = entrySource.match(
      /const shutdown = async \(\{([\s\S]*?)\n\};/,
    );
    expect(shutdownMatch).not.toBeNull();
    expect(shutdownMatch[1]).toContain(
      "await stopJobInvitationExpirationWorker(",
    );
  });

  it("reuses shared materializeDueExpiredJobInvitations instead of a second expiration decision", () => {
    const workerSource = fs.readFileSync(expirationWorkerPath, "utf8");

    expect(workerSource).toMatch(
      /import\s*\{\s*materializeDueExpiredJobInvitations\s*\}\s*from\s*["'].*job-invitation\.service\.js["']/,
    );
    expect(workerSource).toContain("materializeDueExpiredJobInvitations(");
    expect(workerSource).not.toMatch(/evaluateJobInvitationCurrentState/);
    expect(workerSource).not.toMatch(/from\s+["'].*job-invitation\.model\.js["']/);
    expect(workerSource).not.toMatch(/JOB_INVITATION_EXPIRED/);
    expect(workerSource).not.toMatch(/expiresAt\s*:/);
  });

  it("materializes due PENDING Invitations and leaves future and terminal Invitations unchanged", async () => {
    const dueInvitation = await sendPendingInvitation(
      await seedInvitationContext({
        candidateEmail: "runtime.due@example.com",
        recruiterEmail: "runtime.due.recruiter@example.com",
        supportingEmail: "runtime.due.supporting@example.com",
        managerEmail: "runtime.due.manager@example.com",
      }),
    );
    await JobInvitation.updateOne(
      { _id: dueInvitation.id },
      { $set: { expiresAt: PAST_CUTOFF } },
      { timestamps: false },
    );

    const futureInvitation = await sendPendingInvitation(
      await seedInvitationContext({
        candidateEmail: "runtime.future@example.com",
        recruiterEmail: "runtime.future.recruiter@example.com",
        supportingEmail: "runtime.future.supporting@example.com",
        managerEmail: "runtime.future.manager@example.com",
      }),
    );
    await JobInvitation.updateOne(
      { _id: futureInvitation.id },
      { $set: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } },
      { timestamps: false },
    );

    const rejectedInvitation = await sendPendingInvitation(
      await seedInvitationContext({
        candidateEmail: "runtime.rejected@example.com",
        recruiterEmail: "runtime.rejected.recruiter@example.com",
        supportingEmail: "runtime.rejected.supporting@example.com",
        managerEmail: "runtime.rejected.manager@example.com",
      }),
    );
    await JobInvitation.updateOne(
      { _id: rejectedInvitation.id },
      {
        $set: {
          status: JOB_INVITATION_STATUS.REJECTED,
          rejectedAt: new Date("2026-01-10T00:00:00.000Z"),
          expiresAt: PAST_CUTOFF,
        },
      },
      { timestamps: false },
    );

    const acceptedInvitation = await sendPendingInvitation(
      await seedInvitationContext({
        candidateEmail: "runtime.accepted@example.com",
        recruiterEmail: "runtime.accepted.recruiter@example.com",
        supportingEmail: "runtime.accepted.supporting@example.com",
        managerEmail: "runtime.accepted.manager@example.com",
      }),
    );
    await JobInvitation.updateOne(
      { _id: acceptedInvitation.id },
      {
        $set: {
          status: JOB_INVITATION_STATUS.ACCEPTED,
          acceptedAt: new Date("2026-01-10T00:00:00.000Z"),
          expiresAt: PAST_CUTOFF,
        },
      },
      { timestamps: false },
    );

    const materializeSpy = vi.spyOn(
      jobInvitationService,
      "materializeDueExpiredJobInvitations",
    );

    await startJobInvitationExpirationWorker();

    expect(materializeSpy).toHaveBeenCalled();
    expect((await JobInvitation.findById(dueInvitation.id)).status).toBe(
      JOB_INVITATION_STATUS.EXPIRED,
    );
    expect((await JobInvitation.findById(futureInvitation.id)).status).toBe(
      JOB_INVITATION_STATUS.PENDING,
    );
    expect((await JobInvitation.findById(rejectedInvitation.id)).status).toBe(
      JOB_INVITATION_STATUS.REJECTED,
    );
    expect((await JobInvitation.findById(acceptedInvitation.id)).status).toBe(
      JOB_INVITATION_STATUS.ACCEPTED,
    );

    await stopJobInvitationExpirationWorker();
    await startJobInvitationExpirationWorker();

    expect((await JobInvitation.findById(dueInvitation.id)).status).toBe(
      JOB_INVITATION_STATUS.EXPIRED,
    );
    expect((await JobInvitation.findById(futureInvitation.id)).status).toBe(
      JOB_INVITATION_STATUS.PENDING,
    );
    expect((await JobInvitation.findById(rejectedInvitation.id)).status).toBe(
      JOB_INVITATION_STATUS.REJECTED,
    );
    expect((await JobInvitation.findById(acceptedInvitation.id)).status).toBe(
      JOB_INVITATION_STATUS.ACCEPTED,
    );
  });
});
