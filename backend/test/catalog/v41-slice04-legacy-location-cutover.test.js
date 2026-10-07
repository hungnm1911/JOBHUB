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

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import LOCATION from "../../src/constants/location.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import {
  BLOCKED_REASON,
  LEGACY_CANDIDATE_CV_LOCATION_INDEX_KEY,
  LEGACY_JOB_LOCATION_INDEX_KEY,
  LEGACY_LOCATION_PROVINCE_CODE,
  migrate,
  preflight,
  verify,
} from "../../src/database/migrations/v41-legacy-location-cutover.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Job from "../../src/models/job.model.js";
import { toPublicCandidateCvSummary } from "../../src/services/candidate-cv.service.js";
import { toPublicJobLocation } from "../../src/services/job.service.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";
import {
  jsonResponse,
  stubLocationProvider,
  TEST_LOCATION,
} from "../helpers/location-provider.js";

const { ObjectId } = mongoose.Types;

const LEGACY_JOB_INDEX_NAME = "job_discovery_location_idx";
const LEGACY_CANDIDATE_CV_INDEX_NAME = "preferredLocations_1_updatedAt_-1__id_-1";
const FIXED_UPDATED_AT = new Date("2026-01-15T00:00:00.000Z");

const HA_NOI_ALL = Object.freeze({
  provinceCode: TEST_LOCATION.HA_NOI,
  districtCode: null,
});
const HO_CHI_MINH_ALL = Object.freeze({
  provinceCode: TEST_LOCATION.HO_CHI_MINH,
  districtCode: null,
});
const HA_NOI_BA_VI = Object.freeze({
  provinceCode: TEST_LOCATION.HA_NOI,
  districtCode: TEST_LOCATION.HA_NOI_BA_VI,
});
const HO_CHI_MINH_DISTRICT_1 = Object.freeze({
  provinceCode: TEST_LOCATION.HO_CHI_MINH,
  districtCode: TEST_LOCATION.HO_CHI_MINH_DISTRICT_1,
});

// Province Open API v1 `/p/` response carrying every mapped Province code.
const fullProvinceCatalog = () => {
  return Object.values(LEGACY_LOCATION_PROVINCE_CODE).map((code) => ({
    code: Number(code),
    name: `Province ${code}`,
    districts: [],
  }));
};

const stubFullProvinceCatalog = () => {
  return stubLocationProvider({
    "/p/": () => jsonResponse(fullProvinceCatalog()),
  });
};

const createLegacyIndexes = async () => {
  await Job.collection.createIndex(LEGACY_JOB_LOCATION_INDEX_KEY, {
    name: LEGACY_JOB_INDEX_NAME,
  });
  await CandidateCV.collection.createIndex(
    LEGACY_CANDIDATE_CV_LOCATION_INDEX_KEY,
    {
      name: LEGACY_CANDIDATE_CV_INDEX_NAME,
      partialFilterExpression: {
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        archivedAt: null,
      },
    },
  );
};

const indexNames = async (collection) => {
  return (await collection.indexes()).map((index) => index.name);
};

const seedJob = async (location, extra = {}) => {
  const job = await Job.create({
    companyId: new ObjectId(),
    createdByCompanyMemberId: new ObjectId(),
    primaryRecruiterCompanyMemberId: new ObjectId(),
    title: "Backend Engineer",
    workModes: [WORK_MODE.REMOTE],
    ...extra,
  });

  await Job.collection.updateOne(
    { _id: job._id },
    { $set: { location, updatedAt: FIXED_UPDATED_AT } },
  );

  return job._id;
};

const seedCandidateCv = async (preferredLocations) => {
  const candidateCv = await CandidateCV.create({
    candidateUserId: new ObjectId(),
    name: "Legacy CV",
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status: CANDIDATE_CV_STATUS.DRAFT,
    visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
    categoryId: new ObjectId(),
    workModes: [WORK_MODE.REMOTE],
    generatedContent: {
      personalInfo: { fullName: "Nguyen Van A", displayLocation: "Hà Nội" },
    },
  });

  await CandidateCV.collection.updateOne(
    { _id: candidateCv._id },
    { $set: { preferredLocations, updatedAt: FIXED_UPDATED_AT } },
  );

  return candidateCv._id;
};

