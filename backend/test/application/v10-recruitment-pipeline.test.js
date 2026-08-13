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
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import CV_LANGUAGE_PROFICIENCY from "../../src/constants/cv-language-proficiency.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  reassignApplication,
  replaceSubmittedCv,
  updateApplicationRecruitmentPipelineStatus,
  withdrawApplication,
} from "../../src/services/application.service.js";
import * as fileService from "../../src/services/file.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  DEFAULT_PASSWORD,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const APPLIED_AT = new Date("2026-08-13T07:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-13T07:00:00.000Z");

const FORWARD_TRANSITIONS = Object.freeze([
  [APPLICATION_STATUS.APPLIED, APPLICATION_STATUS.SCREENING],
  [APPLICATION_STATUS.SCREENING, APPLICATION_STATUS.CONTACTED],
  [APPLICATION_STATUS.CONTACTED, APPLICATION_STATUS.INTERVIEW_SCHEDULED],
  [
    APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    APPLICATION_STATUS.INTERVIEW_COMPLETED,
  ],
  [APPLICATION_STATUS.INTERVIEW_COMPLETED, APPLICATION_STATUS.HIRED],
]);

const REJECT_FROM_STATUSES = Object.freeze([
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
    storageKey: "applications/submitted-cv-snapshots/v10-s10.pdf",
    originalFileName: "v10-s10.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 2,
  },
  capturedAt: CAPTURED_AT,
  ...overrides,
});

