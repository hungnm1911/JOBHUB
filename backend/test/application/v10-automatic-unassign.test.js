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
import JOB_STATUS from "../../src/constants/job-status.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Job from "../../src/models/job.model.js";
import {
  automaticallyUnassignApplication,
  automaticallyUnassignCurrentResponsibilitiesOfRecruiter,
  firstAssignApplication,
  listRecruiterMyApplications,
  reassignApplication,
  replaceSubmittedCv,
  unassignApplication,
  updateApplicationRecruitmentPipelineStatus,
  withdrawApplication,
} from "../../src/services/application.service.js";
import * as fileService from "../../src/services/file.service.js";
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
const APPLIED_AT = new Date("2026-08-13T07:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-13T07:00:00.000Z");

const NON_TERMINAL_STATUSES = Object.freeze([
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
]);

const TERMINAL_STATUSES = Object.freeze([
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
]);

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-s06.pdf",
    originalFileName: "v10-s06.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 2,
  },
  capturedAt: CAPTURED_AT,
  ...overrides,
});

const completeGeneratedContent = (fullName = "Automatic Unassign Candidate") => ({
  personalInfo: {
    fullName,
    email: "auto-unassign@example.com",
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
  name = "Replacement Generated CV",
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
    generatedContent: completeGeneratedContent(),
  });
};

const mockSnapshotUpload = (publicId) => {
  vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({ publicId });
  vi.spyOn(fileService, "deleteFile").mockResolvedValue(undefined);
};

