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
import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthSession from "../../src/models/auth-session.model.js";
import AuthToken from "../../src/models/auth-token.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import sendMail from "../../src/services/mail.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createPendingRecruiterWithActivationToken,
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

const ACTIVATION_PASSWORD = "recruiter-activate-789";
const RESET_PASSWORD = "recruiter-reset-789";

const extractTokenFromMail = (mailCall, pathSegment) => {
  const match = mailCall.html.match(
    new RegExp(`${pathSegment}\\?token=([^"]+)`),
  );

  return decodeURIComponent(match[1]);
};

const assertNoCredentialLeakage = (body) => {
  const serialized = JSON.stringify(body);

  expect(serialized).not.toMatch(/passwordHash/i);
  expect(serialized).not.toMatch(/"password"\s*:/);
  expect(serialized).not.toMatch(/tokenHash/i);
  expect(serialized).not.toMatch(/activate-recruiter\?token=/);
  expect(serialized).not.toMatch(/reset-password\?token=/);
  expect(body).not.toHaveProperty("token");
  expect(body).not.toHaveProperty("refreshToken");
};

const assertCompanyHasNoManagerUserIdField = (companyDoc) => {
  const raw = companyDoc.toObject();

  expect(raw).not.toHaveProperty("managerUserId");
  expect(Object.prototype.hasOwnProperty.call(raw, "managerUserId")).toBe(
    false,
  );
};

