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

import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import SALARY_PERIOD from "../../src/constants/salary-period.js";
import SALARY_TYPE from "../../src/constants/salary-type.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import { migrate as migrateExperienceLevels } from "../../src/database/migrations/v4-experience-level-dataset.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job, { getJobSalaryInvariantErrors } from "../../src/models/job.model.js";
import {
  createFieldCategory,
  createPositionCategory,
} from "../../src/services/category.service.js";
import { toPublicJobSalary } from "../../src/services/job.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  DEFAULT_PASSWORD,
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
  stubLocationProvider,
} from "../helpers/location-provider.js";

const canonicalSalary = (salary) => ({
  minAmount: null,
  maxAmount: null,
  period: null,
  customPeriodLabel: null,
  ...salary,
});

const VALID_SALARIES = Object.freeze({
  FIXED: {
    type: SALARY_TYPE.FIXED,
    minAmount: 15000000,
    maxAmount: 15000000,
    period: SALARY_PERIOD.MONTH,
  },
  RANGE: {
    type: SALARY_TYPE.RANGE,
    minAmount: 10000000,
    maxAmount: 20000000,
    period: SALARY_PERIOD.MONTH,
  },
  RANGE_EQUAL_BOUNDS: {
    type: SALARY_TYPE.RANGE,
    minAmount: 25000,
    maxAmount: 25000,
    period: SALARY_PERIOD.HOUR,
  },
  FROM: {
    type: SALARY_TYPE.FROM,
    minAmount: 300000,
    period: SALARY_PERIOD.DAY,
  },
  UP_TO: {
    type: SALARY_TYPE.UP_TO,
    maxAmount: 2000000,
    period: SALARY_PERIOD.WEEK,
  },
  SHIFT: {
    type: SALARY_TYPE.FIXED,
    minAmount: 250000,
    maxAmount: 250000,
    period: SALARY_PERIOD.SHIFT,
  },
  ETC: {
    type: SALARY_TYPE.FROM,
    minAmount: 5000000,
    period: SALARY_PERIOD.ETC,
    customPeriodLabel: "dự án",
  },
  NEGOTIABLE: {
    type: SALARY_TYPE.NEGOTIABLE,
  },
});

const INVALID_SALARIES = Object.freeze([
  ["unknown type", { type: "MONTHLY", minAmount: 1, maxAmount: 1, period: SALARY_PERIOD.MONTH }],
  ["FIXED with unequal amounts", { type: SALARY_TYPE.FIXED, minAmount: 1, maxAmount: 2, period: SALARY_PERIOD.MONTH }],
  ["FIXED without maxAmount", { type: SALARY_TYPE.FIXED, minAmount: 1, period: SALARY_PERIOD.MONTH }],
  ["RANGE without maxAmount", { type: SALARY_TYPE.RANGE, minAmount: 1, period: SALARY_PERIOD.MONTH }],
  ["RANGE without minAmount", { type: SALARY_TYPE.RANGE, maxAmount: 1, period: SALARY_PERIOD.MONTH }],
  ["RANGE with lower above upper", { type: SALARY_TYPE.RANGE, minAmount: 3, maxAmount: 2, period: SALARY_PERIOD.MONTH }],
  ["FROM with maxAmount", { type: SALARY_TYPE.FROM, minAmount: 1, maxAmount: 2, period: SALARY_PERIOD.MONTH }],
  ["FROM without minAmount", { type: SALARY_TYPE.FROM, period: SALARY_PERIOD.MONTH }],
  ["UP_TO with minAmount", { type: SALARY_TYPE.UP_TO, minAmount: 1, maxAmount: 2, period: SALARY_PERIOD.MONTH }],
  ["UP_TO without maxAmount", { type: SALARY_TYPE.UP_TO, period: SALARY_PERIOD.MONTH }],
  ["NEGOTIABLE with amount", { type: SALARY_TYPE.NEGOTIABLE, minAmount: 1 }],
  ["NEGOTIABLE with period", { type: SALARY_TYPE.NEGOTIABLE, period: SALARY_PERIOD.MONTH }],
  ["NEGOTIABLE with label", { type: SALARY_TYPE.NEGOTIABLE, customPeriodLabel: "dự án" }],
  ["numeric without period", { type: SALARY_TYPE.FIXED, minAmount: 1, maxAmount: 1 }],
  ["non-canonical period", { type: SALARY_TYPE.FIXED, minAmount: 1, maxAmount: 1, period: "YEAR" }],
  ["ETC without label", { type: SALARY_TYPE.FROM, minAmount: 1, period: SALARY_PERIOD.ETC }],
  ["ETC with blank label", { type: SALARY_TYPE.FROM, minAmount: 1, period: SALARY_PERIOD.ETC, customPeriodLabel: "   " }],
  ["non-ETC with label", { type: SALARY_TYPE.FROM, minAmount: 1, period: SALARY_PERIOD.MONTH, customPeriodLabel: "tháng" }],
  ["non-integer amount", { type: SALARY_TYPE.FROM, minAmount: 1.5, period: SALARY_PERIOD.MONTH }],
]);

