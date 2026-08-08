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
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthSession from "../../src/models/auth-session.model.js";
import AuthToken from "../../src/models/auth-token.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import sendMail from "../../src/services/mail.service.js";
import { hashAuthToken } from "../../src/utils/hash-auth-token.js";
import { verifyPassword } from "../../src/utils/hash-password.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createPendingRecruiterWithActivationToken,
  createSessionWithRefreshToken,
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

const SUCCESS_MESSAGE =
  "If an account exists for that email, password reset instructions have been sent.";

const NEW_PASSWORD = "recruiter-reset-456";

const extractResetTokenFromMailCall = (mailCall) => {
  const match = mailCall.html.match(/reset-password\?token=([^"]+)/);

  return decodeURIComponent(match[1]);
};

describe("V3 Slice 06 Recruiter password recovery and CM-initiated reset (F06/F07/TX-03)", () => {
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

  it("allows activated Recruiter self forgot/reset with TX-03 effects and no unlock (F06/BR-14/BR-17)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.self-reset@example.com",
      businessRegistrationNumber: "BRN-V3-PWR-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "self.reset@example.com",
      company: manager.company,
      employeeCode: "NV-PWR-1",
      membershipStatus: COMPANY_MEMBER_STATUS.LOCKED,
    });
    recruiter.user.status = USER_STATUS.LOCKED;
    await recruiter.user.save();

    const { session } = await createSessionWithRefreshToken(recruiter.user);
    const companyBefore = await Company.findById(manager.company._id);

    const forgot = await agent.post("/api/auth/forgot-password").send({
      email: "self.reset@example.com",
    });

    expect(forgot.status).toBe(200);
    expect(forgot.body.message).toBe(SUCCESS_MESSAGE);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].to).toBe("self.reset@example.com");

    const rawToken = extractResetTokenFromMailCall(sendMail.mock.calls[0][0]);
    const resetToken = await AuthToken.findOne({
      userId: recruiter.user._id,
      type: AUTH_TOKEN_TYPE.PASSWORD_RESET,
    }).select("+tokenHash");

    expect(resetToken.tokenHash).toBe(hashAuthToken(rawToken));

    const reset = await agent.post("/api/auth/reset-password").send({
      token: rawToken,
      password: NEW_PASSWORD,
    });

    expect(reset.status).toBe(200);

    const persistedUser = await User.findById(recruiter.user._id).select(
      "+passwordHash",
    );
    const persistedMembership = await CompanyMember.findById(
      recruiter.membership._id,
    );
    const persistedCompany = await Company.findById(manager.company._id);
    const sessions = await AuthSession.find({ userId: recruiter.user._id });
    const consumed = await AuthToken.findOne({
      userId: recruiter.user._id,
      type: AUTH_TOKEN_TYPE.PASSWORD_RESET,
    });

    expect(consumed).toBeNull();
    expect(sessions).toHaveLength(0);
    expect(await AuthSession.findById(session._id)).toBeNull();
    expect(persistedUser.mustChangePassword).toBe(false);
    expect(persistedUser.status).toBe(USER_STATUS.LOCKED);
    expect(await verifyPassword(NEW_PASSWORD, persistedUser.passwordHash)).toBe(
      true,
    );
    expect(persistedMembership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
    expect(persistedCompany.operationalStatus).toBe(
      companyBefore.operationalStatus,
    );
  });

  it("silently skips self forgot for pending-activation Recruiter and Company Manager", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.pending-skip@example.com",
      businessRegistrationNumber: "BRN-V3-PWR-2",
    });
    await createPendingRecruiterWithActivationToken({
      email: "pending.reset@example.com",
      company: manager.company,
      employeeCode: "NV-PWR-2",
    });

    const pendingForgot = await agent.post("/api/auth/forgot-password").send({
      email: "pending.reset@example.com",
    });
    const managerForgot = await agent.post("/api/auth/forgot-password").send({
      email: manager.user.email,
    });

    expect(pendingForgot.status).toBe(200);
    expect(pendingForgot.body.message).toBe(SUCCESS_MESSAGE);
    expect(managerForgot.status).toBe(200);
    expect(managerForgot.body.message).toBe(SUCCESS_MESSAGE);
    expect(sendMail).not.toHaveBeenCalled();
    expect(await AuthToken.countDocuments({ type: AUTH_TOKEN_TYPE.PASSWORD_RESET })).toBe(
      0,
    );
  });

  it("lets CM initiate reset for activated same-tenant Recruiter without exposing credentials (F07/BR-12)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.initiate@example.com",
      businessRegistrationNumber: "BRN-V3-PWR-3",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "cm.target@example.com",
      company: manager.company,
      employeeCode: "NV-PWR-3",
    });
    await createSessionWithRefreshToken(recruiter.user);

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/company/recruiters/${recruiter.user._id.toString()}/password-reset`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/password reset initiated/i);
    expect(response.body.recruiter.email).toBe("cm.target@example.com");
    expect(response.body).not.toHaveProperty("token");
    expect(response.body.recruiter).not.toHaveProperty("password");
    expect(response.body.recruiter).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(response.body)).not.toMatch(/reset-password\?token=/);

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].to).toBe("cm.target@example.com");

    const rawToken = extractResetTokenFromMailCall(sendMail.mock.calls[0][0]);
    const reset = await agent.post("/api/auth/reset-password").send({
      token: rawToken,
      password: NEW_PASSWORD,
    });

    expect(reset.status).toBe(200);
    expect(
      await AuthSession.countDocuments({ userId: recruiter.user._id }),
    ).toBe(0);

    const login = await agent.post("/api/auth/login").send({
      email: "cm.target@example.com",
      password: NEW_PASSWORD,
    });

    expect(login.status).toBe(200);
  });

  it("rejects CM reset for pending activation, terminated, and cross-tenant targets", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.reject@example.com",
      businessRegistrationNumber: "BRN-V3-PWR-4",
    });
    const otherManager = await createActiveCompanyManagerContext({
      email: "cm.reject-other@example.com",
      businessRegistrationNumber: "BRN-V3-PWR-5",
      name: "Other Reset Co",
    });
    const pending = await createPendingRecruiterWithActivationToken({
      email: "cm.pending-target@example.com",
      company: manager.company,
      employeeCode: "NV-PWR-4A",
    });
    const terminated = await createActiveRecruiterContext({
      email: "cm.terminated-target@example.com",
      company: manager.company,
      employeeCode: "NV-PWR-4B",
      membershipStatus: COMPANY_MEMBER_STATUS.TERMINATED,
    });
    const foreign = await createActiveRecruiterContext({
      email: "cm.foreign-target@example.com",
      company: otherManager.company,
      employeeCode: "NV-PWR-4C",
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const pendingResponse = await agent
      .post(`/api/company/recruiters/${pending.user._id.toString()}/password-reset`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(pendingResponse.status).toBe(409);
    expect(pendingResponse.body.error.message).toMatch(/complete activation/i);

    const terminatedResponse = await agent
      .post(
        `/api/company/recruiters/${terminated.user._id.toString()}/password-reset`,
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(terminatedResponse.status).toBe(409);

    const foreignResponse = await agent
      .post(`/api/company/recruiters/${foreign.user._id.toString()}/password-reset`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(foreignResponse.status).toBe(404);
    expect(sendMail).not.toHaveBeenCalled();
    expect(await AuthToken.countDocuments({ type: AUTH_TOKEN_TYPE.PASSWORD_RESET })).toBe(
      0,
    );
  });

  it("CM-initiated reset does not unlock membership or Company restrictions (BR-15/BR-22)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.nounlock@example.com",
      businessRegistrationNumber: "BRN-V3-PWR-6",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "nounlock.target@example.com",
      company: manager.company,
      employeeCode: "NV-PWR-6",
      membershipStatus: COMPANY_MEMBER_STATUS.LOCKED,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const initiate = await agent
      .post(`/api/company/recruiters/${recruiter.user._id.toString()}/password-reset`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(initiate.status).toBe(200);

    const rawToken = extractResetTokenFromMailCall(sendMail.mock.calls[0][0]);

    await Company.findByIdAndUpdate(manager.company._id, {
      operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
    });

    const reset = await agent.post("/api/auth/reset-password").send({
      token: rawToken,
      password: NEW_PASSWORD,
    });

    expect(reset.status).toBe(200);

    const persistedUser = await User.findById(recruiter.user._id).select(
      "+passwordHash",
    );
    const persistedMembership = await CompanyMember.findById(
      recruiter.membership._id,
    );
    const persistedCompany = await Company.findById(manager.company._id);

    expect(persistedUser.status).toBe(USER_STATUS.ACTIVE);
    expect(persistedMembership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
    expect(persistedCompany.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.LOCKED,
    );
    expect(await verifyPassword(NEW_PASSWORD, persistedUser.passwordHash)).toBe(
      true,
    );

    const login = await agent.post("/api/auth/login").send({
      email: "nounlock.target@example.com",
      password: NEW_PASSWORD,
    });

    expect(login.status).toBe(200);

    const business = await agent
      .get("/api/company-staff-access-probe/business")
      .set("Authorization", `Bearer ${login.body.accessToken}`);

    expect(business.status).toBe(403);
  });
});
