import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
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
      salary: { type: "NEGOTIABLE" },
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

  const createSecondCompanyContext = async ({ name, suffix }) => {
    const manager = await createActiveCompanyManagerContext({
      email: `v8.manager.${suffix}@example.com`,
      businessRegistrationNumber: `BRN-V8-${suffix}`,
      name,
    });
    const recruiter = await createActiveRecruiterContext({
      email: `v8.recruiter.${suffix}@example.com`,
      company: manager.company,
      employeeCode: `V8-${suffix}`,
    });

    return { manager, recruiter };
  };

  // BR-16 / BR-31: keyword scope and business priority
  // title > requiredSkills > Company name > jobDescription.
  it("matches keyword in all four scopes and ranks by business priority under default RELEVANCE", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    const orbit = await createSecondCompanyContext({
      name: "Orbit Labs",
      suffix: "ORBIT",
    });
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Oldest publish time has the highest priority, so NEWEST would invert
    // the order and cannot satisfy the RELEVANCE assertion by accident.
    const titleMatch = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Orbit Platform Engineer",
      publishedAt: new Date(now - 4 * day),
    });
    const skillMatch = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Platform Engineer",
      requiredSkills: ["Orbit"],
      publishedAt: new Date(now - 3 * day),
    });
    const companyMatch = await createJob({
      company: orbit.manager.company,
      recruiter: orbit.recruiter,
      catalog,
      title: "Platform Engineer",
      publishedAt: new Date(now - 2 * day),
    });
    const descriptionMatch = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Platform Engineer",
      jobDescription: "Works on orbit systems.",
      publishedAt: new Date(now - 1 * day),
    });
    await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Unrelated Engineer",
      publishedAt: new Date(now),
    });

    const expectedRelevanceOrder = [
      titleMatch,
      skillMatch,
      companyMatch,
      descriptionMatch,
    ].map((job) => job._id.toString());

    const relevanceResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ keyword: "orbit" });

    expect(relevanceResponse.status).toBe(200);
    expect(relevanceResponse.body.sort).toBe("RELEVANCE");
    expect(relevanceResponse.body.jobs.map((job) => job.id)).toEqual(
      expectedRelevanceOrder,
    );

    const explicitRelevanceResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ keyword: "orbit", sort: "RELEVANCE" });

    expect(explicitRelevanceResponse.body.jobs.map((job) => job.id)).toEqual(
      expectedRelevanceOrder,
    );

    const newestResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ keyword: "orbit", sort: "NEWEST" });

    expect(newestResponse.status).toBe(200);
    expect(newestResponse.body.sort).toBe("NEWEST");
    expect(newestResponse.body.jobs.map((job) => job.id)).toEqual(
      [...expectedRelevanceOrder].reverse(),
    );
  });

  // BR-20 / BR-22 / BR-23: Field branches are alternatives and a Field without
  // Position matches any Job of that Field.
  it("treats Category Field branches as OR alternatives and allows a Field without Position", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    const backendJob = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Backend Role",
      fieldCategoryIds: [catalog.engineering.id],
      positionCategoryIds: [catalog.backend.id],
    });
    const frontendJob = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Frontend Role",
      fieldCategoryIds: [catalog.engineering.id],
      positionCategoryIds: [catalog.frontend.id],
    });
    const productJob = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Product Role",
      fieldCategoryIds: [catalog.product.id],
      positionCategoryIds: [catalog.productManager.id],
    });

    const idsFor = async (categories) => {
      const response = await agent
        .get("/api/job-discovery/jobs")
        .query({ categories: JSON.stringify(categories) });

      expect(response.status).toBe(200);

      return response.body.jobs.map((job) => job.id).sort();
    };

    expect(
      await idsFor({ [catalog.engineering.id]: [] }),
    ).toEqual([backendJob._id.toString(), frontendJob._id.toString()].sort());

    expect(
      await idsFor({
        [catalog.engineering.id]: [catalog.backend.id],
        [catalog.product.id]: [],
      }),
    ).toEqual([backendJob._id.toString(), productJob._id.toString()].sort());

    expect(
      await idsFor({
        [catalog.engineering.id]: [catalog.backend.id, catalog.frontend.id],
      }),
    ).toEqual([backendJob._id.toString(), frontendJob._id.toString()].sort());
  });

  // BR-13 / BR-17: a non-ACTIVE Company is removed from list, search, and
  // filter results as well as from detail and Company information.
  it("excludes Jobs of a non-ACTIVE Company from list, search, and filter results", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    const locked = await createSecondCompanyContext({
      name: "Locked Co",
      suffix: "LOCKED",
    });
    const activeJob = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      title: "Active Platform Engineer",
    });
    await createJob({
      company: locked.manager.company,
      recruiter: locked.recruiter,
      catalog,
      title: "Locked Platform Engineer",
    });

    const beforeLock = await agent
      .get("/api/job-discovery/jobs")
      .query({ keyword: "platform" });

    expect(beforeLock.body.jobs).toHaveLength(2);

    await Company.findByIdAndUpdate(locked.manager.company._id, {
      operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
    });

    const queries = [
      {},
      { keyword: "platform" },
      { keyword: "Locked Co" },
      { workModes: WORK_MODE.HYBRID },
      {
        categories: JSON.stringify({
          [catalog.engineering.id]: [catalog.backend.id],
        }),
      },
    ];

    for (const query of queries) {
      const response = await agent.get("/api/job-discovery/jobs").query(query);

      expect(response.status).toBe(200);
      expect(
        response.body.jobs.every(
          (job) => job.company.id === manager.company._id.toString(),
        ),
      ).toBe(true);
      expect(response.body.pagination.total).toBe(response.body.jobs.length);
    }

    const keywordResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ keyword: "platform" });

    expect(keywordResponse.body.jobs.map((job) => job.id)).toEqual([
      activeJob._id.toString(),
    ]);
  });

  // BR-04: Company Manager context has no V8 capability on any V8 endpoint.
  it("rejects Company Manager on Job detail and Company information", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    const job = await createJob({
      company: manager.company,
      recruiter,
      catalog,
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
    });

    const detailResponse = await agent
      .get(`/api/job-discovery/jobs/${job._id}`)
      .set("Authorization", `Bearer ${managerToken}`);
    const companyResponse = await agent
      .get(`/api/job-discovery/companies/${manager.company._id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(detailResponse.status).toBe(403);
    expect(companyResponse.status).toBe(403);

    const guestDetailResponse = await agent.get(
      `/api/job-discovery/jobs/${job._id}`,
    );

    expect(guestDetailResponse.status).toBe(200);
  });

  // BR-01 / BR-41: list, search, filter, sort, detail, and Company reads do
  // not mutate Job or Company data.
  it("does not mutate Job or Company data on read requests", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    const job = await createJob({
      company: manager.company,
      recruiter,
      catalog,
    });
    const closed = await createJob({
      company: manager.company,
      recruiter,
      catalog,
      status: JOB_STATUS.CLOSED,
    });
    const snapshot = async () => {
      const [jobs, companies] = await Promise.all([
        Job.find().sort({ _id: 1 }).lean(),
        Company.find().sort({ _id: 1 }).lean(),
      ]);

      return JSON.stringify({ jobs, companies });
    };
    const before = await snapshot();

    await agent.get("/api/job-discovery/jobs");
    await agent
      .get("/api/job-discovery/jobs")
      .query({ keyword: "backend", sort: "EXPIRING_SOON" });
    await agent.get("/api/job-discovery/jobs").query({
      categories: JSON.stringify({
        [catalog.engineering.id]: [catalog.backend.id],
      }),
      workModes: WORK_MODE.HYBRID,
    });
    await agent.get(`/api/job-discovery/jobs/${job._id}`);
    await agent.get(`/api/job-discovery/jobs/${closed._id}`);
    await agent.get(`/api/job-discovery/companies/${manager.company._id}`);

    expect(await snapshot()).toBe(before);
  });

  // Only the documented query contract is accepted: `categories` entries use
  // `fieldId` / `positionIds` and Experience uses `experienceLevels`.
  it("does not accept alternate names for Category branch keys or the Experience query", async () => {
    const { manager, recruiter, catalog, agent } = await createBaseContext();
    const job = await createJob({
      company: manager.company,
      recruiter,
      catalog,
    });
    const otherLevel = await ExperienceLevel.findOne({
      _id: { $ne: catalog.experienceLevelId },
    }).lean();

    const aliasField = await agent.get("/api/job-discovery/jobs").query({
      categories: JSON.stringify([
        { fieldCategoryId: catalog.engineering.id },
      ]),
    });

    expect(aliasField.status).toBe(400);

    const canonicalField = await agent.get("/api/job-discovery/jobs").query({
      categories: JSON.stringify([{ fieldId: catalog.engineering.id }]),
    });

    expect(canonicalField.status).toBe(200);
    expect(canonicalField.body.jobs.map((entry) => entry.id)).toEqual([
      job._id.toString(),
    ]);

    // `positionCategoryIds` is not a branch key: it must not narrow the branch.
    const aliasPositions = await agent.get("/api/job-discovery/jobs").query({
      categories: JSON.stringify([
        {
          fieldId: catalog.engineering.id,
          positionCategoryIds: [catalog.frontend.id],
        },
      ]),
    });

    expect(aliasPositions.status).toBe(200);
    expect(aliasPositions.body.jobs.map((entry) => entry.id)).toEqual([
      job._id.toString(),
    ]);

    // `experienceLevelIds` is ignored, while `experienceLevels` filters.
    const aliasExperience = await agent.get("/api/job-discovery/jobs").query({
      experienceLevelIds: otherLevel._id.toString(),
    });

    expect(aliasExperience.status).toBe(200);
    expect(aliasExperience.body.jobs).toHaveLength(1);

    const canonicalExperience = await agent
      .get("/api/job-discovery/jobs")
      .query({ experienceLevels: otherLevel._id.toString() });

    expect(canonicalExperience.status).toBe(200);
    expect(canonicalExperience.body.jobs).toHaveLength(0);
  });

  describe("database-layer pagination and ordering", () => {
    const DAY = 24 * 60 * 60 * 1000;

    const fetchPage = async (agent, query) => {
      const response = await agent.get("/api/job-discovery/jobs").query(query);

      expect(response.status).toBe(200);

      return response.body;
    };

    const collectAllPages = async (agent, query, limit) => {
      const first = await fetchPage(agent, { ...query, limit, page: 1 });
      const ids = first.jobs.map((job) => job.id);

      for (let page = 2; page <= first.pagination.totalPages; page += 1) {
        const body = await fetchPage(agent, { ...query, limit, page });

        ids.push(...body.jobs.map((job) => job.id));
      }

      return { ids, first };
    };

    const descendingByObjectId = (jobs) => {
      return jobs
        .map((job) => job._id.toString())
        .sort()
        .reverse();
    };

    it("returns the correct page, last page, and empty page without changing order", async () => {
      const { manager, recruiter, catalog, agent } = await createBaseContext();
      const now = Date.now();
      const jobs = [];

      for (let index = 0; index < 7; index += 1) {
        jobs.push(
          await createJob({
            company: manager.company,
            recruiter,
            catalog,
            title: `Paged Job ${index}`,
            publishedAt: new Date(now - (index + 1) * DAY),
          }),
        );
      }

      // NEWEST: the most recently published Job is index 0.
      const expectedOrder = jobs.map((job) => job._id.toString());
      const full = await fetchPage(agent, { limit: 100 });

      expect(full.jobs.map((job) => job.id)).toEqual(expectedOrder);
      expect(full.pagination).toEqual({
        page: 1,
        limit: 100,
        total: 7,
        totalPages: 1,
      });

      const pageOne = await fetchPage(agent, { limit: 3, page: 1 });
      const pageTwo = await fetchPage(agent, { limit: 3, page: 2 });
      const pageThree = await fetchPage(agent, { limit: 3, page: 3 });
      const pageFour = await fetchPage(agent, { limit: 3, page: 4 });

      expect(pageOne.jobs.map((job) => job.id)).toEqual(
        expectedOrder.slice(0, 3),
      );
      expect(pageTwo.jobs.map((job) => job.id)).toEqual(
        expectedOrder.slice(3, 6),
      );
      expect(pageThree.jobs.map((job) => job.id)).toEqual(
        expectedOrder.slice(6),
      );
      expect(pageThree.pagination).toEqual({
        page: 3,
        limit: 3,
        total: 7,
        totalPages: 3,
      });
      expect(pageFour.jobs).toEqual([]);
      expect(pageFour.pagination).toEqual({
        page: 4,
        limit: 3,
        total: 7,
        totalPages: 3,
      });
    });

    it("returns an empty first page with zero totals when nothing is discoverable", async () => {
      const { agent } = await createBaseContext();

      const body = await fetchPage(agent, { limit: 5 });

      expect(body.jobs).toEqual([]);
      expect(body.pagination).toEqual({
        page: 1,
        limit: 5,
        total: 0,
        totalPages: 0,
      });
      expect(body.sort).toBe("NEWEST");
    });

    it("keeps pages stable with a deterministic _id tie-breaker for NEWEST and EXPIRING_SOON", async () => {
      const { manager, recruiter, catalog, agent } = await createBaseContext();
      const publishedAt = new Date(Date.now() - DAY);
      const applicationDeadline = new Date(Date.now() + 5 * DAY);
      const jobs = [];

      for (let index = 0; index < 5; index += 1) {
        jobs.push(
          await createJob({
            company: manager.company,
            recruiter,
            catalog,
            title: `Tied Job ${index}`,
            publishedAt,
            applicationDeadline,
          }),
        );
      }

      const expectedOrder = descendingByObjectId(jobs);

      for (const sort of ["NEWEST", "EXPIRING_SOON"]) {
        const { ids } = await collectAllPages(agent, { sort }, 2);

        expect(ids).toEqual(expectedOrder);
        expect(new Set(ids).size).toBe(jobs.length);
      }
    });

    it("pages RELEVANCE results without duplicates or gaps and keeps rank then _id order", async () => {
      const { manager, recruiter, catalog, agent } = await createBaseContext();
      const orbit = await createSecondCompanyContext({
        name: "Orbit Labs",
        suffix: "ORBITPAGE",
      });
      const titleMatches = [];

      for (let index = 0; index < 2; index += 1) {
        titleMatches.push(
          await createJob({
            company: manager.company,
            recruiter,
            catalog,
            title: `Orbit Engineer ${index}`,
          }),
        );
      }

      const skillMatch = await createJob({
        company: manager.company,
        recruiter,
        catalog,
        title: "Platform Engineer",
        requiredSkills: ["Orbit"],
      });
      const companyMatch = await createJob({
        company: orbit.manager.company,
        recruiter: orbit.recruiter,
        catalog,
        title: "Platform Engineer",
      });
      const descriptionMatch = await createJob({
        company: manager.company,
        recruiter,
        catalog,
        title: "Platform Engineer",
        jobDescription: "Works on orbit systems.",
      });

      const expectedOrder = [
        ...descendingByObjectId(titleMatches),
        skillMatch._id.toString(),
        companyMatch._id.toString(),
        descriptionMatch._id.toString(),
      ];

      for (const limit of [1, 2, 3]) {
        const { ids, first } = await collectAllPages(
          agent,
          { keyword: "orbit" },
          limit,
        );

        expect(ids).toEqual(expectedOrder);
        expect(first.pagination.total).toBe(expectedOrder.length);
        expect(first.sort).toBe("RELEVANCE");
      }
    });

    it("combines keyword, filters, Company eligibility, and pagination", async () => {
      const { manager, recruiter, catalog, agent } = await createBaseContext();
      const locked = await createSecondCompanyContext({
        name: "Locked Platform Co",
        suffix: "LOCKEDPAGE",
      });
      const now = Date.now();
      const matching = [];

      for (let index = 0; index < 5; index += 1) {
        matching.push(
          await createJob({
            company: manager.company,
            recruiter,
            catalog,
            title: `Platform Engineer ${index}`,
            workModes: [WORK_MODE.REMOTE],
            publishedAt: new Date(now - (index + 1) * DAY),
          }),
        );
      }

      // Same keyword but wrong Work mode, wrong Field, no keyword, past
      // deadline, and a Company that is not eligible.
      await createJob({
        company: manager.company,
        recruiter,
        catalog,
        title: "Platform Engineer Onsite",
        workModes: [WORK_MODE.ONSITE],
      });
      await createJob({
        company: manager.company,
        recruiter,
        catalog,
        title: "Platform Product Manager",
        workModes: [WORK_MODE.REMOTE],
        fieldCategoryIds: [catalog.product.id],
        positionCategoryIds: [catalog.productManager.id],
      });
      await createJob({
        company: manager.company,
        recruiter,
        catalog,
        title: "Backend Engineer",
        workModes: [WORK_MODE.REMOTE],
      });
      await createJob({
        company: manager.company,
        recruiter,
        catalog,
        title: "Platform Engineer Expired",
        workModes: [WORK_MODE.REMOTE],
        applicationDeadline: new Date(now - DAY),
      });
      await createJob({
        company: locked.manager.company,
        recruiter: locked.recruiter,
        catalog,
        title: "Platform Engineer Locked",
        workModes: [WORK_MODE.REMOTE],
      });
      await Company.findByIdAndUpdate(locked.manager.company._id, {
        operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
      });

      const query = {
        keyword: "platform",
        categories: JSON.stringify({
          [catalog.engineering.id]: [catalog.backend.id],
        }),
        workModes: WORK_MODE.REMOTE,
        sort: "NEWEST",
      };
      const expectedOrder = matching.map((job) => job._id.toString());

      const pageOne = await fetchPage(agent, { ...query, limit: 2, page: 1 });
      const pageTwo = await fetchPage(agent, { ...query, limit: 2, page: 2 });
      const pageThree = await fetchPage(agent, { ...query, limit: 2, page: 3 });
      const pageFour = await fetchPage(agent, { ...query, limit: 2, page: 4 });

      expect(pageOne.jobs.map((job) => job.id)).toEqual(
        expectedOrder.slice(0, 2),
      );
      expect(pageTwo.jobs.map((job) => job.id)).toEqual(
        expectedOrder.slice(2, 4),
      );
      expect(pageThree.jobs.map((job) => job.id)).toEqual(
        expectedOrder.slice(4),
      );
      expect(pageFour.jobs).toEqual([]);

      for (const body of [pageOne, pageTwo, pageThree, pageFour]) {
        expect(body.pagination.total).toBe(5);
        expect(body.pagination.totalPages).toBe(3);
      }

      const everyCompanyEligible = [pageOne, pageTwo, pageThree]
        .flatMap((body) => body.jobs)
        .every((job) => job.company.id === manager.company._id.toString());

      expect(everyCompanyEligible).toBe(true);
    });

    it("sorts and paginates in MongoDB instead of loading every match", async () => {
      const { manager, recruiter, catalog, agent } = await createBaseContext();

      for (let index = 0; index < 4; index += 1) {
        await createJob({
          company: manager.company,
          recruiter,
          catalog,
          title: `Query Shape Job ${index}`,
          publishedAt: new Date(Date.now() - (index + 1) * DAY),
        });
      }

      const aggregateSpy = vi.spyOn(Job, "aggregate");
      const findSpy = vi.spyOn(Job, "find");
      const companyFindSpy = vi.spyOn(Company, "find");

      try {
        const body = await fetchPage(agent, { limit: 2, page: 2 });

        expect(body.jobs).toHaveLength(2);
        expect(body.pagination.total).toBe(4);

        const pipelines = aggregateSpy.mock.calls.map(([pipeline]) => pipeline);
        const serialized = JSON.stringify(pipelines);

        expect(pipelines.length).toBeGreaterThan(0);
        expect(serialized).toContain('"$skip":2');
        expect(serialized).toContain('"$limit":2');
        expect(serialized).toContain('"$sort"');
        // The list path must not fall back to loading every Job or every
        // active Company into the application.
        expect(findSpy).not.toHaveBeenCalled();
        expect(companyFindSpy).not.toHaveBeenCalled();
      } finally {
        aggregateSpy.mockRestore();
        findSpy.mockRestore();
        companyFindSpy.mockRestore();
      }
    });
  });
});
