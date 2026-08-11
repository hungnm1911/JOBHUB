import mongoose from "mongoose";

import Job, { ensureJobCollectionInvariants } from "../../models/job.model.js";

const name = "v6-supporting-recruiter-backfill";

const migrate = async (connection = mongoose.connection) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before V6 Supporting Recruiter backfill",
    );
  }

  await Job.init();

  const result = await Job.updateMany(
    { supportingRecruiterCompanyMemberIds: { $exists: false } },
    { $set: { supportingRecruiterCompanyMemberIds: [] } },
  );

  await Job.syncIndexes();

  await ensureJobCollectionInvariants(connection);

  await assertMigrationInvariants(connection);

  return {
    name,
    modifiedCount: result.modifiedCount,
    matchedCount: result.matchedCount,
  };
};

const assertMigrationInvariants = async (connection) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before V6 backfill verification",
    );
  }

  const missingField = await Job.countDocuments({
    supportingRecruiterCompanyMemberIds: { $exists: false },
  });

  if (missingField > 0) {
    throw new Error(
      `V6 backfill verification failed: ${missingField} Job(s) still missing supportingRecruiterCompanyMemberIds`,
    );
  }

  const indexes = await Job.collection.indexes();
  const indexKeys = indexes.map((idx) => JSON.stringify(Object.keys(idx.key)));

  const requiredKeys = [
    JSON.stringify([
      "primaryRecruiterCompanyMemberId",
      "status",
      "applicationDeadline",
    ]),
    JSON.stringify([
      "supportingRecruiterCompanyMemberIds",
      "status",
      "applicationDeadline",
    ]),
  ];

  for (const required of requiredKeys) {
    if (!indexKeys.includes(required)) {
      throw new Error(
        `V6 backfill verification failed: missing required index with keys ${required}`,
      );
    }
  }
};

const verify = async (connection = mongoose.connection) => {
  await assertMigrationInvariants(connection);

  return { ok: true, name };
};

export { migrate, name, verify };
