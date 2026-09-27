import mongoose from "mongoose";
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
import JOB_STATUS from "../../src/constants/job-status.js";
import LOCATION from "../../src/constants/location.js";
import USER_ROLE from "../../src/constants/user-role.js";
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
  createApprovedActiveCompanyFields,
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const DISCOVERY_URL = "/api/job-discovery";
const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const SOONER_DEADLINE = () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
const LATER_DEADLINE = () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
const PAST_DEADLINE = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

const INTERNAL_JOB_FIELDS = [
  "createdByCompanyMemberId",
  "primaryRecruiterCompanyMemberId",
  "supportingRecruiterCompanyMemberIds",
];

const INTERNAL_COMPANY_FIELDS = [
  "approvalStatus",
  "businessRegistrationNumber",
  "reviewedByUserId",
  "managerUserId",
  "reviewSnapshot",
  "submittedAt",
  "reviewedAt",
  "activatedAt",
  "operationalStatus",
];

const PUBLIC_JOB_FIELDS = new Set([
  "_id",
  "companyId",
  "title",
  "jobDescription",
  "requiredSkills",
  "salaryText",
  "fieldCategoryIds",
  "positionCategoryIds",
  "location",
  "employmentType",
  "workModes",
  "experienceLevelId",
  "applicationDeadline",
  "status",
  "publishedAt",
  "createdAt",
  "updatedAt",
  "company",
  "fieldCategories",
  "positionCategories",
  "experienceLevel",
]);

const PUBLIC_COMPANY_FIELDS = new Set([
  "_id",
  "name",
  "logoUrl",
  "bannerUrl",
  "website",
  "address",
  "description",
  "contactInfo",
]);

const assertPublicJobProjection = (job) => {
  for (const field of Object.keys(job)) {
    expect(PUBLIC_JOB_FIELDS.has(field)).toBe(true);
  }

  for (const field of INTERNAL_JOB_FIELDS) {
    expect(job[field]).toBeUndefined();
  }
};

const assertPublicCompanyProjection = (company) => {
  for (const field of Object.keys(company)) {
    expect(PUBLIC_COMPANY_FIELDS.has(field)).toBe(true);
  }

  for (const field of INTERNAL_COMPANY_FIELDS) {
    expect(company[field]).toBeUndefined();
  }
};

