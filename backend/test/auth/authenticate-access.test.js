import jsonwebtoken from "jsonwebtoken";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import config from "../../src/config/index.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthSession from "../../src/models/auth-session.model.js";
import User from "../../src/models/user.model.js";
import { generateAuthToken, hashAuthToken } from "../../src/utils/hash-auth-token.js";
import { generateAccessToken } from "../../src/utils/jwt.js";
import {
  createVerifiedUser,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const createSessionForUser = async (user, {
  expiresAt = new Date(Date.now() + config.authSession.expiresInMs),
} = {}) => {
  return AuthSession.create({
    userId: user._id,
    refreshTokenHash: hashAuthToken(generateAuthToken()),
    expiresAt,
  });
};

const createAccessTokenFor = ({ user, session, expiresIn = config.jwt.expiresIn }) => {
  return jsonwebtoken.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      sessionId: session._id.toString(),
    },
    config.jwt.secret,
    {
      algorithm: config.jwt.algorithm,
      expiresIn,
    },
  );
};

describe("session-bound access authentication", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("accepts a valid access token bound to an active session", async () => {
    const agent = createTestAgent();
    const { password, user } = await createVerifiedUser({
      email: "access-ok@example.com",
    });

    const loginResponse = await agent.post("/api/auth/login").send({
      email: "access-ok@example.com",
      password,
    });

    const response = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: "Access granted",
      auth: {
        userId: user._id.toString(),
        sessionId: loginResponse.body.session.id,
        role: user.role,
      },
    });
  });

  it("rejects missing, malformed, invalid, and expired access tokens", async () => {
    const agent = createTestAgent();

    const missing = await agent.get("/api/auth-access-probe/protected");
    expect(missing.status).toBe(401);

    const malformed = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", "Token not-a-bearer");
    expect(malformed.status).toBe(401);

    const invalid = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", "Bearer not-a-valid-jwt");
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.message).toBe("Invalid or expired access token");

    const { user } = await createVerifiedUser({
      email: "expired-access@example.com",
    });
    const session = await createSessionForUser(user);
    const expiredToken = createAccessTokenFor({
      user,
      session,
      expiresIn: "0s",
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 1_100);
    });

    const expired = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(expired.status).toBe(401);
    expect(expired.body.error.message).toBe("Invalid or expired access token");
  });

  it("rejects revoked and expired sessions even when the JWT is still valid", async () => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser({
      email: "session-invalid@example.com",
    });

    const revokedSession = await createSessionForUser(user);
    const revokedToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
      sessionId: revokedSession._id.toString(),
    });

    await AuthSession.deleteOne({ _id: revokedSession._id });

    const revokedResponse = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${revokedToken}`);

    expect(revokedResponse.status).toBe(401);

    const expiredSession = await createSessionForUser(user, {
      expiresAt: new Date(Date.now() - 1_000),
    });
    const expiredSessionToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
      sessionId: expiredSession._id.toString(),
    });

    const expiredSessionResponse = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${expiredSessionToken}`);

    expect(expiredSessionResponse.status).toBe(401);
  });

  it("rejects access when the session user mismatches or the user no longer exists", async () => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser({
      email: "owner@example.com",
    });
    const { user: otherUser } = await createVerifiedUser({
      email: "other@example.com",
    });

    const session = await createSessionForUser(user);
    const mismatchedToken = generateAccessToken({
      userId: otherUser._id.toString(),
      role: otherUser.role,
      sessionId: session._id.toString(),
    });

    const mismatchResponse = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${mismatchedToken}`);

    expect(mismatchResponse.status).toBe(401);

    const orphanSession = await createSessionForUser(user);
    const orphanToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
      sessionId: orphanSession._id.toString(),
    });

    await User.deleteOne({ _id: user._id });

    const missingUserResponse = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${orphanToken}`);

    expect(missingUserResponse.status).toBe(401);
  });

  it.each([
    USER_STATUS.LOCKED,
    USER_STATUS.TERMINATED,
  ])(
    "rejects access for %s users even when a valid session remains",
    async (status) => {
      const agent = createTestAgent();
      const { user } = await createVerifiedUser({
        email: `${status.toLowerCase()}-access@example.com`,
        status,
      });
      const session = await createSessionForUser(user);
      const accessToken = generateAccessToken({
        userId: user._id.toString(),
        role: user.role,
        sessionId: session._id.toString(),
      });

      const response = await agent
        .get("/api/auth-access-probe/protected")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.accessToken).toBeUndefined();
    },
  );
});
