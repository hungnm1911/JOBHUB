import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import AUTH_TOKEN_TYPE from "../../src/constants/auth-token-type.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthToken from "../../src/models/auth-token.model.js";
import User from "../../src/models/user.model.js";
import sendMail from "../../src/services/mail.service.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

vi.mock("../../src/services/mail.service.js", () => ({
  default: vi.fn().mockResolvedValue({ messageId: "test-message-id" }),
}));

describe("POST /api/auth/register/candidate", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("creates an unverified candidate account and issues an email verification request", async () => {
    const agent = createTestAgent();

    const response = await agent.post("/api/auth/register/candidate").send({
      fullName: "Jane Candidate",
      email: "jane@example.com",
      password: "password123",
    });

    expect(response.status).toBe(201);
    expect(response.body.message).toMatch(/verify your email/i);
    expect(response.body.user).toMatchObject({
      fullName: "Jane Candidate",
      email: "jane@example.com",
      role: USER_ROLE.CANDIDATE,
      status: USER_STATUS.ACTIVE,
      emailVerifiedAt: null,
      mustChangePassword: false,
    });
    expect(response.body.user.id).toEqual(expect.any(String));
    expect(response.body.accessToken).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();

    const persistedUser = await User.findOne({
      email: "jane@example.com",
    }).select("+passwordHash");

    expect(persistedUser).not.toBeNull();
    expect(persistedUser.passwordHash).not.toBe("password123");

    const verificationToken = await AuthToken.findOne({
      userId: persistedUser._id,
      type: AUTH_TOKEN_TYPE.EMAIL_VERIFICATION,
    }).select("+tokenHash");

    expect(verificationToken).not.toBeNull();
    expect(verificationToken.expiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        subject: expect.stringMatching(/verify/i),
        text: expect.stringContaining("/api/auth/verify-email?token="),
        html: expect.stringContaining("/api/auth/verify-email?token="),
      }),
    );
  });

  it("rejects duplicate email registration", async () => {
    const agent = createTestAgent();
    const payload = {
      fullName: "Jane Candidate",
      email: "duplicate@example.com",
      password: "password123",
    };

    await agent.post("/api/auth/register/candidate").send(payload);

    const response = await agent
      .post("/api/auth/register/candidate")
      .send(payload);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe("Email is already registered");
  });

  it("rejects passwords shorter than 8 characters without trimming whitespace", async () => {
    const agent = createTestAgent();

    const response = await agent.post("/api/auth/register/candidate").send({
      fullName: "Jane Candidate",
      email: "short-password@example.com",
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/at least 8 characters/i);

    const whitespaceResponse = await agent
      .post("/api/auth/register/candidate")
      .send({
        fullName: "Jane Candidate",
        email: "whitespace-password@example.com",
        password: "       ",
      });

    expect(whitespaceResponse.status).toBe(400);
    expect(whitespaceResponse.body.error.message).toMatch(
      /at least 8 characters/i,
    );
  });

  it("rejects client-supplied role selection", async () => {
    const agent = createTestAgent();

    const response = await agent.post("/api/auth/register/candidate").send({
      fullName: "Jane Candidate",
      email: "role-hijack@example.com",
      password: "password123",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    expect(response.status).toBe(400);

    const user = await User.findOne({ email: "role-hijack@example.com" });

    expect(user).toBeNull();
  });
});
