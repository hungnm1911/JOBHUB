import mongoose from "mongoose";

import { MODEL_AUTO_INIT_DISABLED_OPTIONS } from "../../config/mongodb.js";
import LOCATION from "../../constants/location.js";
import CandidateCV, {
  findPreferredLocationSelectionsViolation,
} from "../../models/candidate-cv.model.js";
import Job from "../../models/job.model.js";
import { listProvinces } from "../../services/location.service.js";

const name = "v41-legacy-location-cutover";

// Collections and indexes are created only by the explicit cutover phase of
// `migrate`, never as a side effect of connecting.
const connectionOptions = MODEL_AUTO_INIT_DISABLED_OPTIONS;

// Data V4.1 §8.9/§8.10: every legacy V4 Vietnam literal maps to exactly one
// Province Open API v1 Province code (pre-July-2025 dataset). `FOREIGN` has no
// V4.1 target and is never mapped.
const LEGACY_LOCATION_PROVINCE_CODE = Object.freeze({
  [LOCATION.HA_NOI]: "1",
  [LOCATION.HA_GIANG]: "2",
  [LOCATION.CAO_BANG]: "4",
  [LOCATION.BAC_KAN]: "6",
  [LOCATION.TUYEN_QUANG]: "8",
  [LOCATION.LAO_CAI]: "10",
  [LOCATION.DIEN_BIEN]: "11",
  [LOCATION.LAI_CHAU]: "12",
  [LOCATION.SON_LA]: "14",
  [LOCATION.YEN_BAI]: "15",
  [LOCATION.HOA_BINH]: "17",
  [LOCATION.THAI_NGUYEN]: "19",
  [LOCATION.LANG_SON]: "20",
  [LOCATION.QUANG_NINH]: "22",
  [LOCATION.BAC_GIANG]: "24",
  [LOCATION.PHU_THO]: "25",
  [LOCATION.VINH_PHUC]: "26",
  [LOCATION.BAC_NINH]: "27",
  [LOCATION.HAI_DUONG]: "30",
  [LOCATION.HAI_PHONG]: "31",
  [LOCATION.HUNG_YEN]: "33",
  [LOCATION.THAI_BINH]: "34",
  [LOCATION.HA_NAM]: "35",
  [LOCATION.NAM_DINH]: "36",
  [LOCATION.NINH_BINH]: "37",
  [LOCATION.THANH_HOA]: "38",
  [LOCATION.NGHE_AN]: "40",
  [LOCATION.HA_TINH]: "42",
  [LOCATION.QUANG_BINH]: "44",
  [LOCATION.QUANG_TRI]: "45",
  [LOCATION.HUE]: "46",
  [LOCATION.DA_NANG]: "48",
  [LOCATION.QUANG_NAM]: "49",
  [LOCATION.QUANG_NGAI]: "51",
  [LOCATION.BINH_DINH]: "52",
  [LOCATION.PHU_YEN]: "54",
  [LOCATION.KHANH_HOA]: "56",
  [LOCATION.NINH_THUAN]: "58",
  [LOCATION.BINH_THUAN]: "60",
  [LOCATION.KON_TUM]: "62",
  [LOCATION.GIA_LAI]: "64",
  [LOCATION.DAK_LAK]: "66",
  [LOCATION.DAK_NONG]: "67",
  [LOCATION.LAM_DONG]: "68",
  [LOCATION.BINH_PHUOC]: "70",
  [LOCATION.TAY_NINH]: "72",
  [LOCATION.BINH_DUONG]: "74",
  [LOCATION.DONG_NAI]: "75",
  [LOCATION.BA_RIA_VUNG_TAU]: "77",
  [LOCATION.HO_CHI_MINH]: "79",
  [LOCATION.LONG_AN]: "80",
  [LOCATION.TIEN_GIANG]: "82",
  [LOCATION.BEN_TRE]: "83",
  [LOCATION.TRA_VINH]: "84",
  [LOCATION.VINH_LONG]: "86",
  [LOCATION.DONG_THAP]: "87",
  [LOCATION.AN_GIANG]: "89",
  [LOCATION.KIEN_GIANG]: "91",
  [LOCATION.CAN_THO]: "92",
  [LOCATION.HAU_GIANG]: "93",
  [LOCATION.SOC_TRANG]: "94",
  [LOCATION.BAC_LIEU]: "95",
  [LOCATION.CA_MAU]: "96",
});