const rawJob = (id) => Job.collection.findOne({ _id: id });
const rawCandidateCv = (id) => CandidateCV.collection.findOne({ _id: id });

const snapshotAll = async () => {
  return {
    jobs: await Job.collection.find({}).sort({ _id: 1 }).toArray(),
    candidateCvs: await CandidateCV.collection
      .find({})
      .sort({ _id: 1 })
      .toArray(),
  };
};

const TARGET_COLLECTIONS = Object.freeze(["jobs", "candidate_cvs"]);
const CANONICAL_JOB_INDEX_NAMES = Object.freeze([
  "job_discovery_location_province_idx",
  "job_discovery_location_district_idx",
]);
const CANONICAL_CANDIDATE_CV_INDEX_NAME =
  "preferredLocations.provinceCode_1_preferredLocations.districtCode_1_updatedAt_-1__id_-1";

const dropCanonicalLocationIndexes = async () => {
  for (const indexName of CANONICAL_JOB_INDEX_NAMES) {
    await Job.collection.dropIndex(indexName);
  }
  await CandidateCV.collection.dropIndex(CANONICAL_CANDIDATE_CV_INDEX_NAME);
};

const snapshotDatabaseState = async () => {
  const { db } = mongoose.connection;
  const collections = await db
    .listCollections({ name: { $in: TARGET_COLLECTIONS } })
    .toArray();

  return Promise.all(
    collections
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (info) => ({
        info,
        indexes: await db.collection(info.name).indexes(),
        documents: await db
          .collection(info.name)
          .find({})
          .sort({ _id: 1 })
          .toArray(),
      })),
  );
};

const oplog = () => {
  return mongoose.connection.getClient().db("local").collection("oplog.rs");
};

const describeOplogWrite = (entry) => {
  if (entry.op === "c") {
    const [command] = Object.keys(entry.o);

    return {
      kind: command,
      collection: entry.o[command],
      indexes: entry.o.name
        ? [entry.o.name]
        : entry.o.indexes?.map((index) => index.name) ??
          (entry.o.index ? [entry.o.index] : []),
    };
  }

  return {
    kind: { i: "insert", u: "update", d: "delete" }[entry.op] ?? entry.op,
    collection: entry.ns.slice(entry.ns.indexOf(".") + 1),
  };
};

// Every document, collection, and index mutation is replicated through the
// oplog of the test replica set, so it records the exact write order.
const captureDatabaseWrites = async (operation) => {
  const databaseName = mongoose.connection.db.databaseName;
  const [latest] = await oplog()
    .find({})
    .sort({ $natural: -1 })
    .limit(1)
    .toArray();
  let error = null;

  try {
    await operation();
  } catch (caught) {
    error = caught;
  }

  const entries = await oplog()
    .find({ ts: { $gt: latest.ts }, ns: { $regex: `^${databaseName}\\.` } })
    .sort({ $natural: 1 })
    .toArray();

  return {
    error,
    writes: entries
      .map(describeOplogWrite)
      .filter((write) => TARGET_COLLECTIONS.includes(write.collection)),
  };
};

const isIndexCreation = (write) => {
  return ["createIndexes", "startIndexBuild", "commitIndexBuild"].includes(
    write.kind,
  );
};

