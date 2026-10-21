import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import AuthSession from "../../src/models/auth-session.model.js";
import AuthToken from "../../src/models/auth-token.model.js";
import User from "../../src/models/user.model.js";
import sendMail from "../../src/services/mail.service.js";
import { hashAuthToken } from "../../src/utils/hash-auth-token.js";
import { createActiveCompanyManagerContext, createActiveRecruiterContext, createCompanyStaffWithMembership,
  createPasswordResetToken, createSessionWithRefreshToken, createUnverifiedUserWithVerificationToken,
  createVerifiedUser, loginAndGetAccessToken } from "../helpers/auth-fixtures.js";
import { clearDatabase, connectTestDatabase, createTestAgent, disconnectTestDatabase } from "../helpers/database.js";

vi.mock("../../src/services/mail.service.js", () => ({ default: vi.fn().mockResolvedValue({}) }));
const mailToken = (index = sendMail.mock.calls.length - 1) => decodeURIComponent(sendMail.mock.calls[index][0].text.match(/token=([^\s]+)/)[1]);
const noSecrets = (body) => expect(JSON.stringify(body)).not.toMatch(/passwordHash|tokenHash|refreshTokenHash/);

describe("V1 API completion", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => { vi.clearAllMocks(); await clearDatabase(); });
  afterAll(disconnectTestDatabase);

  it("returns only current public account and membership, including onboarding", async () => {
    const agent = createTestAgent();
    const manager = await createCompanyStaffWithMembership();
    const token = await loginAndGetAccessToken(agent, { email: manager.user.email });
    const response = await agent.get("/api/auth/me").auth(token, { type: "bearer" });
    expect(response.status).toBe(200);
    expect(response.body.user.status).toBe("PENDING_ACTIVATION");
    expect(response.body.membership).toMatchObject({ role: "COMPANY_MANAGER", companyId: manager.company.id });
    noSecrets(response.body);
    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });

  it("changes password atomically, invalidates reset and every session, leaves lifecycle unchanged", async () => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser();
    const token = await loginAndGetAccessToken(agent, { email: user.email });
    const other = await createSessionWithRefreshToken(user);
    const reset = await createPasswordResetToken(user);
    const before = await User.findById(user._id);
    const wrong = await agent.post("/api/auth/change-password").auth(token, { type: "bearer" })
      .send({ currentPassword: "wrong", password: "newPassword123" });
    expect(wrong.status).toBe(400);
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(2);
    const changed = await agent.post("/api/auth/change-password").auth(token, { type: "bearer" })
      .send({ currentPassword: "password123", password: "newPassword123" });
    expect(changed.status).toBe(200);
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(0);
    expect((await agent.get("/api/auth/me").auth(token, { type: "bearer" })).status).toBe(401);
    expect((await agent.post("/api/auth/refresh").send({ refreshToken: other.rawRefreshToken })).status).toBe(401);
    expect((await agent.post("/api/auth/reset-password").send({ token: reset.rawToken, password: "replayed123" })).status).toBe(400);
    expect((await agent.post("/api/auth/login").send({ email: user.email, password: "newPassword123" })).status).toBe(200);
    const after = await User.findById(user._id);
    expect(after.status).toBe(before.status);
    expect(after.emailVerifiedAt).toEqual(before.emailVerifiedAt);
    expect(after.mustChangePassword).toBe(false);
  });

  it.each([{ password: "short" }, { currentPassword: "password123", password: "validpass123", status: "ACTIVE" },
    { currentPassword: "password123", password: "x".repeat(65) }])("strictly rejects malformed change-password body %j", async (body) => {
    const agent = createTestAgent();
    const { user } = await createVerifiedUser();
    const token = await loginAndGetAccessToken(agent, { email: user.email });
    expect((await agent.post("/api/auth/change-password").auth(token, { type: "bearer" }).send(body)).status).toBe(400);
  });

  it("Company Manager forgot/reset supports onboarding without activation", async () => {
    const agent = createTestAgent();
    const manager = await createCompanyStaffWithMembership();
    expect((await agent.post("/api/auth/forgot-password").send({ email: manager.user.email })).status).toBe(200);
    const raw = mailToken();
    expect((await agent.post("/api/auth/reset-password").send({ token: raw, password: "newPassword123" })).status).toBe(200);
    const user = await User.findById(manager.user._id);
    expect(user.status).toBe("PENDING_ACTIVATION");
    expect(user.emailVerifiedAt).toBeNull();
    expect((await agent.post("/api/auth/reset-password").send({ token: raw, password: "replayed123" })).status).toBe(400);
  });

  it("resends verification, invalidates old token, enforces expiry and single use", async () => {
    const agent = createTestAgent();
    const { user, rawToken } = await createUnverifiedUserWithVerificationToken();
    expect((await agent.post("/api/auth/resend-verification").send({ email: user.email })).status).toBe(200);
    const first = mailToken();
    expect((await agent.post("/api/auth/verify-email").send({ token: rawToken })).status).toBe(400);
    await AuthToken.updateOne({ tokenHash: hashAuthToken(first) }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await agent.post("/api/auth/verify-email").send({ token: first })).status).toBe(400);
    await agent.post("/api/auth/resend-verification").send({ email: user.email });
    const second = mailToken();
    expect((await agent.post("/api/auth/verify-email").send({ token: second })).status).toBe(200);
    expect((await agent.post("/api/auth/verify-email").send({ token: second })).status).toBe(400);
    expect((await User.findById(user._id)).status).toBe("ACTIVE");
  });

  it("does not reveal ineligible emails or bypass Company Manager activation; mail failure retains account", async () => {
    const agent = createTestAgent();
    const { user } = await createUnverifiedUserWithVerificationToken();
    sendMail.mockRejectedValueOnce(new Error("SMTP failure"));
    expect((await agent.post("/api/auth/resend-verification").send({ email: user.email })).status).toBe(503);
    expect(await AuthToken.countDocuments({ userId: user._id })).toBe(0);
    expect(await User.exists({ _id: user._id })).toBeTruthy();
    const manager = await createCompanyStaffWithMembership();
    const missing = await agent.post("/api/auth/resend-verification").send({ email: "missing@example.com" });
    const cm = await agent.post("/api/auth/resend-verification").send({ email: manager.user.email });
    expect(cm.body).toEqual(missing.body);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent reset and verification resends to one token per type", async () => {
    const agent = createTestAgent();
    const { user } = await createUnverifiedUserWithVerificationToken();
    const replies = await Promise.all(Array.from({ length: 3 }, () => agent.post("/api/auth/resend-verification").send({ email: user.email })));
    expect(replies.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await AuthToken.countDocuments({ userId: user._id, type: "EMAIL_VERIFICATION" })).toBe(1);
    const resets = await Promise.all(Array.from({ length: 3 }, () => agent.post("/api/auth/forgot-password").send({ email: user.email })));
    expect(resets.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(await AuthToken.countDocuments({ userId: user._id, type: "PASSWORD_RESET" })).toBe(1);
  });

  it("admin accounts uses membership roles, combined filters and stable pagination without secrets", async () => {
    const agent = createTestAgent();
    const { user: admin } = await createVerifiedUser({ email: "admin@example.com", role: "PLATFORM_ADMIN" });
    const manager = await createActiveCompanyManagerContext();
    await createActiveRecruiterContext({ company: manager.company });
    const token = await loginAndGetAccessToken(agent, { email: admin.email });
    const result = await agent.get("/api/platform-admin/accounts").auth(token, { type: "bearer" })
      .query({ actorType: "COMPANY_MANAGER", companyId: manager.company.id, userStatus: "ACTIVE", q: "Manager", sort: "fullName", page: 1, limit: 1 });
    expect(result.status).toBe(200);
    expect(result.body.accounts.map((u) => u.id)).toEqual([manager.user.id]);
    expect(result.body.pagination).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });
    const detail = await agent.get(`/api/platform-admin/accounts/${manager.user.id}`).auth(token, { type: "bearer" });
    expect(detail.body.account.actorType).toBe("COMPANY_MANAGER");
    noSecrets(result.body); noSecrets(detail.body);
    expect((await agent.get("/api/platform-admin/accounts/invalid").auth(token, { type: "bearer" })).status).toBe(400);
    expect((await agent.get("/api/platform-admin/accounts/000000000000000000000000").auth(token, { type: "bearer" })).status).toBe(404);
    const managerToken = await loginAndGetAccessToken(agent, { email: manager.user.email });
    expect((await agent.get("/api/platform-admin/accounts").auth(managerToken, { type: "bearer" })).status).toBe(403);
    for (const query of ["page=0", "page=1.5", "limit=101", "page=1&page=2", "limit=", "page=1e2", "sort=passwordHash", "userStatus=UNKNOWN", "companyId=x", "actorType=COMPANY_STAFF"]) {
      expect((await agent.get(`/api/platform-admin/accounts?${query}`).auth(token, { type: "bearer" })).status, query).toBe(400);
    }
  });
});