const BLOCKED_REASON = Object.freeze({
  FOREIGN: "FOREIGN",
  UNMAPPED_LEGACY_LITERAL: "UNMAPPED_LEGACY_LITERAL",
  MALFORMED_LOCATION: "MALFORMED_LOCATION",
  INVALID_SELECTION_SET: "INVALID_SELECTION_SET",
});

const LEGACY_JOB_LOCATION_INDEX_KEY = Object.freeze({
  status: 1,
  location: 1,
  applicationDeadline: 1,
});
const LEGACY_CANDIDATE_CV_LOCATION_INDEX_KEY = Object.freeze({
  preferredLocations: 1,
  updatedAt: -1,
  _id: -1,
});
const CANONICAL_JOB_LOCATION_INDEX_KEYS = Object.freeze([
  { status: 1, "location.provinceCode": 1, applicationDeadline: 1 },
  {
    status: 1,
    "location.provinceCode": 1,
    "location.districtCode": 1,
    applicationDeadline: 1,
  },
]);
const CANONICAL_CANDIDATE_CV_LOCATION_INDEX_KEYS = Object.freeze([
  {
    "preferredLocations.provinceCode": 1,
    "preferredLocations.districtCode": 1,
    updatedAt: -1,
    _id: -1,
  },
]);

const CLASSIFICATION = Object.freeze({
  CANONICAL: "CANONICAL",
  LEGACY: "LEGACY",
  BLOCKED: "BLOCKED",
});

const MAX_DESCRIBED_RECORDS = 20;

const assertConnectionReady = (connection, step) => {
  if (connection.readyState !== 1) {
    throw new Error(
      `MongoDB connection must be ready before V4.1 legacy Location ${step}`,
    );
  }
};

const assertLegacyMappingCoversVocabulary = () => {
  const legacyVietnamLiterals = Object.values(LOCATION).filter(
    (literal) => literal !== LOCATION.FOREIGN,
  );
  const mappedLiterals = Object.keys(LEGACY_LOCATION_PROVINCE_CODE);
  const provinceCodes = Object.values(LEGACY_LOCATION_PROVINCE_CODE);

  if (
    mappedLiterals.length !== legacyVietnamLiterals.length ||
    legacyVietnamLiterals.some(
      (literal) => !Object.hasOwn(LEGACY_LOCATION_PROVINCE_CODE, literal),
    ) ||
    new Set(provinceCodes).size !== provinceCodes.length
  ) {
    throw new Error(
      "V4.1 legacy Location mapping must map every legacy Vietnam literal to a distinct Province code",
    );
  }
};

const assertMappingTargetsExistInCatalog = async () => {
  const provinces = await listProvinces();
  const catalogCodes = new Set(provinces.map((province) => province.code));
  const missing = Object.entries(LEGACY_LOCATION_PROVINCE_CODE).filter(
    ([, provinceCode]) => !catalogCodes.has(provinceCode),
  );

  if (missing.length > 0) {
    throw new Error(
      `V4.1 legacy Location mapping targets are absent from Province Open API v1: ${missing
        .map(([literal, provinceCode]) => `${literal}→${provinceCode}`)
        .join(", ")}`,
    );
  }
};

const isPresentCode = (value) => {
  return typeof value === "string" && value.trim() !== "";
};

const isPlainObject = (value) => {
  return value != null && typeof value === "object" && !Array.isArray(value);
};

const isStructuredLocation = (value) => {
  return (
    isPlainObject(value) &&
    isPresentCode(value.provinceCode) &&
    (value.districtCode == null || isPresentCode(value.districtCode))
  );
};

