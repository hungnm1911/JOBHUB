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
import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthToken from "../../src/models/auth-token.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import { confirmCompanyApproval } from "../../src/services/auth.service.js";
import sendMail from "../../src/services/mail.service.js";
import { generateAuthToken, hashAuthToken } from "../../src/utils/hash-auth-token.js";
import {
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

const registerSubmitAndApproveCompany = async (
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
      description: "Ready for activation",
      website: "https://example.com",
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

  return {
    companyId: submitResponse.body.company.id,
    managerId: registration.body.user.id,
    rawToken,
    onboardingAccessToken,
  };
};

describe("POST /api/auth/confirm-company-approval", () => {
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

  it("activates CM and Company atomically under TX-03, consumes confirmation token once, and does not issue login credentials", async () => {
    const agent = createTestAgent();

    const { companyId, managerId, rawToken } =
      await registerSubmitAndApproveCompany(agent, {
        managerEmail: "manager.activate@example.com",
        adminEmail: "admin.activate@example.com",
        companyName: "Activate Co",
        businessRegistrationNumber: "BRN-ACTIVATE-1",
      });

    const beforeConfirm = Date.now();

    const response = await agent
      .post("/api/auth/confirm-company-approval")
      .send({ token: rawToken });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/active/i);
    expect(response.body.accessToken).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.body.user).toMatchObject({
      id: managerId,
      role: USER_ROLE.COMPANY_STAFF,
      status: USER_STATUS.ACTIVE,
    });
    expect(response.body.user.emailVerifiedAt).toEqual(expect.any(String));
    expect(response.body.company).toMatchObject({
      id: companyId,
      managerUserId: managerId,
      approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
    });
    expect(response.body.company.activatedAt).toEqual(expect.any(String));
    expect(
      new Date(response.body.company.activatedAt).getTime(),
    ).toBeGreaterThanOrEqual(beforeConfirm);

    const persistedUser = await User.findById(managerId);
    const persistedCompany = await Company.findById(companyId);
    const confirmationToken = await AuthToken.findOne({
      userId: managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    });

    expect(persistedUser.status).toBe(USER_STATUS.ACTIVE);
    expect(persistedUser.emailVerifiedAt).not.toBeNull();
    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.APPROVED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.ACTIVE,
    );
    expect(persistedCompany.activatedAt).not.toBeNull();
    expect(confirmationToken).toBeNull();

    const reuseResponse = await agent
      .post("/api/auth/confirm-company-approval")
      .send({ token: rawToken });

    expect(reuseResponse.status).toBe(400);

    const loginResponse = await agent.post("/api/auth/login").send({
      email: "manager.activate@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.status).toBe(USER_STATUS.ACTIVE);
  });

  it("rejects invalid, expired, and missing confirmation tokens", async () => {
    const agent = createTestAgent();

    const invalidResponse = await agent
      .post("/api/auth/confirm-company-approval")
      .send({ token: "not-a-valid-token" });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error.message).toBe(
      "Invalid or expired company approval confirmation token",
    );

    const { managerId } = await registerSubmitAndApproveCompany(agent, {
      managerEmail: "manager.expired@example.com",
      adminEmail: "admin.expired@example.com",
      companyName: "Expired Co",
      businessRegistrationNumber: "BRN-ACTIVATE-EXPIRED",
    });

    const expiredRawToken = generateAuthToken();

    await AuthToken.deleteMany({
      userId: managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    });

    await AuthToken.create({
      userId: managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      tokenHash: hashAuthToken(expiredRawToken),
      expiresAt: new Date(Date.now() - 1_000),
    });

    const expiredResponse = await agent
      .post("/api/auth/confirm-company-approval")
      .send({ token: expiredRawToken });

    expect(expiredResponse.status).toBe(400);

    const missingTokenResponse = await agent
      .post("/api/auth/confirm-company-approval")
      .send({});

    expect(missingTokenResponse.status).toBe(400);

    const persistedUser = await User.findById(managerId);
    const membership = await CompanyMember.findOne({
      userId: managerId,
      role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    });
    const persistedCompany = membership
      ? await Company.findById(membership.companyId)
      : null;

    expect(persistedUser.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
  });

  it("rejects invalid source states without activating either side", async () => {
    const agent = createTestAgent();

    const pendingOnly = await registerSubmitAndApproveCompany(agent, {
      managerEmail: "manager.pending-source@example.com",
      adminEmail: "admin.pending-source@example.com",
      companyName: "Pending Source Co",
      businessRegistrationNumber: "BRN-ACTIVATE-PENDING",
    });

    await Company.updateOne(
      { _id: pendingOnly.companyId },
      {
        approvalStatus: COMPANY_APPROVAL_STATUS.PENDING,
        reviewedByUserId: null,
        reviewedAt: null,
      },
    );

    const pendingResponse = await agent
      .post("/api/auth/confirm-company-approval")
      .send({ token: pendingOnly.rawToken });

    expect(pendingResponse.status).toBe(409);

    let persistedUser = await User.findById(pendingOnly.managerId);
    let persistedCompany = await Company.findById(pendingOnly.companyId);
    let tokenCount = await AuthToken.countDocuments({
      userId: pendingOnly.managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    });

    expect(persistedUser.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.PENDING,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persistedCompany.activatedAt).toBeNull();
    expect(tokenCount).toBe(1);

    const activeUserCase = await registerSubmitAndApproveCompany(agent, {
      managerEmail: "manager.active-source@example.com",
      adminEmail: "admin.active-source@example.com",
      companyName: "Active Source Co",
      businessRegistrationNumber: "BRN-ACTIVATE-USER",
    });

    await User.updateOne(
      { _id: activeUserCase.managerId },
      { status: USER_STATUS.ACTIVE, emailVerifiedAt: new Date() },
    );

    const activeUserResponse = await agent
      .post("/api/auth/confirm-company-approval")
      .send({ token: activeUserCase.rawToken });

    expect(activeUserResponse.status).toBe(409);

    persistedUser = await User.findById(activeUserCase.managerId);
    persistedCompany = await Company.findById(activeUserCase.companyId);
    tokenCount = await AuthToken.countDocuments({
      userId: activeUserCase.managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    });

    expect(persistedUser.status).toBe(USER_STATUS.ACTIVE);
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persistedCompany.activatedAt).toBeNull();
    expect(tokenCount).toBe(1);
  });

  it("rolls back TX-03 when Company activation persistence fails and prevents partial activation", async () => {
    const agent = createTestAgent();

    const { companyId, managerId, rawToken } =
      await registerSubmitAndApproveCompany(agent, {
        managerEmail: "manager.rollback@example.com",
        adminEmail: "admin.rollback@example.com",
        companyName: "Rollback Activate Co",
        businessRegistrationNumber: "BRN-ACTIVATE-ROLLBACK",
      });

    const saveSpy = vi
      .spyOn(Company.prototype, "save")
      .mockRejectedValueOnce(new Error("forced company activation failure"));

    await expect(
      confirmCompanyApproval({ token: rawToken }),
    ).rejects.toThrow("forced company activation failure");

    saveSpy.mockRestore();

    const persistedUser = await User.findById(managerId);
    const persistedCompany = await Company.findById(companyId);
    const confirmationToken = await AuthToken.findOne({
      userId: managerId,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    }).select("+tokenHash");

    expect(persistedUser.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(persistedUser.emailVerifiedAt).toBeNull();
    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.APPROVED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persistedCompany.activatedAt).toBeNull();
    expect(confirmationToken).not.toBeNull();
    expect(confirmationToken.tokenHash).toBe(hashAuthToken(rawToken));
  });
});
