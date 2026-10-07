import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import LOCATION from "../../src/constants/location.js";

// Runs the canonical migration runner in a fresh Node process, exactly as an
// operator would, so model compilation and connection happen from scratch.
// The test process never opens a Mongoose connection or imports models.

const BACKEND_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const RUNNER_PATH = path.join(BACKEND_DIR, "scripts", "run-migration.js");
const MIGRATION_NAME = "v41-legacy-location-cutover";
const DATABASE_NAME = "jobhub_v41_migration_cli";
const TARGET_COLLECTIONS = Object.freeze(["jobs", "candidate_cvs"]);

const LEGACY_JOB_INDEX = Object.freeze({
  key: { status: 1, location: 1, applicationDeadline: 1 },
  name: "job_discovery_location_idx",
});
const LEGACY_CANDIDATE_CV_INDEX = Object.freeze({
  key: { preferredLocations: 1, updatedAt: -1, _id: -1 },
  name: "preferredLocations_1_updatedAt_-1__id_-1",
});
const CANONICAL_JOB_INDEX_NAMES = Object.freeze([
  "job_discovery_location_province_idx",
  "job_discovery_location_district_idx",
]);
const CANONICAL_CANDIDATE_CV_INDEX_NAME =
  "preferredLocations.provinceCode_1_preferredLocations.districtCode_1_updatedAt_-1__id_-1";
const FIXED_UPDATED_AT = new Date("2026-01-15T00:00:00.000Z");

const { ObjectId } = mongoose.Types;

let replicaSet;
let client;
let db;
let databaseUri;

const runMigrationCli = (...args) => {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [RUNNER_PATH, MIGRATION_NAME, ...args], {
      cwd: BACKEND_DIR,
      env: { ...process.env, MONGODB_URI: databaseUri },
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
};

const parsePreflightReport = (stdout) => {
  const start = stdout.indexOf("\n{\n");
  const end = stdout.indexOf("\n}\n", start);

  return JSON.parse(stdout.slice(start + 1, end + 2));
};

const oplog = () => client.db("local").collection("oplog.rs");

const latestOplogTimestamp = async () => {
  const [entry] = await oplog()
    .find({})
    .sort({ $natural: -1 })
    .limit(1)
    .toArray();

  return entry.ts;
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
    collection: entry.ns.slice(DATABASE_NAME.length + 1),
  };
};

// Every document, collection, and index mutation of the database is
// replicated through the oplog, so an empty result proves zero writes.
const captureDatabaseWrites = async (operation) => {
  const since = await latestOplogTimestamp();
  const result = await operation();
  const entries = await oplog()
    .find({
      ts: { $gt: since },
      ns: { $regex: `^${DATABASE_NAME}\\.` },
    })
    .sort({ $natural: 1 })
    .toArray();

  return { result, writes: entries.map(describeOplogWrite) };
};

