import mongoose from "mongoose";

import config from "../src/config/index.js";

const INDEX_NAME = "job_embedding_text_v05_vector_idx";
const EXPECTED_HOST = "jobhub-dev.cffome0.mongodb.net";
const EXPECTED_DATABASE = "jobhub";
const DEFINITION = Object.freeze({
  fields: [
    { type: "autoEmbed", modality: "text", path: "embeddingText", model: "voyage-4" },
    { type: "filter", path: "status" },
    { type: "filter", path: "publishedAt" },
    { type: "filter", path: "applicationDeadline" },
    { type: "filter", path: "companyId" },
  ],
});

const command = process.argv[2] ?? "--check";
if (!["--check", "--create"].includes(command) || process.argv.length > 3) {
  throw new Error("Usage: node scripts/manage-job-embedding-index.js [--check|--create]");
}

const uri = new URL(config.database.uri);
if (
  config.env !== "development" ||
  uri.hostname !== EXPECTED_HOST ||
  decodeURIComponent(uri.pathname.slice(1)) !== EXPECTED_DATABASE
) {
  throw new Error("Refusing to access a MongoDB target other than the verified jobhub-dev database");
}

const client = new mongoose.mongo.MongoClient(config.database.uri, {
  serverSelectionTimeoutMS: config.database.serverSelectionTimeoutMS,
});

try {
  await client.connect();
  const jobs = client.db(EXPECTED_DATABASE).collection("jobs");
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
