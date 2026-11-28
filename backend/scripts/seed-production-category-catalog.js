import { readFile } from "node:fs/promises";

import config from "../src/config/index.js";
import {
  connectDatabase,
  disconnectDatabase,
  MODEL_AUTO_INIT_DISABLED_OPTIONS,
} from "../src/config/mongodb.js";
import Category, {
  canonicalizeCategoryDisplayName,
  normalizeCategoryName,
} from "../src/models/category.model.js";
import {
  createFieldCategory,
  createPositionCategory,
} from "../src/services/category.service.js";

const EXPECTED_HOST = "jobhub-prod.a956r7b.mongodb.net";
const EXPECTED_DATABASE = "jobhub";
const DATA_URL = new URL(
  "../../tmp/production-seed-data/seed-normaliztion/topcv-jobhub-category-catalog.json",
  import.meta.url,
);

const assertProductionTarget = () => {
  let uri;
  try {
    uri = new URL(config.database.uri);
  } catch {
    throw new Error("Malformed MongoDB URI");
  }

  if (
    config.env !== "production" ||
    uri.protocol !== "mongodb+srv:" ||
    uri.hostname !== EXPECTED_HOST ||
    decodeURIComponent(uri.pathname) !== `/${EXPECTED_DATABASE}`
  ) {
    throw new Error("Production Atlas target guard failed");
  }
};

const loadCatalog = async () => {
  const catalog = JSON.parse(await readFile(DATA_URL, "utf8"));
  const fieldKeys = new Set();
  let positionCount = 0;

  if (!Array.isArray(catalog.fields) || catalog.fields.length !== 25) {
    throw new Error("Expected exactly 25 FIELD definitions");
  }

  for (const field of catalog.fields) {
    if (
      typeof field.name !== "string" ||
      field.name !== canonicalizeCategoryDisplayName(field.name) ||
      !Array.isArray(field.positions) ||
      field.positions.length === 0
    ) {
      throw new Error("Invalid FIELD definition");
    }

    const fieldKey = normalizeCategoryName(field.name);
    if (fieldKeys.has(fieldKey)) throw new Error("Duplicate FIELD definition");
    fieldKeys.add(fieldKey);

    const positionKeys = new Set();
    for (const name of field.positions) {
      if (
        typeof name !== "string" ||
        !name ||
        name !== canonicalizeCategoryDisplayName(name)
      ) {
        throw new Error("Invalid POSITION definition");
      }

      const key = normalizeCategoryName(name);
      if (positionKeys.has(key)) {
        throw new Error(`Duplicate POSITION definition in ${field.name}`);
      }
      positionKeys.add(key);
      positionCount += 1;
    }
  }

  if (
    catalog.sourceFieldCount !== 25 ||
    catalog.sourcePositionCount !== 911 ||
    catalog.excluded?.length !== 25 ||
    positionCount !== 886
  ) {
    throw new Error("Catalog normalization count mismatch");
  }

  return catalog;
};

const inspectExisting = (catalog, existing) => {
  const expectedFields = new Map(
    catalog.fields.map((field) => [normalizeCategoryName(field.name), field]),
  );
  const fieldsByKey = new Map();
  const fieldsById = new Map();
  const positionsByKey = new Map();

  for (const category of existing) {
    if (category.level !== "FIELD") continue;
    const key = normalizeCategoryName(category.name);
    const expected = expectedFields.get(key);
    if (
      !expected ||
      category.name !== expected.name ||
      category.normalizedName !== key ||
      category.parentCategoryId != null ||
      fieldsByKey.has(key)
    ) {
      throw new Error("Unexpected or drifted production FIELD");
    }
    fieldsByKey.set(key, category);
    fieldsById.set(category._id.toString(), expected);
  }

  for (const category of existing) {
    if (category.level !== "POSITION") {
      if (category.level !== "FIELD") {
        throw new Error("Unexpected production Category level");
      }
      continue;
    }

    const parentId = category.parentCategoryId?.toString();
    const parent = fieldsById.get(parentId);
    const key = normalizeCategoryName(category.name);
    const expectedName = parent?.positions.find(
      (name) => normalizeCategoryName(name) === key,
    );
    const compoundKey = `${parentId}:${key}`;
    if (
      !expectedName ||
      category.name !== expectedName ||
      category.normalizedName !== key ||
      positionsByKey.has(compoundKey)
    ) {
      throw new Error("Unexpected or drifted production POSITION");
    }
    positionsByKey.set(compoundKey, category);
  }

  return { fieldsByKey, positionsByKey };
};

