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
import Job from "../../src/models/job.model.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const { ObjectId } = mongoose.Types;

const salary = (type, minAmount, maxAmount, period, customPeriodLabel = null) => ({
  type,
  minAmount,
  maxAmount,
  period,
  customPeriodLabel,
});

const CANONICAL_SALARIES = Object.freeze([
  salary(SALARY_TYPE.FIXED, 15_000_000, 15_000_000, SALARY_PERIOD.MONTH),
  salary(SALARY_TYPE.RANGE, 20_000_000, 30_000_000, SALARY_PERIOD.MONTH),
  salary(SALARY_TYPE.FROM, 300_000, null, SALARY_PERIOD.SHIFT),
  salary(SALARY_TYPE.UP_TO, null, 2_000_000, SALARY_PERIOD.WEEK),
  salary(SALARY_TYPE.FROM, 5_000_000, null, SALARY_PERIOD.ETC, "dự án"),
  salary(SALARY_TYPE.NEGOTIABLE, null, null, null),
]);

const NON_CANONICAL_SALARY_FIELDS = Object.freeze([
  ["currency VND", { currency: "VND" }],
  ["currency USD", { currency: "USD" }],
  ["null currency", { currency: null }],
  ["unknown field", { note: "thưởng" }],
]);

const BASE_SALARY = CANONICAL_SALARIES[1];

// Pre-Bugfix 02 guard: only "DRAFT or Salary is an object", no Salary shape.
const STALE_SALARY_GUARD = Object.freeze({
  $or: [{ status: JOB_STATUS.DRAFT }, { salary: { $type: "object" } }],
});

const rawJob = (fields) => ({
  companyId: new ObjectId(),
  createdByCompanyMemberId: new ObjectId(),
  primaryRecruiterCompanyMemberId: new ObjectId(),
  supportingRecruiterCompanyMemberIds: [],
  title: "Backend Engineer",
  status: JOB_STATUS.PUBLISHED,
  ...fields,
});

const seedRawJob = async (fields) => {
  const { insertedId } = await Job.collection.insertOne(rawJob(fields));

  return insertedId;
};

// Models data persisted before the current strict guard existed.
const seedUnguardedRawJob = async (fields) => {
  const { insertedId } = await Job.collection.insertOne(rawJob(fields), {
    bypassDocumentValidation: true,
  });

  return insertedId;
};

const readAllRawJobs = () => Job.collection.find({}).sort({ _id: 1 }).toArray();

const readJobCollectionOptions = async () => {
  const [collectionInfo] = await mongoose.connection.db
    .listCollections({ name: Job.collection.collectionName })
    .toArray();

  return collectionInfo.options;
};

const applyCollectionGuard = (validator, validationLevel = "strict") => {
  return mongoose.connection.db.command({
    collMod: Job.collection.collectionName,
    validator,
    validationLevel,
    validationAction: "error",
  });
};