describe("V8 - Job Discovery", () => {
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

    const fieldIT = await createFieldCategory({ name: "IT" });
    const positionBackend = await createPositionCategory({
      name: "Backend",
      parentCategoryId: fieldIT.id,
    });
    const positionFrontend = await createPositionCategory({
      name: "Frontend",
      parentCategoryId: fieldIT.id,
    });

    const fieldMarketing = await createFieldCategory({ name: "Marketing" });
    const positionDigital = await createPositionCategory({
      name: "Digital Marketing",
      parentCategoryId: fieldMarketing.id,
    });

    const experienceLevels = await ExperienceLevel.find().lean();
    const entryLevel = experienceLevels.find(
      (level) => level.code === EXPERIENCE_LEVEL.UNDER_1_YEAR,
    );
    const midLevel = experienceLevels.find(
      (level) => level.code === EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS,
    );

    return {
      fieldIT,
      positionBackend,
      positionFrontend,
      fieldMarketing,
      positionDigital,
      entryLevel,
      midLevel,
    };
  };

  const createPublishedJob = async ({
    companyId,
    recruiterMemberId,
    overrides = {},
  }) =>
    Job.create({
      companyId,
      createdByCompanyMemberId: recruiterMemberId,
      primaryRecruiterCompanyMemberId: recruiterMemberId,
      title: "Default Job",
      jobDescription: "Default description",
      requiredSkills: ["Skill"],
      fieldCategoryIds: [],
      positionCategoryIds: [],
      applicationDeadline: FUTURE_DEADLINE(),
      status: JOB_STATUS.PUBLISHED,
      publishedAt: new Date(),
      ...overrides,
    });

  const setupPrimaryFixtures = async (catalog) => {
    const managerContext = await createActiveCompanyManagerContext({
      email: "manager@acme.test",
      businessRegistrationNumber: "BRN-V8-ACME",
      name: "Acme Hiring",
    });
    const recruiterContext = await createActiveRecruiterContext({
      email: "recruiter@acme.test",
      company: managerContext.company,
      employeeCode: "NV-V8-1",
    });

    const discoverableBackend = await createPublishedJob({
      companyId: managerContext.company._id,
      recruiterMemberId: recruiterContext.membership._id,
      overrides: {
        title: "Backend Developer",
        jobDescription: "Build APIs with Node.js",
        requiredSkills: ["Node.js", "MongoDB"],
        fieldCategoryIds: [catalog.fieldIT.id],
        positionCategoryIds: [catalog.positionBackend.id],
        location: LOCATION.HA_NOI,
        employmentType: EMPLOYMENT_TYPE.FULL_TIME,
        workModes: [WORK_MODE.HYBRID, WORK_MODE.REMOTE],
        experienceLevelId: catalog.entryLevel._id,
        applicationDeadline: LATER_DEADLINE(),
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    const discoverableMarketing = await createPublishedJob({
      companyId: managerContext.company._id,
      recruiterMemberId: recruiterContext.membership._id,
      overrides: {
        title: "Digital Marketer",
        jobDescription: "Run SEO campaigns",
        requiredSkills: ["SEO", "Ads"],
        fieldCategoryIds: [catalog.fieldMarketing.id],
        positionCategoryIds: [catalog.positionDigital.id],
        location: LOCATION.HO_CHI_MINH,
        employmentType: EMPLOYMENT_TYPE.PART_TIME,
        workModes: [WORK_MODE.ONSITE],
        experienceLevelId: catalog.midLevel._id,
        applicationDeadline: SOONER_DEADLINE(),
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      },
    });

    const expiredPublished = await createPublishedJob({
      companyId: managerContext.company._id,
      recruiterMemberId: recruiterContext.membership._id,
      overrides: {
        title: "Expired Published Job",
        jobDescription: "Expired but still published",
        fieldCategoryIds: [catalog.fieldIT.id],
        positionCategoryIds: [catalog.positionBackend.id],
        applicationDeadline: PAST_DEADLINE(),
        publishedAt: new Date("2025-12-01T00:00:00.000Z"),
      },
    });

    const closedJob = await createPublishedJob({
      companyId: managerContext.company._id,
      recruiterMemberId: recruiterContext.membership._id,
      overrides: {
        title: "Closed Job",
        status: JOB_STATUS.CLOSED,
        applicationDeadline: FUTURE_DEADLINE(),
        publishedAt: new Date("2025-11-01T00:00:00.000Z"),
      },
    });

    const draftJob = await createPublishedJob({
      companyId: managerContext.company._id,
      recruiterMemberId: recruiterContext.membership._id,
      overrides: {
        title: "Draft Job",
        status: JOB_STATUS.DRAFT,
        publishedAt: null,
      },
    });

    const pendingJob = await createPublishedJob({
      companyId: managerContext.company._id,
      recruiterMemberId: recruiterContext.membership._id,
      overrides: {
        title: "Pending Job",
        status: JOB_STATUS.PENDING_APPROVAL,
        publishedAt: null,
      },
    });

    return {
      managerContext,
      recruiterContext,
      company: managerContext.company,
      discoverableBackend,
      discoverableMarketing,
      expiredPublished,
      closedJob,
      draftJob,
      pendingJob,
    };
  };

  describe("F01/F02 — access and discoverable list", () => {
    it("Guest can list discoverable jobs with public projections (BR-03, BR-35, BR-36)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      const res = await agent.get(DISCOVERY_URL).expect(200);

      expect(res.body.jobs).toHaveLength(2);
      const ids = res.body.jobs.map((job) => job._id);
      expect(ids).toContain(data.discoverableBackend._id.toString());
      expect(ids).toContain(data.discoverableMarketing._id.toString());

      for (const job of res.body.jobs) {
        assertPublicJobProjection(job);
        assertPublicCompanyProjection(job.company);
      }
    });

    it("Candidate can discover jobs without a CV (BR-05)", async () => {
      const catalog = await seedCatalog();
      await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();
      const { user } = await createVerifiedUser({
        email: "candidate@example.com",
        role: USER_ROLE.CANDIDATE,
      });
      const token = await loginAndGetAccessToken(agent, { email: user.email });

      const res = await agent
        .get(DISCOVERY_URL)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.jobs.length).toBeGreaterThanOrEqual(2);
    });

    it("Recruiter can discover jobs from another company (BR-40)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);

      const otherManager = await createActiveCompanyManagerContext({
        email: "other.manager@test",
        businessRegistrationNumber: "BRN-V8-OTHER",
        name: "Other Co",
      });
      const otherRecruiter = await createActiveRecruiterContext({
        email: "other.recruiter@test",
        company: otherManager.company,
        employeeCode: "NV-V8-2",
      });
      await createPublishedJob({
        companyId: otherManager.company._id,
        recruiterMemberId: otherRecruiter.membership._id,
        overrides: {
          title: "Other Company Job",
          publishedAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      });

      const agent = createTestAgent();
      const token = await loginAndGetAccessToken(agent, {
        email: data.recruiterContext.user.email,
      });

      const res = await agent
        .get(DISCOVERY_URL)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const titles = res.body.jobs.map((job) => job.title);
      expect(titles).toContain("Other Company Job");
      expect(titles).toContain("Backend Developer");
    });

    it("Platform Admin can read discovery data (BR-39)", async () => {
      const catalog = await seedCatalog();
      await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();
      const { user: adminUser } = await createVerifiedUser({
        email: "admin@platform.test",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: adminUser.email,
      });

      const res = await agent
        .get(DISCOVERY_URL)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.jobs.length).toBeGreaterThanOrEqual(2);
    });

    it("Authenticated Company Manager is rejected but guest access remains (BR-04)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();
      const token = await loginAndGetAccessToken(agent, {
        email: data.managerContext.user.email,
      });

      await agent
        .get(DISCOVERY_URL)
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      await agent
        .get(`${DISCOVERY_URL}/${data.discoverableBackend._id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      await agent.get(DISCOVERY_URL).expect(200);
    });
  });

  describe("F02 — visibility rules", () => {
    it("does not discover a PUBLISHED job exactly at its application deadline (BR-07, BR-09)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      const deadline = new Date(Date.now() + 1000);

      const boundaryJob = await createPublishedJob({
        companyId: data.company._id,
        recruiterMemberId: data.recruiterContext.membership._id,
        overrides: {
          title: "Deadline Boundary Job",
          applicationDeadline: deadline,
        },
      });

      // Move the deadline to the current moment.
      await Job.findByIdAndUpdate(boundaryJob._id, {
        applicationDeadline: new Date(),
      });

      const response = await agent
        .get(`${DISCOVERY_URL}?keyword=Deadline%20Boundary`)
        .expect(200);

      expect(response.body.jobs).toHaveLength(0);
    });
    it("excludes expired, closed, draft, pending, inactive-company and deleted jobs (BR-06–BR-11, BR-14, BR-15)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      await Company.findByIdAndUpdate(data.company._id, {
        operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
      });

      const inactiveList = await agent.get(DISCOVERY_URL).expect(200);
      expect(inactiveList.body.jobs).toHaveLength(0);

      await Company.findByIdAndUpdate(data.company._id, {
        operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
      });

      const deletedJob = await createPublishedJob({
        companyId: data.company._id,
        recruiterMemberId: data.recruiterContext.membership._id,
        overrides: { title: "Deleted Job" },
      });
      await Job.findByIdAndDelete(deletedJob._id);

      const res = await agent.get(DISCOVERY_URL).expect(200);
      const titles = res.body.jobs.map((job) => job.title);

      expect(titles).not.toContain("Expired Published Job");
      expect(titles).not.toContain("Closed Job");
      expect(titles).not.toContain("Draft Job");
      expect(titles).not.toContain("Pending Job");
      expect(titles).not.toContain("Deleted Job");
      expect(titles).toContain("Backend Developer");
    });
  });

  describe("F03 — keyword search", () => {
    it("matches title, skills, company and description only on discoverable jobs (BR-16, BR-17)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      const titleRes = await agent
        .get(`${DISCOVERY_URL}?keyword=Backend`)
        .expect(200);
      expect(titleRes.body.jobs).toHaveLength(1);
      expect(titleRes.body.jobs[0].title).toBe("Backend Developer");

      const skillRes = await agent
        .get(`${DISCOVERY_URL}?keyword=MongoDB`)
        .expect(200);
      expect(skillRes.body.jobs).toHaveLength(1);

      const companyRes = await agent
        .get(`${DISCOVERY_URL}?keyword=Acme`)
        .expect(200);
      expect(companyRes.body.jobs.length).toBeGreaterThanOrEqual(2);

      const descriptionRes = await agent
        .get(`${DISCOVERY_URL}?keyword=SEO%20campaigns`)
        .expect(200);
      expect(descriptionRes.body.jobs).toHaveLength(1);
      expect(descriptionRes.body.jobs[0].title).toBe("Digital Marketer");

      const expiredRes = await agent
        .get(`${DISCOVERY_URL}?keyword=Expired`)
        .expect(200);
      expect(expiredRes.body.jobs).toHaveLength(0);

      const noMatchRes = await agent
        .get(`${DISCOVERY_URL}?keyword=zzznomatch`)
        .expect(200);
      expect(noMatchRes.body.jobs).toHaveLength(0);
    });
  });

  describe("F04 — filters", () => {
    it("does not allow POSITION-only selection to bypass Field context (BR-19, BR-21)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      const positionOnly = await agent
        .get(
          `${DISCOVERY_URL}?positionCategoryIds[]=${catalog.positionBackend.id}`,
        )
        .expect(200);

      expect(positionOnly.body.jobs).toHaveLength(0);
      expect(positionOnly.body.pagination.total).toBe(0);
    });
    it("supports valid FIELD/POSITION branches and ignores invalid parent-child pairs (BR-19–BR-22)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      const validBranch = await agent
        .get(
          `${DISCOVERY_URL}?fieldCategoryIds[]=${catalog.fieldIT.id}&positionCategoryIds[]=${catalog.positionBackend.id}`,
        )
        .expect(200);
      expect(validBranch.body.jobs).toHaveLength(1);
      expect(validBranch.body.jobs[0]._id).toBe(
        data.discoverableBackend._id.toString(),
      );

      const multiBranch = await agent
        .get(
          `${DISCOVERY_URL}?fieldCategoryIds[]=${catalog.fieldIT.id}&fieldCategoryIds[]=${catalog.fieldMarketing.id}&positionCategoryIds[]=${catalog.positionBackend.id}&positionCategoryIds[]=${catalog.positionDigital.id}`,
        )
        .expect(200);
      expect(multiBranch.body.jobs).toHaveLength(2);

      const invalidPositionForField = await agent
        .get(
          `${DISCOVERY_URL}?fieldCategoryIds[]=${catalog.fieldIT.id}&positionCategoryIds[]=${catalog.positionDigital.id}`,
        )
        .expect(200);
      expect(invalidPositionForField.body.jobs).toHaveLength(1);
      expect(invalidPositionForField.body.jobs[0]._id).toBe(
        data.discoverableBackend._id.toString(),
      );

      const fieldOnly = await agent
        .get(`${DISCOVERY_URL}?fieldCategoryIds[]=${catalog.fieldMarketing.id}`)
        .expect(200);
      expect(fieldOnly.body.jobs).toHaveLength(1);
      expect(fieldOnly.body.jobs[0].title).toBe("Digital Marketer");

      const multiplePositionsOneField = await createPublishedJob({
        companyId: data.company._id,
        recruiterMemberId: data.recruiterContext.membership._id,
        overrides: {
          title: "Frontend Developer",
          fieldCategoryIds: [catalog.fieldIT.id],
          positionCategoryIds: [catalog.positionFrontend.id],
          publishedAt: new Date("2026-01-20T00:00:00.000Z"),
        },
      });

      const multiPositionRes = await agent
        .get(
          `${DISCOVERY_URL}?fieldCategoryIds[]=${catalog.fieldIT.id}&positionCategoryIds[]=${catalog.positionBackend.id}&positionCategoryIds[]=${catalog.positionFrontend.id}`,
        )
        .expect(200);
      const multiIds = multiPositionRes.body.jobs.map((job) => job._id);
      expect(multiIds).toContain(data.discoverableBackend._id.toString());
      expect(multiIds).toContain(multiplePositionsOneField._id.toString());
    });

    it("applies OR within filter groups and AND across groups (BR-23, BR-24, BR-25, BR-26, BR-27)", async () => {
      const catalog = await seedCatalog();
      await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      const locationOr = await agent
        .get(
          `${DISCOVERY_URL}?location[]=${LOCATION.HA_NOI}&location[]=${LOCATION.HO_CHI_MINH}`,
        )
        .expect(200);
      expect(locationOr.body.jobs).toHaveLength(2);

      const workModeOr = await agent
        .get(
          `${DISCOVERY_URL}?workModes[]=${WORK_MODE.REMOTE}&workModes[]=${WORK_MODE.ONSITE}`,
        )
        .expect(200);
      expect(workModeOr.body.jobs).toHaveLength(2);

      const employmentOr = await agent
        .get(
          `${DISCOVERY_URL}?employmentType[]=${EMPLOYMENT_TYPE.FULL_TIME}&employmentType[]=${EMPLOYMENT_TYPE.PART_TIME}`,
        )
        .expect(200);
      expect(employmentOr.body.jobs).toHaveLength(2);

      const experienceOr = await agent
        .get(
          `${DISCOVERY_URL}?experienceLevelIds[]=${catalog.entryLevel._id}&experienceLevelIds[]=${catalog.midLevel._id}`,
        )
        .expect(200);
      expect(experienceOr.body.jobs).toHaveLength(2);

      const legacyExperience = await agent
        .get(`${DISCOVERY_URL}?experienceLevelId=${catalog.entryLevel._id}`)
        .expect(200);
      expect(legacyExperience.body.jobs).toHaveLength(1);

      const dedupedExperience = await agent
        .get(
          `${DISCOVERY_URL}?experienceLevelId=${catalog.entryLevel._id}&experienceLevelIds[]=${catalog.entryLevel._id}&experienceLevelIds[]=${catalog.midLevel._id}`,
        )
        .expect(200);
      expect(dedupedExperience.body.jobs).toHaveLength(2);

      const andAcrossGroups = await agent
        .get(
          `${DISCOVERY_URL}?fieldCategoryIds[]=${catalog.fieldIT.id}&location[]=${LOCATION.HA_NOI}&workModes[]=${WORK_MODE.REMOTE}&employmentType[]=${EMPLOYMENT_TYPE.FULL_TIME}&experienceLevelIds[]=${catalog.entryLevel._id}&keyword=Backend`,
        )
        .expect(200);
      expect(andAcrossGroups.body.jobs).toHaveLength(1);
      expect(andAcrossGroups.body.jobs[0].title).toBe("Backend Developer");
    });
  });

  describe("F05 — sorting", () => {
    it("orders RELEVANCE by title > skills > company > description (BR-34)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      const otherManager = await createActiveCompanyManagerContext({
        email: "relevance.manager@test",
        businessRegistrationNumber: "BRN-V8-REL",
        name: "Alpha Company",
      });

      const otherRecruiter = await createActiveRecruiterContext({
        email: "relevance.recruiter@test",
        company: otherManager.company,
        employeeCode: "NV-V8-REL",
      });

      const titleJob = await createPublishedJob({
        companyId: data.company._id,
        recruiterMemberId: data.recruiterContext.membership._id,
        overrides: {
          title: "Alpha Title Match",
          requiredSkills: ["Other Skill"],
          jobDescription: "Other description",
          publishedAt: new Date("2026-05-01T00:00:00.000Z"),
        },
      });

      const skillJob = await createPublishedJob({
        companyId: data.company._id,
        recruiterMemberId: data.recruiterContext.membership._id,
        overrides: {
          title: "Skill Match Job",
          requiredSkills: ["Alpha"],
          jobDescription: "Other description",
          publishedAt: new Date("2026-05-02T00:00:00.000Z"),
        },
      });

      const companyJob = await createPublishedJob({
        companyId: otherManager.company._id,
        recruiterMemberId: otherRecruiter.membership._id,
        overrides: {
          title: "Company Match Job",
          requiredSkills: ["Other Skill"],
          jobDescription: "Other description",
          publishedAt: new Date("2026-05-03T00:00:00.000Z"),
        },
      });

      const descriptionJob = await createPublishedJob({
        companyId: data.company._id,
        recruiterMemberId: data.recruiterContext.membership._id,
        overrides: {
          title: "Description Match Job",
          requiredSkills: ["Other Skill"],
          jobDescription: "Alpha appears here",
          publishedAt: new Date("2026-05-04T00:00:00.000Z"),
        },
      });

      const response = await agent
        .get(`${DISCOVERY_URL}?keyword=Alpha&sort=RELEVANCE`)
        .expect(200);

      const ids = response.body.jobs.map((job) => job._id);

      expect(ids.indexOf(titleJob._id.toString())).toBeLessThan(
        ids.indexOf(skillJob._id.toString()),
      );

      expect(ids.indexOf(skillJob._id.toString())).toBeLessThan(
        ids.indexOf(companyJob._id.toString()),
      );

      expect(ids.indexOf(companyJob._id.toString())).toBeLessThan(
        ids.indexOf(descriptionJob._id.toString()),
      );
    });
    it("defaults to NEWEST without keyword and RELEVANCE with keyword (BR-32, BR-33)", async () => {
      const catalog = await seedCatalog();
      await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      const defaultNoKeyword = await agent.get(DISCOVERY_URL).expect(200);
      expect(defaultNoKeyword.body.jobs[0].title).toBe("Digital Marketer");

      const defaultWithKeyword = await agent
        .get(`${DISCOVERY_URL}?keyword=Developer`)
        .expect(200);
      expect(defaultWithKeyword.body.jobs[0].title).toBe("Backend Developer");
    });

    it("sorts by NEWEST using publishedAt, EXPIRING_SOON by deadline, and RELEVANCE priority (BR-28–BR-31, BR-34)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      const newest = await agent
        .get(`${DISCOVERY_URL}?sort=NEWEST`)
        .expect(200);
      expect(newest.body.jobs[0]._id).toBe(
        data.discoverableMarketing._id.toString(),
      );

      const expiring = await agent
        .get(`${DISCOVERY_URL}?sort=EXPIRING_SOON`)
        .expect(200);
      expect(expiring.body.jobs[0]._id).toBe(
        data.discoverableMarketing._id.toString(),
      );
      expect(
        expiring.body.jobs.some(
          (job) => job._id === data.expiredPublished._id.toString(),
        ),
      ).toBe(false);

      const relevanceWithoutKeyword = await agent
        .get(`${DISCOVERY_URL}?sort=RELEVANCE`)
        .expect(200);
      expect(relevanceWithoutKeyword.body.jobs[0]._id).toBe(
        data.discoverableMarketing._id.toString(),
      );

      await createPublishedJob({
        companyId: data.company._id,
        recruiterMemberId: data.recruiterContext.membership._id,
        overrides: {
          title: "Alpha Keyword Job",
          jobDescription: "zzzz",
          publishedAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      });
      await createPublishedJob({
        companyId: data.company._id,
        recruiterMemberId: data.recruiterContext.membership._id,
        overrides: {
          title: "Other",
          requiredSkills: ["Alpha"],
          jobDescription: "zzzz",
          publishedAt: new Date("2026-03-01T00:00:00.000Z"),
        },
      });
      await createPublishedJob({
        companyId: data.company._id,
        recruiterMemberId: data.recruiterContext.membership._id,
        overrides: {
          title: "Other",
          jobDescription: "Contains Alpha token",
          publishedAt: new Date("2026-04-01T00:00:00.000Z"),
        },
      });

      const relevance = await agent
        .get(`${DISCOVERY_URL}?keyword=Alpha&sort=RELEVANCE`)
        .expect(200);
      expect(relevance.body.jobs[0].title).toBe("Alpha Keyword Job");
      expect(relevance.body.jobs[1].requiredSkills).toContain("Alpha");
    });
  });

  describe("F06/F07 — job detail and historical read-only", () => {
    it("returns discoverable detail with public projections (F06, BR-35)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      const res = await agent
        .get(`${DISCOVERY_URL}/${data.discoverableBackend._id}`)
        .expect(200);

      expect(res.body.effectiveVisibility).toBe("DISCOVERABLE");
      assertPublicJobProjection(res.body.job);
      assertPublicCompanyProjection(res.body.job.company);
      expect(res.body.job.fieldCategories.length).toBeGreaterThan(0);
      expect(res.body.job.experienceLevel).toBeTruthy();
    });

    it("returns historical read-only detail but excludes historical jobs from list (F07, BR-11, BR-12)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      const expiredDetail = await agent
        .get(`${DISCOVERY_URL}/${data.expiredPublished._id}`)
        .expect(200);
      expect(expiredDetail.body.effectiveVisibility).toBe("HISTORICAL_READ_ONLY");

      const closedDetail = await agent
        .get(`${DISCOVERY_URL}/${data.closedJob._id}`)
        .expect(200);
      expect(closedDetail.body.effectiveVisibility).toBe("HISTORICAL_READ_ONLY");

      const list = await agent.get(DISCOVERY_URL).expect(200);
      const listIds = list.body.jobs.map((job) => job._id);
      expect(listIds).not.toContain(data.expiredPublished._id.toString());
      expect(listIds).not.toContain(data.closedJob._id.toString());
    });

    it("blocks draft, pending, deleted and inactive-company detail access (BR-13, BR-14, BR-15)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      await agent.get(`${DISCOVERY_URL}/${data.draftJob._id}`).expect(404);
      await agent.get(`${DISCOVERY_URL}/${data.pendingJob._id}`).expect(404);

      const deletedJob = await createPublishedJob({
        companyId: data.company._id,
        recruiterMemberId: data.recruiterContext.membership._id,
        overrides: { title: "Deleted Detail Job" },
      });
      await Job.findByIdAndDelete(deletedJob._id);
      await agent.get(`${DISCOVERY_URL}/${deletedJob._id}`).expect(404);

      await Company.findByIdAndUpdate(data.company._id, {
        operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
      });
      await agent
        .get(`${DISCOVERY_URL}/${data.discoverableBackend._id}`)
        .expect(404);
      await agent
        .get(`${DISCOVERY_URL}/${data.expiredPublished._id}`)
        .expect(404);
    });
  });

  describe("F08 — public company info", () => {
    it("returns public company info for active companies only (BR-36, BR-37)", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      const res = await agent
        .get(`${DISCOVERY_URL}/companies/${data.company._id}`)
        .expect(200);

      assertPublicCompanyProjection(res.body.company);
      expect(res.body.company.name).toBe("Acme Hiring");

      await Company.findByIdAndUpdate(data.company._id, {
        operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
      });

      await agent
        .get(`${DISCOVERY_URL}/companies/${data.company._id}`)
        .expect(404);
    });
  });

  describe("pagination", () => {
    it("paginates the filtered discoverable result set with accurate totals", async () => {
      const catalog = await seedCatalog();
      const data = await setupPrimaryFixtures(catalog);
      const agent = createTestAgent();

      for (let index = 0; index < 3; index += 1) {
        await createPublishedJob({
          companyId: data.company._id,
          recruiterMemberId: data.recruiterContext.membership._id,
          overrides: {
            title: `Extra Job ${index}`,
            publishedAt: new Date(`2026-02-0${index + 1}T00:00:00.000Z`),
          },
        });
      }

      const page1 = await agent
        .get(`${DISCOVERY_URL}?limit=2&page=1`)
        .expect(200);
      expect(page1.body.jobs).toHaveLength(2);
      expect(page1.body.pagination.total).toBe(5);
      expect(page1.body.pagination.totalPages).toBe(3);

      const page2 = await agent
        .get(`${DISCOVERY_URL}?limit=2&page=2`)
        .expect(200);
      expect(page2.body.jobs).toHaveLength(2);

      const emptyPage = await agent
        .get(`${DISCOVERY_URL}?limit=2&page=99`)
        .expect(200);
      expect(emptyPage.body.jobs).toHaveLength(0);
    });
  });
});
