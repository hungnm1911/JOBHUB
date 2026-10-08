import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

import JOB_STATUS from "../../src/constants/job-status.js";
import SALARY_PERIOD from "../../src/constants/salary-period.js";
import SALARY_TYPE from "../../src/constants/salary-type.js";
import {
  migrate as migrateV6SupportingRecruiters,
} from "../../src/database/migrations/v6-supporting-recruiter-backfill.js";
import {
  migrate,
  preflight,
  verify,
} from "../../src/database/migrations/v42-legacy-salary-cutover.js";
import Job, {
  assertJobCollectionInvariantsActive,
  isJobCollectionValidatorActive,
  JOB_COLLECTION_VALIDATOR,
} from "../../src/models/job.model.js";
import { createDraftJob, updateDraftJob } from "../../src/services/job.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const { ObjectId } = mongoose.Types;

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const salary = (type, minAmount, maxAmount, period, customPeriodLabel = null) => ({
  type,
  minAmount,
  maxAmount,
  period,
  customPeriodLabel,
});

const RANGE_SALARY = salary(
  SALARY_TYPE.RANGE,
  20_000_000,
  30_000_000,
  SALARY_PERIOD.MONTH,
);

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

  return collectionInfo?.options ?? {};
};

// A database that predates the V4.2 cutover enforces no current Job guard.
const simulatePreCutoverDatabase = () => {
  return mongoose.connection.db.command({
    collMod: Job.collection.collectionName,
    validationLevel: "off",
  });
};

const applyRawValidator = (validator) => {
  return mongoose.connection.db.command({
    collMod: Job.collection.collectionName,
    validator,
    validationLevel: "strict",
    validationAction: "error",
  });
};

// Records every validator mutation issued on the Job collection.
const spyOnJobValidatorMutations = () => {
  const { db } = mongoose.connection;
  const command = vi.spyOn(db, "command");
  const createCollection = vi.spyOn(db, "createCollection");

  return () => [
    ...command.mock.calls
      .map(([commandDocument]) => commandDocument)
      .filter(
        (commandDocument) =>
          commandDocument?.collMod === Job.collection.collectionName,
      ),
    ...createCollection.mock.calls.filter(
      ([collectionName]) => collectionName === Job.collection.collectionName,
    ),
  ];
};

