import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

describe("MongoDB transaction test infrastructure", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("rolls back writes when a transaction fails", async () => {
    const collection = mongoose.connection.collection(
      "transaction_capability_checks",
    );
    const session = await mongoose.startSession();

    try {
      await expect(
        session.withTransaction(async () => {
          await collection.insertOne(
            { marker: "must-not-persist" },
            { session },
          );

          throw new Error("force transaction rollback");
        }),
      ).rejects.toThrow("force transaction rollback");
    } finally {
      await session.endSession();
    }

    await expect(
      collection.findOne({ marker: "must-not-persist" }),
    ).resolves.toBeNull();
  });
});
