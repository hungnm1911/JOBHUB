import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  isApplicationUnassigned,
  listPrimaryJobApplications,
} from "../../src/services/application.service.js";
import { hashPassword } from "../../src/utils/hash-password.js";
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
const APPLIED_AT = new Date("2026-08-13T06:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-13T06:00:00.000Z");

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-s03.pdf",
    originalFileName: "v10-s03.pdf",
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

const createDirectApplication = async ({
  candidateUserId,
  jobId,
  status = APPLICATION_STATUS.APPLIED,
  assignedRecruiterCompanyMemberId = null,
  appliedAt = APPLIED_AT,
  submittedCvSnapshot = buildUploadedSnapshot(),
  version = 0,
}) => {
  const created = await Application.create({
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot,
    appliedAt,
    withdrawnAt: null,
    withdrawReason: null,
    assignedRecruiterCompanyMemberId: null,
    version: 0,
  });

  if (
    status === APPLICATION_STATUS.APPLIED &&
    assignedRecruiterCompanyMemberId == null &&
    version === 0
  ) {
    return created;
  }

  await Application.updateOne(
    { _id: created._id },
    {
      $set: {
        status,
        assignedRecruiterCompanyMemberId,
        version,
      },
    },
  );

  return Application.findById(created._id);
};

const insertLegacyMissingAssigneeApplication = async ({
  candidateUserId,
  jobId,
  appliedAt = APPLIED_AT,
  submittedCvSnapshot = buildUploadedSnapshot(),
}) => {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot,
    appliedAt,
    withdrawnAt: null,
    withdrawReason: null,
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await Application.collection.insertOne(doc);
  return doc;
};

