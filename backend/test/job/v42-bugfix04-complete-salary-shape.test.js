import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import JOB_STATUS from "../../src/constants/job-status.js";
import SALARY_PERIOD from "../../src/constants/salary-period.js";
import SALARY_TYPE from "../../src/constants/salary-type.js";
import {
  migrate,
  preflight,
  UNRESOLVED_REASON,
  verify,
} from "../../src/database/migrations/v42-legacy-salary-cutover.js";
import Job, { getJobSalaryInvariantErrors } from "../../src/models/job.model.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const { ObjectId } = mongoose.Types;

const DOCUMENT_VALIDATION_FAILURE = 121;

const SALARY_FIELDS = Object.freeze([
  "type",
  "minAmount",
  "maxAmount",
  "period",
  "customPeriodLabel",
]);

const salary = (type, minAmount, maxAmount, period, customPeriodLabel = null) => ({
  type,
  minAmount,
  maxAmount,
  period,
  customPeriodLabel,
});

const CANONICAL_SALARIES = Object.freeze({
  FIXED: salary(SALARY_TYPE.FIXED, 15_000_000, 15_000_000, SALARY_PERIOD.MONTH),
  RANGE: salary(SALARY_TYPE.RANGE, 10_000_000, 20_000_000, SALARY_PERIOD.MONTH),
  FROM: salary(SALARY_TYPE.FROM, 300_000, null, SALARY_PERIOD.DAY),
  UP_TO: salary(SALARY_TYPE.UP_TO, null, 2_000_000, SALARY_PERIOD.WEEK),
  ETC: salary(SALARY_TYPE.FROM, 5_000_000, null, SALARY_PERIOD.ETC, "dự án"),
  NEGOTIABLE: salary(SALARY_TYPE.NEGOTIABLE, null, null, null),
});

const withoutField = (value, field) => {
  const rest = { ...value };

  delete rest[field];

  return rest;
};

// Every canonical Salary with exactly one canonical key omitted.
const SPARSE_SALARIES = Object.freeze(
  Object.entries(CANONICAL_SALARIES).flatMap(([label, value]) =>
    SALARY_FIELDS.map((field) => [
      `${label} without ${field}`,
      withoutField(value, field),
    ]),
  ),
);

const TYPE_ONLY_NEGOTIABLE = Object.freeze({ type: SALARY_TYPE.NEGOTIABLE });

const rawJob = (fields) => ({
  companyId: new ObjectId(),
  createdByCompanyMemberId: new ObjectId(),
  primaryRecruiterCompanyMemberId: new ObjectId(),
  supportingRecruiterCompanyMemberIds: [],
  title: "Backend Engineer",
  status: JOB_STATUS.PUBLISHED,
  ...fields,
});

const readRawJob = (jobId) => Job.collection.findOne({ _id: jobId });

const readAllRawJobs = () => Job.collection.find({}).sort({ _id: 1 }).toArray();

const expectRejected = (write, label) =>
  expect(write, label).rejects.toMatchObject({
    code: DOCUMENT_VALIDATION_FAILURE,
  });

// Models a document persisted while the complete-shape guard was not enforced.
const seedUnguardedRawJob = async (fields) => {
  const { insertedId } = await Job.collection.insertOne(rawJob(fields), {
    bypassDocumentValidation: true,
  });

  return insertedId;
};

describe("V4.2 Bugfix Slice 04 — getJobSalaryInvariantErrors requires the complete canonical shape (Data §5.3, §9.1, §16)", () => {
  it("accepts every complete canonical Salary and a null Salary", () => {
    for (const [label, value] of Object.entries(CANONICAL_SALARIES)) {
      expect(getJobSalaryInvariantErrors(value), label).toEqual([]);
    }

    expect(getJobSalaryInvariantErrors(null)).toEqual([]);
  });

  it("rejects a NEGOTIABLE Salary that only persists its type", () => {
    expect(getJobSalaryInvariantErrors(TYPE_ONLY_NEGOTIABLE)).toEqual([
      "salary.minAmount is required",
      "salary.maxAmount is required",
      "salary.period is required",
      "salary.customPeriodLabel is required",
    ]);
  });

  it("rejects every Salary type missing any one canonical key", () => {
    for (const [label, value] of SPARSE_SALARIES) {
      expect(getJobSalaryInvariantErrors(value), label).not.toEqual([]);
    }
  });
});