const run = async (apply) => {
  assertProductionTarget();
  const catalog = await loadCatalog();
  let connected = false;

  try {
    const connection = await connectDatabase(MODEL_AUTO_INIT_DISABLED_OPTIONS);
    connected = true;
    if (connection.name !== EXPECTED_DATABASE) {
      throw new Error("Connected database guard failed");
    }

    const before = await Category.find({}).lean();
    const { fieldsByKey, positionsByKey } = inspectExisting(catalog, before);
    const report = {
      target: `${EXPECTED_HOST}/${EXPECTED_DATABASE}`,
      mode: apply ? "apply" : "dry-run",
      expectedFields: 25,
      expectedPositions: 886,
      excludedSourcePositions: catalog.excluded.length,
      existingFields: fieldsByKey.size,
      existingPositions: positionsByKey.size,
      missingFields: 25 - fieldsByKey.size,
      missingPositions: 886 - positionsByKey.size,
    };

    if (!apply) return report;

    // Auto-indexing is disabled for preflight; establish the model's unique
    // compound index explicitly before the first immutable Category write.
    await Category.createIndexes();
    const indexes = await Category.collection.indexes();
    if (
      !indexes.some(
        (index) =>
          index.unique === true &&
          index.key?.parentCategoryId === 1 &&
          index.key?.normalizedName === 1,
      )
    ) {
      throw new Error("Category uniqueness index is missing");
    }

    for (const definition of catalog.fields) {
      const fieldKey = normalizeCategoryName(definition.name);
      let field = fieldsByKey.get(fieldKey);
      if (!field) {
        const created = await createFieldCategory({ name: definition.name });
        field = { _id: created.id };
        fieldsByKey.set(fieldKey, field);
      }

      for (const name of definition.positions) {
        const key = `${field._id}:${normalizeCategoryName(name)}`;
        if (positionsByKey.has(key)) continue;
        const created = await createPositionCategory({
          name,
          parentCategoryId: field._id,
        });
        positionsByKey.set(key, { _id: created.id });
      }
    }

    const after = await Category.find({}).lean();
    const verified = inspectExisting(catalog, after);
    if (
      after.length !== 911 ||
      verified.fieldsByKey.size !== 25 ||
      verified.positionsByKey.size !== 886
    ) {
      throw new Error("Production Category verification failed");
    }

    return {
      ...report,
      createdFields: verified.fieldsByKey.size - report.existingFields,
      createdPositions: verified.positionsByKey.size - report.existingPositions,
      verifiedFields: verified.fieldsByKey.size,
      verifiedPositions: verified.positionsByKey.size,
    };
  } finally {
    if (connected) await disconnectDatabase();
  }
};

const args = process.argv.slice(2);
if (args.length !== 1 || !["--dry-run", "--apply"].includes(args[0])) {
  process.stderr.write(
    "Usage: node scripts/seed-production-category-catalog.js --dry-run|--apply\n",
  );
  process.exitCode = 2;
} else {
  try {
    process.stdout.write(`${JSON.stringify(await run(args[0] === "--apply"), null, 2)}\n`);
  } catch {
    // Driver errors can include the URI, so never echo raw error details.
    process.stderr.write("Production Category seed failed; database may contain a partial seed. Rerun dry-run before retrying.\n");
    process.exitCode = 1;
  }
}
