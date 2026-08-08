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
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import config from "../../src/config/index.js";
import AuthToken from "../../src/models/auth-token.model.js";
import Company from "../../src/models/company.model.js";
import User from "../../src/models/user.model.js";
import {
  approveCompanyRegistration,
} from "../../src/services/platform-admin.service.js";
import sendMail from "../../src/services/mail.service.js";
import { hashAuthToken } from "../../src/utils/hash-auth-token.js";
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

const registerAndSubmitCompany = async (
  agent,
  {
    email,
    fullName = "Chris Manager",
    companyName,
    businessRegistrationNumber,
    description = "Submitted for review",
  },
) => {
  const registration = await agent
    .post("/api/auth/register/company-manager")
    .send({
      fullName,
      email,
      password: DEFAULT_PASSWORD,
    });

  expect(registration.status).toBe(201);

  const loginResponse = await agent.post("/api/auth/login").send({
    email,
    password: DEFAULT_PASSWORD,
  });

  expect(loginResponse.status).toBe(200);

  const accessToken = loginResponse.body.accessToken;

  const draftResponse = await agent
    .patch("/api/company")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      name: companyName,
      businessRegistrationNumber,
      description,
      website: "https://example.com",
    });

  expect(draftResponse.status).toBe(200);

  const submitResponse = await agent
    .post("/api/company/submit")
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(submitResponse.status).toBe(200);

  return {
    company: submitResponse.body.company,
    manager: registration.body.user,
    onboardingAccessToken: accessToken,
  };
};

