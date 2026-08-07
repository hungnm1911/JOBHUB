import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import AUTH_TOKEN_TYPE from "../../src/constants/auth-token-type.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthToken from "../../src/models/auth-token.model.js";
import User from "../../src/models/user.model.js";
import { verifyEmail } from "../../src/services/auth.service.js";
import { createUnverifiedUserWithVerificationToken } from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

describe("POST /api/auth/verify-email", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("verifies email, consumes the token, and does not issue login credentials", async () => {
    const agent = createTestAgent();
    const { rawToken, user } = await createUnverifiedUserWithVerificationToken({
      email: "verify-me@example.com",
    });

    const response = await agent.post("/api/auth/verify-email").send({
      token: rawToken,
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/verified successfully/i);
    expect(response.body.user).toMatchObject({
      id: user._id.toString(),
      email: "verify-me@example.com",
      status: USER_STATUS.ACTIVE,
    });
    expect(response.body.user.emailVerifiedAt).toEqual(expect.any(String));
    expect(response.body.accessToken).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();

    const persistedUser = await User.findById(user._id);
    const persistedToken = await AuthToken.findOne({
      userId: user._id,
      type: AUTH_TOKEN_TYPE.EMAIL_VERIFICATION,
    });

    expect(persistedUser.emailVerifiedAt).not.toBeNull();
    expect(persistedToken).toBeNull();
  });

  it("rejects invalid, expired, and already-consumed verification tokens", async () => {
    const agent = createTestAgent();

    const invalidResponse = await agent.post("/api/auth/verify-email").send({
      token: "not-a-valid-token",
    });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error.message).toBe(
      "Invalid or expired email verification token",
    );

    const { rawToken: expiredToken } =
      await createUnverifiedUserWithVerificationToken({
        email: "expired@example.com",
        expiresAt: new Date(Date.now() - 1_000),
      });

    const expiredResponse = await agent.post("/api/auth/verify-email").send({
      token: expiredToken,
    });

    expect(expiredResponse.status).toBe(400);
    expect(expiredResponse.body.error.message).toBe(
      "Invalid or expired email verification token",
    );

    const { rawToken: reusableToken } =
      await createUnverifiedUserWithVerificationToken({
        email: "consumed@example.com",
      });

    const firstUse = await agent.post("/api/auth/verify-email").send({
      token: reusableToken,
    });

    expect(firstUse.status).toBe(200);

    const consumedResponse = await agent.post("/api/auth/verify-email").send({
      token: reusableToken,
    });

    expect(consumedResponse.status).toBe(400);
    expect(consumedResponse.body.error.message).toBe(
      "Invalid or expired email verification token",
    );
  });

  it("rejects verification when email is already verified", async () => {
    const agent = createTestAgent();
    const { rawToken, user } = await createUnverifiedUserWithVerificationToken({
      email: "already-verified@example.com",
    });

    await User.updateOne(
      { _id: user._id },
      { emailVerifiedAt: new Date() },
    );

    const response = await agent.post("/api/auth/verify-email").send({
      token: rawToken,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe("Email is already verified");

    const persistedToken = await AuthToken.findOne({
      userId: user._id,
      type: AUTH_TOKEN_TYPE.EMAIL_VERIFICATION,
    }).select("+tokenHash");

    expect(persistedToken).not.toBeNull();
  });
});

describe("verifyEmail service persistence", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it.each([
    USER_STATUS.LOCKED,
    USER_STATUS.TERMINATED,
  ])("sets emailVerifiedAt without changing %s account status", async (status) => {
    const { rawToken, user } = await createUnverifiedUserWithVerificationToken({
      email: `${status.toLowerCase()}@example.com`,
      status,
    });

    const verifiedUser = await verifyEmail({ token: rawToken });

    expect(verifiedUser.status).toBe(status);
    expect(verifiedUser.emailVerifiedAt).not.toBeNull();

    const persistedUser = await User.findById(user._id);
    const persistedToken = await AuthToken.findOne({
      userId: user._id,
      type: AUTH_TOKEN_TYPE.EMAIL_VERIFICATION,
    });

    expect(persistedUser.status).toBe(status);
    expect(persistedUser.emailVerifiedAt).not.toBeNull();
    expect(persistedToken).toBeNull();
  });
});
