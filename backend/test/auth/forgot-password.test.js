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
import AuthSession from "../../src/models/auth-session.model.js";
import AuthToken from "../../src/models/auth-token.model.js";
import User from "../../src/models/user.model.js";
import sendMail from "../../src/services/mail.service.js";
import { hashAuthToken } from "../../src/utils/hash-auth-token.js";
import {
  createSessionWithRefreshToken,
  createVerifiedUser,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

vi.mock("../../src/services/mail.service.js", () => ({
  default: vi.fn().mockResolvedValue({ messageId: "test-message-id" }),
}));

const SUCCESS_MESSAGE =
  "If an account exists for that email, password reset instructions have been sent.";

const extractResetTokenFromMailCall = (mailCall) => {
  const match = mailCall.html.match(/reset-password\?token=([^"]+)/);

  return decodeURIComponent(match[1]);
};

describe("POST /api/auth/forgot-password", () => {
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

  it("creates one expiring PASSWORD_RESET token and sends reset mail for an existing account", async () => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser({
      email: "forgot@example.com",
    });

    const response = await agent.post("/api/auth/forgot-password").send({
      email: "forgot@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(SUCCESS_MESSAGE);

    const resetToken = await AuthToken.findOne({
      userId: user._id,
      type: AUTH_TOKEN_TYPE.PASSWORD_RESET,
    }).select("+tokenHash");

    expect(resetToken).not.toBeNull();
    expect(resetToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "forgot@example.com",
        subject: expect.stringMatching(/reset/i),
        text: expect.stringContaining("reset-password?token="),
        html: expect.stringContaining("reset-password?token="),
      }),
    );

    const rawToken = extractResetTokenFromMailCall(sendMail.mock.calls[0][0]);

    expect(resetToken.tokenHash).toBe(hashAuthToken(rawToken));
  });

  it("returns the same success response for a nonexistent email without creating tokens or sending mail", async () => {
    const agent = createTestAgent();

    const response = await agent.post("/api/auth/forgot-password").send({
      email: "missing@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(SUCCESS_MESSAGE);

    const tokens = await AuthToken.find({});
    expect(tokens).toHaveLength(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("returns the same success response for a non-Candidate account without creating tokens or sending mail", async () => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser({
      email: "manager@example.com",
      role: USER_ROLE.COMPANY_STAFF,
    });

    const response = await agent.post("/api/auth/forgot-password").send({
      email: "manager@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(SUCCESS_MESSAGE);
    expect(
      await AuthToken.countDocuments({
        userId: user._id,
        type: AUTH_TOKEN_TYPE.PASSWORD_RESET,
      }),
    ).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("replaces previous usable PASSWORD_RESET tokens when a new request is issued", async () => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser({
      email: "replace-reset@example.com",
    });

    await agent.post("/api/auth/forgot-password").send({
      email: "replace-reset@example.com",
    });

    const firstRawToken = extractResetTokenFromMailCall(sendMail.mock.calls[0][0]);

    await agent.post("/api/auth/forgot-password").send({
      email: "replace-reset@example.com",
    });

    const secondRawToken = extractResetTokenFromMailCall(sendMail.mock.calls[1][0]);

    expect(firstRawToken).not.toBe(secondRawToken);

    const resetTokens = await AuthToken.find({
      userId: user._id,
      type: AUTH_TOKEN_TYPE.PASSWORD_RESET,
    }).select("+tokenHash");

    expect(resetTokens).toHaveLength(1);
    expect(resetTokens[0].tokenHash).toBe(hashAuthToken(secondRawToken));
    expect(resetTokens[0].tokenHash).not.toBe(hashAuthToken(firstRawToken));
  });

  it("does not revoke sessions or change the user password", async () => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser({
      email: "unchanged@example.com",
    });
    const { session } = await createSessionWithRefreshToken(user);

    const userBefore = await User.findById(user._id).select("+passwordHash");

    await agent.post("/api/auth/forgot-password").send({
      email: "unchanged@example.com",
    });

    const userAfter = await User.findById(user._id).select("+passwordHash");
    const persistedSession = await AuthSession.findById(session._id);

    expect(userAfter.passwordHash).toBe(userBefore.passwordHash);
    expect(persistedSession).not.toBeNull();
  });
});
