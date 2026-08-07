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
import { hashAuthToken } from "../../src/utils/hash-auth-token.js";
import {
  createUnverifiedUserWithVerificationToken,
  createVerifiedUser,
  DEFAULT_PASSWORD,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

describe("POST /api/auth/login", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("creates one expiring session with hashed refresh credential and returns access credentials", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "login-success@example.com",
    });

    const response = await agent.post("/api/auth/login").send({
      email: "login-success@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/login successful/i);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.session).toMatchObject({
      id: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(response.body.user.email).toBe("login-success@example.com");

    const persistedSession = await AuthSession.findOne({
      userId: response.body.user.id,
    }).select("+refreshTokenHash");

    expect(persistedSession).not.toBeNull();
    expect(persistedSession.refreshTokenHash).not.toBe(response.body.refreshToken);
    expect(persistedSession.refreshTokenHash).toBe(
      hashAuthToken(response.body.refreshToken),
    );
    expect(persistedSession.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const decodedAccessToken = jsonwebtoken.verify(
      response.body.accessToken,
      config.jwt.secret,
      { algorithms: [config.jwt.algorithm] },
    );

    expect(decodedAccessToken).toMatchObject({
      userId: response.body.user.id,
      role: response.body.user.role,
      sessionId: response.body.session.id,
    });
  });

  it("creates independent sessions for repeated successful logins", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "multi-session@example.com",
    });

    const firstLogin = await agent.post("/api/auth/login").send({
      email: "multi-session@example.com",
      password: DEFAULT_PASSWORD,
    });

    const secondLogin = await agent.post("/api/auth/login").send({
      email: "multi-session@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(200);
    expect(firstLogin.body.session.id).not.toBe(secondLogin.body.session.id);
    expect(firstLogin.body.refreshToken).not.toBe(secondLogin.body.refreshToken);

    const sessions = await AuthSession.find({
      userId: firstLogin.body.user.id,
    });

    expect(sessions).toHaveLength(2);
  });

  it("rejects invalid credentials", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "known-user@example.com",
    });

    const unknownUserResponse = await agent.post("/api/auth/login").send({
      email: "missing-user@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(unknownUserResponse.status).toBe(401);
    expect(unknownUserResponse.body.error.message).toBe("Invalid email or password");

    const wrongPasswordResponse = await agent.post("/api/auth/login").send({
      email: "known-user@example.com",
      password: "wrong-password",
    });

    expect(wrongPasswordResponse.status).toBe(401);
    expect(wrongPasswordResponse.body.error.message).toBe("Invalid email or password");
  });

  it("rejects unverified email before login", async () => {
    const agent = createTestAgent();

    await createUnverifiedUserWithVerificationToken({
      email: "unverified@example.com",
    });

    const response = await agent.post("/api/auth/login").send({
      email: "unverified@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe(
      "Email verification is required before login",
    );

    const sessions = await AuthSession.find({});

    expect(sessions).toHaveLength(0);
  });

  it.each([
    USER_STATUS.LOCKED,
    USER_STATUS.TERMINATED,
  ])("rejects %s accounts without creating a session", async (status) => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: `${status.toLowerCase()}@example.com`,
      status,
    });

    const response = await agent.post("/api/auth/login").send({
      email: `${status.toLowerCase()}@example.com`,
      password: DEFAULT_PASSWORD,
    });

    expect(response.status).toBe(403);
    expect(response.body.accessToken).toBeUndefined();

    const sessions = await AuthSession.find({});

    expect(sessions).toHaveLength(0);
  });
});