const NON_CANONICAL_SALARY_FIELDS = Object.freeze([
  ["currency USD", { currency: "USD" }],
  ["currency VND", { currency: "VND" }],
  ["null currency", { currency: null }],
  ["unknown field", { note: "thưởng" }],
  ["embedded _id", { _id: new mongoose.Types.ObjectId() }],
]);

describe("V4.2 Slice 04 — getJobSalaryInvariantErrors canonical shape (Data §5.3)", () => {
  it("accepts every canonical Salary type with null canonical fields and rejects absent ones", () => {
    for (const salary of Object.values(VALID_SALARIES)) {
      expect(getJobSalaryInvariantErrors(salary)).not.toEqual([]);
      expect(getJobSalaryInvariantErrors(canonicalSalary(salary))).toEqual([]);
    }

    expect(getJobSalaryInvariantErrors(null)).toEqual([]);
    expect(getJobSalaryInvariantErrors(undefined)).toEqual([]);
  });

  it("keeps rejecting every invalid type/amount/period combination", () => {
    for (const [label, salary] of INVALID_SALARIES) {
      expect(getJobSalaryInvariantErrors(salary), label).not.toEqual([]);
      expect(
        getJobSalaryInvariantErrors(canonicalSalary(salary)),
        label,
      ).not.toEqual([]);
    }
  });

  it("rejects the Final Acceptance FIXED Salary that carries a USD currency", () => {
    expect(
      getJobSalaryInvariantErrors({
        type: SALARY_TYPE.FIXED,
        minAmount: 20000000,
        maxAmount: 20000000,
        period: SALARY_PERIOD.MONTH,
        customPeriodLabel: null,
        currency: "USD",
      }),
    ).toEqual(["salary.currency is not a Structured Salary field"]);
  });

  it("rejects any non-canonical field on every otherwise valid Salary type", () => {
    for (const [typeLabel, salary] of Object.entries(VALID_SALARIES)) {
      for (const [fieldLabel, extra] of NON_CANONICAL_SALARY_FIELDS) {
        const label = `${typeLabel} + ${fieldLabel}`;

        expect(
          getJobSalaryInvariantErrors({ ...salary, ...extra }),
          label,
        ).not.toEqual([]);
        expect(
          getJobSalaryInvariantErrors({ ...canonicalSalary(salary), ...extra }),
          label,
        ).not.toEqual([]);
      }
    }
  });

  it("reports a non-canonical field alongside other invariant violations", () => {
    expect(
      getJobSalaryInvariantErrors({
        ...canonicalSalary({ type: "MONTHLY" }),
        currency: "VND",
      }),
    ).toEqual([
      "salary.currency is not a Structured Salary field",
      "salary.type must be a canonical SalaryType value",
    ]);
  });

  it("evaluates a Mongoose Salary subdocument by its canonical fields", () => {
    for (const salary of Object.values(VALID_SALARIES)) {
      const job = new Job({ salary: { ...salary, currency: "USD" } });

      expect(getJobSalaryInvariantErrors(job.salary)).toEqual([]);
    }
  });
});

