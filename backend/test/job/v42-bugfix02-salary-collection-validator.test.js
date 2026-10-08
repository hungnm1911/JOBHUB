import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import JOB_STATUS from "../../src/constants/job-status.js";
import SALARY_PERIOD from "../../src/constants/salary-period.js";
import SALARY_TYPE from "../../src/constants/salary-type.js";
import Job, { getJobSalaryInvariantErrors } from "../../src/models/job.model.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const { Decimal128, Double, Int32, Long, ObjectId } = mongoose.mongo;

const DOCUMENT_VALIDATION_FAILURE = 121;
const PARITY_PROBE_COLLECTION = "v42_bugfix02_salary_parity_probe";

const canonicalSalary = (salary) => ({
  minAmount: null,
  maxAmount: null,
  period: null,
  customPeriodLabel: null,
  ...salary,
});

const VALID_SALARIES = Object.freeze({
  FIXED: { type: SALARY_TYPE.FIXED, minAmount: 15_000_000, maxAmount: 15_000_000, period: SALARY_PERIOD.MONTH },
  RANGE: { type: SALARY_TYPE.RANGE, minAmount: 10_000_000, maxAmount: 20_000_000, period: SALARY_PERIOD.MONTH },
  RANGE_EQUAL_BOUNDS: { type: SALARY_TYPE.RANGE, minAmount: 25_000, maxAmount: 25_000, period: SALARY_PERIOD.HOUR },
  FROM: { type: SALARY_TYPE.FROM, minAmount: 300_000, period: SALARY_PERIOD.DAY },
  UP_TO: { type: SALARY_TYPE.UP_TO, maxAmount: 2_000_000, period: SALARY_PERIOD.WEEK },
  SHIFT: { type: SALARY_TYPE.FIXED, minAmount: 250_000, maxAmount: 250_000, period: SALARY_PERIOD.SHIFT },
  ETC: { type: SALARY_TYPE.FROM, minAmount: 5_000_000, period: SALARY_PERIOD.ETC, customPeriodLabel: "dự án" },
  NEGOTIABLE: { type: SALARY_TYPE.NEGOTIABLE },
});

const INVALID_SALARIES = Object.freeze([
  ["unknown type", { type: "MONTHLY", minAmount: 1, maxAmount: 1, period: SALARY_PERIOD.MONTH }],
  ["missing type", { minAmount: 1, maxAmount: 1, period: SALARY_PERIOD.MONTH }],
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
  ["non-ETC with empty label", { type: SALARY_TYPE.FROM, minAmount: 1, period: SALARY_PERIOD.MONTH, customPeriodLabel: "" }],
  ["non-integer amount", { type: SALARY_TYPE.FROM, minAmount: 1.5, period: SALARY_PERIOD.MONTH }],
  ["string amount", { type: SALARY_TYPE.FROM, minAmount: "1000000", period: SALARY_PERIOD.MONTH }],
  ["empty object", {}],
]);

const NON_CANONICAL_SALARY_FIELDS = Object.freeze([
  ["currency USD", { currency: "USD" }],
  ["currency VND", { currency: "VND" }],
  ["null currency", { currency: null }],
  ["unknown field", { note: "thưởng" }],
  ["embedded _id", { _id: new ObjectId() }],
]);

const fromSalary = (minAmount, extra = {}) => ({
  type: SALARY_TYPE.FROM,
  minAmount,
  period: SALARY_PERIOD.MONTH,
  ...extra,
});

const etcSalary = (customPeriodLabel) => ({
  type: SALARY_TYPE.FROM,
  minAmount: 1_000_000,
  period: SALARY_PERIOD.ETC,
  customPeriodLabel,
});

// BSON representations whose validity must follow what the helper sees after
// the driver deserializes the persisted value.
const BSON_EDGE_SALARIES = Object.freeze([
  ["int32 amount", fromSalary(new Int32(1_000_000))],
  ["integral double amount", fromSalary(new Double(1_000_000))],
  ["long amount", fromSalary(Long.fromNumber(5_000_000_000))],
  ["amount above int32", fromSalary(5_000_000_000)],
  ["largest safe integer amount", fromSalary(Number.MAX_SAFE_INTEGER)],
  ["smallest safe integer amount", fromSalary(Number.MIN_SAFE_INTEGER)],
  ["negative amount", fromSalary(-1)],
  ["zero amount", fromSalary(0)],
  ["amount beyond safe integer", fromSalary(Number.MAX_SAFE_INTEGER + 1)],
  ["long beyond safe integer", fromSalary(Long.fromString("9007199254740993"))],
  ["NaN amount", fromSalary(Number.NaN)],
  ["infinite amount", fromSalary(Number.POSITIVE_INFINITY)],
  ["decimal128 amount", fromSalary(Decimal128.fromString("1000000"))],
  ["boolean amount", fromSalary(true)],
  ["FIXED int32 equals double", { type: SALARY_TYPE.FIXED, minAmount: new Int32(7), maxAmount: new Double(7), period: SALARY_PERIOD.DAY }],
  ["RANGE long and double bounds", { type: SALARY_TYPE.RANGE, minAmount: Long.fromNumber(3), maxAmount: new Double(4), period: SALARY_PERIOD.DAY }],
  ["array type", { type: [SALARY_TYPE.NEGOTIABLE] }],
  ["array amount", fromSalary([1_000_000])],
  ["ETC label surrounded by whitespace", etcSalary("  dự án  ")],
  ["ETC tab/newline label", etcSalary("\t\n\r\v\f")],
  ["ETC no-break space label", etcSalary("\u00a0\u3000\u2028\u202f")],
  ["ETC byte-order-mark label", etcSalary("\ufeff")],
  ["ETC null-character label", etcSalary("\u0000")],
  ["ETC numeric label", etcSalary(7)],
]);

