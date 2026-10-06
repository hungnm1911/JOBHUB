import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import JOB_DISCOVERY_VISIBILITY from "../../src/constants/job-discovery-visibility.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import { migrate as migrateExperienceLevels } from "../../src/database/migrations/v4-experience-level-dataset.js";
import Company from "../../src/models/company.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job from "../../src/models/job.model.js";
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
import {
  provinceOnlyLocation,
  TEST_LOCATION,
} from "../helpers/location-provider.js";
import {
  createFieldCategory,
  createPositionCategory,
} from "../../src/services/category.service.js";

describe("V8 — Job Discovery", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  const seedCatalog = async () => {
    await migrateExperienceLevels();

    const engineering = await createFieldCategory({
      name: "Software Engineering",
    });
    const backend = await createPositionCategory({
      name: "Backend Engineer",
      parentCategoryId: engineering.id,
    });
    const frontend = await createPositionCategory({
      name: "Frontend Engineer",
      parentCategoryId: engineering.id,
    });
    const product = await createFieldCategory({
      name: "Product",
    });
    const productManager = await createPositionCategory({
      name: "Product Manager",
      parentCategoryId: product.id,
    });
    const experienceLevel = await ExperienceLevel.findOne({
      code: EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS,
    }).lean();

    return {
      engineering,
      backend,
      frontend,
      product,
      productManager,
      experienceLevelId: experienceLevel._id,
    };
  };

  const createJob = async ({
    company,
    recruiter,
    catalog,
    title = "Backend Engineer",
    jobDescription = "Build reliable recruitment APIs.",
    requiredSkills = ["Node.js", "MongoDB"],
    location = provinceOnlyLocation(TEST_LOCATION.HA_NOI),
    workModes = [WORK_MODE.HYBRID],
    employmentType = EMPLOYMENT_TYPE.FULL_TIME,
    applicationDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    publishedAt = new Date(),
    status = JOB_STATUS.PUBLISHED,
    fieldCategoryIds = [catalog.engineering.id],
    positionCategoryIds = [catalog.backend.id],
  } = {}) => {
    return Job.create({
      companyId: company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      primaryRecruiterCompanyMemberId: recruiter.membership._id,
      title,
      jobDescription,
      requiredSkills,
      salaryText: "Negotiable",
      fieldCategoryIds,
      positionCategoryIds,
      location,
      employmentType,
      workModes,
      experienceLevelId: catalog.experienceLevelId,
      applicationDeadline,
      publishedAt,
      status,
    });
  };

  const createBaseContext = async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "v8.manager@example.com",
      businessRegistrationNumber: "BRN-V8-BASE",
      name: "Acme Hiring",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "v8.recruiter@example.com",
      company: manager.company,
      employeeCode: "V8-R1",
    });
    const catalog = await seedCatalog();

    return {
      manager,
      recruiter,
      catalog,
      agent: createTestAgent(),
    };
  };

  it("lists only discoverable Jobs for Guest with the safe public projection", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    const newest = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Newest Backend Engineer",
      publishedAt: new Date("2026-06-20T00:00:00.000Z"),
    });
    await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Older Backend Engineer",
      publishedAt: new Date("2026-06-01T00:00:00.000Z"),
    });
    await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Past Deadline",
      applicationDeadline: new Date("2026-05-01T00:00:00.000Z"),
      publishedAt: new Date("2026-05-02T00:00:00.000Z"),
    });
    await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Closed Historical",
      status: JOB_STATUS.CLOSED,
      publishedAt: new Date("2026-05-03T00:00:00.000Z"),
    });
    await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Draft",
      status: JOB_STATUS.DRAFT,
      publishedAt: null,
    });

    const response = await agent.get("/api/job-discovery/jobs");

    expect(response.status).toBe(200);
    expect(response.body.sort).toBe("NEWEST");
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 2,
    });
    expect(response.body.jobs.map((job) => job.id)).toEqual([
      newest._id.toString(),
      expect.any(String),
    ]);
    expect(response.body.jobs[0]).toMatchObject({
      id: newest._id.toString(),
      title: "Newest Backend Engineer",
      effectiveState: JOB_DISCOVERY_VISIBILITY.DISCOVERABLE,
      isHistoricalReadOnly: false,
      isAcceptingApplications: true,
      company: {
        id: manager.company._id.toString(),
        name: "Acme Hiring",
      },
    });
    expect(response.body.jobs[0]).not.toHaveProperty(
      "createdByCompanyMemberId",
    );
    expect(response.body.jobs[0]).not.toHaveProperty(
      "primaryRecruiterCompanyMemberId",
    );
  });

  it("combines keyword, catalog filters, category branches, and AND/OR semantics", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    const backendJob = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Platform API Engineer",
      requiredSkills: ["Node.js"],
      location: provinceOnlyLocation(TEST_LOCATION.HA_NOI),
      workModes: [WORK_MODE.REMOTE],
    });
    await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Frontend Engineer",
      requiredSkills: ["React"],
      location: provinceOnlyLocation(TEST_LOCATION.HO_CHI_MINH),
      fieldCategoryIds: [catalog.engineering.id],
      positionCategoryIds: [catalog.frontend.id],
    });
    await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Product Manager",
      requiredSkills: ["Roadmaps"],
      fieldCategoryIds: [catalog.product.id],
      positionCategoryIds: [catalog.productManager.id],
    });

    const response = await agent
      .get("/api/job-discovery/jobs")
      .query({
        keyword: "platform",
        categories: JSON.stringify({
          [catalog.engineering.id]: [catalog.backend.id],
        }),
        workModes: WORK_MODE.REMOTE,
      });

    expect(response.status).toBe(200);
    expect(response.body.jobs).toHaveLength(1);
    expect(response.body.jobs[0].id).toBe(backendJob._id.toString());
    expect(response.body.sort).toBe("RELEVANCE");
  });

  it("supports EXPIRING_SOON and normalizes RELEVANCE without a keyword to NEWEST", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    const now = Date.now();
    const expiring = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Expiring Soon",
      applicationDeadline: new Date(now + 5 * 24 * 60 * 60 * 1000),
      publishedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
    });
    await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Later Deadline",
      applicationDeadline: new Date(now + 20 * 24 * 60 * 60 * 1000),
      publishedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
    });

    const expiringResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ sort: "EXPIRING_SOON" });

    expect(expiringResponse.status).toBe(200);
    expect(expiringResponse.body.jobs[0].id).toBe(expiring._id.toString());

    const relevanceResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ sort: "RELEVANCE" });

    expect(relevanceResponse.status).toBe(200);
    expect(relevanceResponse.body.sort).toBe("NEWEST");
  });

  it("allows public and historical detail but hides inaccessible Jobs", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    const discoverable = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Open Backend Engineer",
      applicationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      publishedAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    const pastDeadline = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Past Deadline Backend Engineer",
      applicationDeadline: new Date("2026-05-01T00:00:00.000Z"),
      publishedAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    const nullDeadline = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Missing Deadline Backend Engineer",
      applicationDeadline: null,
      publishedAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    const unpublished = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Unpublished Backend Engineer",
      publishedAt: null,
    });
    const closed = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Historical Backend Engineer",
      status: JOB_STATUS.CLOSED,
      publishedAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    const expired = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Expired Backend Engineer",
      status: JOB_STATUS.EXPIRED,
      publishedAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    const discoverableResponse = await agent.get(
      `/api/job-discovery/jobs/${discoverable._id}`,
    );
    const pastDeadlineResponse = await agent.get(
      `/api/job-discovery/jobs/${pastDeadline._id}`,
    );
    const nullDeadlineResponse = await agent.get(
      `/api/job-discovery/jobs/${nullDeadline._id}`,
    );
    const unpublishedResponse = await agent.get(
      `/api/job-discovery/jobs/${unpublished._id}`,
    );
    const closedResponse = await agent.get(
      `/api/job-discovery/jobs/${closed._id}`,
    );
    const expiredResponse = await agent.get(
      `/api/job-discovery/jobs/${expired._id}`,
    );

    expect(discoverableResponse.status).toBe(200);
    expect(discoverableResponse.body.job).toMatchObject({
      title: "Open Backend Engineer",
      effectiveState: JOB_DISCOVERY_VISIBILITY.DISCOVERABLE,
      isHistoricalReadOnly: false,
      isAcceptingApplications: true,
      jobDescription: "Build reliable recruitment APIs.",
    });

    expect(pastDeadlineResponse.status).toBe(200);
    expect(pastDeadlineResponse.body.job).toMatchObject({
      title: "Past Deadline Backend Engineer",
      effectiveState: JOB_DISCOVERY_VISIBILITY.HISTORICAL_READ_ONLY,
      isHistoricalReadOnly: true,
      isAcceptingApplications: false,
    });

    expect(nullDeadlineResponse.status).toBe(404);
    expect(unpublishedResponse.status).toBe(404);

    expect(closedResponse.status).toBe(200);
    expect(closedResponse.body.job).toMatchObject({
      title: "Historical Backend Engineer",
      effectiveState: JOB_DISCOVERY_VISIBILITY.HISTORICAL_READ_ONLY,
      isHistoricalReadOnly: true,
      isAcceptingApplications: false,
      jobDescription: "Build reliable recruitment APIs.",
    });
    expect(closedResponse.body.job).not.toHaveProperty(
      "createdByCompanyMemberId",
    );

    expect(expiredResponse.status).toBe(200);
    expect(expiredResponse.body.job).toMatchObject({
      title: "Expired Backend Engineer",
      effectiveState: JOB_DISCOVERY_VISIBILITY.HISTORICAL_READ_ONLY,
      isHistoricalReadOnly: true,
      isAcceptingApplications: false,
    });
  });

  it("blocks public access when the owning Company is not ACTIVE", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    const job = await createJob({
      company: manager.company,
      recruiter,
      catalog,
    });

    await Company.findByIdAndUpdate(manager.company._id, {
      operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
    });

    const detailResponse = await agent.get(
      `/api/job-discovery/jobs/${job._id}`,
    );
    const companyResponse = await agent.get(
      `/api/job-discovery/companies/${manager.company._id}`,
    );

    expect(detailResponse.status).toBe(404);
    expect(companyResponse.status).toBe(404);
  });

  it("returns only public Company information", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    await createJob({
      company: manager.company,
      recruiter,
      catalog,
    });

    const response = await agent.get(
      `/api/job-discovery/companies/${manager.company._id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.company).toMatchObject({
      id: manager.company._id.toString(),
      name: "Acme Hiring",
    });
    expect(response.body.company).not.toHaveProperty("businessRegistrationNumber");
    expect(response.body.company).not.toHaveProperty("approvalStatus");
    expect(response.body.company).not.toHaveProperty("operationalStatus");
    expect(response.body.company).not.toHaveProperty("managerUserId");
  });

  it("allows Candidate, Recruiter, and Platform Admin but rejects Company Manager", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    await createJob({
      company: manager.company,
      recruiter,
      catalog,
    });
    const candidate = await createVerifiedUser({
      email: "v8.candidate@example.com",
    });
    const admin = await createVerifiedUser({
      email: "v8.admin@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    const candidateToken = await loginAndGetAccessToken(agent, {
      email: candidate.user.email,
    });
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
    });
    const adminToken = await loginAndGetAccessToken(agent, {
      email: admin.user.email,
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
    });

    for (const token of [candidateToken, recruiterToken, adminToken]) {
      const response = await agent
        .get("/api/job-discovery/jobs")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    }

    const managerResponse = await agent
      .get("/api/job-discovery/jobs")
      .set("Authorization", `Bearer ${managerToken}`);
    const invalidTokenResponse = await agent
      .get("/api/job-discovery/jobs")
      .set("Authorization", "Bearer invalid-token");

    expect(managerResponse.status).toBe(403);
    expect(invalidTokenResponse.status).toBe(401);
  });

  it("rejects an invalid Position-to-Field category selection", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    await createJob({
      company: manager.company,
      recruiter,
      catalog,
    });

    const response = await agent
      .get("/api/job-discovery/jobs")
      .query({
        categories: JSON.stringify({
          [catalog.engineering.id]: [catalog.productManager.id],
        }),
      });

    expect(response.status).toBe(400);
  });
});