const snapshotDatabase = async () => {
  const collections = await db.listCollections().toArray();

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

const indexNames = async (collectionName) => {
  return (await db.collection(collectionName).indexes()).map(
    (index) => index.name,
  );
};

const collectionNames = async () => {
  return (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((collection) => collection.name)
    .sort();
};

const createLegacyJobs = async (locations) => {
  const jobs = db.collection("jobs");

  await db.createCollection("jobs");
  await jobs.createIndex(LEGACY_JOB_INDEX.key, { name: LEGACY_JOB_INDEX.name });

  const documents = locations.map((location) => ({
    _id: new ObjectId(),
    status: "DRAFT",
    title: "Backend Engineer",
    location,
    updatedAt: FIXED_UPDATED_AT,
  }));

  if (documents.length > 0) {
    await jobs.insertMany(documents);
  }

  return documents.map((document) => document._id);
};

const createLegacyCandidateCvs = async (preferredLocationSets) => {
  const candidateCvs = db.collection("candidate_cvs");

  await db.createCollection("candidate_cvs");
  await candidateCvs.createIndex(LEGACY_CANDIDATE_CV_INDEX.key, {
    name: LEGACY_CANDIDATE_CV_INDEX.name,
    partialFilterExpression: { visibility: "PUBLIC", archivedAt: null },
  });

  const documents = preferredLocationSets.map((preferredLocations) => ({
    _id: new ObjectId(),
    candidateUserId: new ObjectId(),
    visibility: "PUBLIC",
    archivedAt: null,
    preferredLocations,
    updatedAt: FIXED_UPDATED_AT,
  }));

  if (documents.length > 0) {
    await candidateCvs.insertMany(documents);
  }

  return documents.map((document) => document._id);
};

const isIndexCreation = (write) => {
  return ["createIndexes", "startIndexBuild", "commitIndexBuild"].includes(
    write.kind,
  );
};

describe("V4.1 Slice 04 migration CLI — read-only preflight and pre-write blocking", () => {
  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    databaseUri = replicaSet.getUri(DATABASE_NAME);
    client = await mongoose.mongo.MongoClient.connect(databaseUri);
    db = client.db(DATABASE_NAME);
  });

  beforeEach(async () => {
    await db.dropDatabase();
  });

  afterAll(async () => {
    await client?.close();
    await replicaSet?.stop();
  });

  it("--preflight on a database without canonical Location indexes leaves documents, collection metadata, and indexes identical", async () => {
    const [legacyJobId, foreignJobId] = await createLegacyJobs([
      LOCATION.HA_NOI,
      LOCATION.FOREIGN,
      { provinceCode: "79", districtCode: null },
      "REMOTE",
    ]);
    const [legacyCvId] = await createLegacyCandidateCvs([
      [LOCATION.HO_CHI_MINH, LOCATION.HA_NOI],
      [{ provinceCode: "1", districtCode: null }],
    ]);
    const before = await snapshotDatabase();

    const { result, writes } = await captureDatabaseWrites(() =>
      runMigrationCli("--preflight"),
    );

    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain(
      `Connected to MongoDB database: ${DATABASE_NAME}`,
    );
    expect(result.stdout).toContain("Running preflight (read-only)");
    expect(writes).toEqual([]);
    expect(await snapshotDatabase()).toEqual(before);
    expect(await indexNames("jobs")).toContain(LEGACY_JOB_INDEX.name);
    for (const canonicalName of CANONICAL_JOB_INDEX_NAMES) {
      expect(await indexNames("jobs")).not.toContain(canonicalName);
    }
    expect(await indexNames("candidate_cvs")).toContain(
      LEGACY_CANDIDATE_CV_INDEX.name,
    );
    expect(await indexNames("candidate_cvs")).not.toContain(
      CANONICAL_CANDIDATE_CV_INDEX_NAME,
    );

    const report = parsePreflightReport(result.stdout);

    expect(report).toMatchObject({
      name: MIGRATION_NAME,
      jobs: { total: 4, canonical: 1, legacy: 1 },
      candidateCvs: { total: 2, canonical: 1, legacy: 1, blocked: [] },
      legacyCount: 2,
      blockedCount: 2,
      unresolvedForeignCount: 1,
    });
    expect(report.jobs.blocked).toEqual(
      expect.arrayContaining([
        {
          id: foreignJobId.toString(),
          reason: "FOREIGN",
          value: LOCATION.FOREIGN,
        },
        expect.objectContaining({ reason: "UNMAPPED_LEGACY_LITERAL", value: "REMOTE" }),
      ]),
    );
    expect(report.jobs.blocked.map((record) => record.id)).not.toContain(
      legacyJobId.toString(),
    );
    expect(report.candidateCvs.blocked.map((record) => record.id)).not.toContain(
      legacyCvId.toString(),
    );
  });

  it("--preflight does not create a collection that does not exist yet", async () => {
    await createLegacyJobs([LOCATION.DA_NANG]);
    const before = await snapshotDatabase();

    expect(await collectionNames()).toEqual(["jobs"]);

    const { result, writes } = await captureDatabaseWrites(() =>
      runMigrationCli("--preflight"),
    );

    expect(result.code).toBe(0);
    expect(writes).toEqual([]);
    expect(await collectionNames()).toEqual(["jobs"]);
    expect(await snapshotDatabase()).toEqual(before);
    expect(parsePreflightReport(result.stdout)).toMatchObject({
      jobs: { total: 1, canonical: 0, legacy: 1, blocked: [] },
      candidateCvs: { total: 0, canonical: 0, legacy: 0, blocked: [] },
      legacyCount: 1,
      blockedCount: 0,
    });
  });

  it("a FOREIGN-blocked migration exits with zero document, index, or metadata writes", async () => {
    await createLegacyJobs([LOCATION.HA_NOI, LOCATION.FOREIGN]);
    await createLegacyCandidateCvs([[LOCATION.HO_CHI_MINH]]);
    const before = await snapshotDatabase();

    const { result, writes } = await captureDatabaseWrites(() =>
      runMigrationCli(),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(
      /blocked before any write: 1 unresolvable record\(s\) \(1 FOREIGN\)/,
    );
    expect(writes).toEqual([]);
    expect(await snapshotDatabase()).toEqual(before);
  });

  it("an unmappable- or malformed-blocked migration exits with the database state unchanged", async () => {
    await createLegacyJobs([
      LOCATION.HA_NOI,
      "ha_noi",
      { districtCode: "271" },
    ]);
    await createLegacyCandidateCvs([[LOCATION.HA_NOI, "REMOTE"]]);
    const before = await snapshotDatabase();

    const { result, writes } = await captureDatabaseWrites(() =>
      runMigrationCli(),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(
      /blocked before any write: 3 unresolvable record\(s\) \(0 FOREIGN\)/,
    );
    expect(writes).toEqual([]);
    expect(await snapshotDatabase()).toEqual(before);
  });

  it("an unblocked migration builds canonical indexes in the cutover phase, drops legacy indexes last, and a re-run writes nothing", async () => {
    await createLegacyJobs([{ provinceCode: "1", districtCode: null }]);
    await createLegacyCandidateCvs([[{ provinceCode: "79", districtCode: null }]]);
    const documentsBefore = await Promise.all(
      TARGET_COLLECTIONS.map((name) =>
        db.collection(name).find({}).sort({ _id: 1 }).toArray(),
      ),
    );

    const first = await captureDatabaseWrites(() => runMigrationCli());

    expect(first.result.stderr).toBe("");
    expect(first.result.code).toBe(0);
    expect(first.result.stdout).toContain(`Migration completed: ${MIGRATION_NAME}`);

    const lastIndexCreation = first.writes.findLastIndex(isIndexCreation);
    const firstIndexDrop = first.writes.findIndex(
      (write) => write.kind === "dropIndexes",
    );

    expect(lastIndexCreation).toBeGreaterThanOrEqual(0);
    expect(firstIndexDrop).toBeGreaterThan(lastIndexCreation);
    expect(
      first.writes.filter((write) => write.kind === "dropIndexes"),
    ).toEqual([
      { kind: "dropIndexes", collection: "jobs", indexes: [LEGACY_JOB_INDEX.name] },
      {
        kind: "dropIndexes",
        collection: "candidate_cvs",
        indexes: [LEGACY_CANDIDATE_CV_INDEX.name],
      },
    ]);
    expect(
      first.writes.every(
        (write) =>
          isIndexCreation(write) ||
          write.kind === "dropIndexes" ||
          write.kind === "create",
      ),
    ).toBe(true);
    expect(await indexNames("jobs")).toEqual(
      expect.arrayContaining(CANONICAL_JOB_INDEX_NAMES),
    );
    expect(await indexNames("jobs")).not.toContain(LEGACY_JOB_INDEX.name);
    expect(await indexNames("candidate_cvs")).toContain(
      CANONICAL_CANDIDATE_CV_INDEX_NAME,
    );
    expect(await indexNames("candidate_cvs")).not.toContain(
      LEGACY_CANDIDATE_CV_INDEX.name,
    );
    expect(
      await Promise.all(
        TARGET_COLLECTIONS.map((name) =>
          db.collection(name).find({}).sort({ _id: 1 }).toArray(),
        ),
      ),
    ).toEqual(documentsBefore);

    const afterFirst = await snapshotDatabase();
    const second = await captureDatabaseWrites(() => runMigrationCli());

    expect(second.result.code).toBe(0);
    expect(second.writes).toEqual([]);
    expect(await snapshotDatabase()).toEqual(afterFirst);
  });
});