const NON_OBJECT_SALARIES = Object.freeze([
  ["string Salary", "15,000,000 VND/month"],
  ["array Salary", [VALID_SALARIES.NEGOTIABLE]],
  ["numeric Salary", 15_000_000],
]);

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

const expectRejected = (write, label) =>
  expect(write, label).rejects.toMatchObject({
    code: DOCUMENT_VALIDATION_FAILURE,
  });

const insertSucceeds = async (document) => {
  try {
    await Job.collection.insertOne(document);
    return true;
  } catch (error) {
    if (error?.code === DOCUMENT_VALIDATION_FAILURE) {
      return false;
    }

    throw error;
  }
};

// The helper's verdict on a Salary as it reads back from an unvalidated
// collection, i.e. what any reader of persisted data would see.
const helperAcceptsPersisted = async (salary) => {
  const probe = mongoose.connection.db.collection(PARITY_PROBE_COLLECTION);
  const { insertedId } = await probe.insertOne({ salary });
  const persisted = await probe.findOne({ _id: insertedId });

  return getJobSalaryInvariantErrors(persisted.salary).length === 0;
};

describe("V4.2 Bugfix Slice 02 — canonical Structured Salary on raw persistence (Data §5.3, §7.1, §7.2, §10.1, §16)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
    await mongoose.connection.db
      .collection(PARITY_PROBE_COLLECTION)
      .deleteMany({});
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("raw insert", () => {
    it("accepts every canonical Salary type with explicit nulls outside and inside DRAFT, and rejects its sparse shape", async () => {
      for (const [label, salary] of Object.entries(VALID_SALARIES)) {
        for (const status of [JOB_STATUS.PUBLISHED, JOB_STATUS.DRAFT]) {
          await expect(
            Job.collection.insertOne(
              rawJob({ status, salary: canonicalSalary(salary) }),
            ),
            `${label} ${status}`,
          ).resolves.toMatchObject({ acknowledged: true });
          await expectRejected(
            Job.collection.insertOne(rawJob({ status, salary })),
            `sparse ${label} ${status}`,
          );
        }
      }
    });

    it("rejects a Salary that carries currency or any other non-canonical field", async () => {
      for (const [typeLabel, salary] of Object.entries(VALID_SALARIES)) {
        for (const [fieldLabel, extra] of NON_CANONICAL_SALARY_FIELDS) {
          for (const status of [JOB_STATUS.PUBLISHED, JOB_STATUS.DRAFT]) {
            await expectRejected(
              Job.collection.insertOne(
                rawJob({ status, salary: { ...canonicalSalary(salary), ...extra } }),
              ),
              `${typeLabel} + ${fieldLabel} ${status}`,
            );
          }
        }
      }

      expect(await Job.collection.countDocuments()).toBe(0);
    });

    it("rejects the Final Acceptance FIXED Salary with a USD currency", async () => {
      await expectRejected(
        Job.collection.insertOne(
          rawJob({
            salary: {
              type: SALARY_TYPE.FIXED,
              minAmount: 20_000_000,
              maxAmount: 20_000_000,
              period: SALARY_PERIOD.MONTH,
              customPeriodLabel: null,
              currency: "USD",
            },
          }),
        ),
      );
    });

    it("rejects every invalid Type/amount/period combination and non-object Salary, including on DRAFT", async () => {
      for (const [label, salary] of [...INVALID_SALARIES, ...NON_OBJECT_SALARIES]) {
        for (const status of [JOB_STATUS.PUBLISHED, JOB_STATUS.DRAFT]) {
          await expectRejected(
            Job.collection.insertOne(rawJob({ status, salary })),
            `${label} ${status}`,
          );
        }
      }
    });

    it("still rejects a non-DRAFT Job without Salary, accepts DRAFT with null Salary, and rejects DRAFT without the salary field", async () => {
      await expectRejected(Job.collection.insertOne(rawJob({})));
      await expectRejected(Job.collection.insertOne(rawJob({ salary: null })));
      await expectRejected(
        Job.collection.insertOne(
          rawJob({ status: JOB_STATUS.CLOSED, salary: null }),
        ),
      );

      await expect(
        Job.collection.insertOne(rawJob({ status: JOB_STATUS.DRAFT, salary: null })),
      ).resolves.toMatchObject({ acknowledged: true });
      await expectRejected(
        Job.collection.insertOne(rawJob({ status: JOB_STATUS.DRAFT })),
      );
    });
  });

  describe("raw update", () => {
    it("accepts replacing Salary with every canonical Salary type", async () => {
      const { insertedId } = await Job.collection.insertOne(
        rawJob({ salary: canonicalSalary(VALID_SALARIES.NEGOTIABLE) }),
      );

      for (const [label, salary] of Object.entries(VALID_SALARIES)) {
        await expect(
          Job.collection.updateOne(
            { _id: insertedId },
            { $set: { salary: canonicalSalary(salary) } },
          ),
          label,
        ).resolves.toMatchObject({ acknowledged: true, matchedCount: 1 });
        expect((await readRawJob(insertedId)).salary, label).toEqual(
          canonicalSalary(salary),
        );
      }
    });

    it("rejects adding currency or an unknown field to a persisted Salary, by replacement or dotted path", async () => {
      const salary = canonicalSalary(VALID_SALARIES.FIXED);
      const { insertedId } = await Job.collection.insertOne(rawJob({ salary }));

      for (const [label, extra] of NON_CANONICAL_SALARY_FIELDS) {
        await expectRejected(
          Job.collection.updateOne(
            { _id: insertedId },
            { $set: { salary: { ...salary, ...extra } } },
          ),
          `replace ${label}`,
        );

        const [[field, value]] = Object.entries(extra);

        await expectRejected(
          Job.collection.updateOne(
            { _id: insertedId },
            { $set: { [`salary.${field}`]: value } },
          ),
          `dotted ${label}`,
        );
      }

      await expectRejected(
        Job.updateOne(
          { _id: insertedId },
          { $set: { "salary.currency": "USD" } },
          { strict: false },
        ),
      );
      expect((await readRawJob(insertedId)).salary).toEqual(salary);
    });

    it("rejects updates that break the Type matrix, also on DRAFT", async () => {
      const draft = await Job.collection.insertOne(
        rawJob({ status: JOB_STATUS.DRAFT, salary: null }),
      );
      const published = await Job.collection.insertOne(
        rawJob({ salary: canonicalSalary(VALID_SALARIES.RANGE) }),
      );

      for (const [label, salary] of INVALID_SALARIES) {
        for (const { insertedId } of [draft, published]) {
          await expectRejected(
            Job.collection.updateOne({ _id: insertedId }, { $set: { salary } }),
            label,
          );
        }
      }

      await expectRejected(
        Job.collection.updateOne(
          { _id: published.insertedId },
          { $set: { "salary.minAmount": 30_000_000 } },
        ),
      );
      expect((await readRawJob(draft.insertedId)).salary).toBeNull();
      expect((await readRawJob(published.insertedId)).salary).toEqual(
        canonicalSalary(VALID_SALARIES.RANGE),
      );
    });

    it("still rejects removing Salary from a non-DRAFT Job and still allows clearing it on DRAFT", async () => {
      const published = await Job.collection.insertOne(
        rawJob({ salary: canonicalSalary(VALID_SALARIES.NEGOTIABLE) }),
      );
      const draft = await Job.collection.insertOne(
        rawJob({
          status: JOB_STATUS.DRAFT,
          salary: canonicalSalary(VALID_SALARIES.NEGOTIABLE),
        }),
      );

      await expectRejected(
        Job.collection.updateOne(
          { _id: published.insertedId },
          { $set: { salary: null } },
        ),
      );
      await expectRejected(
        Job.collection.updateOne(
          { _id: published.insertedId },
          { $unset: { salary: "" } },
        ),
      );
      await expect(
        Job.collection.updateOne(
          { _id: draft.insertedId },
          { $set: { salary: null } },
        ),
      ).resolves.toMatchObject({ modifiedCount: 1 });
      expect((await readRawJob(draft.insertedId)).salary).toBeNull();
    });
  });

  describe("parity with getJobSalaryInvariantErrors", () => {
    it("accepts exactly the persisted Salaries that the canonical helper accepts", async () => {
      const cases = [
        ...Object.entries(VALID_SALARIES),
        ...Object.entries(VALID_SALARIES).map(([label, salary]) => [
          `${label} explicit nulls`,
          canonicalSalary(salary),
        ]),
        ...INVALID_SALARIES,
        ...NON_CANONICAL_SALARY_FIELDS.map(([label, extra]) => [
          label,
          { ...canonicalSalary(VALID_SALARIES.FIXED), ...extra },
        ]),
        ...BSON_EDGE_SALARIES,
        ...NON_OBJECT_SALARIES,
      ];

      for (const [label, salary] of cases) {
        const expected = await helperAcceptsPersisted(salary);

        for (const status of [JOB_STATUS.PUBLISHED, JOB_STATUS.DRAFT]) {
          expect(
            await insertSucceeds(rawJob({ status, salary })),
            `${label} ${status}`,
          ).toBe(expected);
        }
      }
    });
  });
});
