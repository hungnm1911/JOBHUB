import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  connectDatabase,
  disconnectDatabase,
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
    migrate: migrationModule.migrate,
    migrationPath,
    name: migrationModule.name ?? migrationName,
    verify:
      typeof migrationModule.verify === "function"
        ? migrationModule.verify
        : null,
  };
};

const runMigration = async (migrationName) => {
  const migration = await loadMigration(migrationName);
  const connection = await connectDatabase();

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
  const migrationName = process.argv[2];

  if (!migrationName) {
    throw new Error(
      "Usage: node scripts/run-migration.js <migration-name>",
    );
  }

  await runMigration(migrationName);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Migration failed: ${getErrorMessage(error)}`);
    process.exitCode = 1;
  });
}

export { loadMigration, resolveMigrationModulePath, runMigration };