const createPublishedJob = async ({
  companyId,
  primaryMemberId,
  supportingMemberIds = [],
  title = "Backend Engineer",
  status = JOB_STATUS.PUBLISHED,
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status,
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

const setupCompanyWithTeam = async ({ emailPrefix = "v10.s10" } = {}) => {
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
    fullName: "Pipeline Candidate",
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

const completeGeneratedContent = (fullName = "Pipeline Candidate") => ({
  personalInfo: {
    fullName,
    email: "pipeline@example.com",
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

describe("V10 Slice 10 — Recruitment Pipeline (F05, F09 partial)", () => {
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

  describe("service — forward and reject transitions", () => {
    it.each(FORWARD_TRANSITIONS)(
      "lets eligible Assignee transition %s → %s",
      async (fromStatus, toStatus) => {
        const { supporting, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s10.fwd.${fromStatus.toLowerCase()}`,
        });
        const snapshot = buildUploadedSnapshot({ name: "Keep Snapshot" });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status: fromStatus,
          submittedCvSnapshot: snapshot,
        });

        const result = await updateApplicationRecruitmentPipelineStatus({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: toStatus,
          expectedStatus: fromStatus,
          expectedVersion: 1,
        });

        expect(result.application).toMatchObject({
          id: application._id.toString(),
          status: toStatus,
          assignedRecruiterCompanyMemberId: supporting.membership._id.toString(),
          version: 2,
          source: APPLICATION_SOURCE.DIRECT_APPLICATION,
        });
        expect(result.application.submittedCvSnapshot.name).toBe("Keep Snapshot");

        const persisted = await Application.findById(application._id).lean();
        expect(persisted.status).toBe(toStatus);
        expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
          supporting.membership._id.toString(),
        );
        expect(persisted.submittedCvSnapshot.name).toBe("Keep Snapshot");
        expect(String(persisted.candidateUserId)).toBe(
          candidate.user._id.toString(),
        );
        expect(String(persisted.jobId)).toBe(job._id.toString());
        expect(persisted.source).toBe(APPLICATION_SOURCE.DIRECT_APPLICATION);
        expect(persisted.version).toBe(2);
        expect(persisted).not.toHaveProperty("screenedAt");
        expect(persisted).not.toHaveProperty("rejectedAt");
        expect(persisted).not.toHaveProperty("hiredAt");
        expect(persisted).not.toHaveProperty("statusHistory");
      },
    );

    it.each(REJECT_FROM_STATUSES)(
      "lets eligible Assignee reject from %s",
      async (fromStatus) => {
        const { primary, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s10.rej.${fromStatus.toLowerCase()}`,
        });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: primary.membership._id,
          status: fromStatus,
        });

        const result = await updateApplicationRecruitmentPipelineStatus({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.REJECTED,
          expectedStatus: fromStatus,
          expectedVersion: 1,
        });

        expect(result.application.status).toBe(APPLICATION_STATUS.REJECTED);
        expect(result.application.assignedRecruiterCompanyMemberId).toBe(
          primary.membership._id.toString(),
        );
        expect(result.application.version).toBe(2);
      },
    );

    it("rejects skip transitions (BR-21)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.skip",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.APPLIED,
      });

      await expect(
        updateApplicationRecruitmentPipelineStatus({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.CONTACTED,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        details: { field: "targetStatus" },
      });
    });

    it("rejects backward transitions (BR-24)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.back",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.SCREENING,
      });

      await expect(
        updateApplicationRecruitmentPipelineStatus({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.APPLIED,
          expectedStatus: APPLICATION_STATUS.SCREENING,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        details: { field: "targetStatus" },
      });
    });

    it.each(TERMINAL_STATUSES)(
      "rejects reopen / further pipeline from terminal %s (BR-20)",
      async (terminalStatus) => {
        const { supporting, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s10.term.${terminalStatus.toLowerCase()}`,
        });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status: terminalStatus,
        });

        await expect(
          updateApplicationRecruitmentPipelineStatus({
            actorUser: supporting.user,
            jobId: job._id.toString(),
            applicationId: application._id.toString(),
            targetStatus: APPLICATION_STATUS.SCREENING,
            expectedStatus: terminalStatus,
            expectedVersion: 1,
          }),
        ).rejects.toMatchObject({ statusCode: 409 });
      },
    );

    it("rejects WITHDRAWN as a Recruiter Pipeline target (BR-23)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.no.withdraw",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.APPLIED,
      });

      await expect(
        updateApplicationRecruitmentPipelineStatus({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.WITHDRAWN,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        details: { field: "targetStatus" },
      });
    });
  });

  describe("service — authority and continuous eligibility", () => {
    it("rejects Primary who is not the current Assignee (BR-18/BR-19)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.primary.not.assignee",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      await expect(
        updateApplicationRecruitmentPipelineStatus({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        details: { field: "role" },
      });
    });

    it("lets Supporting process only Applications assigned to themselves", async () => {
      const { supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s10.supporting.self",
        });
      const ownApplication = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      const otherCandidate = await createVerifiedUser({
        email: "v10.s10.supporting.self.other@example.com",
        fullName: "Other Candidate",
      });
      const otherApplication = await createAssignedApplication({
        candidateUserId: otherCandidate.user._id,
        jobId: job._id,
        assigneeMemberId: supportingB.membership._id,
      });

      const ownResult = await updateApplicationRecruitmentPipelineStatus({
        actorUser: supporting.user,
        jobId: job._id.toString(),
        applicationId: ownApplication._id.toString(),
        targetStatus: APPLICATION_STATUS.SCREENING,
        expectedStatus: APPLICATION_STATUS.APPLIED,
        expectedVersion: 1,
      });
      expect(ownResult.application.status).toBe(APPLICATION_STATUS.SCREENING);

      await expect(
        updateApplicationRecruitmentPipelineStatus({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: otherApplication._id.toString(),
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("blocks former Assignee after Reassign (BR-38)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s10.former",
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
        updateApplicationRecruitmentPipelineStatus({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );
    });

    it("rejects off-team Assignee processing (BR-08)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.offteam",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      await Job.updateOne(
        { _id: job._id },
        { $pull: { supportingRecruiterCompanyMemberIds: supporting.membership._id } },
      );

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
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
    });

    it("rejects inactive CompanyMember processing (BR-08)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.member.inactive",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      await CompanyMember.updateOne(
        { _id: supporting.membership._id },
        { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
      );

      await expect(
        updateApplicationRecruitmentPipelineStatus({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects inactive User processing (BR-08)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.user.inactive",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      await User.updateOne(
        { _id: supporting.user._id },
        { $set: { status: USER_STATUS.LOCKED } },
      );

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
    });

    it("Company lock freezes processing without mutating Application (BR-08)", async () => {
      const { supporting, job, candidate, manager } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.company.lock",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.SCREENING,
      });
      await Company.updateOne(
        { _id: manager.company._id },
        { $set: { operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED } },
      );

      await expect(
        updateApplicationRecruitmentPipelineStatus({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.CONTACTED,
          expectedStatus: APPLICATION_STATUS.SCREENING,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
      expect(persisted.version).toBe(1);
    });
  });

  describe("service — CLOSED / EXPIRED Job continuity (F09 / BR-30)", () => {
    it.each([JOB_STATUS.CLOSED, JOB_STATUS.EXPIRED])(
      "continues Pipeline on existing Application when Job is %s",
      async (jobStatus) => {
        const { supporting, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s10.job.${jobStatus.toLowerCase()}`,
        });
        await Job.updateOne({ _id: job._id }, { $set: { status: jobStatus } });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status: APPLICATION_STATUS.CONTACTED,
        });

        const result = await updateApplicationRecruitmentPipelineStatus({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
          expectedStatus: APPLICATION_STATUS.CONTACTED,
          expectedVersion: 1,
        });

        expect(result.application.status).toBe(
          APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        );
        expect(result.job.status).toBe(jobStatus);
      },
    );
  });

  describe("service — concurrency races (TX-01 / BR-36 / BR-38 / BR-39)", () => {
    it("Reassign ↔ Pipeline: Reassign winner blocks stale Pipeline", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s10.race.reassign.wins",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      const results = await Promise.allSettled([
        reassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
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
      // Loser may fail as stale CAS (409) or lost-assignee authority (403).
      expect([403, 409]).toContain(rejected[0].reason.statusCode);

      const persisted = await Application.findById(application._id).lean();
      if (
        String(persisted.assignedRecruiterCompanyMemberId) ===
        supportingB.membership._id.toString()
      ) {
        expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      } else {
        expect(persisted.status).toBe(APPLICATION_STATUS.SCREENING);
        expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
          supporting.membership._id.toString(),
        );
      }
      expect(persisted.version).toBe(2);
    });

    it("preserves Pipeline status when Pipeline wins before stale Reassign; retry works", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s10.race.pipeline.wins",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
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
        reassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const afterStale = await Application.findById(application._id).lean();
      expect(afterStale.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(String(afterStale.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );

      const retried = await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 2,
      });

      expect(retried.application.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(retried.application.assignedRecruiterCompanyMemberId).toBe(
        supportingB.membership._id.toString(),
      );
    });

    it("Replace CV ↔ APPLIED→SCREENING: SCREENING winner locks Replace", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.race.screening.wins",
      });
      const category = await Category.create({
        name: "Software Engineering",
        level: CATEGORY_LEVEL.FIELD,
        parentCategoryId: null,
      });
      const replacementCv = await createGeneratedCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        submittedCvSnapshot: buildUploadedSnapshot({ name: "Original Snapshot" }),
      });
      mockSnapshotUpload(
        "jobhub/applications/submitted-cv-snapshots/v10-s10-screening-wins",
      );

      await updateApplicationRecruitmentPipelineStatus({
        actorUser: supporting.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        targetStatus: APPLICATION_STATUS.SCREENING,
        expectedStatus: APPLICATION_STATUS.APPLIED,
        expectedVersion: 1,
      });

      await expect(
        replaceSubmittedCv({
          candidateUserId: candidate.user._id,
          actorUser: candidate.user,
          applicationId: application._id.toString(),
          candidateCvId: replacementCv._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(persisted.submittedCvSnapshot.name).toBe("Original Snapshot");
    });

    it("Replace CV ↔ APPLIED→SCREENING: Replace winner keeps snapshot; stale SCREENING fails", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.race.replace.wins",
      });
      const category = await Category.create({
        name: "Software Engineering Replace",
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
        "jobhub/applications/submitted-cv-snapshots/v10-s10-replace-wins",
      );

      const replaced = await replaceSubmittedCv({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id.toString(),
        candidateCvId: replacementCv._id.toString(),
        expectedVersion: 1,
      });
      expect(replaced.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(replaced.submittedCvSnapshot.name).toBe("Latest Replacement CV");
      expect(replaced.version).toBe(2);

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
      expect(persisted.submittedCvSnapshot.name).toBe("Latest Replacement CV");
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
      expect(persisted.version).toBe(2);

      const screeningRetry = await updateApplicationRecruitmentPipelineStatus({
        actorUser: supporting.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        targetStatus: APPLICATION_STATUS.SCREENING,
        expectedStatus: APPLICATION_STATUS.APPLIED,
        expectedVersion: 2,
      });
      expect(screeningRetry.application.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(screeningRetry.application.submittedCvSnapshot.name).toBe(
        "Latest Replacement CV",
      );
    });

    it("Withdraw ↔ APPLIED→SCREENING: Withdraw winner blocks SCREENING", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.race.withdraw.wins",
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
      expect(persisted.status).toBe(APPLICATION_STATUS.WITHDRAWN);
    });

    it("Withdraw ↔ APPLIED→SCREENING: SCREENING winner locks Withdraw", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.race.screening.locks.withdraw",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
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
        withdrawApplication({
          candidateUserId: candidate.user._id,
          actorUser: candidate.user,
          applicationId: application._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.status).toBe(APPLICATION_STATUS.SCREENING);
    });
  });

  describe("HTTP — POST /api/jobs/:jobId/applications/:applicationId/pipeline", () => {
    it("advances Pipeline for authenticated current Assignee", async () => {
      const agent = createTestAgent();
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.http.ok",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/pipeline`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.application.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(response.body.application.assignedRecruiterCompanyMemberId).toBe(
        supporting.membership._id.toString(),
      );
    });

    it("rejects Company Manager Pipeline authority at HTTP boundary", async () => {
      const agent = createTestAgent();
      const { manager, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.http.cm",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/pipeline`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        });

      expect(response.status).toBe(403);
    });

    it("rejects Candidate Pipeline authority at HTTP boundary", async () => {
      const agent = createTestAgent();
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.http.candidate",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: candidate.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/pipeline`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        });

      expect(response.status).toBe(403);
    });

    it("rejects Primary who is not Assignee via HTTP", async () => {
      const agent = createTestAgent();
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s10.http.primary",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/pipeline`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        });

      expect(response.status).toBe(403);
    });
  });
});
