import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import { migrate as migrateExperienceLevels } from "../../src/database/migrations/v4-experience-level-dataset.js";
import Category from "../../src/models/category.model.js";
import Company from "../../src/models/company.model.js";
import Application from "../../src/models/application.model.js";
import Job from "../../src/models/job.model.js";
import SavedJob from "../../src/models/saved-job.model.js";
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
import { provinceOnlyLocation, stubLocationProvider } from "../helpers/location-provider.js";

describe("V16 Saved Jobs", () => {
  let agent;
  let manager;
  let recruiter;
  let catalog;
  let candidate;
  let candidateToken;
  let job;

  const createJob = async (overrides = {}) => {
    return Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      primaryRecruiterCompanyMemberId: recruiter.membership._id,
      title: overrides.title ?? "Backend Engineer",
      jobDescription: "Build recruitment APIs",
      requiredSkills: ["Node.js"],
      salary: { type: "NEGOTIABLE" },
      fieldCategoryIds: [catalog.field._id],
      positionCategoryIds: [catalog.position._id],
      location: provinceOnlyLocation(),
      employmentType: EMPLOYMENT_TYPE.FULL_TIME,
      workModes: [WORK_MODE.HYBRID],
      experienceLevelId: catalog.experienceLevelId,
      applicationDeadline: overrides.applicationDeadline ?? new Date(Date.now() + 86_400_000),
      publishedAt: overrides.publishedAt ?? new Date(),
      status: overrides.status ?? JOB_STATUS.PUBLISHED,
    });
  };

  beforeAll(async () => {
    await connectTestDatabase();
    await migrateExperienceLevels();
  });

  beforeEach(async () => {
    stubLocationProvider();
    await migrateExperienceLevels();
    agent = createTestAgent();
    manager = await createActiveCompanyManagerContext({
      email: `v16-manager-${Date.now()}@example.com`,
      businessRegistrationNumber: `V16-${Date.now()}`,
    });
    recruiter = await createActiveRecruiterContext({
      email: `v16-recruiter-${Date.now()}@example.com`,
      company: manager.company,
      employeeCode: `V16-${Date.now()}`,
    });
    const field = await Category.create({
      name: "Software Engineering",
      level: CATEGORY_LEVEL.FIELD,
      parentCategoryId: null,
    });
    const position = await Category.create({
      name: "Backend Engineer",
      level: CATEGORY_LEVEL.POSITION,
      parentCategoryId: field._id,
    });
    const experienceLevel = await mongoose.model("ExperienceLevel").findOne({
      code: EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS,
    });
    catalog = { field, position, experienceLevelId: experienceLevel._id };
    candidate = await createVerifiedUser({
      email: `v16-candidate-${Date.now()}@example.com`,
      role: USER_ROLE.CANDIDATE,
    });
    candidateToken = await loginAndGetAccessToken(agent, {
      email: candidate.user.email,
      password: candidate.password,
    });
    job = await createJob();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("saves idempotently and preserves savedAt", async () => {
    const first = await agent
      .put(`/api/candidate/saved-jobs/${job._id}`)
      .set("Authorization", `Bearer ${candidateToken}`)
      .expect(200);
    const savedAt = first.body.savedAt;
    await agent
      .put(`/api/candidate/saved-jobs/${job._id}`)
      .set("Authorization", `Bearer ${candidateToken}`)
      .expect(200);
    const records = await SavedJob.find({ candidateUserId: candidate.user._id });
    expect(records).toHaveLength(1);
    expect(records[0].savedAt.toISOString()).toBe(new Date(savedAt).toISOString());
  });

  it("normalizes concurrent saves to one record", async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        agent
          .put(`/api/candidate/saved-jobs/${job._id}`)
          .set("Authorization", `Bearer ${candidateToken}`),
      ),
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(await SavedJob.countDocuments({ candidateUserId: candidate.user._id, jobId: job._id })).toBe(1);
  });

  it("unsaves idempotently", async () => {
    await agent.put(`/api/candidate/saved-jobs/${job._id}`).set("Authorization", `Bearer ${candidateToken}`);
    await agent.delete(`/api/candidate/saved-jobs/${job._id}`).set("Authorization", `Bearer ${candidateToken}`).expect(200);
    await agent.delete(`/api/candidate/saved-jobs/${job._id}`).set("Authorization", `Bearer ${candidateToken}`).expect(200);
    expect(await SavedJob.countDocuments({ candidateUserId: candidate.user._id })).toBe(0);
  });

  it("enforces authentication and Candidate role", async () => {
    await agent.put(`/api/candidate/saved-jobs/${job._id}`).expect(401);
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: recruiter.password,
    });
    await agent.put(`/api/candidate/saved-jobs/${job._id}`).set("Authorization", `Bearer ${recruiterToken}`).expect(403);
  });

  it("isolates candidates and sorts by savedAt descending", async () => {
    const secondJob = await createJob({ title: "Frontend Engineer" });
    await SavedJob.create({ candidateUserId: candidate.user._id, jobId: job._id, savedAt: new Date("2026-01-01") });
    await SavedJob.create({ candidateUserId: candidate.user._id, jobId: secondJob._id, savedAt: new Date("2026-02-01") });
    const other = await createVerifiedUser({ email: `v16-other-${Date.now()}@example.com` });
    await SavedJob.create({ candidateUserId: other.user._id, jobId: job._id });
    const response = await agent.get("/api/candidate/saved-jobs").set("Authorization", `Bearer ${candidateToken}`).expect(200);
    expect(response.body.savedJobs.map((entry) => entry.job.id)).toEqual([secondJob._id.toString(), job._id.toString()]);
  });

  it("does not expose another Candidate's Saved Jobs", async () => {
    await SavedJob.create({ candidateUserId: candidate.user._id, jobId: job._id });
    const other = await createVerifiedUser({ email: `v16-isolated-${Date.now()}@example.com` });
    const otherToken = await loginAndGetAccessToken(agent, { email: other.user.email, password: other.password });
    const response = await agent.get("/api/candidate/saved-jobs").set("Authorization", `Bearer ${otherToken}`).expect(200);
    expect(response.body.savedJobs).toEqual([]);
  });

  it.each([
    [JOB_STATUS.CLOSED, "CLOSED"],
    [JOB_STATUS.EXPIRED, "EXPIRED"],
  ])("keeps historical %s jobs", async (status, expectedStatus) => {
    await SavedJob.create({ candidateUserId: candidate.user._id, jobId: job._id });
    await Job.updateOne({ _id: job._id }, { $set: { status } });
    const response = await agent.get("/api/candidate/saved-jobs").set("Authorization", `Bearer ${candidateToken}`).expect(200);
    expect(response.body.savedJobs[0].job.status).toBe(expectedStatus);
  });

  it("filters an inaccessible Job without deleting the SavedJob", async () => {
    await SavedJob.create({ candidateUserId: candidate.user._id, jobId: job._id });
    await Company.updateOne({ _id: manager.company._id }, { $set: { operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED } });
    const response = await agent.get("/api/candidate/saved-jobs").set("Authorization", `Bearer ${candidateToken}`).expect(200);
    expect(response.body.savedJobs).toEqual([]);
    expect(await SavedJob.exists({ candidateUserId: candidate.user._id, jobId: job._id })).not.toBeNull();
  });

  it("reports hasApplication false when no Application exists", async () => {
    await SavedJob.create({ candidateUserId: candidate.user._id, jobId: job._id });
    const response = await agent.get("/api/candidate/saved-jobs").set("Authorization", `Bearer ${candidateToken}`).expect(200);
    expect(response.body.savedJobs[0].hasApplication).toBe(false);
  });

  it("reports hasApplication true from Application existence", async () => {
    await SavedJob.create({ candidateUserId: candidate.user._id, jobId: job._id });
    await Application.create({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      source: APPLICATION_SOURCE.DIRECT_APPLICATION,
      status: APPLICATION_STATUS.APPLIED,
      appliedAt: new Date(),
      assignedRecruiterCompanyMemberId: null,
      version: 0,
      submittedCvSnapshot: {
        sourceCandidateCvId: new mongoose.Types.ObjectId(),
        name: "Uploaded CV",
        sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
        capturedAt: new Date(),
        pdfFile: {
          storageKey: "test.pdf",
          originalFileName: "test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1,
          pageCount: 1,
        },
      },
    });
    const response = await agent.get("/api/candidate/saved-jobs").set("Authorization", `Bearer ${candidateToken}`).expect(200);
    expect(response.body.savedJobs[0].hasApplication).toBe(true);
  });

  it("adds isSaved to Discovery and Detail and removes it after unsave", async () => {
    const list = () => agent.get("/api/job-discovery/jobs").set("Authorization", `Bearer ${candidateToken}`);
    expect((await list()).body.jobs.find((entry) => entry.id === job._id.toString()).isSaved).toBe(false);
    await agent.put(`/api/candidate/saved-jobs/${job._id}`).set("Authorization", `Bearer ${candidateToken}`);
    expect((await list()).body.jobs.find((entry) => entry.id === job._id.toString()).isSaved).toBe(true);
    expect((await agent.get(`/api/job-discovery/jobs/${job._id}`).set("Authorization", `Bearer ${candidateToken}`)).body.job.isSaved).toBe(true);
    await agent.delete(`/api/candidate/saved-jobs/${job._id}`).set("Authorization", `Bearer ${candidateToken}`);
    expect((await list()).body.jobs.find((entry) => entry.id === job._id.toString()).isSaved).toBe(false);
  });

  it("cleans SavedJobs before hard deleting a pre-publication Job", async () => {
    const draft = await Job.findByIdAndUpdate(job._id, { $set: { status: JOB_STATUS.DRAFT, publishedAt: null } }, { new: true });
    await SavedJob.create({ candidateUserId: candidate.user._id, jobId: draft._id });
    const recruiterToken = await loginAndGetAccessToken(agent, { email: recruiter.user.email, password: recruiter.password });
    await agent.delete(`/api/jobs/${draft._id}`).set("Authorization", `Bearer ${recruiterToken}`).expect(200);
    expect(await Job.exists({ _id: draft._id })).toBeNull();
    expect(await SavedJob.exists({ jobId: draft._id })).toBeNull();
  });
});
