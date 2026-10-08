import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import JOB_STATUS from "../../src/constants/job-status.js";
import SALARY_PERIOD from "../../src/constants/salary-period.js";
import SALARY_TYPE from "../../src/constants/salary-type.js";
import {
  migrate,
  NON_TYPE_TARGET,
  parseLegacySalaryText,
  preflight,
  UNRESOLVED_REASON,
  verify,
} from "../../src/database/migrations/v42-legacy-salary-cutover.js";
import Job, { JOB_COLLECTION_VALIDATOR } from "../../src/models/job.model.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const { ObjectId } = mongoose.Types;

const FIXED_UPDATED_AT = new Date("2026-01-01T00:00:00.000Z");

const salary = (type, minAmount, maxAmount, period) => ({
  type,
  minAmount,
  maxAmount,
  period,
  customPeriodLabel: null,
});

const NEGOTIABLE_SALARY = salary(SALARY_TYPE.NEGOTIABLE, null, null, null);

const seedRawJob = async (fields) => {
  const { insertedId } = await Job.collection.insertOne({
    companyId: new ObjectId(),
    createdByCompanyMemberId: new ObjectId(),
    primaryRecruiterCompanyMemberId: new ObjectId(),
    supportingRecruiterCompanyMemberIds: [],
    title: "Backend Engineer",
    status: JOB_STATUS.PUBLISHED,
    updatedAt: FIXED_UPDATED_AT,
    ...fields,
  });

  return insertedId;
};

const readRawJob = (jobId) => Job.collection.findOne({ _id: jobId });

const readAllRawJobs = () => Job.collection.find({}).sort({ _id: 1 }).toArray();

const readJobCollectionOptions = async () => {
  const [collectionInfo] = await mongoose.connection.db
    .listCollections({ name: Job.collection.collectionName })
    .toArray();

  return collectionInfo.options;
};

// A database that predates the V4.2 cutover has no non-DRAFT Salary guard.
const simulatePreCutoverDatabase = () => {
  return mongoose.connection.db.command({
    collMod: Job.collection.collectionName,
    validationLevel: "off",
  });
};

const baseJobInput = (fields) => ({
  companyId: new ObjectId(),
  createdByCompanyMemberId: new ObjectId(),
  primaryRecruiterCompanyMemberId: new ObjectId(),
  title: "Backend Engineer",
  ...fields,
});

