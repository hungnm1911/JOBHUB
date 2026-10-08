import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import { migrate as migrateExperienceLevels } from "../../src/database/migrations/v4-experience-level-dataset.js";
import Company from "../../src/models/company.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job from "../../src/models/job.model.js";
import {
  createFieldCategory,
  createPositionCategory,
} from "../../src/services/category.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";
import { TEST_LOCATION } from "../helpers/location-provider.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const M = 1_000_000;

const fixed = (amount, period = "MONTH") => ({
  type: "FIXED",
  minAmount: amount,
  maxAmount: amount,
  period,
});
const range = (minAmount, maxAmount, period = "MONTH") => ({
  type: "RANGE",
  minAmount,
  maxAmount,
  period,
});

const MONTH_20_30 = { salaryPeriod: "MONTH", salaryMin: 20 * M, salaryMax: 30 * M };

describe("V4.2 Slice 06 — Job Discovery Salary Range Filtering", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  const createContext = async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "v42s06.manager@example.com",
      businessRegistrationNumber: "BRN-V42-S06",
      name: "Acme Hiring",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "v42s06.recruiter@example.com",
      company: manager.company,
      employeeCode: "V42S06-R1",
    });

    await migrateExperienceLevels();

    const engineering = await createFieldCategory({ name: "Engineering" });
    const backend = await createPositionCategory({
      name: "Backend Engineer",
      parentCategoryId: engineering.id,
    });
    const experienceLevel = await ExperienceLevel.findOne({
      code: EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS,
    }).lean();

    let sequence = 0;

    const createJob = async ({
      title,
      salary,
      requiredSkills = ["Node.js"],
      employmentType = EMPLOYMENT_TYPE.FULL_TIME,
      status = JOB_STATUS.PUBLISHED,
      publishedAt,
      applicationDeadline,
    }) => {
      sequence += 1;

      return Job.create({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        primaryRecruiterCompanyMemberId: recruiter.membership._id,
        title,
        jobDescription: "Build reliable recruitment APIs.",
        requiredSkills,
        salary,
        fieldCategoryIds: [engineering.id],
        positionCategoryIds: [backend.id],
        location: { provinceCode: TEST_LOCATION.HA_NOI, districtCode: null },
        employmentType,
        workModes: [WORK_MODE.HYBRID],
        experienceLevelId: experienceLevel._id,
        applicationDeadline:
          applicationDeadline ?? new Date(Date.now() + (30 + sequence) * DAY_MS),
        publishedAt:
          publishedAt === undefined
            ? new Date(Date.now() - sequence * 60 * 1000)
            : publishedAt,
        status,
      });
    };

    return { manager, agent: createTestAgent(), createJob };
  };

  const listJobIds = async (agent, query) => {
    const response = await agent.get("/api/job-discovery/jobs").query(query);

    expect(response.status).toBe(200);

    return response.body.jobs.map((job) => job.id).sort();
  };

  const idsOf = (...jobs) => jobs.map((job) => job._id.toString()).sort();

  const seedSalaryJobs = async (createJob) => {
    const salaries = {
      fixedInside: fixed(25 * M),
      fixedAtMin: fixed(20 * M),
      fixedAtMax: fixed(30 * M),
      fixedBelow: fixed(20 * M - 1),
      fixedAbove: fixed(30 * M + 1),
      rangeLeftOverlap: range(18 * M, 25 * M),
      rangeRightOverlap: range(25 * M, 35 * M),
      rangeInside: range(22 * M, 28 * M),
      rangeCovering: range(15 * M, 40 * M),
      rangeTouchingMin: range(10 * M, 20 * M),
      rangeTouchingMax: range(30 * M, 40 * M),
      rangeBelow: range(10 * M, 20 * M - 1),
      rangeAbove: range(30 * M + 1, 40 * M),
      fixedOtherPeriod: fixed(25 * M, "WEEK"),
      rangeOtherPeriod: range(20 * M, 30 * M, "DAY"),
      from: { type: "FROM", minAmount: 20 * M, period: "MONTH" },
      upTo: { type: "UP_TO", maxAmount: 30 * M, period: "MONTH" },
      negotiable: { type: "NEGOTIABLE" },
      etcRange: {
        ...range(20 * M, 30 * M, "ETC"),
        customPeriodLabel: "MONTH",
      },
      etcFixed: { ...fixed(25 * M, "ETC"), customPeriodLabel: "tháng" },
    };
    const jobs = {};

    for (const [title, salary] of Object.entries(salaries)) {
      jobs[title] = await createJob({ title, salary });
    }

    return jobs;
  };

  it("leaves Job Discovery unchanged when no Salary filter is given", async () => {
    const { agent, createJob } = await createContext();
    const jobs = await seedSalaryJobs(createJob);
    const everyJob = idsOf(...Object.values(jobs));

    expect(await listJobIds(agent, {})).toEqual(everyJob);
    expect(
      await listJobIds(agent, { salaryPeriod: "", salaryMin: "", salaryMax: " " }),
    ).toEqual(everyJob);
  });

  it("applies BR-11 to BR-14 matching for FIXED and RANGE in the selected period", async () => {
    const { agent, createJob } = await createContext();
    const jobs = await seedSalaryJobs(createJob);

    expect(await listJobIds(agent, MONTH_20_30)).toEqual(
      idsOf(
        jobs.fixedInside,
        jobs.fixedAtMin,
        jobs.fixedAtMax,
        jobs.rangeLeftOverlap,
        jobs.rangeRightOverlap,
        jobs.rangeInside,
        jobs.rangeCovering,
        jobs.rangeTouchingMin,
        jobs.rangeTouchingMax,
      ),
    );
  });

  it("matches only the selected period without cross-period conversion", async () => {
    const { agent, createJob } = await createContext();
    const jobs = await seedSalaryJobs(createJob);

    expect(
      await listJobIds(agent, { ...MONTH_20_30, salaryPeriod: "WEEK" }),
    ).toEqual(idsOf(jobs.fixedOtherPeriod));
    expect(
      await listJobIds(agent, { ...MONTH_20_30, salaryPeriod: "DAY" }),
    ).toEqual(idsOf(jobs.rangeOtherPeriod));
    expect(
      await listJobIds(agent, { ...MONTH_20_30, salaryPeriod: "HOUR" }),
    ).toEqual([]);
    expect(
      await listJobIds(agent, { ...MONTH_20_30, salaryPeriod: "SHIFT" }),
    ).toEqual([]);
  });

  it("accepts a single-point range and applies it inclusively", async () => {
    const { agent, createJob } = await createContext();
    const jobs = await seedSalaryJobs(createJob);

    expect(
      await listJobIds(agent, {
        salaryPeriod: "MONTH",
        salaryMin: 20 * M,
        salaryMax: 20 * M,
      }),
    ).toEqual(
      idsOf(
        jobs.fixedAtMin,
        jobs.rangeLeftOverlap,
        jobs.rangeCovering,
        jobs.rangeTouchingMin,
      ),
    );
  });

  it("never matches ETC and ignores customPeriodLabel", async () => {
    const { agent, createJob } = await createContext();
    const jobs = await seedSalaryJobs(createJob);

    const monthIds = await listJobIds(agent, MONTH_20_30);

    expect(monthIds).not.toContain(jobs.etcRange._id.toString());
    expect(monthIds).not.toContain(jobs.etcFixed._id.toString());

    for (const salaryPeriod of ["ETC", "tháng"]) {
      const response = await agent
        .get("/api/job-discovery/jobs")
        .query({ ...MONTH_20_30, salaryPeriod });

      expect(response.status).toBe(400);
      expect(response.body.error.details.field).toBe("salaryPeriod");
    }
  });

  it("rejects malformed, one-sided, and period-less Salary filters", async () => {
    const { agent, createJob } = await createContext();
    await seedSalaryJobs(createJob);

    const invalidQueries = [
      { salaryPeriod: "MONTH" },
      { salaryPeriod: "MONTH", salaryMin: 20 * M },
      { salaryPeriod: "MONTH", salaryMax: 30 * M },
      { salaryMin: 20 * M, salaryMax: 30 * M },
      { ...MONTH_20_30, salaryPeriod: "YEAR" },
      { ...MONTH_20_30, salaryPeriod: "month" },
      { ...MONTH_20_30, salaryMin: 31 * M },
      { ...MONTH_20_30, salaryMin: "abc" },
      { ...MONTH_20_30, salaryMin: "1.5" },
      { ...MONTH_20_30, salaryMax: "3e7" },
      { ...MONTH_20_30, salaryMax: "9007199254740993" },
    ];

    for (const query of invalidQueries) {
      const response = await agent.get("/api/job-discovery/jobs").query(query);

      expect(response.status, JSON.stringify(query)).toBe(400);
    }

    const repeatedPeriod = await agent.get(
      `/api/job-discovery/jobs?salaryPeriod=MONTH&salaryPeriod=WEEK&salaryMin=${20 * M}&salaryMax=${30 * M}`,
    );

    expect(repeatedPeriod.status).toBe(400);
  });

  it("ANDs the Salary filter with keyword and employmentType filter groups", async () => {
    const { agent, createJob } = await createContext();
    const matching = await createJob({
      title: "Platform Engineer",
      salary: range(22 * M, 28 * M),
    });
    await createJob({
      title: "Platform Part-time",
      salary: range(22 * M, 28 * M),
      employmentType: EMPLOYMENT_TYPE.PART_TIME,
    });
    await createJob({
      title: "Platform Underpaid",
      salary: fixed(10 * M),
    });
    await createJob({
      title: "Support Engineer",
      salary: fixed(25 * M),
    });

    expect(
      await listJobIds(agent, {
        ...MONTH_20_30,
        keyword: "platform",
        employmentTypes: EMPLOYMENT_TYPE.FULL_TIME,
      }),
    ).toEqual(idsOf(matching));
  });

  it("keeps public visibility under a Salary filter", async () => {
    const { agent, createJob, manager } = await createContext();
    const visible = await createJob({ title: "Visible", salary: fixed(25 * M) });
    await createJob({
      title: "Closed",
      salary: fixed(25 * M),
      status: JOB_STATUS.CLOSED,
    });
    await createJob({
      title: "Draft",
      salary: fixed(25 * M),
      status: JOB_STATUS.DRAFT,
      publishedAt: null,
    });
    await createJob({
      title: "Past deadline",
      salary: fixed(25 * M),
      applicationDeadline: new Date(Date.now() - DAY_MS),
    });

    expect(await listJobIds(agent, MONTH_20_30)).toEqual(idsOf(visible));

    await Company.findByIdAndUpdate(manager.company._id, {
      operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
    });

    expect(await listJobIds(agent, MONTH_20_30)).toEqual([]);
  });

  it("keeps existing sorting and pagination under a Salary filter", async () => {
    const { agent, createJob } = await createContext();
    const now = Date.now();
    const newest = await createJob({
      title: "Newest",
      salary: fixed(25 * M),
      publishedAt: new Date(now - 1 * DAY_MS),
      applicationDeadline: new Date(now + 20 * DAY_MS),
    });
    const middle = await createJob({
      title: "Middle Platform",
      salary: range(18 * M, 22 * M),
      publishedAt: new Date(now - 2 * DAY_MS),
      applicationDeadline: new Date(now + 5 * DAY_MS),
    });
    const oldest = await createJob({
      title: "Oldest",
      requiredSkills: ["Platform"],
      salary: range(28 * M, 40 * M),
      publishedAt: new Date(now - 3 * DAY_MS),
      applicationDeadline: new Date(now + 10 * DAY_MS),
    });
    await createJob({
      title: "Out of range Platform",
      salary: fixed(50 * M),
      publishedAt: new Date(now),
      applicationDeadline: new Date(now + 1 * DAY_MS),
    });

    const newestResponse = await agent
      .get("/api/job-discovery/jobs")
      .query(MONTH_20_30);

    expect(newestResponse.status).toBe(200);
    expect(newestResponse.body.sort).toBe("NEWEST");
    expect(newestResponse.body.jobs.map((job) => job.id)).toEqual(
      [newest, middle, oldest].map((job) => job._id.toString()),
    );

    const expiringResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ ...MONTH_20_30, sort: "EXPIRING_SOON" });

    expect(expiringResponse.body.jobs.map((job) => job.id)).toEqual(
      [middle, oldest, newest].map((job) => job._id.toString()),
    );

    const relevanceResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ ...MONTH_20_30, keyword: "platform" });

    expect(relevanceResponse.body.sort).toBe("RELEVANCE");
    expect(relevanceResponse.body.jobs.map((job) => job.id)).toEqual(
      [middle, oldest].map((job) => job._id.toString()),
    );

    const pageResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ ...MONTH_20_30, page: 2, limit: 2 });

    expect(pageResponse.status).toBe(200);
    expect(pageResponse.body.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(pageResponse.body.jobs.map((job) => job.id)).toEqual([
      oldest._id.toString(),
    ]);
  });

  it("declares the canonical Salary filtering index (Data §5.7)", async () => {
    await Job.init();

    const salaryIndex = (await Job.collection.indexes()).find(
      (index) => index.name === "job_discovery_salary_range_idx",
    );

    expect(salaryIndex?.key).toEqual({
      status: 1,
      "salary.period": 1,
      "salary.type": 1,
      "salary.minAmount": 1,
      "salary.maxAmount": 1,
    });
    expect(salaryIndex.partialFilterExpression).toBeUndefined();
  });
});
