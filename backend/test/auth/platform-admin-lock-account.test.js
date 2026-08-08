import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthSession from "../../src/models/auth-session.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import {
  createSessionWithRefreshToken,
  createVerifiedUser,
  DEFAULT_PASSWORD,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const createApprovedActiveCompanyForManager = async ({
  managerUserId,
  reviewedByUserId,
  businessRegistrationNumber = "BRN-LOCK-BYPASS-1",
  name = "Lock Bypass Co",
}) => {
  const submittedAt = new Date("2026-01-01T00:00:00.000Z");
  const reviewedAt = new Date("2026-01-02T00:00:00.000Z");
  const activatedAt = new Date("2026-01-03T00:00:00.000Z");

  const company = await Company.create({
    name,
    businessRegistrationNumber,
    description: "Active company for account-lock bypass regression",
    approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
    submittedAt,
    reviewedByUserId,
    reviewedAt,
    activatedAt,
    reviewSnapshot: {
      name,
      businessRegistrationNumber,
      description: "Active company for account-lock bypass regression",
    },
  });

  await CompanyMember.create({
    userId: managerUserId,
    companyId: company._id,
    role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    status: COMPANY_MEMBER_STATUS.ACTIVE,
  });

  return company;
};

describe("POST /api/platform-admin/accounts/:userId/lock", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("locks an ACTIVE target account, preserves verification data, and revokes all target sessions", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    const { user: targetUser } = await createVerifiedUser({
      email: "target@example.com",
    });

    const targetLoginResponse = await agent.post("/api/auth/login").send({
      email: "target@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(targetLoginResponse.status).toBe(200);

    const targetAccessToken = targetLoginResponse.body.accessToken;
    const { rawRefreshToken } = await createSessionWithRefreshToken(targetUser);
    await createSessionWithRefreshToken(targetUser);

    const emailVerifiedAtBefore = targetUser.emailVerifiedAt;

    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin@example.com",
    });

    const response = await agent
      .post(`/api/platform-admin/accounts/${targetUser._id.toString()}/lock`)
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/locked successfully/i);
    expect(response.body.user).toMatchObject({
      id: targetUser._id.toString(),
      email: "target@example.com",
      fullName: targetUser.fullName,
      role: USER_ROLE.CANDIDATE,
      status: USER_STATUS.LOCKED,
    });

    const persistedUser = await User.findById(targetUser._id);
    const targetSessions = await AuthSession.find({ userId: targetUser._id });

    expect(persistedUser.emailVerifiedAt?.toISOString()).toBe(
      emailVerifiedAtBefore.toISOString(),
    );
    expect(targetSessions).toHaveLength(0);

    const targetProtectedResponse = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${targetAccessToken}`);

    expect(targetProtectedResponse.status).toBe(401);

    const adminProtectedResponse = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(adminProtectedResponse.status).toBe(200);

    const refreshResponse = await agent.post("/api/auth/refresh").send({
      refreshToken: rawRefreshToken,
    });

    expect(refreshResponse.status).toBe(401);

    const loginResponse = await agent.post("/api/auth/login").send({
      email: "target@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(loginResponse.status).toBe(403);
  });

  it("requires Platform Admin authorization", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "candidate@example.com",
    });
    const { user: targetUser } = await createVerifiedUser({
      email: "target@example.com",
    });

    const candidateAccessToken = await loginAndGetAccessToken(agent, {
      email: "candidate@example.com",
    });

    const response = await agent
      .post(`/api/platform-admin/accounts/${targetUser._id.toString()}/lock`)
      .set("Authorization", `Bearer ${candidateAccessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe("Platform Admin access required");

    const unauthenticated = await agent.post(
      `/api/platform-admin/accounts/${targetUser._id.toString()}/lock`,
    );

    expect(unauthenticated.status).toBe(401);
  });

  it("rejects self-targeting and Platform-Admin-to-Platform-Admin lock attempts", async () => {
    const agent = createTestAgent();

    const { user: actingAdmin } = await createVerifiedUser({
      email: "acting-admin@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    const { user: otherAdmin } = await createVerifiedUser({
      email: "other-admin@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "acting-admin@example.com",
    });

    const selfResponse = await agent
      .post(`/api/platform-admin/accounts/${actingAdmin._id.toString()}/lock`)
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(selfResponse.status).toBe(403);

    const otherAdminResponse = await agent
      .post(`/api/platform-admin/accounts/${otherAdmin._id.toString()}/lock`)
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(otherAdminResponse.status).toBe(403);

    const persistedActingAdmin = await User.findById(actingAdmin._id);
    const persistedOtherAdmin = await User.findById(otherAdmin._id);

    expect(persistedActingAdmin.status).toBe(USER_STATUS.ACTIVE);
    expect(persistedOtherAdmin.status).toBe(USER_STATUS.ACTIVE);
  });

  it("rejects non-ACTIVE targets and unknown accounts without changing other users", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    const { user: lockedUser } = await createVerifiedUser({
      email: "locked@example.com",
      status: USER_STATUS.LOCKED,
    });
    const { user: terminatedUser } = await createVerifiedUser({
      email: "terminated@example.com",
      status: USER_STATUS.TERMINATED,
    });
    const { user: activeUser } = await createVerifiedUser({
      email: "active@example.com",
    });
    const { session: activeSession } = await createSessionWithRefreshToken(activeUser);

    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin@example.com",
    });

    const lockedResponse = await agent
      .post(`/api/platform-admin/accounts/${lockedUser._id.toString()}/lock`)
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(lockedResponse.status).toBe(409);

    const terminatedResponse = await agent
      .post(`/api/platform-admin/accounts/${terminatedUser._id.toString()}/lock`)
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(terminatedResponse.status).toBe(409);

    const missingResponse = await agent
      .post("/api/platform-admin/accounts/507f1f77bcf86cd799439011/lock")
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(missingResponse.status).toBe(404);

    expect(await User.findById(lockedUser._id)).toMatchObject({
      status: USER_STATUS.LOCKED,
    });
    expect(await User.findById(terminatedUser._id)).toMatchObject({
      status: USER_STATUS.TERMINATED,
    });
    expect(await AuthSession.findById(activeSession._id)).not.toBeNull();
  });

  it("revokes only the target user's sessions", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    const { user: targetUser } = await createVerifiedUser({
      email: "target@example.com",
    });
    const { user: otherUser } = await createVerifiedUser({
      email: "other@example.com",
    });

    await createSessionWithRefreshToken(targetUser);
    await createSessionWithRefreshToken(targetUser);
    const { session: otherSession } = await createSessionWithRefreshToken(otherUser);

    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin@example.com",
    });

    await agent
      .post(`/api/platform-admin/accounts/${targetUser._id.toString()}/lock`)
      .set("Authorization", `Bearer ${adminAccessToken}`);

    const targetSessions = await AuthSession.find({ userId: targetUser._id });
    const remainingOtherSession = await AuthSession.findById(otherSession._id);

    expect(targetSessions).toHaveLength(0);
    expect(remainingOtherSession).not.toBeNull();
  });

  it("rejects account-level lock of Company Manager owning APPROVED + ACTIVE Company", async () => {
    const agent = createTestAgent();

    const { user: admin } = await createVerifiedUser({
      email: "admin.lock-bypass@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    const { user: manager } = await createVerifiedUser({
      email: "manager.lock-bypass@example.com",
      role: USER_ROLE.COMPANY_STAFF,
      status: USER_STATUS.ACTIVE,
    });

    const company = await createApprovedActiveCompanyForManager({
      managerUserId: manager._id,
      reviewedByUserId: admin._id,
    });
    const { session: managerSession } =
      await createSessionWithRefreshToken(manager);

    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin.lock-bypass@example.com",
    });

    const response = await agent
      .post(`/api/platform-admin/accounts/${manager._id.toString()}/lock`)
      .set("Authorization", `Bearer ${adminAccessToken}`);

    expect(response.status).toBe(409);

    const persistedManager = await User.findById(manager._id);
    const persistedCompany = await Company.findById(company._id);
    const remainingSession = await AuthSession.findById(managerSession._id);

    expect(persistedManager.status).toBe(USER_STATUS.ACTIVE);
    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.APPROVED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.ACTIVE,
    );
    expect(remainingSession).not.toBeNull();
  });
});
