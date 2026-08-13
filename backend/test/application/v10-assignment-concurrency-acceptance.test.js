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
  firstAssignApplication,
  reassignApplication,
  replaceSubmittedCv,
  unassignApplication,
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
const APPLIED_AT = new Date("2026-08-14T00:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-14T00:00:00.000Z");

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

const completeGeneratedContent = (fullName = "Slice 10 Candidate") => ({
  personalInfo: {
    fullName,
    email: "slice10@example.com",
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
    isDefault: false,
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

  await Application.updateOne(
    { _id: created._id },
    {
      $set: {
        status,
        assignedRecruiterCompanyMemberId: assigneeMemberId,
        version,
      },
    },
  );

  return Application.findById(created._id);
};

const createUnassignedApplication = async ({
  candidateUserId,
  jobId,
  status = APPLICATION_STATUS.APPLIED,
}) => {
  const created = await Application.create({
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot: buildUploadedSnapshot(),
    appliedAt: APPLIED_AT,
    withdrawnAt: null,
    withdrawReason: null,
    assignedRecruiterCompanyMemberId: null,
    version: 0,
  });

  if (status !== APPLICATION_STATUS.APPLIED) {
    await Application.updateOne(
      { _id: created._id },
      { $set: { status, version: 0 } },
    );
  }

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
    fullName: "Slice 10 Candidate",
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

describe("V10 Slice 10 — Assignment concurrency closure (TX-01 gaps)", () => {
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

  it("Assign ↔ Reassign: Assign after Unassign wins over stale Reassign (BR-36/BR-37/TX-01)", async () => {
    const { primary, supporting, supportingB, job, candidate } =
      await setupCompanyWithTeam({
        emailPrefix: "v10.s10.assign.reassign",
      });
    const application = await createAssignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: supporting.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });

    await unassignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    const results = await Promise.allSettled([
      firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedVersion: 2,
      }),
      reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
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
    expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
      supportingB.membership._id.toString(),
    );
    expect(persisted.status).toBe(APPLICATION_STATUS.SCREENING);
    expect(persisted.version).toBe(3);
  });

  it("Assign ↔ Unassign: Assign after A → NONE is not cleared by stale Unassign (BR-36/BR-37/TX-01)", async () => {
    const { primary, supporting, supportingB, job, candidate } =
      await setupCompanyWithTeam({
        emailPrefix: "v10.s10.assign.unassign",
      });
    const application = await createAssignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: supporting.membership._id,
      status: APPLICATION_STATUS.CONTACTED,
    });

    await unassignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    const results = await Promise.allSettled([
      firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedVersion: 2,
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
    expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
      supportingB.membership._id.toString(),
    );
    expect(persisted.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(persisted.version).toBe(3);
  });

  it("allows only one winner when concurrent Assign and Unassign start from Assigned (BR-37/TX-01)", async () => {
    const { primary, supporting, supportingB, job, candidate } =
      await setupCompanyWithTeam({
        emailPrefix: "v10.s10.concurrent.assign.unassign",
      });
    const application = await createAssignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: supporting.membership._id,
    });

    const results = await Promise.allSettled([
      firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
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
    expect(fulfilled[0].value.application.isUnassigned).toBe(true);

    const persisted = await Application.findById(application._id).lean();
    expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
    expect(persisted.version).toBe(2);
  });

  it("allows only one winner when manual Unassign and Replace compete at APPLIED (BR-31/BR-36/TX-01)", async () => {
    const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
      emailPrefix: "v10.s10.manual.unassign.replace",
    });
    const category = await Category.create({
      name: "Software Engineering Slice 10 Replace",
      level: CATEGORY_LEVEL.FIELD,
      parentCategoryId: null,
    });
    const replacementCv = await createGeneratedCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "Manual Unassign Race Replacement CV",
    });
    const application = await createAssignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: supporting.membership._id,
      submittedCvSnapshot: buildUploadedSnapshot({ name: "Original Snapshot" }),
    });
    mockSnapshotUpload(
      "jobhub/applications/submitted-cv-snapshots/v10-s10-replace-race",
    );

    const results = await Promise.allSettled([
      unassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
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
      expect(persisted.submittedCvSnapshot.name).toBe(
        "Manual Unassign Race Replacement CV",
      );
    }
  });

  it("allows only one winner when manual Unassign and Withdraw compete at APPLIED (BR-23/BR-38/TX-01)", async () => {
    const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
      emailPrefix: "v10.s10.manual.unassign.withdraw",
    });
    const application = await createAssignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: supporting.membership._id,
    });

    const results = await Promise.allSettled([
      unassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
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

  it("keeps WITHDRAWN final Assignee when Withdraw wins before manual Unassign (BR-17/BR-20/BR-38)", async () => {
    const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
      emailPrefix: "v10.s10.withdraw.then.unassign",
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
      unassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
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

  it("Assign again continues from current Recruitment Status after Unassign (BR-03/BR-11)", async () => {
    const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
      emailPrefix: "v10.s10.assign.again.status",
    });
    const unassigned = await createUnassignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      status: APPLICATION_STATUS.INTERVIEW_COMPLETED,
    });

    const assigned = await firstAssignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: unassigned._id.toString(),
      assigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 0,
    });
    expect(assigned.application.status).toBe(
      APPLICATION_STATUS.INTERVIEW_COMPLETED,
    );

    await unassignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: unassigned._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    const reassigned = await firstAssignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: unassigned._id.toString(),
      assigneeCompanyMemberId: primary.membership._id.toString(),
      expectedVersion: 2,
    });

    expect(reassigned.application.status).toBe(
      APPLICATION_STATUS.INTERVIEW_COMPLETED,
    );
    expect(reassigned.application.assignedRecruiterCompanyMemberId).toBe(
      primary.membership._id.toString(),
    );
  });
});