describe("V4.2 Slice 04 — Structured Salary Runtime Foundation (F01)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(() => {
    stubLocationProvider();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  let sequence = 0;

  const createRecruiterContext = async () => {
    sequence += 1;

    const manager = await createActiveCompanyManagerContext({
      email: `cm.v42.s04.${sequence}@example.com`,
      businessRegistrationNumber: `BRN-V42-S04-${sequence}`,
    });
    const recruiter = await createActiveRecruiterContext({
      email: `recruiter.v42.s04.${sequence}@example.com`,
      company: manager.company,
      employeeCode: `NV-V42-S04-${sequence}`,
    });
    const agent = createTestAgent();
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    return { agent, manager, recruiter, recruiterToken, managerToken };
  };

  const createDraft = (context, body) => {
    return context.agent
      .post("/api/jobs")
      .set("Authorization", `Bearer ${context.recruiterToken}`)
      .send(body);
  };

  const updateDraft = (context, jobId, body, token = context.recruiterToken) => {
    return context.agent
      .patch(`/api/jobs/${jobId}`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  };

  const submitDraft = (context, jobId) => {
    return context.agent
      .post(`/api/jobs/${jobId}/submit`)
      .set("Authorization", `Bearer ${context.recruiterToken}`);
  };

  const readRawJob = (jobId) => {
    return Job.collection.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
    });
  };

  const seedCatalog = async () => {
    await migrateExperienceLevels();

    const field = await createFieldCategory({ name: "Software Engineering" });
    const position = await createPositionCategory({
      name: "Backend Engineer",
      parentCategoryId: field.id,
    });
    const experienceLevel = await ExperienceLevel.findOne({
      code: EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS,
    }).lean();

    return {
      field,
      position,
      experienceLevelId: experienceLevel._id.toString(),
    };
  };

  const buildCompleteContent = (catalog, overrides = {}) => {
    return {
      title: "Backend Engineer",
      jobDescription: "Build Job lifecycle APIs.",
      requiredSkills: ["Node.js"],
      salary: VALID_SALARIES.RANGE,
      fieldCategoryIds: [catalog.field.id],
      positionCategoryIds: [catalog.position.id],
      location: provinceOnlyLocation(),
      employmentType: EMPLOYMENT_TYPE.FULL_TIME,
      workModes: [WORK_MODE.ONSITE],
      experienceLevelId: catalog.experienceLevelId,
      applicationDeadline: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      ...overrides,
    };
  };

  describe("DRAFT Salary declaration", () => {
    it("allows a DRAFT with NOT_DECLARED Salary (State Matrix §7.1)", async () => {
      const context = await createRecruiterContext();
      const response = await createDraft(context, { title: "No salary yet" });

      expect(response.status).toBe(201);
      expect(response.body.job.salary).toBeNull();
      expect((await readRawJob(response.body.job.id)).salary).toBeNull();
    });

    it("accepts every Structured Salary type and canonical period on create (BR-02, BR-04–BR-07)", async () => {
      const context = await createRecruiterContext();

      for (const salary of Object.values(VALID_SALARIES)) {
        const response = await createDraft(context, { salary });

        expect(response.status).toBe(201);
        expect(response.body.job.salary).toEqual(canonicalSalary(salary));

        const raw = await readRawJob(response.body.job.id);

        expect(raw.salary).toEqual(canonicalSalary(salary));
        expect(raw.salary).not.toHaveProperty("_id");
        expect(raw.salary).not.toHaveProperty("currency");
        expect(raw).not.toHaveProperty("salaryText");
      }
    });

    it("replaces Salary as one unit on update and returns to NOT_DECLARED with null (Data §8.1, §8.2)", async () => {
      const context = await createRecruiterContext();
      const created = await createDraft(context, {});
      const jobId = created.body.job.id;

      for (const salary of Object.values(VALID_SALARIES)) {
        const response = await updateDraft(context, jobId, { salary });

        expect(response.status).toBe(200);
        expect(response.body.job.salary).toEqual(canonicalSalary(salary));
        expect((await readRawJob(jobId)).salary).toEqual(
          canonicalSalary(salary),
        );
      }

      const untouched = await updateDraft(context, jobId, { title: "Renamed" });

      expect(untouched.status).toBe(200);
      expect(untouched.body.job.salary).toEqual(
        canonicalSalary(VALID_SALARIES.NEGOTIABLE),
      );

      const cleared = await updateDraft(context, jobId, { salary: null });

      expect(cleared.status).toBe(200);
      expect(cleared.body.job.salary).toBeNull();
      expect((await readRawJob(jobId)).salary).toBeNull();
    });

    it("rejects every invalid Salary shape on create and update without persisting it (F01 rejections)", async () => {
      const context = await createRecruiterContext();
      const created = await createDraft(context, {
        salary: VALID_SALARIES.FIXED,
      });
      const jobId = created.body.job.id;

      for (const [label, salary] of INVALID_SALARIES) {
        const createResponse = await createDraft(context, { salary });
        const updateResponse = await updateDraft(context, jobId, { salary });

        expect(createResponse.status, label).toBe(400);
        expect(createResponse.body.error.details, label).toMatchObject({
          field: "salary",
        });
        expect(updateResponse.status, label).toBe(400);
        expect(updateResponse.body.error.details, label).toMatchObject({
          field: "salary",
        });
      }

      expect(await Job.countDocuments()).toBe(1);
      expect((await readRawJob(jobId)).salary).toEqual(
        canonicalSalary(VALID_SALARIES.FIXED),
      );
    });

    it("rejects a currency dimension and legacy salaryText as writable input (BR-01, BR-04)", async () => {
      const context = await createRecruiterContext();
      const created = await createDraft(context, {});
      const jobId = created.body.job.id;

      for (const body of [
        { salary: { ...VALID_SALARIES.RANGE, currency: "VND" } },
        { salary: { ...VALID_SALARIES.RANGE, currency: "USD" } },
        { salaryText: "10-20 triệu" },
        { salary: "10-20 triệu" },
      ]) {
        expect((await createDraft(context, body)).status).toBe(400);
        expect((await updateDraft(context, jobId, body)).status).toBe(400);
      }

      expect(await Job.countDocuments()).toBe(1);

      const raw = await readRawJob(jobId);

      expect(raw.salary).toBeNull();
      expect(raw).not.toHaveProperty("salaryText");
    });
  });

  describe("derived Salary projection (BR-01, BR-08)", () => {
    it("projects only the canonical Structured Salary and never a display truth", () => {
      for (const salary of Object.values(VALID_SALARIES)) {
        expect(toPublicJobSalary(canonicalSalary(salary))).toEqual(
          canonicalSalary(salary),
        );
      }

      expect(toPublicJobSalary(null)).toBeNull();
      expect(toPublicJobSalary(undefined)).toBeNull();
      expect(toPublicJobSalary("10-20 triệu")).toBeNull();

      for (const [, salary] of INVALID_SALARIES) {
        expect(toPublicJobSalary(canonicalSalary(salary))).toBeNull();
      }
    });

    it("reads a legacy salaryText-only Job as NOT_DECLARED and leaves the legacy value untouched (S05 boundary)", async () => {
      const context = await createRecruiterContext();
      const catalog = await seedCatalog();
      const created = await createDraft(
        context,
        buildCompleteContent(catalog, { salary: null }),
      );
      const jobId = created.body.job.id;

      await Job.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(jobId) },
        { $set: { salaryText: "10-20 triệu" }, $unset: { salary: "" } },
        { bypassDocumentValidation: true },
      );

      const readResponse = await context.agent
        .get(`/api/jobs/${jobId}`)
        .set("Authorization", `Bearer ${context.recruiterToken}`);

      expect(readResponse.status).toBe(200);
      expect(readResponse.body.job.salary).toBeNull();
      expect(readResponse.body.job).not.toHaveProperty("salaryText");

      const submitResponse = await submitDraft(context, jobId);

      expect(submitResponse.status).toBe(400);
      expect(submitResponse.body.error.details).toMatchObject({
        field: "salary",
      });

      const declared = await updateDraft(context, jobId, {
        salary: VALID_SALARIES.NEGOTIABLE,
      });

      expect(declared.status).toBe(200);

      const raw = await readRawJob(jobId);

      expect(raw.status).toBe(JOB_STATUS.DRAFT);
      expect(raw.salary).toEqual(canonicalSalary(VALID_SALARIES.NEGOTIABLE));
      expect(raw.salaryText).toBe("10-20 triệu");
    });
  });

  describe("Salary completeness and content immutability", () => {
    it("blocks leaving DRAFT while Salary is NOT_DECLARED or invalid (State Matrix §7.1)", async () => {
      const context = await createRecruiterContext();
      const catalog = await seedCatalog();
      const created = await createDraft(
        context,
        buildCompleteContent(catalog, { salary: null }),
      );
      const jobId = created.body.job.id;

      const notDeclared = await submitDraft(context, jobId);

      expect(notDeclared.status).toBe(400);
      expect(notDeclared.body.error.details).toMatchObject({ field: "salary" });

      await Job.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(jobId) },
        {
          $set: {
            salary: canonicalSalary({
              type: SALARY_TYPE.RANGE,
              minAmount: 3,
              maxAmount: 2,
              period: SALARY_PERIOD.MONTH,
            }),
          },
        },
        { bypassDocumentValidation: true },
      );

      const invalid = await submitDraft(context, jobId);

      expect(invalid.status).toBe(400);
      expect(invalid.body.error.details).toMatchObject({ field: "salary" });
      expect((await readRawJob(jobId)).status).toBe(JOB_STATUS.DRAFT);
    });

    it("treats NEGOTIABLE as DECLARED Salary that completes submit (BR-03)", async () => {
      const context = await createRecruiterContext();
      const catalog = await seedCatalog();
      const created = await createDraft(
        context,
        buildCompleteContent(catalog, { salary: VALID_SALARIES.NEGOTIABLE }),
      );

      const response = await submitDraft(context, created.body.job.id);

      expect(response.status).toBe(200);
      expect(response.body.job.status).toBe(JOB_STATUS.PENDING_APPROVAL);
      expect(response.body.job.salary).toEqual(
        canonicalSalary(VALID_SALARIES.NEGOTIABLE),
      );
    });

    it("cannot persist a legacy PENDING_APPROVAL Job that has only salaryText (S05 strict guard)", async () => {
      const context = await createRecruiterContext();
      const catalog = await seedCatalog();
      const created = await createDraft(
        context,
        buildCompleteContent(catalog, { salary: null }),
      );
      const jobId = created.body.job.id;

      await expect(
        Job.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(jobId) },
          {
            $set: {
              status: JOB_STATUS.PENDING_APPROVAL,
              salaryText: "Negotiate",
            },
            $unset: { salary: "" },
          },
        ),
      ).rejects.toMatchObject({ code: 121 });

      const raw = await readRawJob(jobId);

      expect(raw.status).toBe(JOB_STATUS.DRAFT);
      expect(raw.salary).toBeNull();
      expect(raw).not.toHaveProperty("salaryText");
    });

    it("keeps the same Structured Salary through submit, approve, reads, and Discovery, and freezes it after DRAFT", async () => {
      const context = await createRecruiterContext();
      const catalog = await seedCatalog();
      const created = await createDraft(
        context,
        buildCompleteContent(catalog, { salary: VALID_SALARIES.ETC }),
      );
      const jobId = created.body.job.id;
      const expected = canonicalSalary(VALID_SALARIES.ETC);

      const submitted = await submitDraft(context, jobId);
      const pendingEdit = await updateDraft(context, jobId, {
        salary: VALID_SALARIES.NEGOTIABLE,
      });
      const approved = await context.agent
        .post(`/api/jobs/${jobId}/approve`)
        .set("Authorization", `Bearer ${context.managerToken}`);
      const publishedEdit = await updateDraft(context, jobId, {
        salary: null,
      });
      const internalRead = await context.agent
        .get(`/api/jobs/${jobId}`)
        .set("Authorization", `Bearer ${context.managerToken}`);
      const discoveryList = await context.agent.get("/api/job-discovery/jobs");
      const discoveryDetail = await context.agent.get(
        `/api/job-discovery/jobs/${jobId}`,
      );

      expect(submitted.status).toBe(200);
      expect(pendingEdit.status).toBe(409);
      expect(approved.status).toBe(200);
      expect(approved.body.job.status).toBe(JOB_STATUS.PUBLISHED);
      expect(publishedEdit.status).toBe(409);
      expect(internalRead.status).toBe(200);
      expect(discoveryList.status).toBe(200);
      expect(discoveryDetail.status).toBe(200);

      const discoveryListJob = discoveryList.body.jobs.find(
        (job) => job.id === jobId,
      );

      for (const projected of [
        submitted.body.job,
        approved.body.job,
        internalRead.body.job,
        discoveryListJob,
        discoveryDetail.body.job,
      ]) {
        expect(projected.salary).toEqual(expected);
        expect(projected).not.toHaveProperty("salaryText");
      }

      expect((await readRawJob(jobId)).salary).toEqual(expected);
    });
  });

  describe("authorization and tenant boundary", () => {
    it("keeps Recruiter, Primary-only, and tenant rules ahead of Salary validation", async () => {
      const context = await createRecruiterContext();
      const created = await createDraft(context, {
        salary: VALID_SALARIES.FIXED,
      });
      const jobId = created.body.job.id;
      const peer = await createActiveRecruiterContext({
        email: `peer.v42.s04.${sequence}@example.com`,
        company: context.manager.company,
        employeeCode: `NV-V42-S04-PEER-${sequence}`,
      });
      const peerToken = await loginAndGetAccessToken(context.agent, {
        email: peer.user.email,
        password: DEFAULT_PASSWORD,
      });
      const foreign = await createRecruiterContext();

      const managerCreate = await context.agent
        .post("/api/jobs")
        .set("Authorization", `Bearer ${context.managerToken}`)
        .send({ salary: VALID_SALARIES.NEGOTIABLE });
      const anonymousCreate = await context.agent
        .post("/api/jobs")
        .send({ salary: VALID_SALARIES.NEGOTIABLE });

      for (const salary of [VALID_SALARIES.NEGOTIABLE, INVALID_SALARIES[0][1]]) {
        expect((await updateDraft(context, jobId, { salary }, peerToken)).status)
          .toBe(403);
        expect(
          (await updateDraft(context, jobId, { salary }, foreign.recruiterToken))
            .status,
        ).toBe(403);
      }

      expect(managerCreate.status).toBe(403);
      expect(anonymousCreate.status).toBe(401);
      expect(await Job.countDocuments()).toBe(1);
      expect((await readRawJob(jobId)).salary).toEqual(
        canonicalSalary(VALID_SALARIES.FIXED),
      );
    });
  });

  describe("persistence boundary (Data §5.3, §10.1)", () => {
    it("enforces the Structured Salary matrix at document and update validation", async () => {
      const context = await createRecruiterContext();
      const base = {
        companyId: context.manager.company._id,
        createdByCompanyMemberId: context.recruiter.membership._id,
        primaryRecruiterCompanyMemberId: context.recruiter.membership._id,
      };

      for (const [label, salary] of INVALID_SALARIES) {
        await expect(
          Job.create({ ...base, salary }),
          label,
        ).rejects.toThrow(mongoose.Error.ValidationError);
      }

      expect(await Job.countDocuments()).toBe(0);

      const created = await Job.create({
        ...base,
        salary: VALID_SALARIES.UP_TO,
      });
      const raw = await readRawJob(created._id.toString());

      expect(raw.salary).toEqual(canonicalSalary(VALID_SALARIES.UP_TO));
      expect(raw.salary).not.toHaveProperty("_id");

      for (const update of [
        { $set: { salary: INVALID_SALARIES[1][1] } },
        { $set: { salary: INVALID_SALARIES[10][1] } },
        { $set: { salary: INVALID_SALARIES[17][1] } },
      ]) {
        await expect(
          Job.findOneAndUpdate({ _id: created._id }, update, {
            returnDocument: "after",
            runValidators: true,
          }),
        ).rejects.toThrow(mongoose.Error.ValidationError);
      }

      expect((await readRawJob(created._id.toString())).salary).toEqual(
        canonicalSalary(VALID_SALARIES.UP_TO),
      );
    });
  });
});