const isForeignLocation = (value) => {
  return (
    value === LOCATION.FOREIGN ||
    (isPlainObject(value) && value.provinceCode === LOCATION.FOREIGN)
  );
};

const mapLegacyLiteral = (literal) => {
  if (!Object.hasOwn(LEGACY_LOCATION_PROVINCE_CODE, literal)) {
    return null;
  }

  return {
    provinceCode: LEGACY_LOCATION_PROVINCE_CODE[literal],
    districtCode: null,
  };
};

const canonical = () => ({ state: CLASSIFICATION.CANONICAL });

const blocked = (reason) => ({ state: CLASSIFICATION.BLOCKED, reason });

const classifyJobLocation = (location) => {
  if (location == null) {
    return canonical();
  }

  if (isForeignLocation(location)) {
    return blocked(BLOCKED_REASON.FOREIGN);
  }

  if (typeof location === "string") {
    const migrated = mapLegacyLiteral(location);

    return migrated
      ? { state: CLASSIFICATION.LEGACY, migrated }
      : blocked(BLOCKED_REASON.UNMAPPED_LEGACY_LITERAL);
  }

  return isStructuredLocation(location)
    ? canonical()
    : blocked(BLOCKED_REASON.MALFORMED_LOCATION);
};

const classifyPreferredLocations = (preferredLocations) => {
  if (preferredLocations == null) {
    return canonical();
  }

  if (!Array.isArray(preferredLocations)) {
    return blocked(BLOCKED_REASON.MALFORMED_LOCATION);
  }

  if (preferredLocations.some(isForeignLocation)) {
    return blocked(BLOCKED_REASON.FOREIGN);
  }

  const migrated = [];
  const identities = new Set();
  let hasLegacyLiteral = false;

  for (const item of preferredLocations) {
    let selection;

    if (typeof item === "string") {
      selection = mapLegacyLiteral(item);

      if (!selection) {
        return blocked(BLOCKED_REASON.UNMAPPED_LEGACY_LITERAL);
      }

      hasLegacyLiteral = true;
    } else if (isStructuredLocation(item)) {
      selection = {
        provinceCode: item.provinceCode,
        districtCode: item.districtCode ?? null,
      };
    } else {
      return blocked(BLOCKED_REASON.MALFORMED_LOCATION);
    }

    const identity =
      selection.districtCode == null
        ? `PROVINCE:${selection.provinceCode}`
        : `DISTRICT:${selection.provinceCode}:${selection.districtCode}`;

    if (!identities.has(identity)) {
      identities.add(identity);
      migrated.push(selection);
    }
  }

  const finalSelections = hasLegacyLiteral ? migrated : preferredLocations;

  if (findPreferredLocationSelectionsViolation(finalSelections) != null) {
    return blocked(BLOCKED_REASON.INVALID_SELECTION_SET);
  }

  return hasLegacyLiteral
    ? { state: CLASSIFICATION.LEGACY, migrated }
    : canonical();
};

const ENTITY_SCANS = Object.freeze([
  {
    key: "jobs",
    getCollection: () => Job.collection,
    field: "location",
    classify: classifyJobLocation,
  },
  {
    key: "candidateCvs",
    getCollection: () => CandidateCV.collection,
    field: "preferredLocations",
    classify: classifyPreferredLocations,
  },
]);

const scanEntity = async ({ getCollection, field, classify }) => {
  const scan = { total: 0, canonical: 0, legacy: [], blocked: [] };
  const cursor = getCollection().find({}, { projection: { [field]: 1 } });

  for await (const document of cursor) {
    const value = document[field];
    const classification = classify(value);

    scan.total += 1;

    if (classification.state === CLASSIFICATION.CANONICAL) {
      scan.canonical += 1;
    } else if (classification.state === CLASSIFICATION.LEGACY) {
      scan.legacy.push({
        _id: document._id,
        original: value,
        migrated: classification.migrated,
      });
    } else {
      scan.blocked.push({
        id: document._id.toString(),
        reason: classification.reason,
        value,
      });
    }
  }

  return scan;
};

