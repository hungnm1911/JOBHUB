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

const registerCompanyManager = async (agent, { email, fullName = "Chris Manager" }) => {
  const response = await agent.post("/api/auth/register/company-manager").send({
    fullName,
    email,
    password: DEFAULT_PASSWORD,
  });

  expect(response.status).toBe(201);

  return response.body;
};

const loginOnboarding = async (agent, { email }) => {
  const response = await agent.post("/api/auth/login").send({
    email,
    password: DEFAULT_PASSWORD,
  });

  expect(response.status).toBe(200);

  return response.body;
};

const activateOwnedCompany = async (
  agent,
  {
    managerEmail,
    adminEmail,
    companyName,
    businessRegistrationNumber,
  },
) => {
  await createVerifiedUser({
    email: adminEmail,
    role: USER_ROLE.PLATFORM_ADMIN,
  });

  const registration = await registerCompanyManager(agent, {
    email: managerEmail,
  });

  const onboardingLogin = await loginOnboarding(agent, {
    email: managerEmail,
  });

  const draftResponse = await agent
    .patch("/api/company")
    .set("Authorization", `Bearer ${onboardingLogin.accessToken}`)
    .send({
      name: companyName,
      businessRegistrationNumber,
      description: "BR-21 activation fixture",
    });

  expect(draftResponse.status).toBe(200);

  const submitResponse = await agent
    .post("/api/company/submit")
    .set("Authorization", `Bearer ${onboardingLogin.accessToken}`)
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

  const rawToken = extractConfirmationTokenFromMailCall(
    sendMail.mock.calls.at(-1)[0],
  );

  return {
    companyId: submitResponse.body.company.id,
    managerId: registration.user.id,
    onboardingAccessToken: onboardingLogin.accessToken,
    onboardingRefreshToken: onboardingLogin.refreshToken,
    onboardingSessionId: onboardingLogin.session.id,
    rawToken,
  };
};

describe("BR-21 limited onboarding authentication", () => {
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

  it("allows PENDING_ACTIVATION Company Manager to refresh the onboarding session", async () => {
    const agent = createTestAgent();

    await registerCompanyManager(agent, {
      email: "br21.refresh@example.com",
    });

    const loginResponse = await loginOnboarding(agent, {
      email: "br21.refresh@example.com",
    });

    const refreshResponse = await agent.post("/api/auth/refresh").send({
      refreshToken: loginResponse.refreshToken,
    });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).toBeUndefined();
    expect(refreshResponse.body.session.id).toBe(loginResponse.session.id);

    const draftGet = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${refreshResponse.body.accessToken}`);

    expect(draftGet.status).toBe(200);
    expect(draftGet.body.company).toMatchObject({
      approvalStatus: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
    });

    const persistedUser = await User.findOne({
      email: "br21.refresh@example.com",
    });

    expect(persistedUser.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(persistedUser.emailVerifiedAt).toBeNull();
  });

  it("revokes only the current onboarding session on logout", async () => {
    const agent = createTestAgent();

    await registerCompanyManager(agent, {
      email: "br21.logout@example.com",
    });

    const firstLogin = await loginOnboarding(agent, {
      email: "br21.logout@example.com",
    });
    const secondLogin = await loginOnboarding(agent, {
      email: "br21.logout@example.com",
    });

    const logoutResponse = await agent
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${firstLogin.accessToken}`);

    expect(logoutResponse.status).toBe(200);

    const revokedSession = await AuthSession.findById(firstLogin.session.id);
    const remainingSession = await AuthSession.findById(secondLogin.session.id);

    expect(revokedSession).toBeNull();
    expect(remainingSession).not.toBeNull();

    const revokedDraftGet = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${firstLogin.accessToken}`);

    const remainingDraftGet = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${secondLogin.accessToken}`);

    const remainingRefresh = await agent.post("/api/auth/refresh").send({
      refreshToken: secondLogin.refreshToken,
    });

    expect(revokedDraftGet.status).toBe(401);
    expect(remainingDraftGet.status).toBe(200);
    expect(remainingRefresh.status).toBe(200);

    const sessions = await AuthSession.find({
      userId: firstLogin.user.id,
    });
    const persistedUser = await User.findById(firstLogin.user.id);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]._id.toString()).toBe(secondLogin.session.id);
    expect(persistedUser.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(persistedUser.emailVerifiedAt).toBeNull();
  });

  it("stops authorizing onboarding routes after F07 activation", async () => {
    const agent = createTestAgent();

    const prepared = await activateOwnedCompany(agent, {
      managerEmail: "br21.after-f07@example.com",
      adminEmail: "admin.br21.after-f07@example.com",
      companyName: "BR21 After F07 Co",
      businessRegistrationNumber: "BRN-BR21-AFTER-F07",
    });

    const confirmResponse = await agent
      .post("/api/auth/confirm-company-approval")
      .send({ token: prepared.rawToken });

    expect(confirmResponse.status).toBe(200);

    const persistedManager = await User.findById(prepared.managerId);
    const persistedCompany = await Company.findById(prepared.companyId);

    expect(persistedManager.status).toBe(USER_STATUS.ACTIVE);
    expect(persistedManager.emailVerifiedAt).not.toBeNull();
    expect(persistedCompany.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.APPROVED,
    );
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.ACTIVE,
    );

    const submitAttempt = await agent
      .post("/api/company/submit")
      .set("Authorization", `Bearer ${prepared.onboardingAccessToken}`)
      .send();

    const resendAttempt = await agent
      .post("/api/company/resend-approval-confirmation")
      .set("Authorization", `Bearer ${prepared.onboardingAccessToken}`)
      .send();

    expect(submitAttempt.status).toBe(403);
    expect(submitAttempt.body.error.message).toMatch(/onboarding access/i);
    expect(resendAttempt.status).toBe(403);
    expect(resendAttempt.body.error.message).toMatch(/onboarding access/i);
  });

  it("rejects onboarding access after termination", async () => {
    const agent = createTestAgent();

    await registerCompanyManager(agent, {
      email: "br21.terminated@example.com",
    });

    const loginResponse = await loginOnboarding(agent, {
      email: "br21.terminated@example.com",
    });

    await User.updateOne(
      { _id: loginResponse.user.id },
      { status: USER_STATUS.TERMINATED },
    );

    const draftGet = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`);

    const submitAttempt = await agent
      .post("/api/company/submit")
      .set("Authorization", `Bearer ${loginResponse.accessToken}`)
      .send();

    const refreshResponse = await agent.post("/api/auth/refresh").send({
      refreshToken: loginResponse.refreshToken,
    });

    expect(draftGet.status).toBe(403);
    expect(draftGet.body.error.message).toMatch(/terminated/i);
    expect(submitAttempt.status).toBe(403);
    expect(submitAttempt.body.error.message).toMatch(/terminated/i);
    expect(refreshResponse.status).toBe(403);
    expect(refreshResponse.body.error.message).toMatch(/terminated/i);
    expect(refreshResponse.body.accessToken).toBeUndefined();

    const persistedUser = await User.findById(loginResponse.user.id);
    const sessions = await AuthSession.find({
      userId: loginResponse.user.id,
    });

    expect(persistedUser.status).toBe(USER_STATUS.TERMINATED);
    expect(sessions).toHaveLength(1);
  });
});
