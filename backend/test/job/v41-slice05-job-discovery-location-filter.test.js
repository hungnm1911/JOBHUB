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
import {
  stubLocationProvider,
  TEST_LOCATION,
} from "../helpers/location-provider.js";

// Province Open API v1 code of Quận Hoàn Kiếm (Hà Nội). Discovery never
// validates codes against the provider, so it is not part of the stub dataset.
const HA_NOI_HOAN_KIEM = "2";

const location = (provinceCode, districtCode = null) => ({
  provinceCode,
  districtCode,
});

const DAY_MS = 24 * 60 * 60 * 1000;

describe("V4.1 Slice 05 — Job Discovery Location hierarchy filter", () => {
  let providerFetch;

  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(() => {
    providerFetch = stubLocationProvider();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  const createContext = async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "v41s05.manager@example.com",
      businessRegistrationNumber: "BRN-V41-S05",
      name: "Acme Hiring",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "v41s05.recruiter@example.com",
      company: manager.company,
      employeeCode: "V41S05-R1",
    });

    await migrateExperienceLevels();

    const engineering = await createFieldCategory({ name: "Engineering" });
    const backend = await createPositionCategory({
      name: "Backend Engineer",
      parentCategoryId: engineering.id,
    });
    const frontend = await createPositionCategory({
      name: "Frontend Engineer",
      parentCategoryId: engineering.id,
    });
    const experienceLevel = await ExperienceLevel.findOne({
      code: EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS,
    }).lean();
    const otherExperienceLevel = await ExperienceLevel.findOne({
      code: EXPERIENCE_LEVEL.THREE_TO_FIVE_YEARS,
    }).lean();

    let sequence = 0;

    const createJob = async ({
      title,
      jobLocation,
      requiredSkills = ["Node.js"],
      workModes = [WORK_MODE.HYBRID],
      employmentType = EMPLOYMENT_TYPE.FULL_TIME,
      positionCategoryIds = [backend.id],
      experienceLevelId = experienceLevel._id,
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
        salary: { type: "NEGOTIABLE" },
        fieldCategoryIds: [engineering.id],
        positionCategoryIds,
        location: jobLocation,
        employmentType,
        workModes,
        experienceLevelId,
        applicationDeadline:
          applicationDeadline ?? new Date(Date.now() + (30 + sequence) * DAY_MS),
        publishedAt:
          publishedAt === undefined
            ? new Date(Date.now() - sequence * 60 * 1000)
            : publishedAt,
        status,
      });
    };

    return {
      manager,
      agent: createTestAgent(),
      createJob,
      catalog: {
        engineering,
        backend,
        frontend,
        experienceLevelId: experienceLevel._id,
        otherExperienceLevelId: otherExperienceLevel._id,
      },
    };
  };

  const seedHierarchyJobs = async (createJob) => {
    const jobs = {
      haNoiOnly: await createJob({
        title: "Ha Noi Province-only",
        jobLocation: location(TEST_LOCATION.HA_NOI),
      }),
      haNoiBaDinh: await createJob({
        title: "Ha Noi Ba Dinh",
        jobLocation: location(TEST_LOCATION.HA_NOI, TEST_LOCATION.HA_NOI_BA_DINH),
      }),
      haNoiHoanKiem: await createJob({
        title: "Ha Noi Hoan Kiem",
        jobLocation: location(TEST_LOCATION.HA_NOI, HA_NOI_HOAN_KIEM),
      }),
      haNoiBaVi: await createJob({
        title: "Ha Noi Ba Vi",
        jobLocation: location(TEST_LOCATION.HA_NOI, TEST_LOCATION.HA_NOI_BA_VI),
      }),
      hoChiMinhOnly: await createJob({
        title: "Ho Chi Minh Province-only",
        jobLocation: location(TEST_LOCATION.HO_CHI_MINH),
      }),
      hoChiMinhDistrict1: await createJob({
        title: "Ho Chi Minh District 1",
        jobLocation: location(
          TEST_LOCATION.HO_CHI_MINH,
          TEST_LOCATION.HO_CHI_MINH_DISTRICT_1,
        ),
      }),
      haGiangCity: await createJob({
        title: "Ha Giang City",
        jobLocation: location(TEST_LOCATION.HA_GIANG, TEST_LOCATION.HA_GIANG_CITY),
      }),
    };

    return jobs;
  };

  const listJobIds = async (agent, query) => {
    const response = await agent.get("/api/job-discovery/jobs").query(query);

    expect(response.status).toBe(200);

    return response.body.jobs.map((job) => job.id).sort();
  };

  const idsOf = (...jobs) => jobs.map((job) => job._id.toString()).sort();

  describe("canonical matching truth table", () => {
    it("Province / ALL matches Province-only and every District of that Province only", async () => {
      const { agent, createJob } = await createContext();
      const jobs = await seedHierarchyJobs(createJob);

      expect(await listJobIds(agent, { locations: TEST_LOCATION.HA_NOI })).toEqual(
        idsOf(jobs.haNoiOnly, jobs.haNoiBaDinh, jobs.haNoiHoanKiem, jobs.haNoiBaVi),
      );
    });

    it("Province / District matches only the exact Province + District", async () => {
      const { agent, createJob } = await createContext();
      const jobs = await seedHierarchyJobs(createJob);

      expect(
        await listJobIds(agent, {
          locations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        }),
      ).toEqual(idsOf(jobs.haNoiBaDinh));
    });

    it("does not match a well-formed District under a different Province or an unknown code", async () => {
      const { agent, createJob } = await createContext();
      await seedHierarchyJobs(createJob);

      expect(
        await listJobIds(agent, {
          locations: `${TEST_LOCATION.HO_CHI_MINH}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        }),
      ).toEqual([]);
      expect(
        await listJobIds(agent, { locations: TEST_LOCATION.UNKNOWN_PROVINCE }),
      ).toEqual([]);
      expect(
        await listJobIds(agent, {
          locations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.UNKNOWN_DISTRICT}`,
        }),
      ).toEqual([]);
      expect(
        await listJobIds(agent, {
          locations: `${TEST_LOCATION.UNKNOWN_PROVINCE}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        }),
      ).toEqual([]);
    });

    it("invalid Districts and groups contribute nothing while valid ones keep their results", async () => {
      const { agent, createJob } = await createContext();
      const jobs = await seedHierarchyJobs(createJob);

      expect(
        await listJobIds(agent, {
          locations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}|${TEST_LOCATION.UNKNOWN_DISTRICT}|${TEST_LOCATION.HO_CHI_MINH_DISTRICT_1}`,
        }),
      ).toEqual(idsOf(jobs.haNoiBaDinh));
      expect(
        await listJobIds(agent, {
          locations: `${TEST_LOCATION.HO_CHI_MINH};${TEST_LOCATION.HA_GIANG}:${TEST_LOCATION.HA_NOI_BA_DINH};${TEST_LOCATION.UNKNOWN_PROVINCE}`,
        }),
      ).toEqual(idsOf(jobs.hoChiMinhOnly, jobs.hoChiMinhDistrict1));
    });
  });

  describe("OR composition inside the Location group", () => {
    it("combines multiple Provinces with OR", async () => {
      const { agent, createJob } = await createContext();
      const jobs = await seedHierarchyJobs(createJob);

      expect(
        await listJobIds(agent, {
          locations: `${TEST_LOCATION.HA_NOI};${TEST_LOCATION.HO_CHI_MINH}`,
        }),
      ).toEqual(
        idsOf(
          jobs.haNoiOnly,
          jobs.haNoiBaDinh,
          jobs.haNoiHoanKiem,
          jobs.haNoiBaVi,
          jobs.hoChiMinhOnly,
          jobs.hoChiMinhDistrict1,
        ),
      );
    });

    it("combines multiple Districts of one Province with OR, including repeated groups", async () => {
      const { agent, createJob } = await createContext();
      const jobs = await seedHierarchyJobs(createJob);
      const expected = idsOf(jobs.haNoiBaDinh, jobs.haNoiBaVi);

      expect(
        await listJobIds(agent, {
          locations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}|${TEST_LOCATION.HA_NOI_BA_VI}`,
        }),
      ).toEqual(expected);

      const repeatedResponse = await agent.get(
        `/api/job-discovery/jobs?locations=${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}&locations=${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_VI}`,
      );

      expect(repeatedResponse.status).toBe(200);
      expect(repeatedResponse.body.jobs.map((job) => job.id).sort()).toEqual(
        expected,
      );
    });

    it("mixes Province / ALL groups with a multi-District subset across three Provinces", async () => {
      const { agent, createJob } = await createContext();
      const jobs = await seedHierarchyJobs(createJob);

      expect(
        await listJobIds(agent, {
          locations: `${TEST_LOCATION.HO_CHI_MINH};${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}|${TEST_LOCATION.HA_NOI_BA_VI};${TEST_LOCATION.HA_GIANG}`,
        }),
      ).toEqual(
        idsOf(
          jobs.hoChiMinhOnly,
          jobs.hoChiMinhDistrict1,
          jobs.haNoiBaDinh,
          jobs.haNoiBaVi,
          jobs.haGiangCity,
        ),
      );
    });

    it("mixes one Province / ALL with another Province District subset", async () => {
      const { agent, createJob } = await createContext();
      const jobs = await seedHierarchyJobs(createJob);
      const expected = idsOf(
        jobs.hoChiMinhOnly,
        jobs.hoChiMinhDistrict1,
        jobs.haNoiBaDinh,
      );

      expect(
        await listJobIds(agent, {
          locations: `${TEST_LOCATION.HO_CHI_MINH};${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
        }),
      ).toEqual(expected);

      expect(
        await listJobIds(agent, {
          locations: JSON.stringify([
            { provinceCode: TEST_LOCATION.HO_CHI_MINH },
            {
              provinceCode: TEST_LOCATION.HA_NOI,
              districtCodes: [TEST_LOCATION.HA_NOI_BA_DINH],
            },
          ]),
        }),
      ).toEqual(expected);
    });
  });

  it("does not restrict by Location when no Location filter is given", async () => {
    const { agent, createJob } = await createContext();
    const jobs = await seedHierarchyJobs(createJob);
    const all = idsOf(...Object.values(jobs));

    expect(await listJobIds(agent, {})).toEqual(all);
    expect(await listJobIds(agent, { locations: "" })).toEqual(all);
  });

  it("ANDs the Location group with keyword and the other V8 filter groups", async () => {
    const { agent, createJob, catalog } = await createContext();
    const target = await createJob({
      title: "Platform API Engineer",
      jobLocation: location(TEST_LOCATION.HA_NOI, TEST_LOCATION.HA_NOI_BA_DINH),
      workModes: [WORK_MODE.REMOTE],
    });
    await createJob({
      title: "Platform API Engineer Other Province",
      jobLocation: location(TEST_LOCATION.HO_CHI_MINH),
      workModes: [WORK_MODE.REMOTE],
    });
    await createJob({
      title: "Data Engineer",
      jobLocation: location(TEST_LOCATION.HA_NOI),
      workModes: [WORK_MODE.REMOTE],
    });
    await createJob({
      title: "Platform API Engineer Onsite",
      jobLocation: location(TEST_LOCATION.HA_NOI),
      workModes: [WORK_MODE.ONSITE],
    });
    await createJob({
      title: "Platform Frontend Engineer",
      jobLocation: location(TEST_LOCATION.HA_NOI),
      workModes: [WORK_MODE.REMOTE],
      positionCategoryIds: [catalog.frontend.id],
    });
    await createJob({
      title: "Platform API Engineer Part-time",
      jobLocation: location(TEST_LOCATION.HA_NOI),
      workModes: [WORK_MODE.REMOTE],
      employmentType: EMPLOYMENT_TYPE.PART_TIME,
    });
    await createJob({
      title: "Platform API Engineer Senior",
      jobLocation: location(TEST_LOCATION.HA_NOI),
      workModes: [WORK_MODE.REMOTE],
      experienceLevelId: catalog.otherExperienceLevelId,
    });

    const response = await agent.get("/api/job-discovery/jobs").query({
      keyword: "platform",
      locations: TEST_LOCATION.HA_NOI,
      categories: JSON.stringify({
        [catalog.engineering.id]: [catalog.backend.id],
      }),
      workModes: WORK_MODE.REMOTE,
      employmentTypes: EMPLOYMENT_TYPE.FULL_TIME,
      experienceLevels: catalog.experienceLevelId.toString(),
    });

    expect(response.status).toBe(200);
    expect(response.body.jobs.map((job) => job.id)).toEqual([
      target._id.toString(),
    ]);
    expect(response.body.sort).toBe("RELEVANCE");
  });

  it("keeps V8 public visibility under a Location filter", async () => {
    const { agent, createJob, manager } = await createContext();
    const visible = await createJob({
      title: "Visible",
      jobLocation: location(TEST_LOCATION.HA_NOI),
    });
    await createJob({
      title: "Closed",
      jobLocation: location(TEST_LOCATION.HA_NOI),
      status: JOB_STATUS.CLOSED,
    });
    await createJob({
      title: "Draft",
      jobLocation: location(TEST_LOCATION.HA_NOI),
      status: JOB_STATUS.DRAFT,
      publishedAt: null,
    });
    await createJob({
      title: "Past deadline",
      jobLocation: location(TEST_LOCATION.HA_NOI, TEST_LOCATION.HA_NOI_BA_DINH),
      applicationDeadline: new Date(Date.now() - DAY_MS),
    });

    expect(await listJobIds(agent, { locations: TEST_LOCATION.HA_NOI })).toEqual(
      idsOf(visible),
    );

    await Company.findByIdAndUpdate(manager.company._id, {
      operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
    });

    expect(await listJobIds(agent, { locations: TEST_LOCATION.HA_NOI })).toEqual(
      [],
    );
  });

  it("keeps V8 sorting and pagination under a Location filter", async () => {
    const { agent, createJob } = await createContext();
    const now = Date.now();
    const newest = await createJob({
      title: "Newest",
      jobLocation: location(TEST_LOCATION.HA_NOI),
      publishedAt: new Date(now - 1 * DAY_MS),
      applicationDeadline: new Date(now + 20 * DAY_MS),
    });
    const middle = await createJob({
      title: "Middle Platform",
      jobLocation: location(TEST_LOCATION.HA_NOI, TEST_LOCATION.HA_NOI_BA_DINH),
      publishedAt: new Date(now - 2 * DAY_MS),
      applicationDeadline: new Date(now + 5 * DAY_MS),
    });
    const oldest = await createJob({
      title: "Oldest",
      requiredSkills: ["Platform"],
      jobLocation: location(TEST_LOCATION.HA_NOI, TEST_LOCATION.HA_NOI_BA_VI),
      publishedAt: new Date(now - 3 * DAY_MS),
      applicationDeadline: new Date(now + 10 * DAY_MS),
    });
    await createJob({
      title: "Other Province Platform",
      jobLocation: location(TEST_LOCATION.HO_CHI_MINH),
      publishedAt: new Date(now),
      applicationDeadline: new Date(now + 1 * DAY_MS),
    });

    const newestResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ locations: TEST_LOCATION.HA_NOI });

    expect(newestResponse.status).toBe(200);
    expect(newestResponse.body.sort).toBe("NEWEST");
    expect(newestResponse.body.jobs.map((job) => job.id)).toEqual(
      [newest, middle, oldest].map((job) => job._id.toString()),
    );

    const expiringResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ locations: TEST_LOCATION.HA_NOI, sort: "EXPIRING_SOON" });

    expect(expiringResponse.body.jobs.map((job) => job.id)).toEqual(
      [middle, oldest, newest].map((job) => job._id.toString()),
    );

    const relevanceResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ locations: TEST_LOCATION.HA_NOI, keyword: "platform" });

    expect(relevanceResponse.body.sort).toBe("RELEVANCE");
    expect(relevanceResponse.body.jobs.map((job) => job.id)).toEqual(
      [middle, oldest].map((job) => job._id.toString()),
    );

    const pageResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ locations: TEST_LOCATION.HA_NOI, page: 2, limit: 2 });

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

  it("returns the canonical structured Location on list and detail", async () => {
    const { agent, createJob } = await createContext();
    const job = await createJob({
      title: "Ba Dinh",
      jobLocation: location(TEST_LOCATION.HA_NOI, TEST_LOCATION.HA_NOI_BA_DINH),
    });

    const listResponse = await agent
      .get("/api/job-discovery/jobs")
      .query({ locations: TEST_LOCATION.HA_NOI });
    const detailResponse = await agent.get(`/api/job-discovery/jobs/${job._id}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.jobs[0].location).toEqual({
      provinceCode: TEST_LOCATION.HA_NOI,
      districtCode: TEST_LOCATION.HA_NOI_BA_DINH,
    });
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.job.location).toEqual({
      provinceCode: TEST_LOCATION.HA_NOI,
      districtCode: TEST_LOCATION.HA_NOI_BA_DINH,
    });
  });

  it("never calls the Location provider on the Discovery path", async () => {
    const { agent, createJob } = await createContext();
    const jobs = await seedHierarchyJobs(createJob);

    await listJobIds(agent, {});
    await listJobIds(agent, { locations: TEST_LOCATION.HA_NOI });
    await listJobIds(agent, {
      locations: `${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH};${TEST_LOCATION.HO_CHI_MINH}`,
    });
    await listJobIds(agent, { locations: TEST_LOCATION.UNKNOWN_PROVINCE });
    await agent.get(`/api/job-discovery/jobs/${jobs.haNoiBaDinh._id}`);

    expect(providerFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["legacy literal", "HA_NOI"],
    ["FOREIGN", "FOREIGN"],
    ["REMOTE", "REMOTE"],
    ["ALL as Province", "ALL"],
    ["ALL as District", `${TEST_LOCATION.HA_NOI}:ALL`],
    ["leading-zero code", "01"],
    ["decimal code", "1.0"],
    ["District without Province", `:${TEST_LOCATION.HA_NOI_BA_DINH}`],
    ["empty group", `${TEST_LOCATION.HA_NOI};`],
    ["extra hierarchy level", `${TEST_LOCATION.HA_NOI}:1:2`],
    [
      "same Province as ALL and District subset",
      `${TEST_LOCATION.HA_NOI};${TEST_LOCATION.HA_NOI}:${TEST_LOCATION.HA_NOI_BA_DINH}`,
    ],
    ["invalid JSON", "[{"],
    ["JSON object form", JSON.stringify({ [TEST_LOCATION.HA_NOI]: [] })],
    ["JSON numeric code", JSON.stringify([{ provinceCode: 1 }])],
    [
      "JSON singular districtCode",
      JSON.stringify([
        { provinceCode: TEST_LOCATION.HA_NOI, districtCode: TEST_LOCATION.HA_NOI_BA_DINH },
      ]),
    ],
    [
      "JSON non-array districtCodes",
      JSON.stringify([
        { provinceCode: TEST_LOCATION.HA_NOI, districtCodes: TEST_LOCATION.HA_NOI_BA_DINH },
      ]),
    ],
  ])("rejects a structurally invalid Location filter (%s) with 400", async (_, value) => {
    const { agent, createJob } = await createContext();
    await seedHierarchyJobs(createJob);

    const response = await agent
      .get("/api/job-discovery/jobs")
      .query({ locations: value });

    expect(response.status).toBe(400);
    expect(response.body.error.details).toMatchObject({ field: "locations" });
    expect(providerFetch).not.toHaveBeenCalled();
  });
});
