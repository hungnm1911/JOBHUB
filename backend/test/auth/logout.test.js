import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import USER_STATUS from "../../src/constants/user-status.js";
import AuthSession from "../../src/models/auth-session.model.js";
import User from "../../src/models/user.model.js";
import {
  createVerifiedUser,
  DEFAULT_PASSWORD,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

describe("POST /api/auth/logout", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("revokes only the authenticated current session without changing the user", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "logout-user@example.com",
    });

    const loginResponse = await agent.post("/api/auth/login").send({
      email: "logout-user@example.com",
      password: DEFAULT_PASSWORD,
    });

    const userBeforeLogout = await User.findById(loginResponse.body.user.id);

    const logoutResponse = await agent
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.message).toMatch(/logout successful/i);

    const deletedSession = await AuthSession.findById(
      loginResponse.body.session.id,
    );
    const userAfterLogout = await User.findById(loginResponse.body.user.id);

    expect(deletedSession).toBeNull();
    expect(userAfterLogout.status).toBe(userBeforeLogout.status);
    expect(userAfterLogout.emailVerifiedAt).not.toBeNull();
  });

  it("rejects access and refresh credentials for the logged-out session", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "revoked-session@example.com",
    });

    const loginResponse = await agent.post("/api/auth/login").send({
      email: "revoked-session@example.com",
      password: DEFAULT_PASSWORD,
    });

    await agent
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    const protectedResponse = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(protectedResponse.status).toBe(401);

    const refreshResponse = await agent.post("/api/auth/refresh").send({
      refreshToken: loginResponse.body.refreshToken,
    });

    expect(refreshResponse.status).toBe(401);
  });

  it("preserves other concurrent sessions for the same user", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "concurrent@example.com",
    });

    const firstLogin = await agent.post("/api/auth/login").send({
      email: "concurrent@example.com",
      password: DEFAULT_PASSWORD,
    });

    const secondLogin = await agent.post("/api/auth/login").send({
      email: "concurrent@example.com",
      password: DEFAULT_PASSWORD,
    });

    await agent
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${firstLogin.body.accessToken}`);

    const revokedAccess = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${firstLogin.body.accessToken}`);

    const revokedRefresh = await agent.post("/api/auth/refresh").send({
      refreshToken: firstLogin.body.refreshToken,
    });

    expect(revokedAccess.status).toBe(401);
    expect(revokedRefresh.status).toBe(401);

    const remainingAccess = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${secondLogin.body.accessToken}`);

    const remainingRefresh = await agent.post("/api/auth/refresh").send({
      refreshToken: secondLogin.body.refreshToken,
    });

    expect(remainingAccess.status).toBe(200);
    expect(remainingRefresh.status).toBe(200);

    const sessions = await AuthSession.find({
      userId: firstLogin.body.user.id,
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]._id.toString()).toBe(secondLogin.body.session.id);
  });

  it("requires authentication", async () => {
    const agent = createTestAgent();

    const response = await agent.post("/api/auth/logout");

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Authentication required");
  });

  it("does not change account status", async () => {
    const agent = createTestAgent();

    const { user } = await createVerifiedUser({
      email: "status-stable@example.com",
      status: USER_STATUS.ACTIVE,
    });

    const loginResponse = await agent.post("/api/auth/login").send({
      email: "status-stable@example.com",
      password: DEFAULT_PASSWORD,
    });

    await agent
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    const persistedUser = await User.findById(user._id);

    expect(persistedUser.status).toBe(USER_STATUS.ACTIVE);
    expect(persistedUser.emailVerifiedAt).not.toBeNull();
  });
});