describe("V4.2 Bugfix Slice 04 — complete canonical Salary on raw persistence and Final Cutover (Data §5.2, §5.3, §8.4, §10.1, §16)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    await migrate(mongoose.connection);
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("raw insert", () => {
    it("accepts every complete canonical Salary outside and inside DRAFT, and DRAFT with salary null", async () => {
      for (const [label, value] of Object.entries(CANONICAL_SALARIES)) {
        for (const status of [JOB_STATUS.PUBLISHED, JOB_STATUS.DRAFT]) {
          await expect(
            Job.collection.insertOne(rawJob({ status, salary: value })),
            `${label} ${status}`,
          ).resolves.toMatchObject({ acknowledged: true });
        }
      }

      await expect(
        Job.collection.insertOne(rawJob({ status: JOB_STATUS.DRAFT, salary: null })),
      ).resolves.toMatchObject({ acknowledged: true });
    });

    it("rejects a Job without the root salary field in every status", async () => {
      for (const status of Object.values(JOB_STATUS)) {
        await expectRejected(Job.collection.insertOne(rawJob({ status })), status);
      }

      expect(await Job.collection.countDocuments()).toBe(0);
    });

    it("rejects a type-only NEGOTIABLE Salary and every Salary missing one canonical key", async () => {
      for (const [label, value] of [
        ["NEGOTIABLE type only", TYPE_ONLY_NEGOTIABLE],
        ...SPARSE_SALARIES,
      ]) {
        for (const status of [JOB_STATUS.PUBLISHED, JOB_STATUS.DRAFT]) {
          await expectRejected(
            Job.collection.insertOne(rawJob({ status, salary: value })),
            `${label} ${status}`,
          );
        }
      }

      expect(await Job.collection.countDocuments()).toBe(0);
    });
  });

  describe("raw update", () => {
    it("rejects replacing Salary with a sparse shape, unsetting a Salary key, or unsetting salary on DRAFT", async () => {
      const published = await Job.collection.insertOne(
        rawJob({ salary: CANONICAL_SALARIES.RANGE }),
      );
      const draft = await Job.collection.insertOne(
        rawJob({ status: JOB_STATUS.DRAFT, salary: CANONICAL_SALARIES.NEGOTIABLE }),
      );

      for (const { insertedId } of [published, draft]) {
        for (const [label, value] of [
          ["NEGOTIABLE type only", TYPE_ONLY_NEGOTIABLE],
          ...SPARSE_SALARIES,
        ]) {
          await expectRejected(
            Job.collection.updateOne({ _id: insertedId }, { $set: { salary: value } }),
            label,
          );
        }

        for (const field of SALARY_FIELDS) {
          await expectRejected(
            Job.collection.updateOne(
              { _id: insertedId },
              { $unset: { [`salary.${field}`]: "" } },
            ),
            `unset salary.${field}`,
          );
        }
      }

      await expectRejected(
        Job.collection.updateOne(
          { _id: draft.insertedId },
          { $unset: { salary: "" } },
        ),
      );

      expect((await readRawJob(published.insertedId)).salary).toEqual(
        CANONICAL_SALARIES.RANGE,
      );
      expect((await readRawJob(draft.insertedId)).salary).toEqual(
        CANONICAL_SALARIES.NEGOTIABLE,
      );
    });
  });

  describe("cutover preflight / verify", () => {
    it("still certifies complete canonical Salary and DRAFT salary null", async () => {
      for (const value of Object.values(CANONICAL_SALARIES)) {
        await Job.collection.insertOne(rawJob({ salary: value }));
      }
      await Job.collection.insertOne(
        rawJob({ status: JOB_STATUS.DRAFT, salary: null }),
      );

      expect(await preflight(mongoose.connection)).toMatchObject({
        unresolved: { total: 0 },
        nonDraftWithoutValidSalary: 0,
        strictSalaryGuardActive: true,
      });
      await expect(verify(mongoose.connection)).resolves.toMatchObject({
        ok: true,
      });
    });

    it("marks persisted sparse Salary as INVALID_SALARY and fails verify even with the strict guard active", async () => {
      await Job.collection.insertOne(rawJob({ salary: CANONICAL_SALARIES.RANGE }));
      const typeOnlyId = await seedUnguardedRawJob({ salary: TYPE_ONLY_NEGOTIABLE });
      const sparseFromId = await seedUnguardedRawJob({
        salary: withoutField(CANONICAL_SALARIES.FROM, "maxAmount"),
      });
      const sparseDraftId = await seedUnguardedRawJob({
        status: JOB_STATUS.DRAFT,
        salary: withoutField(CANONICAL_SALARIES.FIXED, "customPeriodLabel"),
      });

      const report = await preflight(mongoose.connection);

      expect(report).toMatchObject({
        legacySalaryText: { total: 0 },
        unresolved: {
          total: 3,
          byReason: { [UNRESOLVED_REASON.INVALID_SALARY]: 3 },
        },
        nonDraftWithoutValidSalary: 2,
        strictSalaryGuardActive: true,
      });

      const documentsBefore = await readAllRawJobs();
      const error = await verify(mongoose.connection).catch((caught) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(
        /verification failed: 2 non-DRAFT Job\(s\) lack a valid Structured Salary; 3 Job\(s\) require remediation/,
      );
      for (const [jobId, status] of [
        [typeOnlyId, JOB_STATUS.PUBLISHED],
        [sparseFromId, JOB_STATUS.PUBLISHED],
        [sparseDraftId, JOB_STATUS.DRAFT],
      ]) {
        expect(error.message).toContain(
          `jobs/${jobId} (${status}): ${UNRESOLVED_REASON.INVALID_SALARY}`,
        );
      }
      expect(await readAllRawJobs()).toEqual(documentsBefore);
    });

    it("marks a DRAFT Job without the root salary field as MISSING_SALARY and fails verify", async () => {
      const missingId = await seedUnguardedRawJob({ status: JOB_STATUS.DRAFT });

      expect(await preflight(mongoose.connection)).toMatchObject({
        unresolved: {
          total: 1,
          byReason: { [UNRESOLVED_REASON.MISSING_SALARY]: 1 },
        },
        nonDraftWithoutValidSalary: 0,
        strictSalaryGuardActive: true,
      });
      await expect(verify(mongoose.connection)).rejects.toThrow(
        `jobs/${missingId} (${JOB_STATUS.DRAFT}): ${UNRESOLVED_REASON.MISSING_SALARY}`,
      );
    });

    it("blocks migrate before any write instead of completing a sparse Salary", async () => {
      await seedUnguardedRawJob({ salary: TYPE_ONLY_NEGOTIABLE });
      await seedUnguardedRawJob({ status: JOB_STATUS.DRAFT });
      const documentsBefore = await readAllRawJobs();

      const error = await migrate(mongoose.connection).catch((caught) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(
        /blocked before any write: 2 Job\(s\) require remediation/,
      );
      expect(error.inventory.unresolved.byReason).toEqual({
        [UNRESOLVED_REASON.INVALID_SALARY]: 1,
        [UNRESOLVED_REASON.MISSING_SALARY]: 1,
      });
      expect(await readAllRawJobs()).toEqual(documentsBefore);
    });
  });
});