describe("V4.2 Bugfix 03 — Final Cutover verification requires canonical persisted Salary (Data §8.4, §16)", () => {
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

  it("certifies a cut-over collection whose every persisted Salary is canonical", async () => {
    for (const canonicalSalary of CANONICAL_SALARIES) {
      await seedRawJob({ salary: canonicalSalary });
    }
    await seedRawJob({ status: JOB_STATUS.DRAFT, salary: null });

    const report = await preflight(mongoose.connection);

    expect(report).toMatchObject({
      totalJobs: CANONICAL_SALARIES.length + 1,
      legacySalaryText: { total: 0 },
      deterministic: { total: 0 },
      unresolved: { total: 0 },
      nonDraftWithoutValidSalary: 0,
      strictSalaryGuardActive: true,
    });
    await expect(verify(mongoose.connection)).resolves.toMatchObject({
      ok: true,
      unresolved: { total: 0 },
      nonDraftWithoutValidSalary: 0,
      strictSalaryGuardActive: true,
    });
  });

  it("never certifies a non-DRAFT Job persisting currency or an unknown Salary field, even with the strict guard active", async () => {
    for (const [label, extra] of NON_CANONICAL_SALARY_FIELDS) {
      await seedRawJob({ salary: BASE_SALARY });
      const noncanonicalId = await seedUnguardedRawJob({
        salary: { ...BASE_SALARY, ...extra },
      });

      const report = await preflight(mongoose.connection);

      expect(report, label).toMatchObject({
        legacySalaryText: { total: 0 },
        unresolved: {
          total: 1,
          byReason: { [UNRESOLVED_REASON.INVALID_SALARY]: 1 },
          records: [
            {
              id: noncanonicalId.toString(),
              status: JOB_STATUS.PUBLISHED,
              reason: UNRESOLVED_REASON.INVALID_SALARY,
            },
          ],
        },
        nonDraftWithoutValidSalary: 1,
        strictSalaryGuardActive: true,
      });

      const documentsBefore = await readAllRawJobs();
      const error = await verify(mongoose.connection).catch((caught) => caught);

      expect(error, label).toBeInstanceOf(Error);
      expect(error.message, label).toMatch(
        /verification failed: 1 non-DRAFT Job\(s\) lack a valid Structured Salary; 1 Job\(s\) require remediation/,
      );
      expect(error.message, label).toContain(
        `jobs/${noncanonicalId} (${JOB_STATUS.PUBLISHED}): ${UNRESOLVED_REASON.INVALID_SALARY}`,
      );
      expect(error.inventory.strictSalaryGuardActive, label).toBe(true);
      expect(await readAllRawJobs(), label).toEqual(documentsBefore);

      await clearDatabase();
    }
  });

  it("never certifies a DRAFT Job persisting a noncanonical Salary", async () => {
    const noncanonicalId = await seedUnguardedRawJob({
      status: JOB_STATUS.DRAFT,
      salary: { ...BASE_SALARY, currency: "VND" },
    });

    const report = await preflight(mongoose.connection);

    expect(report).toMatchObject({
      unresolved: {
        total: 1,
        byReason: { [UNRESOLVED_REASON.INVALID_SALARY]: 1 },
      },
      nonDraftWithoutValidSalary: 0,
      strictSalaryGuardActive: true,
    });
    await expect(verify(mongoose.connection)).rejects.toThrow(
      `jobs/${noncanonicalId} (${JOB_STATUS.DRAFT}): ${UNRESOLVED_REASON.INVALID_SALARY}`,
    );
  });

  it("blocks the cutover before any write instead of remediating a noncanonical Salary", async () => {
    await seedUnguardedRawJob({ salary: { ...BASE_SALARY, currency: "USD" } });
    await seedUnguardedRawJob({
      status: JOB_STATUS.DRAFT,
      salaryText: "15,000,000 VND/month",
    });
    const documentsBefore = await readAllRawJobs();

    const error = await migrate(mongoose.connection).catch((caught) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(
      /blocked before any write: 1 Job\(s\) require remediation/,
    );
    expect(error.inventory.unresolved.byReason).toEqual({
      [UNRESOLVED_REASON.INVALID_SALARY]: 1,
    });
    expect(await readAllRawJobs()).toEqual(documentsBefore);
  });

  it("does not treat a stale or non-strict collection validator as the strict Salary guard", async () => {
    await seedRawJob({ salary: BASE_SALARY });

    for (const [label, validator, validationLevel] of [
      ["stale pre-Bugfix 02 validator", STALE_SALARY_GUARD, "strict"],
      ["current validator at moderate level", (await readJobCollectionOptions()).validator, "moderate"],
    ]) {
      await applyCollectionGuard(validator, validationLevel);

      expect(
        (await preflight(mongoose.connection)).strictSalaryGuardActive,
        label,
      ).toBe(false);
      await expect(verify(mongoose.connection), label).rejects.toThrow(
        /strict non-DRAFT Salary collection validator is not active/,
      );
    }

    // The existing cutover flow refreshes the guard on canonical data.
    await migrate(mongoose.connection);

    await expect(verify(mongoose.connection)).resolves.toMatchObject({
      ok: true,
      strictSalaryGuardActive: true,
    });
  });
});