const createPublishedJob = async ({
  companyId,
  primaryMemberId,
  supportingMemberIds = [],
  title = "Backend Engineer",
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: FUTURE_DEADLINE(),
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

const createAssignedApplication = async ({
  candidateUserId,
  jobId,
  assigneeMemberId,
  status = APPLICATION_STATUS.APPLIED,
  version = 1,
  submittedCvSnapshot = buildUploadedSnapshot(),
}) => {
  const created = await Application.create({
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

  const update = {
    status,
    assignedRecruiterCompanyMemberId: assigneeMemberId,
    version,
  };

  if (status === APPLICATION_STATUS.WITHDRAWN) {
    update.withdrawnAt = new Date();
  }

  await Application.updateOne({ _id: created._id }, { $set: update });

  return Application.findById(created._id);
};

const setupCompanyWithTeam = async ({ emailPrefix = "v10.s06" } = {}) => {
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
  const supportingB = await createActiveRecruiterContext({
    email: `${emailPrefix}.supporting.b@example.com`,
    fullName: "Supporting Recruiter B",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-SB`,
    jobTitle: "Supporting Recruiter B",
  });

  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: primary.membership._id,
    supportingMemberIds: [
      supporting.membership._id,
      supportingB.membership._id,
    ],
  });

  const candidate = await createVerifiedUser({
    email: `${emailPrefix}.candidate@example.com`,
    fullName: "Automatic Unassign Candidate",
  });

  return {
    manager,
    primary,
    supporting,
    supportingB,
    job,
    candidate,
  };
};

const expectUnassignedPreservingIdentity = ({
  persisted,
  before,
  expectedStatus,
  expectedVersion,
}) => {
  expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
  expect(persisted.status).toBe(expectedStatus);
  expect(persisted.version).toBe(expectedVersion);
  expect(persisted.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
  expect(String(persisted.candidateUserId)).toBe(String(before.candidateUserId));
  expect(String(persisted.jobId)).toBe(String(before.jobId));
  expect(persisted.source).toBe(before.source);
};

describe("V10 Slice 06 — Canonical Automatic-Unassign Primitive (F04, F09, F11)", () => {
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

  describe("service — automaticallyUnassignApplication", () => {
    it.each(NON_TERMINAL_STATUSES)(
      "automatically Unassigns A → NONE from %s without changing status or identity (BR-10/BR-11/BR-17/BR-52)",
      async (status) => {
        const { supporting, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s06.auto.${status.toLowerCase()}`,
        });
        const snapshot = buildUploadedSnapshot({ name: `Auto Unassign ${status}` });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status,
          submittedCvSnapshot: snapshot,
        });
        const before = await Application.findById(application._id).lean();
        const teamBefore = await Job.findById(job._id).lean();

        const result = await automaticallyUnassignApplication({
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

        expect(result.assignedRecruiterCompanyMemberId).toBeNull();
        expect(result.status).toBe(status);
        expect(result.version).toBe(2);

        const persisted = await Application.findById(application._id).lean();
        expectUnassignedPreservingIdentity({
          persisted,
          before,
          expectedStatus: status,
          expectedVersion: 2,
        });

        const teamAfter = await Job.findById(job._id).lean();
        expect(String(teamAfter.primaryRecruiterCompanyMemberId)).toBe(
          String(teamBefore.primaryRecruiterCompanyMemberId),
        );
        expect(teamAfter.supportingRecruiterCompanyMemberIds.map(String)).toEqual(
          teamBefore.supportingRecruiterCompanyMemberIds.map(String),
        );
      },
    );

    it.each([JOB_STATUS.CLOSED, JOB_STATUS.EXPIRED])(
      "automatically Unassigns A → NONE on a %s Job without filtering by Job status (F09/BR-50)",
      async (jobStatus) => {
        const { supporting, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s06.auto.job.${jobStatus.toLowerCase()}`,
        });
        await Job.updateOne({ _id: job._id }, { $set: { status: jobStatus } });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status: APPLICATION_STATUS.INTERVIEW_COMPLETED,
        });

        const result = await automaticallyUnassignApplication({
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

        expect(result.status).toBe(APPLICATION_STATUS.INTERVIEW_COMPLETED);
        expect(result.assignedRecruiterCompanyMemberId).toBeNull();
        const persistedJob = await Job.findById(job._id).lean();
        expect(persistedJob.status).toBe(jobStatus);
      },
    );

    it("rejects automatic Unassign on terminal Applications and keeps the final Assignee (BR-17/BR-52)", async () => {
      for (const [index, status] of TERMINAL_STATUSES.entries()) {
        const { supporting, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s06.auto.term.${index}`,
        });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status,
        });

        await expect(
          automaticallyUnassignApplication({
            applicationId: application._id.toString(),
            expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
            expectedVersion: 1,
          }),
        ).rejects.toMatchObject({ statusCode: 409 });

        const persisted = await Application.findById(application._id).lean();
        expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
          supporting.membership._id.toString(),
        );
        expect(persisted.status).toBe(status);
        expect(persisted.version).toBe(1);
      }
    });

    it("rejects stale expected Assignee or version and does not clear a newer Assignee (BR-36/BR-37/TX-01)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s06.auto.stale",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      await expect(
        automaticallyUnassignApplication({
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );
      expect(persisted.version).toBe(2);
    });

    it("does not require a replacement Recruiter and does not persist A → B (BR-10/BR-52)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.auto.no.replacement",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.CONTACTED,
      });

      const result = await automaticallyUnassignApplication({
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      expect(result.assignedRecruiterCompanyMemberId).toBeNull();
      expect(result.status).toBe(APPLICATION_STATUS.CONTACTED);
      const persisted = await Application.findById(application._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
    });

    it("removes the Application from the outgoing Recruiter current workload (BR-33/BR-34)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.auto.workload",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.SCREENING,
      });

      const beforeMine = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });
      expect(
        beforeMine.applications.some(
          (item) => item.id === application._id.toString(),
        ),
      ).toBe(true);

      await automaticallyUnassignApplication({
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      const afterMine = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });
      expect(
        afterMine.applications.some(
          (item) => item.id === application._id.toString(),
        ),
      ).toBe(false);
    });
  });

  describe("concurrency — Assign / Reassign / Unassign", () => {
    it("allows only one winner when automatic Unassign and Reassign compete (BR-37/TX-01)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s06.race.reassign",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      const results = await Promise.allSettled([
        automaticallyUnassignApplication({
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
        reassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ]);

      const fulfilled = results.filter((item) => item.status === "fulfilled");
      const rejected = results.filter((item) => item.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.statusCode).toBe(409);

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.version).toBe(2);
      const winnerIsNone = persisted.assignedRecruiterCompanyMemberId == null;
      const winnerIsB =
        persisted.assignedRecruiterCompanyMemberId != null &&
        String(persisted.assignedRecruiterCompanyMemberId) ===
          supportingB.membership._id.toString();
      expect(winnerIsNone || winnerIsB).toBe(true);
    });

    it("allows only one winner when automatic Unassign and manual Unassign compete (BR-37/TX-01)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.race.manual.unassign",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      const results = await Promise.allSettled([
        automaticallyUnassignApplication({
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
        unassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ]);

      const fulfilled = results.filter((item) => item.status === "fulfilled");
      const rejected = results.filter((item) => item.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.statusCode).toBe(409);

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      expect(persisted.version).toBe(2);
    });

    it("does not let stale automatic Unassign clear an Assignee committed by Assign after A → NONE (BR-36/BR-37)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s06.race.assign.after",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      await automaticallyUnassignApplication({
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      await firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedVersion: 2,
      });

      await expect(
        automaticallyUnassignApplication({
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );
      expect(persisted.version).toBe(3);
    });
  });

  describe("concurrency — Pipeline", () => {
    it("preserves newer non-terminal status when Pipeline wins before automatic Unassign (BR-38)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.pipeline.then.auto",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.APPLIED,
      });

      await updateApplicationRecruitmentPipelineStatus({
        actorUser: supporting.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        targetStatus: APPLICATION_STATUS.SCREENING,
        expectedStatus: APPLICATION_STATUS.APPLIED,
        expectedVersion: 1,
      });

      await expect(
        automaticallyUnassignApplication({
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const retried = await automaticallyUnassignApplication({
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 2,
      });

      expect(retried.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(retried.assignedRecruiterCompanyMemberId).toBeNull();
      expect(retried.version).toBe(3);
    });

    it("blocks former Assignee Pipeline after automatic Unassign wins (BR-08/BR-38)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.auto.then.pipeline",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.APPLIED,
      });

      await automaticallyUnassignApplication({
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      await expect(
        updateApplicationRecruitmentPipelineStatus({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      expect(persisted.version).toBe(2);
    });

    it("allows only one winner when automatic Unassign and Pipeline compete (BR-38/TX-01)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.race.pipeline",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.APPLIED,
      });

      const results = await Promise.allSettled([
        automaticallyUnassignApplication({
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
        updateApplicationRecruitmentPipelineStatus({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        }),
      ]);

      const fulfilled = results.filter((item) => item.status === "fulfilled");
      const rejected = results.filter((item) => item.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.statusCode).toBe(409);

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.version).toBe(2);
      if (persisted.assignedRecruiterCompanyMemberId == null) {
        expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      } else {
        expect(persisted.status).toBe(APPLICATION_STATUS.SCREENING);
        expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
          supporting.membership._id.toString(),
        );
      }
    });
  });

  describe("concurrency — Replace / Withdraw at APPLIED", () => {
    it("keeps the newer snapshot when Replace wins; retry Unassign does not restore the old snapshot (BR-31/BR-36)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.replace.then.auto",
      });
      const category = await Category.create({
        name: "Software Engineering Auto Unassign",
        level: CATEGORY_LEVEL.FIELD,
        parentCategoryId: null,
      });
      const replacementCv = await createGeneratedCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
        name: "Latest Replacement CV",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        submittedCvSnapshot: buildUploadedSnapshot({ name: "Original Snapshot" }),
      });
      mockSnapshotUpload(
        "jobhub/applications/submitted-cv-snapshots/v10-s06-replace-wins",
      );

      const replaced = await replaceSubmittedCv({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id.toString(),
        candidateCvId: replacementCv._id.toString(),
        expectedVersion: 1,
      });
      expect(replaced.submittedCvSnapshot.name).toBe("Latest Replacement CV");

      await expect(
        automaticallyUnassignApplication({
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const retried = await automaticallyUnassignApplication({
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 2,
      });

      expect(retried.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(retried.assignedRecruiterCompanyMemberId).toBeNull();
      expect(retried.submittedCvSnapshot.name).toBe("Latest Replacement CV");
      expect(retried.version).toBe(3);
    });

    it("allows only one winner when automatic Unassign and Replace compete at APPLIED (BR-31/BR-36/TX-01)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.race.replace",
      });
      const category = await Category.create({
        name: "Software Engineering Race Replace",
        level: CATEGORY_LEVEL.FIELD,
        parentCategoryId: null,
      });
      const replacementCv = await createGeneratedCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
        name: "Race Replacement CV",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        submittedCvSnapshot: buildUploadedSnapshot({ name: "Original Snapshot" }),
      });
      mockSnapshotUpload(
        "jobhub/applications/submitted-cv-snapshots/v10-s06-replace-race",
      );

      const results = await Promise.allSettled([
        automaticallyUnassignApplication({
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
        replaceSubmittedCv({
          candidateUserId: candidate.user._id,
          actorUser: candidate.user,
          applicationId: application._id.toString(),
          candidateCvId: replacementCv._id.toString(),
          expectedVersion: 1,
        }),
      ]);

      const fulfilled = results.filter((item) => item.status === "fulfilled");
      const rejected = results.filter((item) => item.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.statusCode).toBe(409);

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.version).toBe(2);
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      if (persisted.assignedRecruiterCompanyMemberId == null) {
        expect(persisted.submittedCvSnapshot.name).toBe("Original Snapshot");
      } else {
        expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
          supporting.membership._id.toString(),
        );
        expect(persisted.submittedCvSnapshot.name).toBe("Race Replacement CV");
      }
    });

    it("keeps WITHDRAWN and the final Assignee when Withdraw wins before automatic Unassign (BR-17/BR-38)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.withdraw.then.auto",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      await withdrawApplication({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id.toString(),
        expectedVersion: 1,
      });

      await expect(
        automaticallyUnassignApplication({
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.status).toBe(APPLICATION_STATUS.WITHDRAWN);
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
      expect(persisted.version).toBe(2);
    });

    it("allows only one winner when automatic Unassign and Withdraw compete at APPLIED (BR-38/TX-01)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.race.withdraw",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      const results = await Promise.allSettled([
        automaticallyUnassignApplication({
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
        withdrawApplication({
          candidateUserId: candidate.user._id,
          actorUser: candidate.user,
          applicationId: application._id.toString(),
          expectedVersion: 1,
        }),
      ]);

      const fulfilled = results.filter((item) => item.status === "fulfilled");
      const rejected = results.filter((item) => item.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.statusCode).toBe(409);

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.version).toBe(2);
      if (persisted.status === APPLICATION_STATUS.WITHDRAWN) {
        expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
          supporting.membership._id.toString(),
        );
      } else {
        expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
        expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      }
    });
  });

  describe("TX-05 — multi-Application partial progress", () => {
    it("detaches Applications independently, keeps partial progress, and retries remaining current responsibilities without global rollback", async () => {
      const { primary, supporting, supportingB, job } = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.tx05.partial",
      });
      const first = await createVerifiedUser({
        email: "v10.s06.tx05.partial.candidate.1@example.com",
        fullName: "Candidate One",
      });
      const second = await createVerifiedUser({
        email: "v10.s06.tx05.partial.candidate.2@example.com",
        fullName: "Candidate Two",
      });
      const third = await createVerifiedUser({
        email: "v10.s06.tx05.partial.candidate.3@example.com",
        fullName: "Candidate Three",
      });
      const app1 = await createAssignedApplication({
        candidateUserId: first.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.APPLIED,
      });
      const app2 = await createAssignedApplication({
        candidateUserId: second.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.SCREENING,
      });
      const app3 = await createAssignedApplication({
        candidateUserId: third.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.CONTACTED,
      });

      await automaticallyUnassignApplication({
        applicationId: app1._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: app2._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      await expect(
        automaticallyUnassignApplication({
          applicationId: app3._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const afterPartial = await Promise.all(
        [app1, app2, app3].map((application) =>
          Application.findById(application._id).lean(),
        ),
      );
      expect(afterPartial[0].assignedRecruiterCompanyMemberId).toBeNull();
      expect(afterPartial[0].status).toBe(APPLICATION_STATUS.APPLIED);
      expect(String(afterPartial[1].assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );
      expect(afterPartial[1].status).toBe(APPLICATION_STATUS.SCREENING);
      expect(String(afterPartial[2].assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
      expect(afterPartial[2].status).toBe(APPLICATION_STATUS.CONTACTED);

      const firstPass =
        await automaticallyUnassignCurrentResponsibilitiesOfRecruiter({
          outgoingRecruiterCompanyMemberId: supporting.membership._id.toString(),
        });
      expect(firstPass.detached).toHaveLength(1);
      expect(firstPass.failed).toHaveLength(0);
      expect(String(firstPass.detached[0]._id)).toBe(String(app3._id));
      expect(firstPass.detached[0].assignedRecruiterCompanyMemberId).toBeNull();
      expect(firstPass.detached[0].status).toBe(APPLICATION_STATUS.CONTACTED);

      const retry =
        await automaticallyUnassignCurrentResponsibilitiesOfRecruiter({
          outgoingRecruiterCompanyMemberId: supporting.membership._id.toString(),
        });
      expect(retry.detached).toHaveLength(0);
      expect(retry.failed).toHaveLength(0);

      const afterRetry = await Promise.all(
        [app1, app2, app3].map((application) =>
          Application.findById(application._id).lean(),
        ),
      );
      expect(afterRetry[0].assignedRecruiterCompanyMemberId).toBeNull();
      expect(String(afterRetry[1].assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );
      expect(afterRetry[2].assignedRecruiterCompanyMemberId).toBeNull();
      expect(afterRetry[0].status).toBe(APPLICATION_STATUS.APPLIED);
      expect(afterRetry[1].status).toBe(APPLICATION_STATUS.SCREENING);
      expect(afterRetry[2].status).toBe(APPLICATION_STATUS.CONTACTED);
    });
  });
});