describe("V4.2 Slice 05 — Legacy Salary Preflight & Final Cutover (F01)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    await simulatePreCutoverDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("deterministic legacy mapping (Data §8.4, BR-01, BR-03)", () => {
    it("maps only explicit fixed, range, from, up-to values with VND and a canonical period", () => {
      const cases = [
        ["15,000,000 VND/month", salary(SALARY_TYPE.FIXED, 15_000_000, 15_000_000, SALARY_PERIOD.MONTH)],
        ["20 - 30 million VND/month", salary(SALARY_TYPE.RANGE, 20_000_000, 30_000_000, SALARY_PERIOD.MONTH)],
        ["20.000.000 – 30.000.000 VNĐ / tháng", salary(SALARY_TYPE.RANGE, 20_000_000, 30_000_000, SALARY_PERIOD.MONTH)],
        ["From 50000 VND per hour", salary(SALARY_TYPE.FROM, 50_000, null, SALARY_PERIOD.HOUR)],
        ["Từ 300000 đ/ca", salary(SALARY_TYPE.FROM, 300_000, null, SALARY_PERIOD.SHIFT)],
        ["Up to 2 million VND/week", salary(SALARY_TYPE.UP_TO, null, 2_000_000, SALARY_PERIOD.WEEK)],
        ["Tối đa 500000 VND/ngày", salary(SALARY_TYPE.UP_TO, null, 500_000, SALARY_PERIOD.DAY)],
      ];

      for (const [text, expected] of cases) {
        expect(parseLegacySalaryText(text), text).toEqual(expected);
      }
    });

    it("maps unambiguous negotiable wording to NEGOTIABLE without amount or period", () => {
      for (const text of ["Negotiable", "  Thỏa thuận ", "THOẢ THUẬN"]) {
        expect(parseLegacySalaryText(text), text).toEqual(NEGOTIABLE_SALARY);
      }
    });

    it("never guesses ambiguous or unrecognized legacy text", () => {
      const ambiguous = [
        "20 - 30 million VND",
        "15000000 VND",
        "15,000,000/month",
        "$1000/month",
        "1000 USD/month",
        "1.500 VND/hour",
        "1.5 million VND/month",
        "30 - 20 million VND/month",
        "20 million - 30 VND/month",
        "120 million VND/year",
        "~20 million VND/month",
        "Negotiable, from 10 million VND/month",
        "Competitive",
      ];

      for (const text of ambiguous) {
        expect(parseLegacySalaryText(text), text).toBeNull();
      }
    });
  });

  describe("read-only preflight", () => {
    it("reports the legacy inventory without mutating documents or the collection validator", async () => {
      await seedRawJob({ salaryText: "20,000,000 - 30,000,000 VND/month" });
      await seedRawJob({ status: JOB_STATUS.DRAFT, salaryText: "Negotiable" });
      await seedRawJob({ status: JOB_STATUS.DRAFT, salaryText: null });
      const ambiguousId = await seedRawJob({ salaryText: "20 - 30 million VND" });
      const missingId = await seedRawJob({ status: JOB_STATUS.CLOSED });
      await seedRawJob({ salary: NEGOTIABLE_SALARY });
      const documentsBefore = await readAllRawJobs();
      const optionsBefore = await readJobCollectionOptions();

      const report = await preflight(mongoose.connection);

      expect(report).toMatchObject({
        totalJobs: 6,
        legacySalaryText: { total: 4, draft: 2, nonDraft: 2 },
        deterministic: {
          total: 3,
          byTarget: {
            [SALARY_TYPE.RANGE]: 1,
            [SALARY_TYPE.NEGOTIABLE]: 1,
            [NON_TYPE_TARGET.NOT_DECLARED]: 1,
          },
        },
        unresolved: {
          total: 2,
          byReason: {
            [UNRESOLVED_REASON.UNRECOGNIZED_SALARY_TEXT]: 1,
            [UNRESOLVED_REASON.MISSING_SALARY]: 1,
          },
        },
        nonDraftWithoutValidSalary: 3,
        strictSalaryGuardActive: false,
      });
      expect(report.unresolved.records).toEqual(
        expect.arrayContaining([
          {
            id: ambiguousId.toString(),
            status: JOB_STATUS.PUBLISHED,
            reason: UNRESOLVED_REASON.UNRECOGNIZED_SALARY_TEXT,
            salaryText: "20 - 30 million VND",
          },
          {
            id: missingId.toString(),
            status: JOB_STATUS.CLOSED,
            reason: UNRESOLVED_REASON.MISSING_SALARY,
          },
        ]),
      );
      expect(await readAllRawJobs()).toEqual(documentsBefore);
      expect(await readJobCollectionOptions()).toEqual(optionsBefore);
    });
  });

  describe("deterministic conversion and Final Cutover", () => {
    it("converts each legacy Job atomically, removes salaryText, keeps existing Structured Salary, then applies the strict guard", async () => {
      const rangeId = await seedRawJob({
        salaryText: "20 - 30 million VND/month",
      });
      const negotiableId = await seedRawJob({
        status: JOB_STATUS.CLOSED,
        salaryText: "Thỏa thuận",
      });
      const fixedDraftId = await seedRawJob({
        status: JOB_STATUS.DRAFT,
        salaryText: "15,000,000 VND/month",
      });
      const emptyDraftId = await seedRawJob({
        status: JOB_STATUS.DRAFT,
        salaryText: "   ",
      });
      const existingSalary = salary(SALARY_TYPE.UP_TO, null, 900_000, SALARY_PERIOD.DAY);
      const staleTextId = await seedRawJob({
        status: JOB_STATUS.PENDING_APPROVAL,
        salary: existingSalary,
        salaryText: "Old free-form salary",
      });
      const canonicalId = await seedRawJob({ salary: NEGOTIABLE_SALARY });
      const canonicalBefore = await readRawJob(canonicalId);

      const result = await migrate(mongoose.connection);

      expect(result.converted).toBe(5);
      expect(result.verification).toMatchObject({
        legacySalaryText: { total: 0 },
        nonDraftWithoutValidSalary: 0,
        unresolved: { total: 0 },
        strictSalaryGuardActive: true,
      });

      const expectations = [
        [rangeId, salary(SALARY_TYPE.RANGE, 20_000_000, 30_000_000, SALARY_PERIOD.MONTH)],
        [negotiableId, NEGOTIABLE_SALARY],
        [fixedDraftId, salary(SALARY_TYPE.FIXED, 15_000_000, 15_000_000, SALARY_PERIOD.MONTH)],
        [emptyDraftId, null],
        [staleTextId, existingSalary],
      ];

      for (const [jobId, expectedSalary] of expectations) {
        const raw = await readRawJob(jobId);

        expect(raw.salary).toEqual(expectedSalary);
        expect(raw).not.toHaveProperty("salaryText");
        expect(raw.updatedAt).toEqual(FIXED_UPDATED_AT);
      }

      expect(await readRawJob(canonicalId)).toEqual(canonicalBefore);

      const options = await readJobCollectionOptions();

      expect(options).toMatchObject({
        validationLevel: "strict",
        validationAction: "error",
      });
      expect(JSON.stringify(options.validator)).toBe(
        JSON.stringify(JOB_COLLECTION_VALIDATOR),
      );
      await expect(verify(mongoose.connection)).resolves.toMatchObject({
        ok: true,
      });
    });

    it("is safe to rerun: an already cut-over collection is left unchanged", async () => {
      await seedRawJob({ salaryText: "Up to 2 million VND/week" });
      await seedRawJob({ status: JOB_STATUS.DRAFT, salaryText: null });
      await seedRawJob({ salary: NEGOTIABLE_SALARY });

      await migrate(mongoose.connection);
      const documentsAfterFirstRun = await readAllRawJobs();

      const rerun = await migrate(mongoose.connection);

      expect(rerun.converted).toBe(0);
      expect(rerun.preflight.deterministic.total).toBe(0);
      expect(await readAllRawJobs()).toEqual(documentsAfterFirstRun);
    });
  });

  describe("unresolved / remediation gate", () => {
    it("blocks before any write and keeps the guard inactive while any record needs remediation", async () => {
      const deterministicId = await seedRawJob({
        salaryText: "15,000,000 VND/month",
      });
      await seedRawJob({ salaryText: "20 - 30 million VND" });
      await seedRawJob({ status: JOB_STATUS.DRAFT, salaryText: "Competitive" });
      const documentsBefore = await readAllRawJobs();

      const error = await migrate(mongoose.connection).catch((caught) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(/blocked before any write: 2 Job\(s\) require remediation/);
      expect(error.inventory.unresolved.byReason).toEqual({
        [UNRESOLVED_REASON.UNRECOGNIZED_SALARY_TEXT]: 2,
      });
      expect(await readAllRawJobs()).toEqual(documentsBefore);
      expect((await readRawJob(deterministicId)).salaryText).toBe(
        "15,000,000 VND/month",
      );
      expect((await readJobCollectionOptions()).validationLevel).toBe("off");
    });

    it("detects non-DRAFT Jobs without a valid Structured Salary and never removes their salaryText", async () => {
      const missingId = await seedRawJob({ status: JOB_STATUS.EXPIRED });
      const nullTextId = await seedRawJob({ salaryText: null });
      const invalidId = await seedRawJob({
        salary: salary(SALARY_TYPE.RANGE, 30, 20, SALARY_PERIOD.MONTH),
      });

      await expect(verify(mongoose.connection)).rejects.toThrow(
        /3 non-DRAFT Job\(s\) lack a valid Structured Salary/,
      );

      const error = await migrate(mongoose.connection).catch((caught) => caught);

      expect(error.inventory.unresolved.byReason).toEqual({
        [UNRESOLVED_REASON.MISSING_SALARY]: 2,
        [UNRESOLVED_REASON.INVALID_SALARY]: 1,
      });
      expect(error.message).toContain(`jobs/${missingId}`);
      expect(await readRawJob(nullTextId)).toHaveProperty("salaryText", null);
      expect((await readRawJob(invalidId)).salary.minAmount).toBe(30);
    });

    it("fails final verification while the strict guard is not applied", async () => {
      await seedRawJob({ salary: NEGOTIABLE_SALARY });

      await expect(verify(mongoose.connection)).rejects.toThrow(
        /strict non-DRAFT Salary collection validator is not active/,
      );
    });
  });

  describe("strict non-DRAFT Salary persistence guard (State Matrix §7.1, Data §10.1)", () => {
    it("rejects persisting a non-DRAFT Job without Salary on every write path and still allows DRAFT with null", async () => {
      await migrate(mongoose.connection);

      await expect(
        Job.collection.insertOne(baseJobInput({
          supportingRecruiterCompanyMemberIds: [],
          status: JOB_STATUS.PUBLISHED,
        })),
      ).rejects.toMatchObject({ code: 121 });
      await expect(
        Job.collection.insertOne(baseJobInput({
          supportingRecruiterCompanyMemberIds: [],
          status: JOB_STATUS.CLOSED,
          salary: null,
        })),
      ).rejects.toMatchObject({ code: 121 });
      await expect(
        Job.create(baseJobInput({ status: JOB_STATUS.PUBLISHED })),
      ).rejects.toThrow(/outside DRAFT requires a Structured Salary/);

      const published = await Job.create(
        baseJobInput({ status: JOB_STATUS.PUBLISHED, salary: NEGOTIABLE_SALARY }),
      );

      await expect(
        Job.collection.updateOne(
          { _id: published._id },
          { $set: { salary: null } },
        ),
      ).rejects.toMatchObject({ code: 121 });
      expect((await readRawJob(published._id)).salary).toEqual(NEGOTIABLE_SALARY);

      const draft = await Job.create(baseJobInput({ salary: null }));

      expect((await readRawJob(draft._id)).salary).toBeNull();
      await expect(
        Job.collection.insertOne(baseJobInput({
          supportingRecruiterCompanyMemberIds: [],
          status: JOB_STATUS.DRAFT,
          salary: null,
        })),
      ).resolves.toMatchObject({ acknowledged: true });
      await expect(
        Job.updateOne(
          { _id: draft._id },
          { $set: { status: JOB_STATUS.PENDING_APPROVAL } },
        ),
      ).rejects.toMatchObject({ code: 121 });
      expect((await readRawJob(draft._id)).status).toBe(JOB_STATUS.DRAFT);
    });
  });
});
