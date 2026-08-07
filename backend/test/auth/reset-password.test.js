import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import AUTH_TOKEN_TYPE from "../../src/constants/auth-token-type.js";
import AuthSession from "../../src/models/auth-session.model.js";
import AuthToken from "../../src/models/auth-token.model.js";
import User from "../../src/models/user.model.js";
import { verifyPassword } from "../../src/utils/hash-password.js";
import {
  createPasswordResetToken,
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

const NEW_PASSWORD = "new-password-456";

describe("POST /api/auth/reset-password", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("updates the password, consumes the token, keeps mustChangePassword false, and revokes all sessions", async () => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser({
      email: "reset-target@example.com",
    });

    await createSessionWithRefreshToken(user);
    await createSessionWithRefreshToken(user);

    const { rawToken } = await createPasswordResetToken(user);

    const response = await agent.post("/api/auth/reset-password").send({
      token: rawToken,
      password: NEW_PASSWORD,
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/password reset successful/i);
    expect(response.body.accessToken).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();

    const persistedUser = await User.findById(user._id).select("+passwordHash");
    const resetToken = await AuthToken.findOne({
      userId: user._id,
      type: AUTH_TOKEN_TYPE.PASSWORD_RESET,
    });
    const sessions = await AuthSession.find({ userId: user._id });

    expect(resetToken).toBeNull();
    expect(sessions).toHaveLength(0);
    expect(persistedUser.mustChangePassword).toBe(false);
    expect(await verifyPassword(DEFAULT_PASSWORD, persistedUser.passwordHash)).toBe(false);
    expect(await verifyPassword(NEW_PASSWORD, persistedUser.passwordHash)).toBe(true);

    const oldLogin = await agent.post("/api/auth/login").send({
      email: "reset-target@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(oldLogin.status).toBe(401);

    const newLogin = await agent.post("/api/auth/login").send({
      email: "reset-target@example.com",
      password: NEW_PASSWORD,
    });

    expect(newLogin.status).toBe(200);
  });

  it("rejects invalid, expired, and reused tokens without changing password or sessions", async () => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser({
      email: "token-reject@example.com",
    });
    const { session } = await createSessionWithRefreshToken(user);
    const userBefore = await User.findById(user._id).select("+passwordHash");

    const invalidResponse = await agent.post("/api/auth/reset-password").send({
      token: "invalid-token",
      password: NEW_PASSWORD,
    });

    expect(invalidResponse.status).toBe(400);

    const { rawToken: expiredToken } = await createPasswordResetToken(user, {
      expiresAt: new Date(Date.now() - 1_000),
    });

    const expiredResponse = await agent.post("/api/auth/reset-password").send({
      token: expiredToken,
      password: NEW_PASSWORD,
    });

    expect(expiredResponse.status).toBe(400);

    const { rawToken } = await createPasswordResetToken(user);

    const firstUse = await agent.post("/api/auth/reset-password").send({
      token: rawToken,
      password: NEW_PASSWORD,
    });

    expect(firstUse.status).toBe(200);

    const reusedResponse = await agent.post("/api/auth/reset-password").send({
      token: rawToken,
      password: "another-password-789",
    });

    expect(reusedResponse.status).toBe(400);

    const userAfterFailedAttempts = await User.findById(user._id).select("+passwordHash");

    expect(await verifyPassword(DEFAULT_PASSWORD, userAfterFailedAttempts.passwordHash)).toBe(false);
    expect(await verifyPassword(NEW_PASSWORD, userAfterFailedAttempts.passwordHash)).toBe(true);
    expect(await verifyPassword("another-password-789", userAfterFailedAttempts.passwordHash)).toBe(false);
    expect(userBefore.passwordHash).not.toBe(userAfterFailedAttempts.passwordHash);
    expect(await AuthSession.findById(session._id)).toBeNull();
  });

  it("revokes only the target user's sessions and leaves other users unchanged", async () => {
    const agent = createTestAgent();
    const { user: targetUser } = await createVerifiedUser({
      email: "target-user@example.com",
    });
    const { user: otherUser } = await createVerifiedUser({
      email: "other-user@example.com",
    });

    const { session: targetSession } = await createSessionWithRefreshToken(targetUser);
    const { session: otherSession, rawRefreshToken: otherRefreshToken } =
      await createSessionWithRefreshToken(otherUser);

    const otherUserBefore = await User.findById(otherUser._id).select("+passwordHash");
    const { rawToken } = await createPasswordResetToken(targetUser);

    const response = await agent.post("/api/auth/reset-password").send({
      token: rawToken,
      password: NEW_PASSWORD,
    });

    expect(response.status).toBe(200);

    const targetSessions = await AuthSession.find({ userId: targetUser._id });
    const otherSessions = await AuthSession.find({ userId: otherUser._id });
    const otherUserAfter = await User.findById(otherUser._id).select("+passwordHash");

    expect(targetSessions).toHaveLength(0);
    expect(await AuthSession.findById(targetSession._id)).toBeNull();
    expect(otherSessions).toHaveLength(1);
    expect(otherSessions[0]._id.toString()).toBe(otherSession._id.toString());
    expect(otherUserAfter.passwordHash).toBe(otherUserBefore.passwordHash);

    const otherRefresh = await agent.post("/api/auth/refresh").send({
      refreshToken: otherRefreshToken,
    });

    expect(otherRefresh.status).toBe(200);
  });

  it("rejects passwords that violate the V1 password policy", async () => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser({
      email: "policy@example.com",
    });
    const { session } = await createSessionWithRefreshToken(user);
    const { rawToken } = await createPasswordResetToken(user);

    const response = await agent.post("/api/auth/reset-password").send({
      token: rawToken,
      password: "short",
    });

    expect(response.status).toBe(400);

    const persistedUser = await User.findById(user._id).select("+passwordHash");
    const resetToken = await AuthToken.findOne({
      userId: user._id,
      type: AUTH_TOKEN_TYPE.PASSWORD_RESET,
    });
    const persistedSession = await AuthSession.findById(session._id);

    expect(await verifyPassword(DEFAULT_PASSWORD, persistedUser.passwordHash)).toBe(true);
    expect(resetToken).not.toBeNull();
    expect(persistedSession).not.toBeNull();
  });
});
