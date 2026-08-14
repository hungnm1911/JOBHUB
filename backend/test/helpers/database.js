import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";

import app from "../../src/app.js";
import { ensureApplicationCollectionInvariants } from "../../src/models/application.model.js";
import { ensureCandidateCvCollectionInvariants } from "../../src/models/candidate-cv.model.js";
import { ensureCompanyCollectionInvariants } from "../../src/models/company.model.js";
import { ensureConversationCollection } from "../../src/models/conversation.model.js";
import { ensureJobCollectionInvariants } from "../../src/models/job.model.js";
import { ensureMessageCollection } from "../../src/models/message.model.js";

let mongoMemoryReplicaSet = null;

const connectTestDatabase = async () => {
  mongoMemoryReplicaSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });
  const uri = mongoMemoryReplicaSet.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5_000,
  });

  await ensureCompanyCollectionInvariants(mongoose.connection);
  await ensureJobCollectionInvariants(mongoose.connection);
  await ensureCandidateCvCollectionInvariants(mongoose.connection);
  await ensureApplicationCollectionInvariants(mongoose.connection);
  await ensureConversationCollection(mongoose.connection);
  await ensureMessageCollection(mongoose.connection);
};

const disconnectTestDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoMemoryReplicaSet) {
    await mongoMemoryReplicaSet.stop();
    mongoMemoryReplicaSet = null;
  }
};

const clearDatabase = async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const { collections } = mongoose.connection;

  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
};

const createTestAgent = () => {
  return request(app);
};

export {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
};
