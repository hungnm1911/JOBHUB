import mongoose from "mongoose";

import config from "../src/config/index.js";

const INDEX_NAME = "job_embedding_text_v05_vector_idx";
const DEVELOPMENT_HOST = "jobhub-dev.cffome0.mongodb.net";
const DEVELOPMENT_DATABASE = "jobhub";
const DEFINITION = Object.freeze({
  fields: [
    { type: "autoEmbed", modality: "text", path: "embeddingText", model: "voyage-4" },
    { type: "filter", path: "status" },
    { type: "filter", path: "publishedAt" },
    { type: "filter", path: "applicationDeadline" },
    { type: "filter", path: "companyId" },
  ],
});

const [command = "--check", targetFlag, expectedHost, expectedDatabase, ...extra] = process.argv.slice(2);
const usage = "Usage: node scripts/manage-job-embedding-index.js [--check|--create] [--production-target <atlas-host> <database-name>]";
if (!["--check", "--create"].includes(command) || extra.length > 0) {
  throw new Error(usage);
}
const uri = new URL(config.database.uri);
const databaseName = decodeURIComponent(uri.pathname.slice(1));

if (config.env === "development") {
  if (targetFlag != null || uri.hostname !== DEVELOPMENT_HOST || databaseName !== DEVELOPMENT_DATABASE) {
    throw new Error("Refusing to access a development target other than the verified jobhub-dev database");
  }
} else if (config.env === "production") {
  if (targetFlag !== "--production-target" || !expectedHost || !expectedDatabase) {
    throw new Error(usage);
  }
  if (
    uri.protocol !== "mongodb+srv:" ||
    !uri.username ||
    !uri.hostname.endsWith(".mongodb.net") ||
    uri.hostname === DEVELOPMENT_HOST ||
    uri.hostname !== expectedHost ||
    databaseName !== expectedDatabase
  ) {
    throw new Error("Refusing to access a production MongoDB target that does not match the explicit Atlas host and database");
  }
} else {
  throw new Error("Job embedding index management requires NODE_ENV=development or production");
}

const client = new mongoose.mongo.MongoClient(config.database.uri, {
  serverSelectionTimeoutMS: config.database.serverSelectionTimeoutMS,
});

try {
  await client.connect();
  const jobs = client.db(databaseName).collection("jobs");
  const indexes = await jobs.listSearchIndexes().toArray();
  const matching = indexes.filter(
    (index) => index.name === INDEX_NAME || index.type === "vectorSearch",
  );

  if (matching.length > 1) {
    throw new Error("Multiple jobs Vector Search indexes require operator review");
  }

  const conflicting = matching[0];

  if (conflicting) {
    if (
      conflicting.name !== INDEX_NAME ||
      conflicting.type !== "vectorSearch" ||
      JSON.stringify(conflicting.latestDefinition) !== JSON.stringify(DEFINITION)
    ) {
      throw new Error(`Conflicting jobs Search Index: ${conflicting.name}`);
    }

    process.stdout.write(
      `${JSON.stringify({ name: conflicting.name, status: conflicting.status, queryable: conflicting.queryable, definition: conflicting.latestDefinition })}\n`,
    );
  } else if (command === "--create") {
    await jobs.createSearchIndex({ name: INDEX_NAME, type: "vectorSearch", definition: DEFINITION });
    process.stdout.write(`${JSON.stringify({ name: INDEX_NAME, created: true, status: "BUILDING" })}\n`);
  } else {
    process.stdout.write(`${JSON.stringify({ name: INDEX_NAME, exists: false })}\n`);
  }
} catch (error) {
  process.stderr.write(`Job embedding index management failed: ${error.codeName ?? error.name}: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await client.close();
}
