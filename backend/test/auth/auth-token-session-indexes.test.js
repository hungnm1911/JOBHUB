import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import mongoose from "mongoose";

import AUTH_TOKEN_TYPE from "../../src/constants/auth-token-type.js";
import AuthSession from "../../src/models/auth-session.model.js";
import AuthToken from "../../src/models/auth-token.model.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const findIndexByKey = (indexes, key) => {
  return indexes.find((index) => {
    const indexKey = index.key;
    const expectedKeys = Object.keys(key);

    return (
      Object.keys(indexKey).length === expectedKeys.length &&
      expectedKeys.every((field) => indexKey[field] === key[field])
    );
  });
};

describe("AuthToken and AuthSession canonical index contract", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("declares unique tokenHash, compound userId+type, and TTL expiresAt on AuthToken", async () => {
    await AuthToken.createCollection();
    await AuthToken.syncIndexes();

    const indexes = await AuthToken.collection.indexes();

    const tokenHashIndex = findIndexByKey(indexes, { tokenHash: 1 });
    const userIdTypeIndex = findIndexByKey(indexes, { userId: 1, type: 1 });
    const expiresAtIndex = findIndexByKey(indexes, { expiresAt: 1 });

    expect(tokenHashIndex).toBeDefined();
    expect(tokenHashIndex.unique).toBe(true);

    expect(userIdTypeIndex).toBeDefined();
    expect(userIdTypeIndex.unique).not.toBe(true);

    expect(expiresAtIndex).toBeDefined();
    expect(expiresAtIndex.expireAfterSeconds).toBe(0);

    const userId = new mongoose.Types.ObjectId();

    await AuthToken.create({
      userId,
      type: AUTH_TOKEN_TYPE.EMAIL_VERIFICATION,
      tokenHash: "token-hash-unique-contract",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      AuthToken.create({
        userId: new mongoose.Types.ObjectId(),
        type: AUTH_TOKEN_TYPE.PASSWORD_RESET,
        tokenHash: "token-hash-unique-contract",
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("declares unique refreshTokenHash, userId lookup, and TTL expiresAt on AuthSession", async () => {
    await AuthSession.createCollection();
    await AuthSession.syncIndexes();

    const indexes = await AuthSession.collection.indexes();

    const refreshTokenHashIndex = findIndexByKey(indexes, {
      refreshTokenHash: 1,
    });
    const userIdIndex = findIndexByKey(indexes, { userId: 1 });
    const expiresAtIndex = findIndexByKey(indexes, { expiresAt: 1 });

    expect(refreshTokenHashIndex).toBeDefined();
    expect(refreshTokenHashIndex.unique).toBe(true);

    expect(userIdIndex).toBeDefined();

    expect(expiresAtIndex).toBeDefined();
    expect(expiresAtIndex.expireAfterSeconds).toBe(0);

    await AuthSession.create({
      userId: new mongoose.Types.ObjectId(),
      refreshTokenHash: "refresh-hash-unique-contract",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      AuthSession.create({
        userId: new mongoose.Types.ObjectId(),
        refreshTokenHash: "refresh-hash-unique-contract",
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({
      code: 11000,
    });
  });
});