describe("V4.2 Bugfix 05 — strict Salary guard activation ownership (Data §8.4, §10.1, §16)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    await migrate(mongoose.connection);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("runtime startup only verifies", () => {
    it("fails closed on a legacy, un-cut-over database without any collMod", async () => {
      await simulatePreCutoverDatabase();
      await seedRawJob({ salaryText: "20 - 30 million VND" });
      const optionsBefore = await readJobCollectionOptions();
      const documentsBefore = await readAllRawJobs();
      const validatorMutations = spyOnJobValidatorMutations();

      await expect(
        assertJobCollectionInvariantsActive(mongoose.connection),
      ).rejects.toThrow(/v42-legacy-salary-cutover/);

      expect(validatorMutations()).toEqual([]);
      expect(await readJobCollectionOptions()).toEqual(optionsBefore);
      expect(await readAllRawJobs()).toEqual(documentsBefore);
      expect(await isJobCollectionValidatorActive(mongoose.connection)).toBe(
        false,
      );
    });

    it("never activates the current guard over a stale one, even on canonical data", async () => {
      await seedRawJob({ salary: RANGE_SALARY });
      await applyRawValidator(STALE_SALARY_GUARD);
      const validatorMutations = spyOnJobValidatorMutations();

      await expect(
        assertJobCollectionInvariantsActive(mongoose.connection),
      ).rejects.toThrow(/missing or stale.*v42-legacy-salary-cutover/s);

      expect(validatorMutations()).toEqual([]);
      expect((await readJobCollectionOptions()).validator).toEqual(
        STALE_SALARY_GUARD,
      );
    });

    it("fails closed when the current validator sits over data that was never cut over", async () => {
      await simulatePreCutoverDatabase();
      const legacyId = await seedRawJob({ salaryText: "Negotiable" });
      await applyRawValidator(JOB_COLLECTION_VALIDATOR);

      await expect(
        assertJobCollectionInvariantsActive(mongoose.connection),
      ).rejects.toThrow(`jobs/${legacyId}`);
    });

    it("passes on a cut-over database with the current guard, without mutating it", async () => {
      await seedRawJob({ salary: RANGE_SALARY });
      await seedRawJob({ status: JOB_STATUS.DRAFT, salary: null });
      const optionsBefore = await readJobCollectionOptions();
      const validatorMutations = spyOnJobValidatorMutations();

      await expect(
        assertJobCollectionInvariantsActive(mongoose.connection),
      ).resolves.toBeUndefined();

      expect(validatorMutations()).toEqual([]);
      expect(await readJobCollectionOptions()).toEqual(optionsBefore);
    });

    it("is the Job collection step of the production bootstrap", () => {
      const entrySource = fs.readFileSync(
        path.join(backendRoot, "index.js"),
        "utf8",
      );
      const startServerBody = entrySource.match(
        /const startServer = async \(\) => \{([\s\S]*?)\n\};/,
      )?.[1];

      expect(startServerBody).toContain(
        "await assertJobCollectionInvariantsActive(",
      );
      expect(entrySource).not.toMatch(/ensureJobCollectionInvariants|collMod/);
    });
  });

  describe("V4.2 migration is the only activation owner", () => {
    it("blocks an unready database before any validator mutation", async () => {
      await simulatePreCutoverDatabase();
      await seedRawJob({ salaryText: "20 - 30 million VND" });
      await seedRawJob({ salary: { ...RANGE_SALARY, currency: "VND" } });
      const optionsBefore = await readJobCollectionOptions();
      const documentsBefore = await readAllRawJobs();
      const validatorMutations = spyOnJobValidatorMutations();

      await expect(migrate(mongoose.connection)).rejects.toThrow(
        /blocked before any write/,
      );

      expect(validatorMutations()).toEqual([]);
      expect(await readJobCollectionOptions()).toEqual(optionsBefore);
      expect(await readAllRawJobs()).toEqual(documentsBefore);
    });

    it("applies the current strict guard on canonical data and verifies it", async () => {
      await simulatePreCutoverDatabase();
      await seedRawJob({ salary: RANGE_SALARY });
      await seedRawJob({ status: JOB_STATUS.DRAFT, salary: null });

      const result = await migrate(mongoose.connection);

      expect(result.preflight.strictSalaryGuardActive).toBe(false);
      expect(result.verification).toMatchObject({
        legacySalaryText: { total: 0 },
        unresolved: { total: 0 },
        nonDraftWithoutValidSalary: 0,
        strictSalaryGuardActive: true,
      });
      expect(await readJobCollectionOptions()).toMatchObject({
        validator: JOB_COLLECTION_VALIDATOR,
        validationLevel: "strict",
        validationAction: "error",
      });
      await expect(verify(mongoose.connection)).resolves.toMatchObject({
        ok: true,
      });
      await expect(
        assertJobCollectionInvariantsActive(mongoose.connection),
      ).resolves.toBeUndefined();
    });
  });

  describe("historical migrations", () => {
    it("V6 backfill never activates the V4.2 Salary guard", async () => {
      await simulatePreCutoverDatabase();
      const v5Job = rawJob({ salaryText: "20 - 30 million VND" });

      delete v5Job.supportingRecruiterCompanyMemberIds;

      const { insertedId: legacyId } = await Job.collection.insertOne(v5Job);
      const optionsBefore = await readJobCollectionOptions();

      const result = await migrateV6SupportingRecruiters(mongoose.connection);

      expect(result.modifiedCount).toBe(1);
      expect(await readJobCollectionOptions()).toEqual(optionsBefore);
      expect(await isJobCollectionValidatorActive(mongoose.connection)).toBe(
        false,
      );
      expect((await preflight(mongoose.connection)).strictSalaryGuardActive).toBe(
        false,
      );

      const legacy = await Job.collection.findOne({ _id: legacyId });

      expect(legacy.supportingRecruiterCompanyMemberIds).toEqual([]);
      expect(legacy.salaryText).toBe("20 - 30 million VND");
    });
  });
});