const scanInventory = async () => {
  const inventory = {};

  for (const entity of ENTITY_SCANS) {
    inventory[entity.key] = await scanEntity(entity);
  }

  return inventory;
};

const toInventoryReport = (inventory) => {
  const report = { name };
  let blockedCount = 0;
  let legacyCount = 0;
  let unresolvedForeignCount = 0;

  for (const { key } of ENTITY_SCANS) {
    const scan = inventory[key];

    report[key] = {
      total: scan.total,
      canonical: scan.canonical,
      legacy: scan.legacy.length,
      blocked: scan.blocked,
    };
    blockedCount += scan.blocked.length;
    legacyCount += scan.legacy.length;
    unresolvedForeignCount += scan.blocked.filter(
      (record) => record.reason === BLOCKED_REASON.FOREIGN,
    ).length;
  }

  return {
    ...report,
    legacyCount,
    blockedCount,
    unresolvedForeignCount,
  };
};

const describeBlockedRecords = (report) => {
  const records = ENTITY_SCANS.flatMap(({ key }) =>
    report[key].blocked.map((record) => `${key}/${record.id}: ${record.reason}`),
  );
  const described = records.slice(0, MAX_DESCRIBED_RECORDS).join(", ");

  return records.length > MAX_DESCRIBED_RECORDS
    ? `${described}, … (${records.length - MAX_DESCRIBED_RECORDS} more)`
    : described;
};

const createBlockedError = (message, report) => {
  const error = new Error(message);

  error.inventory = report;

  return error;
};

const migrateDocuments = async ({ getCollection, field }, legacyEntries) => {
  const collection = getCollection();
  const result = { migrated: 0, changedConcurrently: [], failed: [] };

  for (const { _id, original, migrated } of legacyEntries) {
    try {
      // Conditional on the scanned legacy value so one document either moves
      // to its full canonical value or stays exactly as it was. The raw driver
      // write leaves `updatedAt` untouched.
      const { modifiedCount } = await collection.updateOne(
        { _id, [field]: original },
        { $set: { [field]: migrated } },
      );

      if (modifiedCount === 1) {
        result.migrated += 1;
      } else {
        result.changedConcurrently.push(_id.toString());
      }
    } catch (error) {
      result.failed.push({ id: _id.toString(), message: error.message });
    }
  }

  return result;
};

const findIndexByKey = (indexes, key) => {
  const serializedKey = JSON.stringify(key);

  return indexes.find((index) => JSON.stringify(index.key) === serializedKey);
};

const dropLegacyIndex = async (collection, key) => {
  const legacyIndex = findIndexByKey(await collection.indexes(), key);

  if (!legacyIndex) {
    return null;
  }

  await collection.dropIndex(legacyIndex.name);

  return legacyIndex.name;
};

const findIndexProblems = async () => {
  const problems = [];
  const checks = [
    {
      label: "jobs",
      collection: Job.collection,
      legacyKey: LEGACY_JOB_LOCATION_INDEX_KEY,
      canonicalKeys: CANONICAL_JOB_LOCATION_INDEX_KEYS,
    },
    {
      label: "candidate_cvs",
      collection: CandidateCV.collection,
      legacyKey: LEGACY_CANDIDATE_CV_LOCATION_INDEX_KEY,
      canonicalKeys: CANONICAL_CANDIDATE_CV_LOCATION_INDEX_KEYS,
    },
  ];

  for (const { label, collection, legacyKey, canonicalKeys } of checks) {
    const indexes = await collection.indexes();

    if (findIndexByKey(indexes, legacyKey)) {
      problems.push(
        `${label} still has legacy Location index ${JSON.stringify(legacyKey)}`,
      );
    }

    for (const canonicalKey of canonicalKeys) {
      if (!findIndexByKey(indexes, canonicalKey)) {
        problems.push(
          `${label} is missing canonical Location index ${JSON.stringify(canonicalKey)}`,
        );
      }
    }
  }

  return problems;
};

