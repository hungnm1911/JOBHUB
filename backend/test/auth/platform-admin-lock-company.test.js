import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthSession from "../../src/models/auth-session.model.js";
import Company from "../../src/models/company.model.js";
import User from "../../src/models/user.model.js";
import sendMail from "../../src/services/mail.service.js";
import { lockCompany } from "../../src/services/platform-admin.service.js";
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

vi.mock("../../src/services/mail.service.js", () => ({
  default: vi.fn().mockResolvedValue({ messageId: "test-message-id" }),
}));

const extractConfirmationTokenFromMailCall = (mailCall) => {
  const match = mailCall.html.match(/confirm-company-approval\?token=([^"]+)/);

  return decodeURIComponent(match[1]);
};

const registerActivateOwnedCompany = async (
  agent,
  {
    managerEmail,
    adminEmail,
    companyName,
    businessRegistrationNumber,
    fullName = "Chris Manager",
  },
) => {
  await createVerifiedUser({
    email: adminEmail,
    role: USER_ROLE.PLATFORM_ADMIN,
  });

  const registration = await agent
    .post("/api/auth/register/company-manager")
    .send({
      fullName,
      email: managerEmail,
      password: DEFAULT_PASSWORD,
    });

  expect(registration.status).toBe(201);

  const onboardingAccessToken = await loginAndGetAccessToken(agent, {
    email: managerEmail,
  });

  const draftResponse = await agent
    .patch("/api/company")
    .set("Authorization", `Bearer ${onboardingAccessToken}`)
    .send({
      name: companyName,
      businessRegistrationNumber,
      description: "Company ready for lock",
      website: "https://lock-target.example",
      logoUrl: "https://cdn.example/logo.png",
      bannerUrl: "https://cdn.example/banner.png",
      address: "10 Lock Street",
      contactInfo: "lock@example.com",
    });

  expect(draftResponse.status).toBe(200);

  const submitResponse = await agent
    .post("/api/company/submit")
    .set("Authorization", `Bearer ${onboardingAccessToken}`)
    .send();

  expect(submitResponse.status).toBe(200);

  const adminAccessToken = await loginAndGetAccessToken(agent, {
    email: adminEmail,
  });

  const approveResponse = await agent
    .post(
      `/api/platform-admin/company-registrations/${submitResponse.body.company.id}/approve`,
    )
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send();

  expect(approveResponse.status).toBe(200);
  expect(sendMail).toHaveBeenCalled();

  const rawToken = extractConfirmationTokenFromMailCall(
    sendMail.mock.calls.at(-1)[0],
  );

  const confirmResponse = await agent
    .post("/api/auth/confirm-company-approval")
    .send({ token: rawToken });

  expect(confirmResponse.status).toBe(200);

  const managerAccessToken = await loginAndGetAccessToken(agent, {
    email: managerEmail,
  });

  return {
    adminAccessToken,
    managerAccessToken,
    companyId: confirmResponse.body.company.id,
    managerId: registration.body.user.id,
    company: confirmResponse.body.company,
  };
};

describe("POST /api/platform-admin/companies/:companyId/lock (F10)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("locks an APPROVED + ACTIVE Company, terminates the ACTIVE Manager, and revokes all Manager sessions", async () => {
    const agent = createTestAgent();

    const activated = await registerActivateOwnedCompany(agent, {
      managerEmail: "manager.lock-happy@example.com",
      adminEmail: "admin.lock-happy@example.com",
      companyName: "Lock Happy Co",
      businessRegistrationNumber: "BRN-LOCK-HAPPY",
    });

    const manager = await User.findById(activated.managerId);
    const { rawRefreshToken } = await createSessionWithRefreshToken(manager);
    await createSessionWithRefreshToken(manager);

    const before = await Company.findById(activated.companyId);
    const retentionBefore = {
      name: before.name,
      logoUrl: before.logoUrl,
      bannerUrl: before.bannerUrl,
      website: before.website,
      address: before.address,
      description: before.description,
      contactInfo: before.contactInfo,
      businessRegistrationNumber: before.businessRegistrationNumber,
      managerUserId: before.managerUserId.toString(),
      reviewSnapshot: before.reviewSnapshot.toObject(),
      submittedAt: before.submittedAt?.toISOString(),
      reviewedByUserId: before.reviewedByUserId?.toString(),
      reviewedAt: before.reviewedAt?.toISOString(),
      activatedAt: before.activatedAt?.toISOString(),
      emailVerifiedAt: manager.emailVerifiedAt?.toISOString(),
      fullName: manager.fullName,
      email: manager.email,
    };

    const response = await agent
      .post(`/api/platform-admin/companies/${activated.companyId}/lock`)
      .set("Authorization", `Bearer ${activated.adminAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/Company locked successfully/i);
    expect(response.body.company).toMatchObject({
      id: activated.companyId,
      approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
      managerUserId: activated.managerId,
      name: "Lock Happy Co",
      businessRegistrationNumber: "BRN-LOCK-HAPPY",
    });
    expect(response.body.manager).toMatchObject({
      id: activated.managerId,
      role: USER_ROLE.COMPANY_MANAGER,
      status: USER_STATUS.TERMINATED,
      email: "manager.lock-happy@example.com",
    });

    const persistedCompany = await Company.findById(activated.companyId);
    const persistedManager = await User.findById(activated.managerId);
    const managerSessions = await AuthSession.find({
      userId: activated.managerId,
    });

    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.APPROVED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.LOCKED,
    );
    expect(persistedCompany.name).toBe(retentionBefore.name);
    expect(persistedCompany.logoUrl).toBe(retentionBefore.logoUrl);
    expect(persistedCompany.bannerUrl).toBe(retentionBefore.bannerUrl);
    expect(persistedCompany.website).toBe(retentionBefore.website);
    expect(persistedCompany.address).toBe(retentionBefore.address);
    expect(persistedCompany.description).toBe(retentionBefore.description);
    expect(persistedCompany.contactInfo).toBe(retentionBefore.contactInfo);
    expect(persistedCompany.businessRegistrationNumber).toBe(
      retentionBefore.businessRegistrationNumber,
    );
    expect(persistedCompany.managerUserId.toString()).toBe(
      retentionBefore.managerUserId,
    );
    expect(persistedCompany.reviewSnapshot.toObject()).toEqual(
      retentionBefore.reviewSnapshot,
    );
    expect(persistedCompany.submittedAt?.toISOString()).toBe(
      retentionBefore.submittedAt,
    );
    expect(persistedCompany.reviewedByUserId?.toString()).toBe(
      retentionBefore.reviewedByUserId,
    );
    expect(persistedCompany.reviewedAt?.toISOString()).toBe(
      retentionBefore.reviewedAt,
    );
    expect(persistedCompany.activatedAt?.toISOString()).toBe(
      retentionBefore.activatedAt,
    );

    expect(persistedManager.status).toBe(USER_STATUS.TERMINATED);
    expect(persistedManager.fullName).toBe(retentionBefore.fullName);
    expect(persistedManager.email).toBe(retentionBefore.email);
    expect(persistedManager.emailVerifiedAt?.toISOString()).toBe(
      retentionBefore.emailVerifiedAt,
    );
    expect(managerSessions).toHaveLength(0);

    const protectedResponse = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${activated.managerAccessToken}`);

    expect(protectedResponse.status).toBe(401);

    const refreshResponse = await agent.post("/api/auth/refresh").send({
      refreshToken: rawRefreshToken,
    });

    expect(refreshResponse.status).toBe(401);

    const loginResponse = await agent.post("/api/auth/login").send({
      email: "manager.lock-happy@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(loginResponse.status).toBe(403);
  });

  it("requires ACTIVE Platform Admin authorization", async () => {
    const agent = createTestAgent();

    const activated = await registerActivateOwnedCompany(agent, {
      managerEmail: "manager.lock-authz@example.com",
      adminEmail: "admin.lock-authz@example.com",
      companyName: "Lock Authz Co",
      businessRegistrationNumber: "BRN-LOCK-AUTHZ",
    });

    const unauthenticated = await agent.post(
      `/api/platform-admin/companies/${activated.companyId}/lock`,
    );

    expect(unauthenticated.status).toBe(401);

    const candidate = await createVerifiedUser({
      email: "candidate.lock-authz@example.com",
    });
    const candidateAccessToken = await loginAndGetAccessToken(agent, {
      email: candidate.user.email,
      password: candidate.password,
    });

    const forbidden = await agent
      .post(`/api/platform-admin/companies/${activated.companyId}/lock`)
      .set("Authorization", `Bearer ${candidateAccessToken}`);

    expect(forbidden.status).toBe(403);

    const managerForbidden = await agent
      .post(`/api/platform-admin/companies/${activated.companyId}/lock`)
      .set("Authorization", `Bearer ${activated.managerAccessToken}`);

    expect(managerForbidden.status).toBe(403);

    const company = await Company.findById(activated.companyId);
    const manager = await User.findById(activated.managerId);

    expect(company.operationalStatus).toBe(COMPANY_OPERATIONAL_STATUS.ACTIVE);
    expect(manager.status).toBe(USER_STATUS.ACTIVE);
  });

  it("rejects lock when Company is not APPROVED + ACTIVE", async () => {
    const agent = createTestAgent();

    const activated = await registerActivateOwnedCompany(agent, {
      managerEmail: "manager.lock-invalid-company@example.com",
      adminEmail: "admin.lock-invalid-company@example.com",
      companyName: "Invalid Company State Co",
      businessRegistrationNumber: "BRN-LOCK-INVALID-CO",
    });

    const company = await Company.findById(activated.companyId);
    company.operationalStatus = COMPANY_OPERATIONAL_STATUS.INACTIVE;
    company.activatedAt = null;
    await company.save();

    const response = await agent
      .post(`/api/platform-admin/companies/${activated.companyId}/lock`)
      .set("Authorization", `Bearer ${activated.adminAccessToken}`);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(
      /APPROVED and ACTIVE Companies can be locked/i,
    );

    const persistedCompany = await Company.findById(activated.companyId);
    const persistedManager = await User.findById(activated.managerId);

    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persistedManager.status).toBe(USER_STATUS.ACTIVE);
  });

  it("rejects lock when Manager role is not COMPANY_MANAGER and leaves Company/User/session unchanged", async () => {
    const agent = createTestAgent();

    const activated = await registerActivateOwnedCompany(agent, {
      managerEmail: "manager.lock-wrong-role@example.com",
      adminEmail: "admin.lock-wrong-role@example.com",
      companyName: "Wrong Role Lock Co",
      businessRegistrationNumber: "BRN-LOCK-WRONG-ROLE",
    });

    const managerBefore = await User.findById(activated.managerId);
    await AuthSession.deleteMany({ userId: activated.managerId });
    await createSessionWithRefreshToken(managerBefore);
    await createSessionWithRefreshToken(managerBefore);

    await User.collection.updateOne(
      { _id: managerBefore._id },
      { $set: { role: USER_ROLE.CANDIDATE } },
    );

    const response = await agent
      .post(`/api/platform-admin/companies/${activated.companyId}/lock`)
      .set("Authorization", `Bearer ${activated.adminAccessToken}`);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/COMPANY_MANAGER/i);

    const persistedCompany = await Company.findById(activated.companyId);
    const persistedManager = await User.findById(activated.managerId);
    const managerSessions = await AuthSession.find({
      userId: activated.managerId,
    });

    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.APPROVED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.ACTIVE,
    );
    expect(persistedManager.role).toBe(USER_ROLE.CANDIDATE);
    expect(persistedManager.status).toBe(USER_STATUS.ACTIVE);
    expect(managerSessions).toHaveLength(2);
  });

  it("rejects lock when Company Manager is not ACTIVE", async () => {
    const agent = createTestAgent();

    const activated = await registerActivateOwnedCompany(agent, {
      managerEmail: "manager.lock-invalid-cm@example.com",
      adminEmail: "admin.lock-invalid-cm@example.com",
      companyName: "Invalid Manager State Co",
      businessRegistrationNumber: "BRN-LOCK-INVALID-CM",
    });

    await User.updateOne(
      { _id: activated.managerId },
      { status: USER_STATUS.LOCKED },
    );

    const response = await agent
      .post(`/api/platform-admin/companies/${activated.companyId}/lock`)
      .set("Authorization", `Bearer ${activated.adminAccessToken}`);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(
      /Company Manager must be ACTIVE/i,
    );

    const persistedCompany = await Company.findById(activated.companyId);
    const persistedManager = await User.findById(activated.managerId);

    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.ACTIVE,
    );
    expect(persistedManager.status).toBe(USER_STATUS.LOCKED);
  });

  it("keeps Company LOCKED with no unlock/reactivation path and rejects a second lock", async () => {
    const agent = createTestAgent();

    const activated = await registerActivateOwnedCompany(agent, {
      managerEmail: "manager.lock-nounlock@example.com",
      adminEmail: "admin.lock-nounlock@example.com",
      companyName: "No Unlock Co",
      businessRegistrationNumber: "BRN-LOCK-NOUNLOCK",
    });

    const firstLock = await agent
      .post(`/api/platform-admin/companies/${activated.companyId}/lock`)
      .set("Authorization", `Bearer ${activated.adminAccessToken}`);

    expect(firstLock.status).toBe(200);

    const secondLock = await agent
      .post(`/api/platform-admin/companies/${activated.companyId}/lock`)
      .set("Authorization", `Bearer ${activated.adminAccessToken}`);

    expect(secondLock.status).toBe(409);

    const unlockAttempt = await agent
      .post(`/api/platform-admin/companies/${activated.companyId}/unlock`)
      .set("Authorization", `Bearer ${activated.adminAccessToken}`);

    expect(unlockAttempt.status).toBe(404);

    const persistedCompany = await Company.findById(activated.companyId);
    const persistedManager = await User.findById(activated.managerId);

    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.APPROVED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.LOCKED,
    );
    expect(persistedCompany.activatedAt).not.toBeNull();
    expect(persistedManager.status).toBe(USER_STATUS.TERMINATED);
  });

  it("rolls back TX-04 when Manager termination persistence fails and prevents partial lock state", async () => {
    const agent = createTestAgent();

    const activated = await registerActivateOwnedCompany(agent, {
      managerEmail: "manager.lock-rollback@example.com",
      adminEmail: "admin.lock-rollback@example.com",
      companyName: "Lock Rollback Co",
      businessRegistrationNumber: "BRN-LOCK-ROLLBACK",
    });

    const manager = await User.findById(activated.managerId);
    await AuthSession.deleteMany({ userId: activated.managerId });
    await createSessionWithRefreshToken(manager);
    await createSessionWithRefreshToken(manager);

    const saveSpy = vi
      .spyOn(User.prototype, "save")
      .mockRejectedValueOnce(new Error("forced manager terminate failure"));

    await expect(
      lockCompany({ companyId: activated.companyId }),
    ).rejects.toThrow("forced manager terminate failure");

    saveSpy.mockRestore();

    const persistedCompany = await Company.findById(activated.companyId);
    const persistedManager = await User.findById(activated.managerId);
    const managerSessions = await AuthSession.find({
      userId: activated.managerId,
    });

    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.APPROVED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.ACTIVE,
    );
    expect(persistedManager.status).toBe(USER_STATUS.ACTIVE);
    expect(managerSessions).toHaveLength(2);
  });
});
