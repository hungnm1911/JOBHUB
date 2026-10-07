import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  connectDatabase,
  disconnectDatabase,
  MODEL_AUTO_INIT_DISABLED_OPTIONS,
} from "../src/config/mongodb.js";

const getErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const resolveMigrationModulePath = (migrationName) => {
  if (typeof migrationName !== "string" || migrationName.trim() === "") {
    throw new Error("Migration name is required");
  }

  const normalizedName = migrationName.trim().replace(/\.js$/i, "");

  return path.resolve(
    process.cwd(),
    "src",
    "database",
    "migrations",
    `${normalizedName}.js`,
  );
};

const loadMigration = async (migrationName) => {
  const migrationPath = resolveMigrationModulePath(migrationName);
  const migrationModule = await import(pathToFileURL(migrationPath).href);

  if (typeof migrationModule.migrate !== "function") {
    throw new Error(
      `Migration "${migrationName}" must export an async migrate(connection) function`,
    );
  }

  return {
    connectionOptions: migrationModule.connectionOptions ?? {},
    migrate: migrationModule.migrate,
    migrationPath,
    name: migrationModule.name ?? migrationName,
    preflight:
      typeof migrationModule.preflight === "function"
        ? migrationModule.preflight
        : null,
    verify:
      typeof migrationModule.verify === "function"
        ? migrationModule.verify
        : null,
  };
};

const runPreflight = async (migrationName) => {
  const migration = await loadMigration(migrationName);

  if (!migration.preflight) {
    throw new Error(
      `Migration "${migrationName}" does not export a preflight(connection) function`,
    );
  }

  const connection = await connectDatabase(MODEL_AUTO_INIT_DISABLED_OPTIONS);

  try {
    console.log(`Running preflight (read-only): ${migration.name}`);
    const report = await migration.preflight(connection);

    console.log(JSON.stringify(report, null, 2));

    return report;
  } finally {
    await disconnectDatabase();
  }
};

const runMigration = async (migrationName) => {
  const migration = await loadMigration(migrationName);
  const connection = await connectDatabase(migration.connectionOptions);

  try {
    console.log(`Running migration: ${migration.name}`);
    const result = await migration.migrate(connection);

    if (migration.verify) {
      console.log(`Verifying migration: ${migration.name}`);
      await migration.verify(connection);
    }

    console.log(`Migration completed: ${migration.name}`);

    return result;
  } finally {
    await disconnectDatabase();
  }
};

const main = async () => {
  const [migrationName, mode] = process.argv.slice(2);

  if (!migrationName || (mode != null && mode !== "--preflight")) {
    throw new Error(
      "Usage: node scripts/run-migration.js <migration-name> [--preflight]",
    );
  }

  if (mode === "--preflight") {
    await runPreflight(migrationName);
    return;
  }

  await runMigration(migrationName);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Migration failed: ${getErrorMessage(error)}`);
    process.exitCode = 1;
  });
}

export {
  loadMigration,
  resolveMigrationModulePath,
  runMigration,
  runPreflight,
};