describe("V3 Slice 09 acceptance and regression closure (F01–F09, F11–F17)", () => {
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

  it("completes Recruiter lifecycle end-to-end without credential leakage (§17)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.lifecycle@example.com",
      businessRegistrationNumber: "BRN-V3-ACC-1",
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const create = await agent
      .post("/api/company/recruiters")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        fullName: "Lifecycle Recruiter",
        email: "lifecycle.recruiter@example.com",
        employeeCode: "NV-ACC-1",
        jobTitle: "Talent Partner",
      });

    expect(create.status).toBe(201);
    assertNoCredentialLeakage(create.body);
    expect(create.body.recruiter.mustChangePassword).toBe(true);
    expect(create.body.recruiter.membership.status).toBe(
      COMPANY_MEMBER_STATUS.ACTIVE,
    );
    expect(create.body.recruiter.role).toBe(USER_ROLE.COMPANY_STAFF);

    const recruiterId = create.body.recruiter.id;
    const activationToken = extractTokenFromMail(
      sendMail.mock.calls[0][0],
      "activate-recruiter",
    );

    const activate = await agent.post("/api/auth/activate-recruiter").send({
      token: activationToken,
      password: ACTIVATION_PASSWORD,
    });

    expect(activate.status).toBe(200);
    assertNoCredentialLeakage(activate.body);
    expect(activate.body.user.mustChangePassword).toBe(false);

    const recruiterLogin = await agent.post("/api/auth/login").send({
      email: "lifecycle.recruiter@example.com",
      password: ACTIVATION_PASSWORD,
    });

    expect(recruiterLogin.status).toBe(200);

    const businessBeforeLock = await agent
      .get("/api/company-staff-access-probe/business")
      .set("Authorization", `Bearer ${recruiterLogin.body.accessToken}`);

    expect(businessBeforeLock.status).toBe(200);

    const list = await agent
      .get("/api/company/recruiters")
      .set("Authorization", `Bearer ${managerToken}`);
    const detail = await agent
      .get(`/api/company/recruiters/${recruiterId}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    assertNoCredentialLeakage(list.body);
    assertNoCredentialLeakage(detail.body);
    expect(list.body.recruiters).toHaveLength(1);

    const initiateReset = await agent
      .post(`/api/company/recruiters/${recruiterId}/password-reset`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(initiateReset.status).toBe(200);
    assertNoCredentialLeakage(initiateReset.body);

    const resetToken = extractTokenFromMail(
      sendMail.mock.calls.at(-1)[0],
      "reset-password",
    );
    const reset = await agent.post("/api/auth/reset-password").send({
      token: resetToken,
      password: RESET_PASSWORD,
    });

    expect(reset.status).toBe(200);

    const afterResetLogin = await agent.post("/api/auth/login").send({
      email: "lifecycle.recruiter@example.com",
      password: RESET_PASSWORD,
    });

    expect(afterResetLogin.status).toBe(200);

    const priorAccessToken = afterResetLogin.body.accessToken;
    const priorRefreshToken = afterResetLogin.body.refreshToken;

    const lock = await agent
      .post(`/api/company/recruiters/${recruiterId}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(lock.status).toBe(200);
    assertNoCredentialLeakage(lock.body);
    expect(lock.body.recruiter.membership.status).toBe(
      COMPANY_MEMBER_STATUS.LOCKED,
    );
    expect(lock.body.recruiter.status).toBe(USER_STATUS.ACTIVE);
    expect(await AuthSession.countDocuments({ userId: recruiterId })).toBe(0);

    const lockedAccess = await agent
      .get("/api/auth-access-probe/protected")
      .set("Authorization", `Bearer ${priorAccessToken}`);
    const lockedRefresh = await agent.post("/api/auth/refresh").send({
      refreshToken: priorRefreshToken,
    });

    expect(lockedAccess.status).toBe(401);
    expect(lockedRefresh.status).toBe(401);

    const unlock = await agent
      .post(`/api/company/recruiters/${recruiterId}/unlock`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(unlock.status).toBe(200);
    expect(unlock.body.recruiter.membership.status).toBe(
      COMPANY_MEMBER_STATUS.ACTIVE,
    );
    expect(await AuthSession.countDocuments({ userId: recruiterId })).toBe(0);
    expect(
      (
        await agent
          .get("/api/auth-access-probe/protected")
          .set("Authorization", `Bearer ${priorAccessToken}`)
      ).status,
    ).toBe(401);

    const reLogin = await agent.post("/api/auth/login").send({
      email: "lifecycle.recruiter@example.com",
      password: RESET_PASSWORD,
    });
    const terminateAccess = reLogin.body.accessToken;
    const terminateRefresh = reLogin.body.refreshToken;

    const terminate = await agent
      .post(`/api/company/recruiters/${recruiterId}/terminate`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(terminate.status).toBe(200);
    assertNoCredentialLeakage(terminate.body);
    expect(terminate.body.recruiter.membership.status).toBe(
      COMPANY_MEMBER_STATUS.TERMINATED,
    );

    expect(
      (
        await agent
          .get("/api/auth-access-probe/protected")
          .set("Authorization", `Bearer ${terminateAccess}`)
      ).status,
    ).toBe(401);
    expect(
      (
        await agent.post("/api/auth/refresh").send({
          refreshToken: terminateRefresh,
        })
      ).status,
    ).toBe(401);

    const persistedUser = await User.findById(recruiterId);
    const persistedMembership = await CompanyMember.findOne({
      userId: recruiterId,
    });
    const persistedCompany = await Company.findById(manager.company._id);

    expect(persistedUser).not.toBeNull();
    expect(persistedUser.email).toBe("lifecycle.recruiter@example.com");
    expect(persistedUser.status).toBe(USER_STATUS.ACTIVE);
    expect(persistedMembership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
    expect(persistedMembership.employeeCode).toBe("NV-ACC-1");
    expect(persistedMembership.jobTitle).toBe("Talent Partner");
    assertCompanyHasNoManagerUserIdField(persistedCompany);

    const historyDetail = await agent
      .get(`/api/company/recruiters/${recruiterId}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(historyDetail.status).toBe(200);
    expect(historyDetail.body.recruiter.membership.status).toBe(
      COMPANY_MEMBER_STATUS.TERMINATED,
    );
  });

  it("rejects cross-tenant targets and client companyId expansion on management routes (BR-07)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.cross-tenant@example.com",
      businessRegistrationNumber: "BRN-V3-ACC-2",
    });
    const other = await createActiveCompanyManagerContext({
      email: "cm.cross-other@example.com",
      businessRegistrationNumber: "BRN-V3-ACC-3",
      name: "Other Acceptance Co",
    });
    const foreign = await createActiveRecruiterContext({
      email: "foreign.acceptance@example.com",
      company: other.company,
      employeeCode: "NV-ACC-2F",
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });
    const foreignId = foreign.user._id.toString();
    const foreignCompanyId = other.company._id.toString();

    const listExpanded = await agent
      .get(`/api/company/recruiters?companyId=${foreignCompanyId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    const createExpanded = await agent
      .post("/api/company/recruiters")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        fullName: "Should Fail",
        email: "should.fail.cross@example.com",
        employeeCode: "NV-FAIL",
        jobTitle: "Recruiter",
        companyId: foreignCompanyId,
      });
    const detail = await agent
      .get(`/api/company/recruiters/${foreignId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    const lock = await agent
      .post(`/api/company/recruiters/${foreignId}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);
    const unlock = await agent
      .post(`/api/company/recruiters/${foreignId}/unlock`)
      .set("Authorization", `Bearer ${managerToken}`);
    const terminate = await agent
      .post(`/api/company/recruiters/${foreignId}/terminate`)
      .set("Authorization", `Bearer ${managerToken}`);
    const reset = await agent
      .post(`/api/company/recruiters/${foreignId}/password-reset`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(listExpanded.status).toBe(403);
    expect(createExpanded.status).toBe(403);
    expect(detail.status).toBe(404);
    expect(lock.status).toBe(404);
    expect(unlock.status).toBe(404);
    expect(terminate.status).toBe(404);
    expect(reset.status).toBe(404);
    expect(
      (await CompanyMember.findById(foreign.membership._id)).status,
    ).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("rejects Candidate, Platform Admin, Recruiter, and PENDING_ACTIVATION CM on recruiter management", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.actor-matrix@example.com",
      businessRegistrationNumber: "BRN-V3-ACC-4",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "peer.actor@example.com",
      company: manager.company,
      employeeCode: "NV-ACC-4",
    });
    const { user: candidate } = await createVerifiedUser({
      email: "candidate.actor@example.com",
    });
    const { user: admin } = await createVerifiedUser({
      email: "admin.actor@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    const pendingCm = await createActiveCompanyManagerContext({
      email: "pending.cm.actor@example.com",
      businessRegistrationNumber: "BRN-V3-ACC-5",
      name: "Pending CM Co",
    });
    pendingCm.user.status = USER_STATUS.PENDING_ACTIVATION;
    await pendingCm.user.save();

    const candidateToken = await loginAndGetAccessToken(agent, {
      email: candidate.email,
      password: DEFAULT_PASSWORD,
    });
    const adminToken = await loginAndGetAccessToken(agent, {
      email: admin.email,
      password: DEFAULT_PASSWORD,
    });
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });
    const pendingLogin = await agent.post("/api/auth/login").send({
      email: pendingCm.user.email,
      password: DEFAULT_PASSWORD,
    });

    expect(pendingLogin.status).toBe(200);

    const payloads = [
      candidateToken,
      adminToken,
      recruiterToken,
      pendingLogin.body.accessToken,
    ];

    for (const token of payloads) {
      const response = await agent
        .get("/api/company/recruiters")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    }
  });

  it("denies management when CM User is LOCKED or Company is LOCKED (BR-06/BR-22/BR-23)", async () => {
    const agent = createTestAgent();
    const lockedUserCm = await createActiveCompanyManagerContext({
      email: "cm.user-locked@example.com",
      businessRegistrationNumber: "BRN-V3-ACC-6",
    });
    const lockedCompanyCm = await createActiveCompanyManagerContext({
      email: "cm.company-locked@example.com",
      businessRegistrationNumber: "BRN-V3-ACC-7",
      name: "Locked Company Co",
    });
    await createActiveRecruiterContext({
      email: "under.locked.user@example.com",
      company: lockedUserCm.company,
      employeeCode: "NV-ACC-6",
    });
    await createActiveRecruiterContext({
      email: "under.locked.company@example.com",
      company: lockedCompanyCm.company,
      employeeCode: "NV-ACC-7",
    });

    const lockedUserToken = await loginAndGetAccessToken(agent, {
      email: lockedUserCm.user.email,
      password: DEFAULT_PASSWORD,
    });
    const lockedCompanyToken = await loginAndGetAccessToken(agent, {
      email: lockedCompanyCm.user.email,
      password: DEFAULT_PASSWORD,
    });

    lockedUserCm.user.status = USER_STATUS.LOCKED;
    await lockedUserCm.user.save();
    await Company.findByIdAndUpdate(lockedCompanyCm.company._id, {
      operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
    });

    const userLockedList = await agent
      .get("/api/company/recruiters")
      .set("Authorization", `Bearer ${lockedUserToken}`);
    const companyLockedCreate = await agent
      .post("/api/company/recruiters")
      .set("Authorization", `Bearer ${lockedCompanyToken}`)
      .send({
        fullName: "Blocked",
        email: "blocked.create@example.com",
        employeeCode: "NV-BLOCK",
        jobTitle: "Recruiter",
      });

    expect(userLockedList.status).toBe(403);
    expect(companyLockedCreate.status).toBe(403);
  });

  it("blocks pre-activation Recruiter access and CM-initiated reset (BR-11/BR-13)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.preact@example.com",
      businessRegistrationNumber: "BRN-V3-ACC-8",
    });
    const pending = await createPendingRecruiterWithActivationToken({
      email: "pending.preact@example.com",
      company: manager.company,
      employeeCode: "NV-ACC-8",
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const login = await agent.post("/api/auth/login").send({
      email: "pending.preact@example.com",
      password: DEFAULT_PASSWORD,
    });
    const forgot = await agent.post("/api/auth/forgot-password").send({
      email: "pending.preact@example.com",
    });
    const cmReset = await agent
      .post(
        `/api/company/recruiters/${pending.user._id.toString()}/password-reset`,
      )
      .set("Authorization", `Bearer ${managerToken}`);

    expect(login.status).toBe(403);
    expect(forgot.status).toBe(200);
    expect(sendMail).not.toHaveBeenCalled();
    expect(cmReset.status).toBe(409);
    expect(pending.user.mustChangePassword).toBe(true);
    expect(pending.user.status).toBe(USER_STATUS.ACTIVE);
    expect(
      await AuthToken.countDocuments({ type: AUTH_TOKEN_TYPE.PASSWORD_RESET }),
    ).toBe(0);
  });

  it("keeps TERMINATED terminal and rejects forbidden transitions (BR-19)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.terminal@example.com",
      businessRegistrationNumber: "BRN-V3-ACC-9",
    });
    const active = await createActiveRecruiterContext({
      email: "terminal.active@example.com",
      company: manager.company,
      employeeCode: "NV-ACC-9A",
    });
    const locked = await createActiveRecruiterContext({
      email: "terminal.locked@example.com",
      company: manager.company,
      employeeCode: "NV-ACC-9B",
      membershipStatus: COMPANY_MEMBER_STATUS.LOCKED,
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    expect(
      (
        await agent
          .post(
            `/api/company/recruiters/${active.user._id.toString()}/terminate`,
          )
          .set("Authorization", `Bearer ${managerToken}`)
      ).status,
    ).toBe(200);
    expect(
      (
        await agent
          .post(
            `/api/company/recruiters/${locked.user._id.toString()}/terminate`,
          )
          .set("Authorization", `Bearer ${managerToken}`)
      ).status,
    ).toBe(200);

    const activeId = active.user._id.toString();
    const lockAfter = await agent
      .post(`/api/company/recruiters/${activeId}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);
    const unlockAfter = await agent
      .post(`/api/company/recruiters/${activeId}/unlock`)
      .set("Authorization", `Bearer ${managerToken}`);
    const secondTerminate = await agent
      .post(`/api/company/recruiters/${activeId}/terminate`)
      .set("Authorization", `Bearer ${managerToken}`);
    const recreate = await agent
      .post("/api/company/recruiters")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        fullName: "Reuse Attempt",
        email: "terminal.active@example.com",
        employeeCode: "NV-ACC-9C",
        jobTitle: "Recruiter",
      });

    expect(lockAfter.status).toBe(409);
    expect(unlockAfter.status).toBe(409);
    expect(secondTerminate.status).toBe(409);
    expect(recreate.status).toBe(409);
    expect(recreate.body.error.message).toMatch(/email/i);
    expect(
      (await CompanyMember.findById(active.membership._id)).status,
    ).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
    expect(
      (await CompanyMember.findById(locked.membership._id)).status,
    ).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
  });

  it("preserves V1 Candidate login and V2 CM membership SoT without Company.managerUserId (F17)", async () => {
    const agent = createTestAgent();

    await createVerifiedUser({
      email: "v1.candidate@example.com",
    });
    const candidateLogin = await agent.post("/api/auth/login").send({
      email: "v1.candidate@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(candidateLogin.status).toBe(200);

    const register = await agent.post("/api/auth/register/company-manager").send({
      fullName: "V2 Compatible Manager",
      email: "v2.compatible.cm@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(register.status).toBe(201);

    const registeredUser = await User.findOne({
      email: "v2.compatible.cm@example.com",
    });
    const membership = await CompanyMember.findOne({
      userId: registeredUser._id,
    });
    const company = await Company.findById(membership.companyId);

    expect(registeredUser.role).toBe(USER_ROLE.COMPANY_STAFF);
    expect(registeredUser.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(membership.role).toBe(COMPANY_MEMBER_ROLE.COMPANY_MANAGER);
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
    assertCompanyHasNoManagerUserIdField(company);

    const manager = await createActiveCompanyManagerContext({
      email: "v2.active.cm@example.com",
      businessRegistrationNumber: "BRN-V3-ACC-10",
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });
    const companyGet = await agent
      .get("/api/company")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(companyGet.status).toBe(200);
    expect(companyGet.body.company.managerUserId).toBe(
      manager.user._id.toString(),
    );
    assertCompanyHasNoManagerUserIdField(
      await Company.findById(manager.company._id),
    );
  });

  it("does not implement F10 Recruiter update routes (BR-29/§15)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.no-f10@example.com",
      businessRegistrationNumber: "BRN-V3-ACC-11",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "nof10.target@example.com",
      company: manager.company,
      employeeCode: "NV-ACC-11",
      jobTitle: "Original Title",
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });
    const path = `/api/company/recruiters/${recruiter.user._id.toString()}`;

    const patch = await agent
      .patch(path)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        fullName: "Updated Name",
        jobTitle: "Updated Title",
      });
    const put = await agent
      .put(path)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        fullName: "Updated Name",
        jobTitle: "Updated Title",
      });

    expect([404, 405]).toContain(patch.status);
    expect([404, 405]).toContain(put.status);

    const membership = await CompanyMember.findById(recruiter.membership._id);
    const user = await User.findById(recruiter.user._id);

    expect(user.fullName).toBe("Active Recruiter");
    expect(membership.jobTitle).toBe("Original Title");
  });
});
