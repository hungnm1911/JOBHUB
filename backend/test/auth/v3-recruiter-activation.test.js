import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import AUTH_TOKEN_TYPE from "../../src/constants/auth-token-type.js";
import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthToken from "../../src/models/auth-token.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import { verifyPassword } from "../../src/utils/hash-password.js";
import {
  createPendingRecruiterWithActivationToken,
  DEFAULT_PASSWORD,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const NEW_PASSWORD = "recruiter-password-456";

describe("V3 Slice 04 Recruiter activation completion (F05/TX-02)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("GET email link opens password setup form without consuming the token", async () => {
    const agent = createTestAgent();
    const { rawToken } = await createPendingRecruiterWithActivationToken({
      email: "activate.link@example.com",
      employeeCode: "NV-ACT-LINK",
    });

    const response = await agent.get(
      `/api/auth/activate-recruiter?token=${encodeURIComponent(rawToken)}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/html/);
    expect(response.text).toContain('method="POST"');
    expect(response.text).toContain('action="/api/auth/activate-recruiter"');
    expect(response.text).toContain(`value="${rawToken}"`);
    expect(response.text).toContain('name="password"');

    const tokenStillUsable = await AuthToken.findOne({
      type: AUTH_TOKEN_TYPE.RECRUITER_ACTIVATION,
    });
    expect(tokenStillUsable).not.toBeNull();
  });

  it("completes activation when the email form posts urlencoded token + password", async () => {
    const agent = createTestAgent();
    const { user, rawToken } = await createPendingRecruiterWithActivationToken({
      email: "activate.form@example.com",
      employeeCode: "NV-ACT-FORM",
    });

    const response = await agent
      .post("/api/auth/activate-recruiter")
      .type("form")
      .send({
        token: rawToken,
        password: NEW_PASSWORD,
      });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: user._id.toString(),
      mustChangePassword: false,
    });
  });

  it("atomically sets password, clears mustChangePassword, verifies email, and consumes token (BR-11/TX-02)", async () => {
    const agent = createTestAgent();
    const { user, company, membership, rawToken } =
      await createPendingRecruiterWithActivationToken({
        email: "activate.ok@example.com",
        employeeCode: "NV-ACT-1",
      });

    const membershipBefore = membership.toObject();
    const companyBefore = await Company.findById(company._id);

    const response = await agent.post("/api/auth/activate-recruiter").send({
      token: rawToken,
      password: NEW_PASSWORD,
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/recruiter activation completed/i);
    expect(response.body.user).toMatchObject({
      id: user._id.toString(),
      email: "activate.ok@example.com",
      role: USER_ROLE.COMPANY_STAFF,
      status: USER_STATUS.ACTIVE,
      mustChangePassword: false,
    });
    expect(response.body.user.emailVerifiedAt).toEqual(expect.any(String));
    expect(response.body.accessToken).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.body.user.password).toBeUndefined();
    expect(response.body.user.passwordHash).toBeUndefined();

    const persistedUser = await User.findById(user._id).select("+passwordHash");
    const activationToken = await AuthToken.findOne({
      userId: user._id,
      type: AUTH_TOKEN_TYPE.RECRUITER_ACTIVATION,
    });
    const persistedMembership = await CompanyMember.findById(membership._id);
    const persistedCompany = await Company.findById(company._id);

    expect(activationToken).toBeNull();
    expect(persistedUser.mustChangePassword).toBe(false);
    expect(persistedUser.emailVerifiedAt).toBeInstanceOf(Date);
    expect(persistedUser.status).toBe(USER_STATUS.ACTIVE);
    expect(await verifyPassword(DEFAULT_PASSWORD, persistedUser.passwordHash)).toBe(
      false,
    );
    expect(await verifyPassword(NEW_PASSWORD, persistedUser.passwordHash)).toBe(
      true,
    );
    expect(persistedMembership.status).toBe(membershipBefore.status);
    expect(persistedMembership.role).toBe(COMPANY_MEMBER_ROLE.RECRUITER);
    expect(persistedMembership.companyId.toString()).toBe(
      membershipBefore.companyId.toString(),
    );
    expect(persistedCompany.approvalStatus).toBe(companyBefore.approvalStatus);
    expect(persistedCompany.operationalStatus).toBe(
      companyBefore.operationalStatus,
    );
    expect(persistedCompany.activatedAt?.getTime()).toBe(
      companyBefore.activatedAt?.getTime(),
    );
  });

  it("rejects invalid, expired, and reused activation tokens without mutating user (single-use)", async () => {
    const agent = createTestAgent();
    const pending = await createPendingRecruiterWithActivationToken({
      email: "activate.reject@example.com",
      employeeCode: "NV-ACT-2",
    });
    const userBefore = await User.findById(pending.user._id).select(
      "+passwordHash",
    );

    const invalidResponse = await agent
      .post("/api/auth/activate-recruiter")
      .send({
        token: "invalid-token",
        password: NEW_PASSWORD,
      });

    expect(invalidResponse.status).toBe(400);

    const expired = await createPendingRecruiterWithActivationToken({
      email: "activate.expired@example.com",
      company: pending.company,
      employeeCode: "NV-ACT-2B",
      expiresAt: new Date(Date.now() - 1_000),
    });

    const expiredResponse = await agent
      .post("/api/auth/activate-recruiter")
      .send({
        token: expired.rawToken,
        password: NEW_PASSWORD,
      });

    expect(expiredResponse.status).toBe(400);

    const firstUse = await agent.post("/api/auth/activate-recruiter").send({
      token: pending.rawToken,
      password: NEW_PASSWORD,
    });

    expect(firstUse.status).toBe(200);

    const reusedResponse = await agent.post("/api/auth/activate-recruiter").send({
      token: pending.rawToken,
      password: "another-password-789",
    });

    expect(reusedResponse.status).toBe(400);

    const userAfter = await User.findById(pending.user._id).select("+passwordHash");
    const expiredUser = await User.findById(expired.user._id).select(
      "+passwordHash",
    );
    const expiredToken = await AuthToken.findOne({
      userId: expired.user._id,
      type: AUTH_TOKEN_TYPE.RECRUITER_ACTIVATION,
    });

    expect(await verifyPassword(NEW_PASSWORD, userAfter.passwordHash)).toBe(true);
    expect(
      await verifyPassword("another-password-789", userAfter.passwordHash),
    ).toBe(false);
    expect(userBefore.passwordHash).not.toBe(userAfter.passwordHash);
    expect(await verifyPassword(DEFAULT_PASSWORD, expiredUser.passwordHash)).toBe(
      true,
    );
    expect(expiredUser.mustChangePassword).toBe(true);
    expect(expiredUser.emailVerifiedAt).toBeNull();
    expect(expiredToken).not.toBeNull();
  });

  it("rejects locked or terminated users and locked membership without consuming token", async () => {
    const agent = createTestAgent();

    const lockedUser = await createPendingRecruiterWithActivationToken({
      email: "activate.locked-user@example.com",
      employeeCode: "NV-ACT-3",
      userStatus: USER_STATUS.LOCKED,
    });

    const lockedUserResponse = await agent
      .post("/api/auth/activate-recruiter")
      .send({
        token: lockedUser.rawToken,
        password: NEW_PASSWORD,
      });

    expect(lockedUserResponse.status).toBe(409);

    const lockedMembership = await createPendingRecruiterWithActivationToken({
      email: "activate.locked-member@example.com",
      company: lockedUser.company,
      employeeCode: "NV-ACT-3B",
      membershipStatus: COMPANY_MEMBER_STATUS.LOCKED,
    });

    const lockedMembershipResponse = await agent
      .post("/api/auth/activate-recruiter")
      .send({
        token: lockedMembership.rawToken,
        password: NEW_PASSWORD,
      });

    expect(lockedMembershipResponse.status).toBe(409);

    for (const fixture of [lockedUser, lockedMembership]) {
      const persistedUser = await User.findById(fixture.user._id).select(
        "+passwordHash",
      );
      const token = await AuthToken.findOne({
        userId: fixture.user._id,
        type: AUTH_TOKEN_TYPE.RECRUITER_ACTIVATION,
      });

      expect(persistedUser.mustChangePassword).toBe(true);
      expect(persistedUser.emailVerifiedAt).toBeNull();
      expect(await verifyPassword(DEFAULT_PASSWORD, persistedUser.passwordHash)).toBe(
        true,
      );
      expect(token).not.toBeNull();
    }
  });

  it("rejects passwords that violate the shared password policy without consuming token", async () => {
    const agent = createTestAgent();
    const { user, rawToken } = await createPendingRecruiterWithActivationToken({
      email: "activate.policy@example.com",
      employeeCode: "NV-ACT-4",
    });

    const response = await agent.post("/api/auth/activate-recruiter").send({
      token: rawToken,
      password: "short",
    });

    expect(response.status).toBe(400);

    const persistedUser = await User.findById(user._id).select("+passwordHash");
    const token = await AuthToken.findOne({
      userId: user._id,
      type: AUTH_TOKEN_TYPE.RECRUITER_ACTIVATION,
    });

    expect(persistedUser.mustChangePassword).toBe(true);
    expect(persistedUser.emailVerifiedAt).toBeNull();
    expect(await verifyPassword(DEFAULT_PASSWORD, persistedUser.passwordHash)).toBe(
      true,
    );
    expect(token).not.toBeNull();
  });

  it("after completion clears activation gate for login and business access while F14 still applies (BR-13)", async () => {
    const agent = createTestAgent();
    const { user, company, rawToken } =
      await createPendingRecruiterWithActivationToken({
        email: "activate.access@example.com",
        employeeCode: "NV-ACT-5",
      });

    const beforeLogin = await agent.post("/api/auth/login").send({
      email: user.email,
      password: DEFAULT_PASSWORD,
    });

    expect(beforeLogin.status).toBe(403);

    const activate = await agent.post("/api/auth/activate-recruiter").send({
      token: rawToken,
      password: NEW_PASSWORD,
    });

    expect(activate.status).toBe(200);

    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
      password: NEW_PASSWORD,
    });

    expect(accessToken).toEqual(expect.any(String));

    const businessOk = await agent
      .get("/api/company-staff-access-probe/business")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(businessOk.status).toBe(200);

    await Company.findByIdAndUpdate(company._id, {
      operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
    });

    const businessDenied = await agent
      .get("/api/company-staff-access-probe/business")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(businessDenied.status).toBe(403);
  });
});