describe("V4.2 Bugfix 05 — Job service Salary input boundary (BR-01, BR-04; Data §5.3, §8.4, §14)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  let sequence = 0;

  const createRecruiter = async () => {
    sequence += 1;

    const manager = await createActiveCompanyManagerContext({
      email: `cm.v42.bf05.${sequence}@example.com`,
      businessRegistrationNumber: `BRN-V42-BF05-${sequence}`,
    });
    const recruiter = await createActiveRecruiterContext({
      email: `recruiter.v42.bf05.${sequence}@example.com`,
      company: manager.company,
      employeeCode: `NV-V42-BF05-${sequence}`,
    });

    return recruiter.user;
  };

  const UNSUPPORTED_CONTENT = Object.freeze([
    ["salary.currency VND", { salary: { ...RANGE_SALARY, currency: "VND" } }],
    ["salary.currency USD", { salary: { ...RANGE_SALARY, currency: "USD" } }],
    ["salary.currency null", { salary: { ...RANGE_SALARY, currency: null } }],
    ["unknown Salary key", { salary: { ...RANGE_SALARY, note: "thưởng" } }],
    ["Salary _id", { salary: { ...RANGE_SALARY, _id: new ObjectId() } }],
    [
      "sparse Salary with currency",
      { salary: { type: SALARY_TYPE.NEGOTIABLE, currency: "VND" } },
    ],
    ["legacy salaryText", { salaryText: "20 - 30 million VND" }],
    [
      "legacy salaryText beside a valid Salary",
      { salary: RANGE_SALARY, salaryText: "20 - 30 million VND" },
    ],
  ]);

  it("createDraftJob rejects currency, unknown Salary keys, and salaryText without writing", async () => {
    const recruiterUser = await createRecruiter();

    for (const [label, content] of UNSUPPORTED_CONTENT) {
      await expect(
        createDraftJob({ recruiterUser, content }),
        label,
      ).rejects.toMatchObject({ statusCode: 400 });
    }

    expect(await Job.countDocuments()).toBe(0);
  });

  it("updateDraftJob rejects currency, unknown Salary keys, and salaryText without writing", async () => {
    const recruiterUser = await createRecruiter();
    const draft = await createDraftJob({
      recruiterUser,
      content: { salary: RANGE_SALARY },
    });
    const before = await Job.collection.findOne({
      _id: new ObjectId(draft.id),
    });

    for (const [label, content] of UNSUPPORTED_CONTENT) {
      await expect(
        updateDraftJob({ recruiterUser, jobId: draft.id, content }),
        label,
      ).rejects.toMatchObject({ statusCode: 400 });
    }

    expect(
      await Job.collection.findOne({ _id: new ObjectId(draft.id) }),
    ).toEqual(before);
  });

  it("normalizes valid sparse Salary input into the complete five-key canonical shape", async () => {
    const recruiterUser = await createRecruiter();
    const created = await createDraftJob({
      recruiterUser,
      content: {
        salary: {
          type: SALARY_TYPE.FROM,
          minAmount: 300_000,
          period: SALARY_PERIOD.DAY,
        },
      },
    });

    expect(
      (await Job.collection.findOne({ _id: new ObjectId(created.id) })).salary,
    ).toStrictEqual(salary(SALARY_TYPE.FROM, 300_000, null, SALARY_PERIOD.DAY));

    for (const [input, expected] of [
      [
        { type: SALARY_TYPE.NEGOTIABLE },
        salary(SALARY_TYPE.NEGOTIABLE, null, null, null),
      ],
      [
        {
          type: SALARY_TYPE.UP_TO,
          maxAmount: 2_000_000,
          period: SALARY_PERIOD.ETC,
          customPeriodLabel: "  dự án  ",
        },
        salary(SALARY_TYPE.UP_TO, null, 2_000_000, SALARY_PERIOD.ETC, "dự án"),
      ],
    ]) {
      const updated = await updateDraftJob({
        recruiterUser,
        jobId: created.id,
        content: { salary: input },
      });

      expect(updated.salary).toEqual(expected);
      expect(
        (await Job.collection.findOne({ _id: new ObjectId(created.id) }))
          .salary,
      ).toStrictEqual(expected);
    }
  });
});
