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
import JOB_STATUS from "../../src/constants/job-status.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Job from "../../src/models/job.model.js";
import {
  directApplyToJob,
  replaceSubmittedCv,
  withdrawApplication,
} from "../../src/services/application.service.js";
import * as fileService from "../../src/services/file.service.js";
import {
  closePublishedJob,
  deletePrePublicationJob,
  expirePublishedJobIfDue,
} from "../../src/services/job.service.js";
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

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST_DEADLINE = () => new Date(Date.now() - 60_000);

const createFieldCategory = async (name = "Software Engineering") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
    parentCategoryId: null,
  });
};

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
    { institutionName: "Example University", degree: "BSc", fieldOfStudy: "CS" },
  ],
  skills: ["Node.js", "MongoDB"],
  workExperiences: [
    { companyName: "Example Co", position: "Engineer", description: "Built APIs" },
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
  languages: [{ name: "English", proficiency: CV_LANGUAGE_PROFICIENCY.FLUENT }],
  hiddenSections: [],
});

const createGeneratedCv = async ({
  candidateUserId,
  categoryId,
  name = "Generated CV",
  generatedContent = completeGeneratedContent(),
} = {}) => {
  return CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId,
    experienceLevelId: null,
    preferredLocations: [],
    skillTags: [],
    employmentTypes: [],
    workModes: [],
    isDefault: false,
    archivedAt: null,
    generatedContent,
  });
};

const createPublishedJob = async ({ companyId, primaryMemberId }) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: [],
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: FUTURE_DEADLINE(),
    title: "Backend Engineer",
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

