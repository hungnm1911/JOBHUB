import mongoose from "mongoose";

import EXPERIENCE_LEVEL from "../../constants/experience-level.js";
import ExperienceLevel from "../../models/experience-level.model.js";

const name = "v4-experience-level-dataset";

const CANONICAL_EXPERIENCE_LEVEL_CODES = Object.freeze(
  Object.values(EXPERIENCE_LEVEL),
);

const assertCanonicalDataset = async (connection) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ExperienceLevel verification",
    );
  }

  const documents = await ExperienceLevel.find().lean();
  const codes = documents.map((document) => document.code).sort();
  const expectedCodes = [...CANONICAL_EXPERIENCE_LEVEL_CODES].sort();
  const errors = [];

  if (documents.length !== CANONICAL_EXPERIENCE_LEVEL_CODES.length) {
    errors.push(
      `expected ${CANONICAL_EXPERIENCE_LEVEL_CODES.length} ExperienceLevel documents, found ${documents.length}`,
    );
  }

  if (JSON.stringify(codes) !== JSON.stringify(expectedCodes)) {
    errors.push(
      `ExperienceLevel codes must be exactly [${expectedCodes.join(", ")}]; found [${codes.join(", ")}]`,
    );
  }

  for (const document of documents) {
    const keys = Object.keys(document).sort();

    if (JSON.stringify(keys) !== JSON.stringify(["_id", "code"].sort())) {
      errors.push(
        `ExperienceLevel ${document.code} has unexpected fields: ${keys.join(", ")}`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `ExperienceLevel dataset verification failed: ${errors.join("; ")}`,
    );
  }
};

const migrate = async (connection = mongoose.connection) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ExperienceLevel migration",
    );
  }

  await ExperienceLevel.init();

  let insertedCount = 0;

  for (const code of CANONICAL_EXPERIENCE_LEVEL_CODES) {
    const result = await ExperienceLevel.updateOne(
      { code },
      { $setOnInsert: { code } },
      { upsert: true },
    );

    if (result.upsertedCount === 1) {
      insertedCount += 1;
    }
  }

  await assertCanonicalDataset(connection);

  return {
    insertedCount,
    name,
    totalCount: CANONICAL_EXPERIENCE_LEVEL_CODES.length,
  };
};

const verify = async (connection = mongoose.connection) => {
  await assertCanonicalDataset(connection);

  return {
    ok: true,
    name,
    totalCount: CANONICAL_EXPERIENCE_LEVEL_CODES.length,
  };
};

export {
  CANONICAL_EXPERIENCE_LEVEL_CODES,
  migrate,
  name,
  verify,
};