const setupCompanyWithPrimary = async ({ emailPrefix = "v10.s03" } = {}) => {
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
  const peerPrimary = await createActiveRecruiterContext({
    email: `${emailPrefix}.peer@example.com`,
    fullName: "Peer Primary",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-PEER`,
    jobTitle: "Peer Recruiter",
  });

  const jobA = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: primary.membership._id,
    supportingMemberIds: [supporting.membership._id],
    title: "Job A",
  });
  const jobB = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: peerPrimary.membership._id,
    title: "Job B",
  });

  return { manager, primary, supporting, peerPrimary, jobA, jobB };
};

describe("V10 Slice 03 — Unassigned Applications and Primary Application View (F01)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("service — listPrimaryJobApplications", () => {
    it("lets current Primary view Assigned and Unassigned Applications of the managed Job (BR-03/BR-05)", async () => {
      const { primary, supporting, jobA } = await setupCompanyWithPrimary();
      const candidateUnassigned = await createVerifiedUser({
        email: "cand.unassigned@example.com",
        fullName: "Unassigned Candidate",
      });
      const candidateAssigned = await createVerifiedUser({
        email: "cand.assigned@example.com",
        fullName: "Assigned Candidate",
      });

      const unassigned = await createDirectApplication({
        candidateUserId: candidateUnassigned.user._id,
        jobId: jobA._id,
        assignedRecruiterCompanyMemberId: null,
      });
      const assigned = await createDirectApplication({
        candidateUserId: candidateAssigned.user._id,
        jobId: jobA._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
        appliedAt: new Date(APPLIED_AT.getTime() + 1_000),
      });

      const result = await listPrimaryJobApplications({
        actorUser: primary.user,
        jobId: jobA._id.toString(),
      });

      expect(result.job.id).toBe(jobA._id.toString());
      expect(result.job.title).toBe("Job A");
      expect(result.applications).toHaveLength(2);

      const unassignedView = result.applications.find(
        (item) => item.id === unassigned._id.toString(),
      );
      const assignedView = result.applications.find(
        (item) => item.id === assigned._id.toString(),
      );

      expect(unassignedView).toMatchObject({
        status: APPLICATION_STATUS.APPLIED,
        assignedRecruiterCompanyMemberId: null,
        isUnassigned: true,
        assignedRecruiter: null,
        source: APPLICATION_SOURCE.DIRECT_APPLICATION,
      });
      expect(unassignedView.candidate).toMatchObject({
        id: candidateUnassigned.user._id.toString(),
        fullName: "Unassigned Candidate",
      });
      expect(unassignedView.submittedCvSnapshot).toMatchObject({
        name: "Submitted CV Snapshot",
        sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
        pdfFile: {
          originalFileName: "v10-s03.pdf",
          mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        },
      });
      expect(unassignedView.submittedCvSnapshot.pdfFile.storageKey).toBeUndefined();
      expect(unassignedView.appliedAt).toEqual(APPLIED_AT);

      expect(assignedView).toMatchObject({
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id.toString(),
        isUnassigned: false,
      });
      expect(assignedView.assignedRecruiter).toMatchObject({
        companyMemberId: supporting.membership._id.toString(),
        fullName: "Supporting Recruiter",
        jobTitle: "Supporting Recruiter",
      });
      expect(assignedView.candidate.fullName).toBe("Assigned Candidate");
    });

    it("treats legacy missing assignee field as Unassigned (BR-05 / PI-05)", async () => {
      const { primary, jobA } = await setupCompanyWithPrimary({
        emailPrefix: "v10.s03.legacy",
      });
      const candidate = await createVerifiedUser({
        email: "cand.legacy@example.com",
      });

      const legacy = await insertLegacyMissingAssigneeApplication({
        candidateUserId: candidate.user._id,
        jobId: jobA._id,
      });

      const persisted = await Application.collection.findOne({
        _id: legacy._id,
      });
      expect(persisted).not.toHaveProperty("assignedRecruiterCompanyMemberId");
      expect(isApplicationUnassigned(persisted)).toBe(true);

      const result = await listPrimaryJobApplications({
        actorUser: primary.user,
        jobId: jobA._id.toString(),
      });

      expect(result.applications).toHaveLength(1);
      expect(result.applications[0]).toMatchObject({
        id: legacy._id.toString(),
        assignedRecruiterCompanyMemberId: null,
        isUnassigned: true,
        assignedRecruiter: null,
        status: APPLICATION_STATUS.APPLIED,
      });
    });

    it("denies Supporting Recruiter Primary Application View", async () => {
      const { supporting, jobA } = await setupCompanyWithPrimary({
        emailPrefix: "v10.s03.supp",
      });

      await expect(
        listPrimaryJobApplications({
          actorUser: supporting.user,
          jobId: jobA._id.toString(),
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("denies Primary of Job A from viewing Applications of Job B", async () => {
      const { primary, peerPrimary, jobA, jobB } = await setupCompanyWithPrimary({
        emailPrefix: "v10.s03.jobb",
      });
      const candidate = await createVerifiedUser({
        email: "cand.jobb@example.com",
      });
      await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: jobB._id,
      });

      await expect(
        listPrimaryJobApplications({
          actorUser: primary.user,
          jobId: jobB._id.toString(),
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      const ownJob = await listPrimaryJobApplications({
        actorUser: peerPrimary.user,
        jobId: jobB._id.toString(),
      });
      expect(ownJob.applications).toHaveLength(1);

      const emptyOwn = await listPrimaryJobApplications({
        actorUser: primary.user,
        jobId: jobA._id.toString(),
      });
      expect(emptyOwn.applications).toHaveLength(0);
    });

    it("denies Recruiter from another Company (BR-40)", async () => {
      const { jobA } = await setupCompanyWithPrimary({
        emailPrefix: "v10.s03.tenant.a",
      });
      const other = await setupCompanyWithPrimary({
        emailPrefix: "v10.s03.tenant.b",
      });

      await expect(
        listPrimaryJobApplications({
          actorUser: other.primary.user,
          jobId: jobA._id.toString(),
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("exposes submittedCvSnapshot without granting CandidateCV library access (BR-31)", async () => {
      const { primary, jobA } = await setupCompanyWithPrimary({
        emailPrefix: "v10.s03.cv",
      });
      const candidate = await createVerifiedUser({
        email: "cand.cvlib@example.com",
      });
      const category = await Category.create({
        name: "Software Engineering",
        level: CATEGORY_LEVEL.FIELD,
        parentCategoryId: null,
      });
      const liveCv = await CandidateCV.create({
        candidateUserId: candidate.user._id,
        name: "Private Live CV",
        sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
        status: CANDIDATE_CV_STATUS.ACTIVE,
        visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
        categoryId: category._id,
        experienceLevelId: null,
        preferredLocations: [],
        skillTags: [],
        employmentTypes: [],
        workModes: [],
        isDefault: false,
        archivedAt: null,
        generatedContent: {
          personalInfo: {
            fullName: "Private Live CV",
            email: null,
            phone: null,
            displayLocation: null,
            links: [],
            avatarUrl: null,
          },
          professionalSummary: null,
          educations: [],
          skills: [],
          workExperiences: [],
          projects: [],
          certifications: [],
          languages: [],
          hiddenSections: [],
        },
      });
      const sourceCandidateCvId = new mongoose.Types.ObjectId();
      await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: jobA._id,
        submittedCvSnapshot: buildUploadedSnapshot({
          sourceCandidateCvId,
          name: "Only Snapshot",
        }),
      });

      const result = await listPrimaryJobApplications({
        actorUser: primary.user,
        jobId: jobA._id.toString(),
      });

      expect(result.applications[0].submittedCvSnapshot.name).toBe("Only Snapshot");
      expect(
        String(result.applications[0].submittedCvSnapshot.sourceCandidateCvId),
      ).toBe(sourceCandidateCvId.toString());
      expect(result.applications[0]).not.toHaveProperty("candidateCvs");
      expect(JSON.stringify(result)).not.toContain(liveCv._id.toString());
      expect(JSON.stringify(result)).not.toContain("Private Live CV");
    });

    it("does not mutate Application state on read", async () => {
      const { primary, supporting, jobA } = await setupCompanyWithPrimary({
        emailPrefix: "v10.s03.readonly",
      });
      const candidate = await createVerifiedUser({
        email: "cand.readonly@example.com",
      });
      const created = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: jobA._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 3,
      });

      const before = await Application.findById(created._id).lean();

      await listPrimaryJobApplications({
        actorUser: primary.user,
        jobId: jobA._id.toString(),
      });

      const after = await Application.findById(created._id).lean();

      expect(after.status).toBe(before.status);
      expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
        String(before.assignedRecruiterCompanyMemberId),
      );
      expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
      expect(String(after.candidateUserId)).toBe(String(before.candidateUserId));
      expect(String(after.jobId)).toBe(String(before.jobId));
      expect(after.source).toBe(before.source);
      expect(after.version).toBe(before.version);
      expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    });
  });

  describe("HTTP — GET /api/jobs/:jobId/applications", () => {
    it("returns Primary Application View for authenticated current Primary", async () => {
      const agent = createTestAgent();
      const { primary, jobA } = await setupCompanyWithPrimary({
        emailPrefix: "v10.s03.http",
      });
      const candidate = await createVerifiedUser({
        email: "cand.http@example.com",
        fullName: "HTTP Candidate",
      });
      await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: jobA._id,
      });

      const token = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/jobs/${jobA._id}/applications`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.job.id).toBe(jobA._id.toString());
      expect(response.body.applications).toHaveLength(1);
      expect(response.body.applications[0]).toMatchObject({
        isUnassigned: true,
        candidate: { fullName: "HTTP Candidate" },
        status: APPLICATION_STATUS.APPLIED,
      });
    });

    it("blocks Supporting, Candidate, and Platform Admin", async () => {
      const agent = createTestAgent();
      const { manager, supporting, jobA } = await setupCompanyWithPrimary({
        emailPrefix: "v10.s03.http.deny",
      });
      const candidate = await createVerifiedUser({
        email: "cand.deny@example.com",
      });
      const platformAdmin = await User.create({
        fullName: "Platform Admin",
        email: "pa.v10.s03@example.com",
        passwordHash: await hashPassword(DEFAULT_PASSWORD),
        role: USER_ROLE.PLATFORM_ADMIN,
        status: USER_STATUS.ACTIVE,
        emailVerifiedAt: new Date(),
        mustChangePassword: false,
      });

      const supportingToken = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
      });
      const managerToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
      });
      const candidateToken = await loginAndGetAccessToken(agent, {
        email: candidate.user.email,
      });
      const adminToken = await loginAndGetAccessToken(agent, {
        email: platformAdmin.email,
      });

      const supportingRes = await agent
        .get(`/api/jobs/${jobA._id}/applications`)
        .set("Authorization", `Bearer ${supportingToken}`);
      const managerRes = await agent
        .get(`/api/jobs/${jobA._id}/applications`)
        .set("Authorization", `Bearer ${managerToken}`);
      const candidateRes = await agent
        .get(`/api/jobs/${jobA._id}/applications`)
        .set("Authorization", `Bearer ${candidateToken}`);
      const adminRes = await agent
        .get(`/api/jobs/${jobA._id}/applications`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(supportingRes.status).toBe(403);
      expect(managerRes.status).toBe(200);
      expect(candidateRes.status).toBe(403);
      expect(adminRes.status).toBe(403);
    });

    it("does not open Candidate My CVs to Primary via Application read (BR-31)", async () => {
      const agent = createTestAgent();
      const { primary, jobA } = await setupCompanyWithPrimary({
        emailPrefix: "v10.s03.http.cv",
      });
      const candidate = await createVerifiedUser({
        email: "cand.http.cv@example.com",
      });
      const category = await Category.create({
        name: "Data",
        level: CATEGORY_LEVEL.FIELD,
        parentCategoryId: null,
      });
      await CandidateCV.create({
        candidateUserId: candidate.user._id,
        name: "Library CV",
        sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
        status: CANDIDATE_CV_STATUS.ACTIVE,
        visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
        categoryId: category._id,
        experienceLevelId: null,
        preferredLocations: [],
        skillTags: [],
        employmentTypes: [],
        workModes: [],
        isDefault: false,
        archivedAt: null,
        generatedContent: {
          personalInfo: {
            fullName: "Library CV",
            email: null,
            phone: null,
            displayLocation: null,
            links: [],
            avatarUrl: null,
          },
          professionalSummary: null,
          educations: [],
          skills: [],
          workExperiences: [],
          projects: [],
          certifications: [],
          languages: [],
          hiddenSections: [],
        },
      });
      await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: jobA._id,
      });

      const token = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
      });

      const applicationsRes = await agent
        .get(`/api/jobs/${jobA._id}/applications`)
        .set("Authorization", `Bearer ${token}`);
      expect(applicationsRes.status).toBe(200);
      expect(applicationsRes.body.applications[0].submittedCvSnapshot).toBeTruthy();

      const libraryRes = await agent
        .get("/api/candidate/cvs")
        .set("Authorization", `Bearer ${token}`);
      expect(libraryRes.status).toBe(403);
    });
  });
});