const setupBaseline = async ({ emailPrefix = "v10.s02" } = {}) => {
  const candidate = await createVerifiedUser({
    email: `${emailPrefix}.candidate@example.com`,
  });
  const owner = candidate.user;
  const manager = await createActiveCompanyManagerContext({
    email: `${emailPrefix}.manager@example.com`,
    businessRegistrationNumber: `BRN-${emailPrefix.toUpperCase().replace(/\./g, "-")}`,
  });
  const recruiter = await createActiveRecruiterContext({
    email: `${emailPrefix}.recruiter@example.com`,
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}`,
  });
  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: recruiter.membership._id,
  });
  const category = await createFieldCategory();

  return { owner, manager, recruiter, job, category };
};

const mockSnapshotUpload = (publicId) => {
  vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({ publicId });
};

const applyWithGeneratedCv = async ({ owner, job, category, name = "Initial CV" }) => {
  const cv = await createGeneratedCv({
    candidateUserId: owner._id,
    categoryId: category._id,
    name,
    generatedContent: completeGeneratedContent(name),
  });
  const created = await directApplyToJob({
    candidateUserId: owner._id,
    actorUser: owner,
    jobId: job._id.toString(),
    candidateCvId: cv._id.toString(),
  });
  return { cv, created };
};

const assignAppliedApplication = async (applicationId, assigneeId) => {
  await Application.updateOne(
    { _id: applicationId },
    {
      $set: {
        assignedRecruiterCompanyMemberId: assigneeId,
        version: 1,
      },
    },
  );
};

const moveToScreeningAssigned = async (applicationId, assigneeId) => {
  await Application.updateOne(
    { _id: applicationId },
    {
      $set: {
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: assigneeId,
        version: 1,
      },
    },
  );
};

describe("V10 Slice 02 — V9 compatibility and Job-retention compatibility", () => {
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

  describe("Direct Apply remains V9-compatible on V10 shape (F01)", () => {
    it("creates one APPLIED Unassigned Direct Application per Candidate–Job", async () => {
      mockSnapshotUpload(
        "jobhub/applications/submitted-cv-snapshots/v10-s02-apply",
      );
      const { owner, job, category } = await setupBaseline({
        emailPrefix: "v10.s02.apply",
      });
      const { created } = await applyWithGeneratedCv({ owner, job, category });

      expect(created.source).toBe(APPLICATION_SOURCE.DIRECT_APPLICATION);
      expect(created.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(created.version).toBe(0);

      const persisted = await Application.findById(created.id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      expect(persisted.candidateUserId.toString()).toBe(owner._id.toString());
      expect(persisted.jobId.toString()).toBe(job._id.toString());
      expect(persisted.submittedCvSnapshot).toBeTruthy();

      const secondCv = await createGeneratedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
        name: "Second CV",
      });
      await expect(
        directApplyToJob({
          candidateUserId: owner._id,
          actorUser: owner,
          jobId: job._id.toString(),
          candidateCvId: secondCv._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("treats legacy missing assignee and explicit null as the same Unassigned semantics", async () => {
      mockSnapshotUpload(
        "jobhub/applications/submitted-cv-snapshots/v10-s02-legacy",
      );
      const { owner, job, category } = await setupBaseline({
        emailPrefix: "v10.s02.legacy",
      });
      const { created } = await applyWithGeneratedCv({ owner, job, category });

      await Application.collection.updateOne(
        { _id: created.id },
        { $unset: { assignedRecruiterCompanyMemberId: "" } },
      );

      const legacy = await Application.collection.findOne({ _id: created.id });
      expect(legacy).not.toHaveProperty("assignedRecruiterCompanyMemberId");

      const viaModel = await Application.findById(created.id);
      expect(viaModel.assignedRecruiterCompanyMemberId ?? null).toBeNull();

      const withdrawn = await withdrawApplication({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        expectedVersion: 0,
      });
      expect(withdrawn.status).toBe(APPLICATION_STATUS.WITHDRAWN);

      const afterWithdraw = await Application.findById(created.id).lean();
      expect(afterWithdraw.assignedRecruiterCompanyMemberId ?? null).toBeNull();
      expect(afterWithdraw.submittedCvSnapshot).toBeTruthy();
    });
  });

  describe("Replace / Withdraw compatibility with Assignee and SCREENING (BR-23, BR-39, BR-41)", () => {
    it("allows Replace on Assigned APPLIED when Job still accepts applications and preserves Assignee", async () => {
      mockSnapshotUpload(
        "jobhub/applications/submitted-cv-snapshots/v10-s02-replace-assigned",
      );
      const { owner, recruiter, job, category } = await setupBaseline({
        emailPrefix: "v10.s02.replace.assigned",
      });
      const { created } = await applyWithGeneratedCv({
        owner,
        job,
        category,
        name: "Original Snapshot",
      });
      const assigneeId = recruiter.membership._id;
      await assignAppliedApplication(created.id, assigneeId);

      const replacementCv = await createGeneratedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
        name: "Replacement Snapshot",
        generatedContent: completeGeneratedContent("Replacement Snapshot"),
      });

      const replaced = await replaceSubmittedCv({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        candidateCvId: replacementCv._id.toString(),
        expectedVersion: 1,
      });

      expect(replaced.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(replaced.version).toBe(2);
      expect(replaced.submittedCvSnapshot.name).toBe("Replacement Snapshot");

      const persisted = await Application.findById(created.id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId.toString()).toBe(
        assigneeId.toString(),
      );
      expect(persisted.candidateUserId.toString()).toBe(owner._id.toString());
      expect(persisted.jobId.toString()).toBe(job._id.toString());
      expect(persisted.source).toBe(APPLICATION_SOURCE.DIRECT_APPLICATION);
    });

    it("allows Withdraw on Assigned APPLIED and keeps the final Assignee", async () => {
      mockSnapshotUpload(
        "jobhub/applications/submitted-cv-snapshots/v10-s02-withdraw-assigned",
      );
      const { owner, recruiter, job, category } = await setupBaseline({
        emailPrefix: "v10.s02.withdraw.assigned",
      });
      const { created } = await applyWithGeneratedCv({ owner, job, category });
      const assigneeId = recruiter.membership._id;
      await assignAppliedApplication(created.id, assigneeId);

      const withdrawn = await withdrawApplication({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        expectedVersion: 1,
        withdrawReason: "Accepted another offer",
      });

      expect(withdrawn.status).toBe(APPLICATION_STATUS.WITHDRAWN);
      expect(withdrawn.version).toBe(2);

      const persisted = await Application.findById(created.id).lean();
      expect(persisted.status).toBe(APPLICATION_STATUS.WITHDRAWN);
      expect(persisted.assignedRecruiterCompanyMemberId.toString()).toBe(
        assigneeId.toString(),
      );
      expect(persisted.submittedCvSnapshot).toBeTruthy();
      expect(persisted.withdrawnAt).toBeTruthy();
    });

    it("locks Replace and Withdraw once Application is SCREENING", async () => {
      mockSnapshotUpload(
        "jobhub/applications/submitted-cv-snapshots/v10-s02-screening-lock",
      );
      const { owner, recruiter, job, category } = await setupBaseline({
        emailPrefix: "v10.s02.screening.lock",
      });
      const { created } = await applyWithGeneratedCv({ owner, job, category });
      await moveToScreeningAssigned(created.id, recruiter.membership._id);

      const replacementCv = await createGeneratedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
        name: "Should Not Replace",
      });

      await expect(
        replaceSubmittedCv({
          candidateUserId: owner._id,
          actorUser: owner,
          applicationId: created.id.toString(),
          candidateCvId: replacementCv._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      await expect(
        withdrawApplication({
          candidateUserId: owner._id,
          actorUser: owner,
          applicationId: created.id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(created.id).lean();
      expect(persisted.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(persisted.assignedRecruiterCompanyMemberId.toString()).toBe(
        recruiter.membership._id.toString(),
      );
    });
  });

  describe("CLOSED / EXPIRED Job compatibility (F09; BR-25, BR-26, BR-29–BR-31)", () => {
    it("blocks Replace but allows Withdraw after Job CLOSED, without mutating Application on close", async () => {
      mockSnapshotUpload(
        "jobhub/applications/submitted-cv-snapshots/v10-s02-closed",
      );
      const { owner, manager, recruiter, job, category } = await setupBaseline({
        emailPrefix: "v10.s02.closed",
      });
      const { created } = await applyWithGeneratedCv({ owner, job, category });
      const beforeClose = await Application.findById(created.id).lean();

      const closed = await closePublishedJob({
        actorUser: manager.user,
        jobId: job._id.toString(),
      });
      expect(closed.status).toBe(JOB_STATUS.CLOSED);

      const afterClose = await Application.findById(created.id).lean();
      expect(afterClose.status).toBe(beforeClose.status);
      expect(afterClose.version).toBe(beforeClose.version);
      expect(JSON.parse(JSON.stringify(afterClose.submittedCvSnapshot))).toEqual(
        JSON.parse(JSON.stringify(beforeClose.submittedCvSnapshot)),
      );

      const replacementCv = await createGeneratedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
        name: "Closed Replace",
      });
      await expect(
        replaceSubmittedCv({
          candidateUserId: owner._id,
          actorUser: owner,
          applicationId: created.id.toString(),
          candidateCvId: replacementCv._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const withdrawn = await withdrawApplication({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        expectedVersion: 0,
      });
      expect(withdrawn.status).toBe(APPLICATION_STATUS.WITHDRAWN);

      // Job retention remains V5 lifecycle authority (no Application-existence delete).
      await expect(
        deletePrePublicationJob({
          actorUser: manager.user,
          jobId: job._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(await Job.findById(job._id)).not.toBeNull();
      expect(await Application.findById(created.id)).not.toBeNull();
      expect(recruiter.membership._id).toBeTruthy();
    });

    it("blocks Replace but allows Withdraw after Job EXPIRED, without mutating Application on expire", async () => {
      mockSnapshotUpload(
        "jobhub/applications/submitted-cv-snapshots/v10-s02-expired",
      );
      const { owner, job, category } = await setupBaseline({
        emailPrefix: "v10.s02.expired",
      });
      const { created } = await applyWithGeneratedCv({ owner, job, category });

      await Job.updateOne(
        { _id: job._id },
        { applicationDeadline: PAST_DEADLINE() },
      );
      const beforeExpire = await Application.findById(created.id).lean();

      const expired = await expirePublishedJobIfDue({
        jobId: job._id.toString(),
        now: new Date(),
      });
      expect(expired.status).toBe(JOB_STATUS.EXPIRED);

      const afterExpire = await Application.findById(created.id).lean();
      expect(afterExpire.status).toBe(beforeExpire.status);
      expect(afterExpire.version).toBe(beforeExpire.version);
      expect(afterExpire.jobId.toString()).toBe(job._id.toString());

      const replacementCv = await createGeneratedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
        name: "Expired Replace",
      });
      await expect(
        replaceSubmittedCv({
          candidateUserId: owner._id,
          actorUser: owner,
          applicationId: created.id.toString(),
          candidateCvId: replacementCv._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const withdrawn = await withdrawApplication({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        expectedVersion: 0,
      });
      expect(withdrawn.status).toBe(APPLICATION_STATUS.WITHDRAWN);
      expect(withdrawn.jobId.toString()).toBe(job._id.toString());
    });

    it("keeps Job.status independent from Application.status after close", async () => {
      mockSnapshotUpload(
        "jobhub/applications/submitted-cv-snapshots/v10-s02-status-sep",
      );
      const { owner, manager, recruiter, job, category } = await setupBaseline({
        emailPrefix: "v10.s02.status.sep",
      });
      const { created } = await applyWithGeneratedCv({ owner, job, category });
      await moveToScreeningAssigned(created.id, recruiter.membership._id);

      await closePublishedJob({
        actorUser: manager.user,
        jobId: job._id.toString(),
      });

      const persistedJob = await Job.findById(job._id).lean();
      const persistedApp = await Application.findById(created.id).lean();
      expect(persistedJob.status).toBe(JOB_STATUS.CLOSED);
      expect(persistedApp.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(persistedApp.status).not.toBe(persistedJob.status);
    });
  });

  describe("TX-01 version compatibility for stale Candidate mutations (BR-36)", () => {
    it("rejects stale Replace after Assignee revision advanced on APPLIED Application", async () => {
      mockSnapshotUpload(
        "jobhub/applications/submitted-cv-snapshots/v10-s02-stale-replace",
      );
      const { owner, recruiter, job, category } = await setupBaseline({
        emailPrefix: "v10.s02.stale.replace",
      });
      const { created } = await applyWithGeneratedCv({ owner, job, category });
      await assignAppliedApplication(created.id, recruiter.membership._id);

      const replacementCv = await createGeneratedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
        name: "Stale Replace",
      });

      await expect(
        replaceSubmittedCv({
          candidateUserId: owner._id,
          actorUser: owner,
          applicationId: created.id.toString(),
          candidateCvId: replacementCv._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(created.id).lean();
      expect(persisted.version).toBe(1);
      expect(persisted.assignedRecruiterCompanyMemberId.toString()).toBe(
        recruiter.membership._id.toString(),
      );
      expect(persisted.submittedCvSnapshot.name).not.toBe("Stale Replace");
    });
  });
});
