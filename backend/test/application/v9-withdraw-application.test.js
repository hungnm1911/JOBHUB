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
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import CV_LANGUAGE_PROFICIENCY from "../../src/constants/cv-language-proficiency.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Company from "../../src/models/company.model.js";
import Job from "../../src/models/job.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import {
  directApplyToJob,
  replaceSubmittedCv,
  withdrawApplication,
} from "../../src/services/application.service.js";
import * as fileService from "../../src/services/file.service.js";
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
  educations: [{ institutionName: "Example University", degree: "BSc", fieldOfStudy: "CS" }],
  skills: ["Node.js", "MongoDB"],
  workExperiences: [{ companyName: "Example Co", position: "Engineer", description: "Built APIs" }],
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

const setupBaseline = async () => {
  const candidate = await createVerifiedUser({ email: "withdraw.candidate@example.com" });
  const owner = candidate.user;
  const manager = await createActiveCompanyManagerContext({
    email: "withdraw.manager@example.com",
    businessRegistrationNumber: "BRN-V9-WITHDRAW",
  });
  const recruiter = await createActiveRecruiterContext({
    email: "withdraw.recruiter@example.com",
    company: manager.company,
    employeeCode: "NV-V9-WITHDRAW",
  });
  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: recruiter.membership._id,
  });
  const category = await createFieldCategory();

  return { owner, manager, recruiter, job, category };
};