describe("POST /api/platform-admin/company-registrations/:companyId/approve", () => {
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

  it("approves a PENDING Company under TX-02, persists reviewer metadata, issues confirmation token for CM, keeps Company and CM inactive, and sends confirmation email", async () => {
    const agent = createTestAgent();

    const { user: admin } = await createVerifiedUser({
      email: "admin.approve@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    const submitted = await registerAndSubmitCompany(agent, {
      email: "manager.approve@example.com",
      fullName: "Approve Manager",
      companyName: "Approve Co",
      businessRegistrationNumber: "BRN-APPROVE-1",
      description: "Immutable approve snapshot",
    });

    const snapshotBeforeApprove = submitted.company.reviewSnapshot;
    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin.approve@example.com",
    });

    const beforeApprove = Date.now();

    const response = await agent
      .post(
        `/api/platform-admin/company-registrations/${submitted.company.id}/approve`,
      )
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/approved/i);
    expect(response.body.companyRegistration).toMatchObject({
      id: submitted.company.id,
      approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
      reviewedByUserId: admin._id.toString(),
      activatedAt: null,
      manager: {
        id: submitted.manager.id,
        status: USER_STATUS.PENDING_ACTIVATION,
        role: USER_ROLE.COMPANY_STAFF,
      },
      reviewSnapshot: snapshotBeforeApprove,
    });
    expect(
      new Date(response.body.companyRegistration.reviewedAt).getTime(),
    ).toBeGreaterThanOrEqual(beforeApprove);

    const persistedCompany = await Company.findById(submitted.company.id);
    const persistedManager = await User.findById(submitted.manager.id);
    const confirmationToken = await AuthToken.findOne({
      userId: submitted.manager.id,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    }).select("+tokenHash");

    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.APPROVED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persistedCompany.reviewedByUserId.toString()).toBe(
      admin._id.toString(),
    );
    expect(persistedCompany.reviewedAt).not.toBeNull();
    expect(persistedCompany.activatedAt).toBeNull();
    expect(persistedCompany.reviewSnapshot.toObject()).toMatchObject(
      snapshotBeforeApprove,
    );
    expect(persistedManager.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(persistedManager.emailVerifiedAt).toBeNull();

    expect(confirmationToken).not.toBeNull();
    expect(confirmationToken.userId.toString()).toBe(submitted.manager.id);
    expect(confirmationToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(
      confirmationToken.expiresAt.getTime() - beforeApprove,
    ).toBeLessThanOrEqual(
      config.authToken.companyApprovalConfirmationExpiresInMs + 5_000,
    );

    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "manager.approve@example.com",
        subject: expect.stringMatching(/confirm/i),
        text: expect.stringContaining("confirm-company-approval?token="),
        html: expect.stringContaining("confirm-company-approval?token="),
      }),
    );

    const rawToken = extractConfirmationTokenFromMailCall(
      sendMail.mock.calls[0][0],
    );

    expect(confirmationToken.tokenHash).toBe(hashAuthToken(rawToken));
  });

  it("rejects approve when Manager role or status is not COMPANY_STAFF PENDING_ACTIVATION and leaves Company/User/token unchanged", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin.approve.manager-state@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    const wrongStatus = await registerAndSubmitCompany(agent, {
      email: "manager.approve.wrong-status@example.com",
      companyName: "Wrong Status Approve Co",
      businessRegistrationNumber: "BRN-APPROVE-WRONG-STATUS",
    });

    await User.updateOne(
      { _id: wrongStatus.manager.id },
      { status: USER_STATUS.ACTIVE },
    );

    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin.approve.manager-state@example.com",
    });

    const wrongStatusResponse = await agent
      .post(
        `/api/platform-admin/company-registrations/${wrongStatus.company.id}/approve`,
      )
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(wrongStatusResponse.status).toBe(409);
    expect(wrongStatusResponse.body.error.message).toMatch(
      /PENDING_ACTIVATION/i,
    );

    const wrongStatusCompany = await Company.findById(wrongStatus.company.id);
    const wrongStatusManager = await User.findById(wrongStatus.manager.id);
    const wrongStatusTokenCount = await AuthToken.countDocuments({
      userId: wrongStatus.manager.id,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    });

    expect(wrongStatusCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.PENDING,
    );
    expect(wrongStatusCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(wrongStatusCompany.reviewedByUserId).toBeNull();
    expect(wrongStatusCompany.reviewedAt).toBeNull();
    expect(wrongStatusManager.status).toBe(USER_STATUS.ACTIVE);
    expect(wrongStatusManager.role).toBe(USER_ROLE.COMPANY_STAFF);
    expect(wrongStatusTokenCount).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();

    const wrongRole = await registerAndSubmitCompany(agent, {
      email: "manager.approve.wrong-role@example.com",
      companyName: "Wrong Role Approve Co",
      businessRegistrationNumber: "BRN-APPROVE-WRONG-ROLE",
    });

    const wrongRoleManagerBefore = await User.findById(wrongRole.manager.id);
    await User.collection.updateOne(
      { _id: wrongRoleManagerBefore._id },
      { $set: { role: USER_ROLE.CANDIDATE } },
    );

    const wrongRoleResponse = await agent
      .post(
        `/api/platform-admin/company-registrations/${wrongRole.company.id}/approve`,
      )
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(wrongRoleResponse.status).toBe(409);
    expect(wrongRoleResponse.body.error.message).toMatch(/COMPANY_STAFF/i);

    const wrongRoleCompany = await Company.findById(wrongRole.company.id);
    const wrongRoleManager = await User.findById(wrongRole.manager.id);
    const wrongRoleTokenCount = await AuthToken.countDocuments({
      userId: wrongRole.manager.id,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    });

    expect(wrongRoleCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.PENDING,
    );
    expect(wrongRoleCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(wrongRoleCompany.reviewedByUserId).toBeNull();
    expect(wrongRoleCompany.reviewedAt).toBeNull();
    expect(wrongRoleManager.role).toBe(USER_ROLE.CANDIDATE);
    expect(wrongRoleManager.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(wrongRoleTokenCount).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("rejects unauthorized actors and invalid source states", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "admin.approve.authz@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    await createVerifiedUser({
      email: "candidate.approve@example.com",
      role: USER_ROLE.CANDIDATE,
    });

    const draftRegistration = await agent
      .post("/api/auth/register/company-manager")
      .send({
        fullName: "Draft Manager",
        email: "manager.approve.draft@example.com",
        password: DEFAULT_PASSWORD,
      });

    expect(draftRegistration.status).toBe(201);

    const submitted = await registerAndSubmitCompany(agent, {
      email: "manager.approve.authz@example.com",
      companyName: "Authz Approve Co",
      businessRegistrationNumber: "BRN-APPROVE-AUTHZ",
    });

    const candidateAccessToken = await loginAndGetAccessToken(agent, {
      email: "candidate.approve@example.com",
    });

    const candidateResponse = await agent
      .post(
        `/api/platform-admin/company-registrations/${submitted.company.id}/approve`,
      )
      .set("Authorization", `Bearer ${candidateAccessToken}`)
      .send();

    expect(candidateResponse.status).toBe(403);

    const onboardingResponse = await agent
      .post(
        `/api/platform-admin/company-registrations/${submitted.company.id}/approve`,
      )
      .set("Authorization", `Bearer ${submitted.onboardingAccessToken}`)
      .send();

    expect(onboardingResponse.status).toBe(403);

    const adminAccessToken = await loginAndGetAccessToken(agent, {
      email: "admin.approve.authz@example.com",
    });

    const unsubmittedResponse = await agent
      .post(
        `/api/platform-admin/company-registrations/${draftRegistration.body.company.id}/approve`,
      )
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(unsubmittedResponse.status).toBe(409);

    const unknownResponse = await agent
      .post("/api/platform-admin/company-registrations/not-a-valid-id/approve")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(unknownResponse.status).toBe(400);

    const firstApprove = await agent
      .post(
        `/api/platform-admin/company-registrations/${submitted.company.id}/approve`,
      )
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(firstApprove.status).toBe(200);

    const secondApprove = await agent
      .post(
        `/api/platform-admin/company-registrations/${submitted.company.id}/approve`,
      )
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send();

    expect(secondApprove.status).toBe(409);

    const persistedCompany = await Company.findById(submitted.company.id);
    const confirmationTokenCount = await AuthToken.countDocuments({
      userId: submitted.manager.id,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
    });

    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.APPROVED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(confirmationTokenCount).toBe(1);
  });

  it("rolls back TX-02 when confirmation token persistence fails", async () => {
    const agent = createTestAgent();

    const { user: admin } = await createVerifiedUser({
      email: "admin.approve.rollback@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    const submitted = await registerAndSubmitCompany(agent, {
      email: "manager.approve.rollback@example.com",
      companyName: "Rollback Approve Co",
      businessRegistrationNumber: "BRN-APPROVE-ROLLBACK",
    });

    const createSpy = vi
      .spyOn(AuthToken, "create")
      .mockRejectedValueOnce(new Error("forced token persistence failure"));

    await expect(
      approveCompanyRegistration({
        companyId: submitted.company.id,
        actorUserId: admin._id,
      }),
    ).rejects.toThrow("forced token persistence failure");

    createSpy.mockRestore();

    const persistedCompany = await Company.findById(submitted.company.id);
    const persistedManager = await User.findById(submitted.manager.id);
    const authTokenCount = await AuthToken.countDocuments({
      userId: submitted.manager.id,
    });

    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.PENDING,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persistedCompany.reviewedByUserId).toBeNull();
    expect(persistedCompany.reviewedAt).toBeNull();
    expect(persistedCompany.activatedAt).toBeNull();
    expect(persistedManager.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(authTokenCount).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("preserves TX-02 APPROVED+INACTIVE and confirmation capability when confirmation email fails", async () => {
    const agent = createTestAgent();

    const { user: admin } = await createVerifiedUser({
      email: "admin.approve.mailfail@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    const submitted = await registerAndSubmitCompany(agent, {
      email: "manager.approve.mailfail@example.com",
      fullName: "Mailfail Manager",
      companyName: "Mailfail Approve Co",
      businessRegistrationNumber: "BRN-APPROVE-MAILFAIL",
    });

    sendMail.mockRejectedValueOnce(new Error("forced SMTP failure"));

    const deleteSpy = vi.spyOn(AuthToken, "deleteOne");

    await expect(
      approveCompanyRegistration({
        companyId: submitted.company.id,
        actorUserId: admin._id,
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/approval confirmation email/i),
    });

    expect(deleteSpy).not.toHaveBeenCalled();
    deleteSpy.mockRestore();

    const persistedCompany = await Company.findById(submitted.company.id);
    const persistedManager = await User.findById(submitted.manager.id);
    const confirmationToken = await AuthToken.findOne({
      userId: submitted.manager.id,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      expiresAt: { $gt: new Date() },
    });

    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.APPROVED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persistedCompany.reviewedByUserId.toString()).toBe(
      admin._id.toString(),
    );
    expect(persistedCompany.reviewedAt).not.toBeNull();
    expect(persistedCompany.activatedAt).toBeNull();
    expect(persistedManager.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(confirmationToken).not.toBeNull();
    expect(confirmationToken.userId.toString()).toBe(submitted.manager.id);
  });

  it("does not leave APPROVED Company without confirmation capability when mail-failure compensation only partially succeeds", async () => {
    const agent = createTestAgent();

    const { user: admin } = await createVerifiedUser({
      email: "admin.approve.partialcomp@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });

    const submitted = await registerAndSubmitCompany(agent, {
      email: "manager.approve.partialcomp@example.com",
      fullName: "Partial Comp Manager",
      companyName: "Partial Comp Approve Co",
      businessRegistrationNumber: "BRN-APPROVE-PARTIALCOMP",
    });

    sendMail.mockRejectedValueOnce(new Error("forced SMTP failure"));

    const saveSpy = vi
      .spyOn(Company.prototype, "save")
      .mockRejectedValueOnce(new Error("forced company compensation failure"));

    await expect(
      approveCompanyRegistration({
        companyId: submitted.company.id,
        actorUserId: admin._id,
      }),
    ).rejects.toBeTruthy();

    saveSpy.mockRestore();

    const persistedCompany = await Company.findById(submitted.company.id);
    const confirmationToken = await AuthToken.findOne({
      userId: submitted.manager.id,
      type: AUTH_TOKEN_TYPE.COMPANY_APPROVAL_CONFIRMATION,
      expiresAt: { $gt: new Date() },
    });

    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.APPROVED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persistedCompany.reviewedByUserId.toString()).toBe(
      admin._id.toString(),
    );
    expect(confirmationToken).not.toBeNull();
  });
});
