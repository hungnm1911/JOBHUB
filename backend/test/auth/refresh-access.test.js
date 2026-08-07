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
import {
  createSessionWithRefreshToken,
  createVerifiedUser,
  DEFAULT_PASSWORD,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

describe("POST /api/auth/refresh", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("issues a new access token bound to the same valid session without rotating refresh credentials", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "refresh-ok@example.com",
    });

    const loginResponse = await agent.post("/api/auth/login").send({
      email: "refresh-ok@example.com",
      password: DEFAULT_PASSWORD,
    });

    const sessionBeforeRefresh = await AuthSession.findById(
      loginResponse.body.session.id,
    ).select("+refreshTokenHash");

    const refreshResponse = await agent.post("/api/auth/refresh").send({
      refreshToken: loginResponse.body.refreshToken,
    });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.message).toMatch(/refreshed successfully/i);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).toBeUndefined();
    expect(refreshResponse.body.session.id).toBe(loginResponse.body.session.id);

    const sessionAfterRefresh = await AuthSession.findById(
      loginResponse.body.session.id,
    ).select("+refreshTokenHash");

    expect(sessionAfterRefresh.refreshTokenHash).toBe(
      sessionBeforeRefresh.refreshTokenHash,
    );
    expect(sessionAfterRefresh.expiresAt.getTime()).toBe(
      sessionBeforeRefresh.expiresAt.getTime(),
    );

    const decodedAccessToken = jsonwebtoken.verify(
      refreshResponse.body.accessToken,
      config.jwt.secret,
      { algorithms: [config.jwt.algorithm] },
    );

    expect(decodedAccessToken).toMatchObject({
      userId: loginResponse.body.user.id,
      sessionId: loginResponse.body.session.id,
      role: loginResponse.body.user.role,
    });

    const protectedResponse = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${refreshResponse.body.accessToken}`);

    expect(protectedResponse.status).toBe(200);
    expect(protectedResponse.body.auth.userId).toBe(loginResponse.body.user.id);
  });

  it("rejects missing and invalid refresh credentials", async () => {
    const agent = createTestAgent();

    const missing = await agent.post("/api/auth/refresh").send({});
    expect(missing.status).toBe(400);

    const invalid = await agent.post("/api/auth/refresh").send({
      refreshToken: "not-a-valid-refresh-token",
    });

    expect(invalid.status).toBe(401);
    expect(invalid.body.error.message).toBe("Invalid or expired refresh token");
  });

  it("rejects deleted and expired sessions", async () => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser({
      email: "session-gone@example.com",
    });

    const { rawRefreshToken, session } = await createSessionWithRefreshToken(user);

    await AuthSession.deleteOne({ _id: session._id });

    const deletedSessionResponse = await agent.post("/api/auth/refresh").send({
      refreshToken: rawRefreshToken,
    });

    expect(deletedSessionResponse.status).toBe(401);

    const { rawRefreshToken: expiredRefreshToken } =
      await createSessionWithRefreshToken(user, {
        expiresAt: new Date(Date.now() - 1_000),
      });

    const expiredSessionResponse = await agent.post("/api/auth/refresh").send({
      refreshToken: expiredRefreshToken,
    });

    expect(expiredSessionResponse.status).toBe(401);
  });

  it("binds refreshed access to the session owner rather than another user", async () => {
    const agent = createTestAgent();
    const { user: owner } = await createVerifiedUser({
      email: "owner@example.com",
    });
    const { user: otherUser } = await createVerifiedUser({
      email: "other@example.com",
    });

    const { rawRefreshToken } = await createSessionWithRefreshToken(owner);

    const response = await agent.post("/api/auth/refresh").send({
      refreshToken: rawRefreshToken,
    });

    expect(response.status).toBe(200);

    const decodedAccessToken = jsonwebtoken.verify(
      response.body.accessToken,
      config.jwt.secret,
      { algorithms: [config.jwt.algorithm] },
    );

    expect(decodedAccessToken.userId).toBe(owner._id.toString());
    expect(decodedAccessToken.userId).not.toBe(otherUser._id.toString());
  });

  it("rejects refresh when the owning user no longer exists", async () => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser({
      email: "missing-user@example.com",
    });
    const { rawRefreshToken } = await createSessionWithRefreshToken(user);

    await User.deleteOne({ _id: user._id });

    const response = await agent.post("/api/auth/refresh").send({
      refreshToken: rawRefreshToken,
    });

    expect(response.status).toBe(401);
  });

  it.each([
    USER_STATUS.LOCKED,
    USER_STATUS.TERMINATED,
  ])("rejects refresh for %s users", async (status) => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser({
      email: `${status.toLowerCase()}-refresh@example.com`,
      status,
    });
    const { rawRefreshToken } = await createSessionWithRefreshToken(user);

    const response = await agent.post("/api/auth/refresh").send({
      refreshToken: rawRefreshToken,
    });

    expect(response.status).toBe(403);
    expect(response.body.accessToken).toBeUndefined();
  });
});