describe("V4.1 Slice 04 — Legacy Location Migration & Cutover (F06)", () => {
  let providerFetch;

  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    providerFetch = stubFullProvinceCatalog();
    await Job.createIndexes();
    await CandidateCV.createIndexes();
    await createLegacyIndexes();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("deterministic legacy → Province mapping (BR-02, BR-21–BR-23)", () => {
    it("maps every legacy Vietnam literal to one distinct Province code and never FOREIGN or REMOTE", () => {
      const legacyVietnamLiterals = Object.values(LOCATION).filter(
        (literal) => literal !== LOCATION.FOREIGN,
      );
      const provinceCodes = Object.values(LEGACY_LOCATION_PROVINCE_CODE);

      expect(Object.keys(LEGACY_LOCATION_PROVINCE_CODE).sort()).toEqual(
        [...legacyVietnamLiterals].sort(),
      );
      expect(new Set(provinceCodes).size).toBe(63);
      expect(LEGACY_LOCATION_PROVINCE_CODE).not.toHaveProperty(LOCATION.FOREIGN);
      expect(LEGACY_LOCATION_PROVINCE_CODE).not.toHaveProperty("REMOTE");
      expect(LEGACY_LOCATION_PROVINCE_CODE[LOCATION.HA_NOI]).toBe(
        TEST_LOCATION.HA_NOI,
      );
      expect(LEGACY_LOCATION_PROVINCE_CODE[LOCATION.HA_GIANG]).toBe(
        TEST_LOCATION.HA_GIANG,
      );
      expect(LEGACY_LOCATION_PROVINCE_CODE[LOCATION.HO_CHI_MINH]).toBe(
        TEST_LOCATION.HO_CHI_MINH,
      );

      for (const code of provinceCodes) {
        expect(code).toBe(String(Number(code)));
      }
    });
  });

  describe("successful migration", () => {
    it("migrates a legacy Job Province literal to a Province-only structured Location without inventing a District", async () => {
      const jobId = await seedJob(LOCATION.HO_CHI_MINH);
      const before = await rawJob(jobId);

      const result = await migrate();
      const after = await rawJob(jobId);

      expect(result.jobs.migrated).toBe(1);
      expect(after.location).toEqual(HO_CHI_MINH_ALL);
      expect(after.updatedAt).toEqual(FIXED_UPDATED_AT);

      expect({ ...after, location: before.location }).toEqual(before);
      expect(after.workModes).toEqual([WORK_MODE.REMOTE]);
    });

    it("migrates legacy CandidateCV literals to Province-wide selections, deduplicating canonical duplicates in first-seen order", async () => {
      const cvId = await seedCandidateCv([
        LOCATION.HO_CHI_MINH,
        LOCATION.HA_NOI,
        LOCATION.HO_CHI_MINH,
      ]);
      const before = await rawCandidateCv(cvId);

      const result = await migrate();
      const after = await rawCandidateCv(cvId);

      expect(result.candidateCvs.migrated).toBe(1);
      expect(after.preferredLocations).toEqual([HO_CHI_MINH_ALL, HA_NOI_ALL]);
      expect(
        after.preferredLocations.every(
          (selection) => selection.districtCode === null,
        ),
      ).toBe(true);
      expect(after.updatedAt).toEqual(FIXED_UPDATED_AT);
      expect(after.generatedContent.personalInfo.displayLocation).toBe("Hà Nội");

      expect({
        ...after,
        preferredLocations: before.preferredLocations,
      }).toEqual(before);
    });

    it("leaves V4.1 structured Jobs/CandidateCVs, unset Job Locations, and empty preferences untouched", async () => {
      const unsetJobId = await seedJob(null);
      const provinceOnlyJobId = await seedJob(HA_NOI_ALL);
      const districtJobId = await seedJob(HA_NOI_BA_VI);
      const emptyCvId = await seedCandidateCv([]);
      const subsetCvId = await seedCandidateCv([
        HA_NOI_BA_VI,
        HO_CHI_MINH_DISTRICT_1,
      ]);
      const before = await snapshotAll();

      const result = await migrate();

      expect(result.jobs.migrated).toBe(0);
      expect(result.candidateCvs.migrated).toBe(0);
      expect(await snapshotAll()).toEqual(before);
      expect((await rawJob(unsetJobId)).location).toBeNull();
      expect((await rawJob(provinceOnlyJobId)).location).toEqual(HA_NOI_ALL);
      expect((await rawJob(districtJobId)).location).toEqual(HA_NOI_BA_VI);
      expect((await rawCandidateCv(emptyCvId)).preferredLocations).toEqual([]);
      expect((await rawCandidateCv(subsetCvId)).preferredLocations).toEqual([
        HA_NOI_BA_VI,
        HO_CHI_MINH_DISTRICT_1,
      ]);
    });

    it("handles a mixed legacy/canonical dataset deterministically, including legacy literals mixed into a structured array", async () => {
      const unsetJobId = await seedJob(null);
      const structuredJobId = await seedJob(HA_NOI_BA_VI);
      const legacyJobA = await seedJob(LOCATION.HA_GIANG);
      const legacyJobB = await seedJob(LOCATION.HA_NOI);
      const structuredCvId = await seedCandidateCv([HA_NOI_BA_VI]);
      const legacyCvId = await seedCandidateCv([LOCATION.HA_GIANG]);
      const mixedCvId = await seedCandidateCv([
        HO_CHI_MINH_DISTRICT_1,
        LOCATION.HA_NOI,
        HA_NOI_ALL,
      ]);

      const preflightReport = await preflight();

      expect(preflightReport.jobs).toMatchObject({
        total: 4,
        canonical: 2,
        legacy: 2,
        blocked: [],
      });
      expect(preflightReport.candidateCvs).toMatchObject({
        total: 3,
        canonical: 1,
        legacy: 2,
        blocked: [],
      });

      const result = await migrate();

      expect(result.jobs.migrated).toBe(2);
      expect(result.candidateCvs.migrated).toBe(2);
      expect((await rawJob(unsetJobId)).location).toBeNull();
      expect((await rawJob(structuredJobId)).location).toEqual(HA_NOI_BA_VI);
      expect((await rawJob(legacyJobA)).location).toEqual({
        provinceCode: TEST_LOCATION.HA_GIANG,
        districtCode: null,
      });
      expect((await rawJob(legacyJobB)).location).toEqual(HA_NOI_ALL);
      expect((await rawCandidateCv(structuredCvId)).preferredLocations).toEqual([
        HA_NOI_BA_VI,
      ]);
      expect((await rawCandidateCv(legacyCvId)).preferredLocations).toEqual([
        { provinceCode: TEST_LOCATION.HA_GIANG, districtCode: null },
      ]);
      expect((await rawCandidateCv(mixedCvId)).preferredLocations).toEqual([
        HO_CHI_MINH_DISTRICT_1,
        HA_NOI_ALL,
      ]);
    });

    it("is idempotent: re-running changes nothing, creates no duplicates, and needs no provider call", async () => {
      await seedJob(LOCATION.DA_NANG);
      await seedCandidateCv([LOCATION.HA_NOI, LOCATION.HA_NOI]);

      const first = await migrate();
      const afterFirst = await snapshotAll();

      providerFetch.mockClear();

      let second;
      const { error, writes } = await captureDatabaseWrites(async () => {
        second = await migrate();
      });

      expect(error).toBeNull();
      expect(writes).toEqual([]);
      expect(first.jobs.migrated).toBe(1);
      expect(first.candidateCvs.migrated).toBe(1);
      expect(second.jobs.migrated).toBe(0);
      expect(second.candidateCvs.migrated).toBe(0);
      expect(second.droppedLegacyIndexes).toEqual([]);
      expect(providerFetch).not.toHaveBeenCalled();
      expect(await snapshotAll()).toEqual(afterFirst);
      expect(afterFirst.candidateCvs[0].preferredLocations).toEqual([
        HA_NOI_ALL,
      ]);
    });

    it("verifies zero legacy, zero unresolved FOREIGN, and cuts over legacy indexes only after verified data migration", async () => {
      await seedJob(LOCATION.HA_NOI);
      await seedCandidateCv([LOCATION.HO_CHI_MINH]);

      expect(await indexNames(Job.collection)).toContain(LEGACY_JOB_INDEX_NAME);
      expect(await indexNames(CandidateCV.collection)).toContain(
        LEGACY_CANDIDATE_CV_INDEX_NAME,
      );

      const result = await migrate();

      expect(result.droppedLegacyIndexes.sort()).toEqual(
        [LEGACY_CANDIDATE_CV_INDEX_NAME, LEGACY_JOB_INDEX_NAME].sort(),
      );
      expect(result.verification).toMatchObject({
        legacyCount: 0,
        blockedCount: 0,
        unresolvedForeignCount: 0,
      });
      expect(await indexNames(Job.collection)).not.toContain(
        LEGACY_JOB_INDEX_NAME,
      );
      expect(await indexNames(Job.collection)).toEqual(
        expect.arrayContaining([
          "job_discovery_location_province_idx",
          "job_discovery_location_district_idx",
        ]),
      );
      expect(await indexNames(CandidateCV.collection)).not.toContain(
        LEGACY_CANDIDATE_CV_INDEX_NAME,
      );
      expect(
        await Job.collection.countDocuments({ location: { $type: "string" } }),
      ).toBe(0);
      expect(
        await CandidateCV.collection.countDocuments({
          preferredLocations: { $type: "string" },
        }),
      ).toBe(0);
      await expect(verify()).resolves.toMatchObject({
        ok: true,
        legacyCount: 0,
        blockedCount: 0,
        unresolvedForeignCount: 0,
      });
    });

    it("closes the Slice 02/03 interim gaps: legacy Jobs no longer read as null and legacy CVs no longer read as []", async () => {
      const jobId = await seedJob(LOCATION.HA_NOI);
      const cvId = await seedCandidateCv([LOCATION.HO_CHI_MINH, LOCATION.HA_NOI]);

      expect(toPublicJobLocation((await Job.findById(jobId)).location)).toBeNull();
      expect(
        toPublicCandidateCvSummary(await CandidateCV.findById(cvId))
          .preferredLocations,
      ).toEqual([]);

      await migrate();

      expect(toPublicJobLocation((await Job.findById(jobId)).location)).toEqual(
        HA_NOI_ALL,
      );
      expect(
        toPublicCandidateCvSummary(await CandidateCV.findById(cvId))
          .preferredLocations,
      ).toEqual([HO_CHI_MINH_ALL, HA_NOI_ALL]);
    });

    it("does not create legacy Location indexes on a fresh database", async () => {
      await Job.collection.dropIndex(LEGACY_JOB_INDEX_NAME);
      await CandidateCV.collection.dropIndex(LEGACY_CANDIDATE_CV_INDEX_NAME);
      await Job.syncIndexes();
      await CandidateCV.syncIndexes();

      expect(await indexNames(Job.collection)).not.toContain(
        LEGACY_JOB_INDEX_NAME,
      );
      expect(await indexNames(CandidateCV.collection)).not.toContain(
        LEGACY_CANDIDATE_CV_INDEX_NAME,
      );
      await expect(verify()).resolves.toMatchObject({ ok: true });
    });
  });

  describe("blocked migration (no silent completion)", () => {
    it("inventories FOREIGN and blocks migration before any write, keeping legacy indexes", async () => {
      const foreignJobId = await seedJob(LOCATION.FOREIGN);
      const mappableJobId = await seedJob(LOCATION.HA_NOI);
      const foreignCvId = await seedCandidateCv([LOCATION.HA_NOI, LOCATION.FOREIGN]);
      const structuredForeignCvId = await seedCandidateCv([HA_NOI_ALL]);

      await CandidateCV.collection.updateOne(
        { _id: structuredForeignCvId },
        {
          $set: {
            preferredLocations: [
              { provinceCode: LOCATION.FOREIGN, districtCode: null },
            ],
          },
        },
      );

      const before = await snapshotAll();
      const report = await preflight();

      expect(report.unresolvedForeignCount).toBe(3);
      expect(report.jobs.blocked).toEqual([
        {
          id: foreignJobId.toString(),
          reason: BLOCKED_REASON.FOREIGN,
          value: LOCATION.FOREIGN,
        },
      ]);
      expect(report.candidateCvs.blocked.map((record) => record.id).sort()).toEqual(
        [foreignCvId.toString(), structuredForeignCvId.toString()].sort(),
      );
      expect(await snapshotAll()).toEqual(before);

      await expect(migrate()).rejects.toThrow(
        /blocked before any write: 3 unresolvable record\(s\) \(3 FOREIGN\)/,
      );
      expect(await snapshotAll()).toEqual(before);
      expect((await rawJob(mappableJobId)).location).toBe(LOCATION.HA_NOI);
      expect((await rawCandidateCv(foreignCvId)).preferredLocations).toEqual([
        LOCATION.HA_NOI,
        LOCATION.FOREIGN,
      ]);
      expect(providerFetch).not.toHaveBeenCalled();
      expect(await indexNames(Job.collection)).toContain(LEGACY_JOB_INDEX_NAME);
      expect(await indexNames(CandidateCV.collection)).toContain(
        LEGACY_CANDIDATE_CV_INDEX_NAME,
      );
      await expect(verify()).rejects.toThrow(/verification failed/);
    });

    it("never converts unmapped literals, REMOTE, or malformed values into a canonical Location", async () => {
      const remoteJobId = await seedJob("REMOTE");
      const aliasJobId = await seedJob("ha_noi");
      const malformedJobId = await seedJob({ districtCode: TEST_LOCATION.HA_NOI_BA_VI });
      const remoteCvId = await seedCandidateCv([LOCATION.HA_NOI, "REMOTE"]);
      const aliasCvId = await seedCandidateCv(["HANOI"]);
      const before = await snapshotAll();

      const report = await preflight();

      expect(
        report.jobs.blocked.map(({ id, reason }) => ({ id, reason })),
      ).toEqual(
        expect.arrayContaining([
          { id: remoteJobId.toString(), reason: BLOCKED_REASON.UNMAPPED_LEGACY_LITERAL },
          { id: aliasJobId.toString(), reason: BLOCKED_REASON.UNMAPPED_LEGACY_LITERAL },
          { id: malformedJobId.toString(), reason: BLOCKED_REASON.MALFORMED_LOCATION },
        ]),
      );
      expect(
        report.candidateCvs.blocked.map(({ id, reason }) => ({ id, reason })),
      ).toEqual(
        expect.arrayContaining([
          { id: remoteCvId.toString(), reason: BLOCKED_REASON.UNMAPPED_LEGACY_LITERAL },
          { id: aliasCvId.toString(), reason: BLOCKED_REASON.UNMAPPED_LEGACY_LITERAL },
        ]),
      );
      expect(report.unresolvedForeignCount).toBe(0);

      await expect(migrate()).rejects.toThrow(/blocked before any write/);
      expect(await snapshotAll()).toEqual(before);
      expect((await rawJob(remoteJobId)).location).toBe("REMOTE");
    });

    it("blocks a legacy Province literal that would combine Province-wide with an existing District subset of the same Province", async () => {
      const conflictCvId = await seedCandidateCv([HA_NOI_BA_VI, LOCATION.HA_NOI]);
      const before = await snapshotAll();

      const report = await preflight();

      expect(report.candidateCvs.blocked).toEqual([
        {
          id: conflictCvId.toString(),
          reason: BLOCKED_REASON.INVALID_SELECTION_SET,
          value: [HA_NOI_BA_VI, LOCATION.HA_NOI],
        },
      ]);
      await expect(migrate()).rejects.toThrow(/blocked before any write/);
      expect(await snapshotAll()).toEqual(before);
    });

    it("fails closed without writing when the Province Open API v1 catalog is unavailable or lacks a mapped Province", async () => {
      await seedJob(LOCATION.HA_NOI);
      await seedCandidateCv([LOCATION.HO_CHI_MINH]);

      const before = await snapshotAll();

      vi.unstubAllGlobals();
      stubLocationProvider({
        "/p/": () => jsonResponse({ detail: "upstream error" }, 500),
      });

      await expect(migrate()).rejects.toThrow(/provider is unavailable/);
      expect(await snapshotAll()).toEqual(before);

      vi.unstubAllGlobals();
      stubLocationProvider({
        "/p/": () =>
          jsonResponse(
            fullProvinceCatalog().filter(
              (province) => province.code !== Number(TEST_LOCATION.HO_CHI_MINH),
            ),
          ),
      });

      await expect(migrate()).rejects.toThrow(
        /absent from Province Open API v1: HO_CHI_MINH→79/,
      );
      expect(await snapshotAll()).toEqual(before);
      expect(await indexNames(Job.collection)).toContain(LEGACY_JOB_INDEX_NAME);
    });

    it("leaves a document whose write fails fully un-migrated, keeps legacy indexes, and completes after remediation on re-run", async () => {
      const healthyJobId = await seedJob(LOCATION.HA_NOI);
      const failingCvId = await seedCandidateCv([
        LOCATION.HA_NOI,
        LOCATION.HO_CHI_MINH,
      ]);

      // A pre-existing collection-validator violation unrelated to Location
      // makes this CandidateCV's update fail under strict validation.
      await CandidateCV.collection.updateOne(
        { _id: failingCvId },
        { $set: { isDefault: true } },
        { bypassDocumentValidation: true },
      );

      const failingBefore = await rawCandidateCv(failingCvId);

      const { error, writes } = await captureDatabaseWrites(() => migrate());

      expect(error?.message).toMatch(
        /migration incomplete; legacy indexes retained: 1 legacy and 0 unresolvable/,
      );
      expect(writes.filter((write) => write.kind === "dropIndexes")).toEqual(
        [],
      );
      expect(
        writes.filter((write) => write.kind === "update"),
      ).toEqual([{ kind: "update", collection: "jobs" }]);
      expect(await rawCandidateCv(failingCvId)).toEqual(failingBefore);
      expect((await rawJob(healthyJobId)).location).toEqual(HA_NOI_ALL);
      expect(await indexNames(Job.collection)).toContain(LEGACY_JOB_INDEX_NAME);
      expect(await indexNames(CandidateCV.collection)).toContain(
        LEGACY_CANDIDATE_CV_INDEX_NAME,
      );
      await expect(verify()).rejects.toThrow(
        /1 record\(s\) still persist a legacy Location literal/,
      );

      await CandidateCV.collection.updateOne(
        { _id: failingCvId },
        { $set: { isDefault: false } },
        { bypassDocumentValidation: true },
      );

      const resumed = await migrate();

      expect(resumed.jobs.migrated).toBe(0);
      expect(resumed.candidateCvs.migrated).toBe(1);
      expect((await rawCandidateCv(failingCvId)).preferredLocations).toEqual([
        HA_NOI_ALL,
        HO_CHI_MINH_ALL,
      ]);
      await expect(verify()).resolves.toMatchObject({ ok: true });
    });
  });

  describe("read / write / index-cleanup phase boundary", () => {
    it("preflight on a database without canonical Location indexes performs no write and keeps legacy indexes", async () => {
      await dropCanonicalLocationIndexes();
      await seedJob(LOCATION.HA_NOI);
      await seedJob(LOCATION.FOREIGN);
      await seedCandidateCv([LOCATION.HO_CHI_MINH]);
      const before = await snapshotDatabaseState();

      let report;
      const { error, writes } = await captureDatabaseWrites(async () => {
        report = await preflight();
      });

      expect(error).toBeNull();
      expect(writes).toEqual([]);
      expect(await snapshotDatabaseState()).toEqual(before);
      expect(await indexNames(Job.collection)).toContain(LEGACY_JOB_INDEX_NAME);
      expect(await indexNames(CandidateCV.collection)).toContain(
        LEGACY_CANDIDATE_CV_INDEX_NAME,
      );
      expect(report).toMatchObject({
        legacyCount: 2,
        blockedCount: 1,
        unresolvedForeignCount: 1,
      });
    });

    it.each([
      ["FOREIGN", () => seedJob(LOCATION.FOREIGN), /\(1 FOREIGN\)/],
      ["an unmapped literal", () => seedCandidateCv(["HANOI"]), /\(0 FOREIGN\)/],
      [
        "a malformed value",
        () => seedJob({ districtCode: TEST_LOCATION.HA_NOI_BA_VI }),
        /\(0 FOREIGN\)/,
      ],
    ])(
      "a migration blocked by %s performs zero document, index, or metadata writes",
      async (_label, seedBlocker, foreignCount) => {
        await dropCanonicalLocationIndexes();
        await seedJob(LOCATION.HA_NOI);
        await seedCandidateCv([LOCATION.HO_CHI_MINH]);
        await seedBlocker();
        const before = await snapshotDatabaseState();

        const { error, writes } = await captureDatabaseWrites(() => migrate());

        expect(error?.message).toMatch(/blocked before any write/);
        expect(error?.message).toMatch(foreignCount);
        expect(writes).toEqual([]);
        expect(await snapshotDatabaseState()).toEqual(before);
        expect(providerFetch).not.toHaveBeenCalled();
      },
    );

    it("a Province catalog validation failure performs zero writes", async () => {
      await dropCanonicalLocationIndexes();
      await seedJob(LOCATION.HA_NOI);
      const before = await snapshotDatabaseState();

      vi.unstubAllGlobals();
      stubLocationProvider({
        "/p/": () => jsonResponse({ detail: "upstream error" }, 500),
      });

      const { error, writes } = await captureDatabaseWrites(() => migrate());

      expect(error?.message).toMatch(/provider is unavailable/);
      expect(writes).toEqual([]);
      expect(await snapshotDatabaseState()).toEqual(before);
    });

    it("builds canonical indexes only after the blocker checks pass, then writes documents, and drops legacy indexes only after zero-legacy verification", async () => {
      await dropCanonicalLocationIndexes();
      const jobId = await seedJob(LOCATION.HA_NOI);
      const cvId = await seedCandidateCv([LOCATION.HO_CHI_MINH]);

      const { error, writes } = await captureDatabaseWrites(() => migrate());

      expect(error).toBeNull();

      const updates = writes
        .map((write, position) => ({ write, position }))
        .filter(({ write }) => write.kind === "update");
      const drops = writes
        .map((write, position) => ({ write, position }))
        .filter(({ write }) => write.kind === "dropIndexes");
      const createdIndexes = writes
        .filter(isIndexCreation)
        .flatMap((write) => write.indexes);

      expect(createdIndexes).toEqual(
        expect.arrayContaining([
          ...CANONICAL_JOB_INDEX_NAMES,
          CANONICAL_CANDIDATE_CV_INDEX_NAME,
        ]),
      );
      expect(writes.findLastIndex(isIndexCreation)).toBeLessThan(
        updates[0].position,
      );
      expect(updates.map(({ write }) => write.collection)).toEqual([
        "jobs",
        "candidate_cvs",
      ]);
      expect(drops.map(({ write }) => write)).toEqual([
        { kind: "dropIndexes", collection: "jobs", indexes: [LEGACY_JOB_INDEX_NAME] },
        {
          kind: "dropIndexes",
          collection: "candidate_cvs",
          indexes: [LEGACY_CANDIDATE_CV_INDEX_NAME],
        },
      ]);
      expect(drops[0].position).toBeGreaterThan(updates.at(-1).position);
      expect((await rawJob(jobId)).location).toEqual(HA_NOI_ALL);
      expect((await rawCandidateCv(cvId)).preferredLocations).toEqual([
        HO_CHI_MINH_ALL,
      ]);
      await expect(verify()).resolves.toMatchObject({ ok: true });
    });
  });
});
