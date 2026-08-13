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
import USER_ROLE from "../../src/constants/user-role.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Company from "../../src/models/company.model.js";
import Job from "../../src/models/job.model.js";
import { directApplyToJob } from "../../src/services/application.service.js";
import { saveOwnGeneratedContent } from "../../src/services/candidate-cv.service.js";
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

const completeGeneratedContent = (fullName = "Jane Candidate") => {
  return {
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
  };
};

const createGeneratedCv = async ({
  candidateUserId,
  categoryId,
  name = "Generated CV",
  status = CANDIDATE_CV_STATUS.ACTIVE,
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
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

const mockSnapshotUpload = () => {
  vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
    assetId: "asset-1",
    publicId: "jobhub/applications/submitted-cv-snapshots/snapshot.pdf",
    resourceType: "raw",
    deliveryType: "authenticated",
    format: "pdf",
    bytes: 2048,
    width: null,
    height: null,
    secureUrl: "https://example.invalid/snapshot.pdf",
    version: 1,
    assetFolder: "jobhub/applications/submitted-cv-snapshots",
  });
};

describe("V9 Slice 02 — Direct Apply with Generated ACTIVE CV (F01–F03)", () => {
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

  describe("happy path", () => {
    it("creates APPLIED Direct Application with captured Generated snapshot", async () => {
      mockSnapshotUpload();
      const { user } = await createVerifiedUser({
        email: "apply.happy@example.com",
      });
      const manager = await createActiveCompanyManagerContext({
        email: "manager.apply.happy@example.com",
        businessRegistrationNumber: "BRN-V9-APPLY-HAPPY",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.apply.happy@example.com",
        company: manager.company,
        employeeCode: "NV-V9-APPLY",
      });
      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: recruiter.membership._id,
      });
      const category = await createFieldCategory();
      const candidateCv = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Apply CV",
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        generatedContent: completeGeneratedContent("Captured Name"),
      });
      const jobBefore = await Job.findById(job._id).lean();
      const cvBefore = await CandidateCV.findById(candidateCv._id).lean();

      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const response = await agent
        .post("/api/candidate/applications")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          jobId: job._id.toString(),
          candidateCvId: candidateCv._id.toString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.application).toMatchObject({
        candidateUserId: user._id.toString(),
        jobId: job._id.toString(),
        source: APPLICATION_SOURCE.DIRECT_APPLICATION,
        status: APPLICATION_STATUS.APPLIED,
        version: 0,
        withdrawnAt: null,
        withdrawReason: null,
      });
      expect(
        response.body.application.submittedCvSnapshot.sourceCandidateCvId,
      ).toBe(candidateCv._id.toString());
      expect(response.body.application.submittedCvSnapshot.name).toBe("Apply CV");
      expect(response.body.application.submittedCvSnapshot.sourceType).toBe(
        CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      );
      expect(
        response.body.application.submittedCvSnapshot.generatedContent
          .personalInfo.fullName,
      ).toBe("Captured Name");
      expect(
        response.body.application.submittedCvSnapshot.pdfFile,
      ).toMatchObject({
        originalFileName: "Apply CV.pdf",
        mimeType: "application/pdf",
        pageCount: expect.any(Number),
        sizeBytes: expect.any(Number),
      });
      expect(
        response.body.application.submittedCvSnapshot.pdfFile,
      ).not.toHaveProperty("storageKey");

      const persisted = await Application.findOne({
        candidateUserId: user._id,
        jobId: job._id,
      }).lean();
      expect(persisted).toBeTruthy();
      expect(persisted.submittedCvSnapshot.pdfFile.storageKey).toBe(
        "jobhub/applications/submitted-cv-snapshots/snapshot.pdf",
      );
      expect(persisted).not.toHaveProperty("companyId");
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();

      const jobAfter = await Job.findById(job._id).lean();
      const cvAfter = await CandidateCV.findById(candidateCv._id).lean();
      expect(jobAfter).toEqual(jobBefore);
      expect(cvAfter).toEqual(cvBefore);
    });

    it("rejects Direct Apply when candidate supplies foreign CandidateCV (ownership guard)", async () => {
      mockSnapshotUpload();

      const { user: candidateA } = await createVerifiedUser({
        email: "apply.foreign-cv.candidate-a@example.com",
      });
      const candidateB = await createVerifiedUser({
        email: "apply.foreign-cv.candidate-b@example.com",
      });

      const manager = await createActiveCompanyManagerContext({
        email: "manager.apply.foreign-cv@example.com",
        businessRegistrationNumber: "BRN-V9-APPLY-FOREIGN-CV",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.apply.foreign-cv@example.com",
        company: manager.company,
        employeeCode: "NV-V9-APPLY-FOREIGN-CV",
      });
      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: recruiter.membership._id,
      });
      const category = await createFieldCategory();

      const foreignCandidateCv = await createGeneratedCv({
        candidateUserId: candidateB.user._id,
        categoryId: category._id,
        name: "Foreign Candidate Generated",
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        generatedContent: completeGeneratedContent("Foreign Candidate Name"),
      });

      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: candidateA.email,
      });

      const response = await agent
        .post("/api/candidate/applications")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          jobId: job._id.toString(),
          candidateCvId: foreignCandidateCv._id.toString(),
        });

      expect(response.status).toBe(404);

      const persisted = await Application.findOne({
        candidateUserId: candidateA._id,
        jobId: job._id,
      }).lean();
      expect(persisted).toBeNull();
    });
  });

  describe("authorization and eligibility rejection", () => {
    it("rejects non-Candidate actors and invalid CV/Job states", async () => {
      mockSnapshotUpload();
      const { user } = await createVerifiedUser({
        email: "apply.candidate@example.com",
      });
      const manager = await createActiveCompanyManagerContext({
        email: "manager.apply.reject@example.com",
        businessRegistrationNumber: "BRN-V9-APPLY-REJECT",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.apply.reject@example.com",
        company: manager.company,
        employeeCode: "NV-V9-REJECT",
      });
      const eligibleJob = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: recruiter.membership._id,
      });
      const category = await createFieldCategory();
      const activeCv = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
      });
      const draftCv = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Draft CV",
        status: CANDIDATE_CV_STATUS.DRAFT,
      });
      const archivedCv = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Archived CV",
        archivedAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const agent = createTestAgent();
      const candidateToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });
      const recruiterToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: recruiter.password,
      });

      const recruiterResponse = await agent
        .post("/api/candidate/applications")
        .set("Authorization", `Bearer ${recruiterToken}`)
        .send({
          jobId: eligibleJob._id.toString(),
          candidateCvId: activeCv._id.toString(),
        });
      expect(recruiterResponse.status).toBe(403);

      const draftResponse = await agent
        .post("/api/candidate/applications")
        .set("Authorization", `Bearer ${candidateToken}`)
        .send({
          jobId: eligibleJob._id.toString(),
          candidateCvId: draftCv._id.toString(),
        });
      expect(draftResponse.status).toBe(409);

      const archivedResponse = await agent
        .post("/api/candidate/applications")
        .set("Authorization", `Bearer ${candidateToken}`)
        .send({
          jobId: eligibleJob._id.toString(),
          candidateCvId: archivedCv._id.toString(),
        });
      expect(archivedResponse.status).toBe(409);

      const missingJobResponse = await agent
        .post("/api/candidate/applications")
        .set("Authorization", `Bearer ${candidateToken}`)
        .send({
          jobId: "65f000000000000000000001",
          candidateCvId: activeCv._id.toString(),
        });
      expect(missingJobResponse.status).toBe(404);

      const closedJob = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: recruiter.membership._id,
        title: "Closed Job",
      });
      await Job.updateOne(
        { _id: closedJob._id },
        { status: JOB_STATUS.CLOSED },
      );

      const closedJobResponse = await agent
        .post("/api/candidate/applications")
        .set("Authorization", `Bearer ${candidateToken}`)
        .send({
          jobId: closedJob._id.toString(),
          candidateCvId: activeCv._id.toString(),
        });
      expect(closedJobResponse.status).toBe(409);

      const expiredJob = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: recruiter.membership._id,
        applicationDeadline: PAST_DEADLINE(),
        title: "Expired Job",
      });

      const expiredJobResponse = await agent
        .post("/api/candidate/applications")
        .set("Authorization", `Bearer ${candidateToken}`)
        .send({
          jobId: expiredJob._id.toString(),
          candidateCvId: activeCv._id.toString(),
        });
      expect(expiredJobResponse.status).toBe(409);

      await Company.updateOne(
        { _id: manager.company._id },
        { operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED },
      );

      const inactiveCompanyResponse = await agent
        .post("/api/candidate/applications")
        .set("Authorization", `Bearer ${candidateToken}`)
        .send({
          jobId: eligibleJob._id.toString(),
          candidateCvId: activeCv._id.toString(),
        });
      expect(inactiveCompanyResponse.status).toBe(409);
    });
  });

  describe("snapshot independence and uniqueness", () => {
    it("keeps submitted snapshot unchanged after live Generated CV edits", async () => {
      mockSnapshotUpload();
      const { user } = await createVerifiedUser({
        email: "apply.snapshot@example.com",
      });
      const manager = await createActiveCompanyManagerContext({
        email: "manager.apply.snapshot@example.com",
        businessRegistrationNumber: "BRN-V9-SNAPSHOT",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.apply.snapshot@example.com",
        company: manager.company,
        employeeCode: "NV-V9-SNAPSHOT",
      });
      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: recruiter.membership._id,
      });
      const category = await createFieldCategory();
      const candidateCv = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        generatedContent: completeGeneratedContent("Snapshot Original"),
      });

      const application = await directApplyToJob({
        candidateUserId: user._id,
        actorUser: user,
        jobId: job._id.toString(),
        candidateCvId: candidateCv._id.toString(),
      });

      await saveOwnGeneratedContent({
        candidateUserId: user._id,
        actorUser: user,
        candidateCvId: candidateCv._id.toString(),
        generatedContent: completeGeneratedContent("Live Updated"),
      });

      const persisted = await Application.findById(application.id).lean();
      expect(
        persisted.submittedCvSnapshot.generatedContent.personalInfo.fullName,
      ).toBe("Snapshot Original");

      const liveCv = await CandidateCV.findById(candidateCv._id).lean();
      expect(liveCv.generatedContent.personalInfo.fullName).toBe("Live Updated");
    });

    it("allows only one Application per Candidate–Job under concurrent Apply", async () => {
      mockSnapshotUpload();
      const { user } = await createVerifiedUser({
        email: "apply.concurrent@example.com",
        role: USER_ROLE.CANDIDATE,
      });
      const manager = await createActiveCompanyManagerContext({
        email: "manager.apply.concurrent@example.com",
        businessRegistrationNumber: "BRN-V9-CONCURRENT",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.apply.concurrent@example.com",
        company: manager.company,
        employeeCode: "NV-V9-CONCURRENT",
      });
      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: recruiter.membership._id,
      });
      const category = await createFieldCategory();
      const candidateCv = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
      });

      const outcomes = await Promise.allSettled([
        directApplyToJob({
          candidateUserId: user._id,
          actorUser: user,
          jobId: job._id.toString(),
          candidateCvId: candidateCv._id.toString(),
        }),
        directApplyToJob({
          candidateUserId: user._id,
          actorUser: user,
          jobId: job._id.toString(),
          candidateCvId: candidateCv._id.toString(),
        }),
      ]);

      const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
      const rejected = outcomes.filter((result) => result.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({
        statusCode: 409,
      });

      const applications = await Application.find({
        candidateUserId: user._id,
        jobId: job._id,
      });
      expect(applications).toHaveLength(1);
    });
  });
});