const ensureSchemaIndexes = async () => {
  await Job.createIndexes();
  await CandidateCV.createIndexes();
};

const preflight = async (connection = mongoose.connection) => {
  assertConnectionReady(connection, "preflight");
  assertLegacyMappingCoversVocabulary();

  return toInventoryReport(await scanInventory());
};

const assertCutoverComplete = async () => {
  const report = toInventoryReport(await scanInventory());
  const problems = [];

  if (report.legacyCount > 0) {
    problems.push(
      `${report.legacyCount} record(s) still persist a legacy Location literal`,
    );
  }

  if (report.blockedCount > 0) {
    problems.push(
      `${report.blockedCount} record(s) are unresolvable (${report.unresolvedForeignCount} FOREIGN): ${describeBlockedRecords(report)}`,
    );
  }

  problems.push(...(await findIndexProblems()));

  if (problems.length > 0) {
    throw createBlockedError(
      `V4.1 legacy Location cutover verification failed: ${problems.join("; ")}`,
      report,
    );
  }

  return report;
};

const migrate = async (connection = mongoose.connection) => {
  assertConnectionReady(connection, "migration");
  assertLegacyMappingCoversVocabulary();

  const inventory = await scanInventory();
  const preflightReport = toInventoryReport(inventory);

  if (preflightReport.blockedCount > 0) {
    throw createBlockedError(
      `V4.1 legacy Location migration blocked before any write: ${preflightReport.blockedCount} unresolvable record(s) (${preflightReport.unresolvedForeignCount} FOREIGN): ${describeBlockedRecords(preflightReport)}`,
      preflightReport,
    );
  }

  if (preflightReport.legacyCount > 0) {
    await assertMappingTargetsExistInCatalog();
  }

  await ensureSchemaIndexes();

  const writeResults = {};

  for (const entity of ENTITY_SCANS) {
    writeResults[entity.key] = await migrateDocuments(
      entity,
      inventory[entity.key].legacy,
    );
  }

  const postWriteReport = toInventoryReport(await scanInventory());

  if (postWriteReport.legacyCount > 0 || postWriteReport.blockedCount > 0) {
    const failures = ENTITY_SCANS.flatMap(({ key }) => [
      ...writeResults[key].failed.map(
        (failure) => `${key}/${failure.id}: ${failure.message}`,
      ),
      ...writeResults[key].changedConcurrently.map(
        (id) => `${key}/${id}: changed concurrently`,
      ),
    ]);

    throw createBlockedError(
      `V4.1 legacy Location migration incomplete; legacy indexes retained: ${postWriteReport.legacyCount} legacy and ${postWriteReport.blockedCount} unresolvable record(s) remain${
        failures.length > 0
          ? ` (${failures.slice(0, MAX_DESCRIBED_RECORDS).join(", ")})`
          : ""
      }`,
      postWriteReport,
    );
  }

  const droppedLegacyIndexes = [
    await dropLegacyIndex(Job.collection, LEGACY_JOB_LOCATION_INDEX_KEY),
    await dropLegacyIndex(
      CandidateCV.collection,
      LEGACY_CANDIDATE_CV_LOCATION_INDEX_KEY,
    ),
  ].filter((indexName) => indexName != null);

  const verification = await assertCutoverComplete();

  return {
    name,
    preflight: preflightReport,
    jobs: { migrated: writeResults.jobs.migrated },
    candidateCvs: { migrated: writeResults.candidateCvs.migrated },
    droppedLegacyIndexes,
    verification,
  };
};

const verify = async (connection = mongoose.connection) => {
  assertConnectionReady(connection, "verification");

  const report = await assertCutoverComplete();

  return { ok: true, ...report };
};

export {
  BLOCKED_REASON,
  connectionOptions,
  LEGACY_CANDIDATE_CV_LOCATION_INDEX_KEY,
  LEGACY_JOB_LOCATION_INDEX_KEY,
  LEGACY_LOCATION_PROVINCE_CODE,
  migrate,
  name,
  preflight,
  verify,
};