describe("V9 Slice 05 — Withdraw Application (F05)", () => {
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

  it("withdraws own APPLIED Application and preserves identity/snapshot fields", async () => {
    vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
      publicId: "jobhub/applications/submitted-cv-snapshots/initial-snapshot",
    });

    const { owner, recruiter, job, category } = await setupBaseline();
    const initialCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      name: "Initial Generated",
      generatedContent: completeGeneratedContent("Initial Snapshot"),
    });
    const created = await directApplyToJob({
      candidateUserId: owner._id,
      actorUser: owner,
      jobId: job._id.toString(),
      candidateCvId: initialCv._id.toString(),
    });

    const withdrawn = await withdrawApplication({
      candidateUserId: owner._id,
      actorUser: owner,
      applicationId: created.id.toString(),
      expectedVersion: 0,
      withdrawReason: "Found another opportunity",
    });

    expect(withdrawn.id.toString()).toBe(created.id.toString());
    expect(withdrawn.source).toBe(APPLICATION_SOURCE.DIRECT_APPLICATION);
    expect(withdrawn.status).toBe(APPLICATION_STATUS.WITHDRAWN);
    expect(withdrawn.version).toBe(1);
    expect(withdrawn.withdrawnAt).toBeTruthy();
    expect(withdrawn.withdrawReason).toBe("Found another opportunity");
    expect(withdrawn.candidateUserId.toString()).toBe(owner._id.toString());
    expect(withdrawn.jobId.toString()).toBe(job._id.toString());
    expect(new Date(withdrawn.appliedAt).toISOString()).toBe(
      new Date(created.appliedAt).toISOString(),
    );
    expect(withdrawn.submittedCvSnapshot.sourceCandidateCvId.toString()).toBe(
      created.submittedCvSnapshot.sourceCandidateCvId.toString(),
    );

    const events = await NotificationEvent.find({
      applicationId: created.id,
      type: NOTIFICATION_TYPE.APPLICATION_WITHDRAWN,
    });
    expect(events).toHaveLength(1);
    expect(events[0].recipients).toHaveLength(1);
    expect(events[0].recipients[0].recipientUserId.toString()).toBe(
      recruiter.user._id.toString(),
    );
    expect(events[0].recipients[0].recipientUserId.toString()).not.toBe(
      owner._id.toString(),
    );
  });

  it("allows withdraw when Job is closed, expired, or owning Company is not ACTIVE", async () => {
    vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
      publicId: "jobhub/applications/submitted-cv-snapshots/initial-snapshot",
    });

    const { owner, manager, job, category } = await setupBaseline();
    const initialCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
    });
    const created = await directApplyToJob({
      candidateUserId: owner._id,
      actorUser: owner,
      jobId: job._id.toString(),
      candidateCvId: initialCv._id.toString(),
    });

    await Job.updateOne({ _id: job._id }, { status: JOB_STATUS.CLOSED });
    await expect(
      withdrawApplication({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        expectedVersion: 0,
        withdrawReason: null,
      }),
    ).resolves.toMatchObject({
      status: APPLICATION_STATUS.WITHDRAWN,
      version: 1,
    });

    await Application.updateOne(
      { _id: created.id },
      {
        $set: {
          status: APPLICATION_STATUS.APPLIED,
          withdrawnAt: null,
          withdrawReason: null,
          // Keep the V10 concurrency token monotonic when this regression
          // fixture restores APPLIED to exercise a second independent case.
          version: 1,
        },
      },
    );
    await Job.updateOne(
      { _id: job._id },
      { status: JOB_STATUS.PUBLISHED, applicationDeadline: PAST_DEADLINE() },
    );
    await Company.updateOne(
      { _id: manager.company._id },
      { operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED },
    );

    const withdrawnAgain = await withdrawApplication({
      candidateUserId: owner._id,
      actorUser: owner,
      applicationId: created.id.toString(),
      expectedVersion: 1,
      withdrawReason: undefined,
    });
    expect(withdrawnAgain.status).toBe(APPLICATION_STATUS.WITHDRAWN);
    expect(withdrawnAgain.version).toBe(2);
    expect(withdrawnAgain.withdrawReason).toBeNull();
  });

  it("enforces ownership, APPLIED guard, and no second withdraw", async () => {
    vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
      publicId: "jobhub/applications/submitted-cv-snapshots/initial-snapshot",
    });

    const { owner, job, category } = await setupBaseline();
    const outsider = await createVerifiedUser({ email: "withdraw.outsider@example.com" });
    const initialCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
    });
    const created = await directApplyToJob({
      candidateUserId: owner._id,
      actorUser: owner,
      jobId: job._id.toString(),
      candidateCvId: initialCv._id.toString(),
    });

    await expect(
      withdrawApplication({
        candidateUserId: outsider.user._id,
        actorUser: outsider.user,
        applicationId: created.id.toString(),
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    await withdrawApplication({
      candidateUserId: owner._id,
      actorUser: owner,
      applicationId: created.id.toString(),
      expectedVersion: 0,
    });

    await expect(
      withdrawApplication({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("allows only one concurrent withdraw from the same revision", async () => {
    vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
      publicId: "jobhub/applications/submitted-cv-snapshots/initial-snapshot",
    });

    const { owner, job, category } = await setupBaseline();
    const initialCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
    });
    const created = await directApplyToJob({
      candidateUserId: owner._id,
      actorUser: owner,
      jobId: job._id.toString(),
      candidateCvId: initialCv._id.toString(),
    });

    const outcomes = await Promise.allSettled([
      withdrawApplication({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        expectedVersion: 0,
      }),
      withdrawApplication({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        expectedVersion: 0,
      }),
    ]);

    const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
    const rejected = outcomes.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ statusCode: 409 });

    const persisted = await Application.findById(created.id).lean();
    expect(persisted.status).toBe(APPLICATION_STATUS.WITHDRAWN);
    expect(persisted.version).toBe(1);
  });

  it("excludes stale replace-vs-withdraw writes from the same revision", async () => {
    vi.spyOn(fileService, "uploadFileBuffer")
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/initial-snapshot",
      })
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/replaced-snapshot",
      });

    const { owner, job, category } = await setupBaseline();
    const initialCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      generatedContent: completeGeneratedContent("Initial"),
    });
    const replacementCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      generatedContent: completeGeneratedContent("Replacement"),
    });
    const created = await directApplyToJob({
      candidateUserId: owner._id,
      actorUser: owner,
      jobId: job._id.toString(),
      candidateCvId: initialCv._id.toString(),
    });

    const outcomes = await Promise.allSettled([
      replaceSubmittedCv({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        candidateCvId: replacementCv._id.toString(),
        expectedVersion: 0,
      }),
      withdrawApplication({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        expectedVersion: 0,
      }),
    ]);

    const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
    const rejected = outcomes.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ statusCode: 409 });

    const persisted = await Application.findById(created.id).lean();
    expect(persisted.version).toBe(1);
    if (persisted.status === APPLICATION_STATUS.WITHDRAWN) {
      expect(persisted.submittedCvSnapshot.sourceCandidateCvId.toString()).toBe(
        initialCv._id.toString(),
      );
    } else {
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(persisted.submittedCvSnapshot.sourceCandidateCvId.toString()).toBe(
        replacementCv._id.toString(),
      );
    }
  });

  it("exposes Candidate withdraw endpoint with CAS semantics", async () => {
    vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
      publicId: "jobhub/applications/submitted-cv-snapshots/initial-snapshot",
    });

    const { owner, job, category } = await setupBaseline();
    const initialCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
    });
    const created = await directApplyToJob({
      candidateUserId: owner._id,
      actorUser: owner,
      jobId: job._id.toString(),
      candidateCvId: initialCv._id.toString(),
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: owner.email,
    });

    const response = await agent
      .post(`/api/candidate/applications/${created.id}/withdraw`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        expectedVersion: 0,
        withdrawReason: "No longer interested",
      });
    expect(response.status).toBe(200);
    expect(response.body.application.status).toBe(APPLICATION_STATUS.WITHDRAWN);
    expect(response.body.application.version).toBe(1);

    const staleResponse = await agent
      .post(`/api/candidate/applications/${created.id}/withdraw`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        expectedVersion: 0,
      });
    expect(staleResponse.status).toBe(409);
  });
});
