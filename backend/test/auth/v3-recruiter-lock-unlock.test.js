import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthSession from "../../src/models/auth-session.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
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

describe("V3 Slice 07 Recruiter lock and unlock (F11/F12/TX-04)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("locks ACTIVE→LOCKED same-tenant Recruiter and revokes sessions atomically (F11/BR-16/BR-17/TX-04)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.lock@example.com",
      businessRegistrationNumber: "BRN-V3-LOCK-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "lock.target@example.com",
      company: manager.company,
      employeeCode: "NV-LOCK-1",
    });
    const { session } = await createSessionWithRefreshToken(recruiter.user);
    const secondSession = await createSessionWithRefreshToken(recruiter.user);
    const companyBefore = await Company.findById(manager.company._id);
    const userBefore = await User.findById(recruiter.user._id);

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/company/recruiters/${recruiter.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/recruiter locked/i);
    expect(response.body.recruiter.membership.status).toBe(
      COMPANY_MEMBER_STATUS.LOCKED,
    );
    expect(response.body.recruiter.status).toBe(USER_STATUS.ACTIVE);

    const persistedMembership = await CompanyMember.findById(
      recruiter.membership._id,
    );
    const persistedUser = await User.findById(recruiter.user._id);
    const persistedCompany = await Company.findById(manager.company._id);
    const sessions = await AuthSession.find({ userId: recruiter.user._id });

    expect(persistedMembership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
    expect(persistedUser.status).toBe(userBefore.status);
    expect(persistedUser.mustChangePassword).toBe(userBefore.mustChangePassword);
    expect(persistedCompany.operationalStatus).toBe(
      companyBefore.operationalStatus,
    );
    expect(persistedCompany.approvalStatus).toBe(companyBefore.approvalStatus);
    expect(sessions).toHaveLength(0);
    expect(await AuthSession.findById(session._id)).toBeNull();
    expect(await AuthSession.findById(secondSession.session._id)).toBeNull();

    const recruiterLogin = await agent.post("/api/auth/login").send({
      email: "lock.target@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(recruiterLogin.status).toBe(200);

    const business = await agent
      .get("/api/company-staff-access-probe/business")
      .set("Authorization", `Bearer ${recruiterLogin.body.accessToken}`);

    expect(business.status).toBe(403);
  });

  it("unlocks LOCKED→ACTIVE without restoring sessions (F12/BR-18)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.unlock@example.com",
      businessRegistrationNumber: "BRN-V3-LOCK-2",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "unlock.target@example.com",
      company: manager.company,
      employeeCode: "NV-LOCK-2",
    });
    const { session } = await createSessionWithRefreshToken(recruiter.user);

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const lock = await agent
      .post(`/api/company/recruiters/${recruiter.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(lock.status).toBe(200);
    expect(await AuthSession.findById(session._id)).toBeNull();

    const unlock = await agent
      .post(`/api/company/recruiters/${recruiter.user._id.toString()}/unlock`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(unlock.status).toBe(200);
    expect(unlock.body.message).toMatch(/recruiter unlocked/i);
    expect(unlock.body.recruiter.membership.status).toBe(
      COMPANY_MEMBER_STATUS.ACTIVE,
    );

    const persistedMembership = await CompanyMember.findById(
      recruiter.membership._id,
    );
    const sessions = await AuthSession.find({ userId: recruiter.user._id });

    expect(persistedMembership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
    expect(sessions).toHaveLength(0);
    expect(await AuthSession.findById(session._id)).toBeNull();

    const recruiterLogin = await agent.post("/api/auth/login").send({
      email: "unlock.target@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(recruiterLogin.status).toBe(200);

    const business = await agent
      .get("/api/company-staff-access-probe/business")
      .set("Authorization", `Bearer ${recruiterLogin.body.accessToken}`);

    expect(business.status).toBe(200);
  });

  it("rejects cross-tenant lock/unlock and invalid source states", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.reject@example.com",
      businessRegistrationNumber: "BRN-V3-LOCK-3",
    });
    const otherManager = await createActiveCompanyManagerContext({
      email: "cm.reject-other@example.com",
      businessRegistrationNumber: "BRN-V3-LOCK-4",
      name: "Other Lock Co",
    });
    const active = await createActiveRecruiterContext({
      email: "active.lock-reject@example.com",
      company: manager.company,
      employeeCode: "NV-LOCK-3A",
    });
    const locked = await createActiveRecruiterContext({
      email: "locked.lock-reject@example.com",
      company: manager.company,
      employeeCode: "NV-LOCK-3B",
      membershipStatus: COMPANY_MEMBER_STATUS.LOCKED,
    });
    const terminated = await createActiveRecruiterContext({
      email: "terminated.lock-reject@example.com",
      company: manager.company,
      employeeCode: "NV-LOCK-3C",
      membershipStatus: COMPANY_MEMBER_STATUS.TERMINATED,
    });
    const foreign = await createActiveRecruiterContext({
      email: "foreign.lock-reject@example.com",
      company: otherManager.company,
      employeeCode: "NV-LOCK-3D",
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const lockAlreadyLocked = await agent
      .post(`/api/company/recruiters/${locked.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${accessToken}`);
    const lockTerminated = await agent
      .post(`/api/company/recruiters/${terminated.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${accessToken}`);
    const lockForeign = await agent
      .post(`/api/company/recruiters/${foreign.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${accessToken}`);
    const unlockActive = await agent
      .post(`/api/company/recruiters/${active.user._id.toString()}/unlock`)
      .set("Authorization", `Bearer ${accessToken}`);
    const unlockTerminated = await agent
      .post(`/api/company/recruiters/${terminated.user._id.toString()}/unlock`)
      .set("Authorization", `Bearer ${accessToken}`);
    const unlockForeign = await agent
      .post(`/api/company/recruiters/${foreign.user._id.toString()}/unlock`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(lockAlreadyLocked.status).toBe(409);
    expect(lockTerminated.status).toBe(409);
    expect(lockForeign.status).toBe(404);
    expect(unlockActive.status).toBe(409);
    expect(unlockTerminated.status).toBe(409);
    expect(unlockForeign.status).toBe(404);

    expect(
      (await CompanyMember.findById(locked.membership._id)).status,
    ).toBe(COMPANY_MEMBER_STATUS.LOCKED);
    expect(
      (await CompanyMember.findById(terminated.membership._id)).status,
    ).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
    expect(
      (await CompanyMember.findById(active.membership._id)).status,
    ).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
    expect(
      (await CompanyMember.findById(foreign.membership._id)).status,
    ).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("rejects unlock when User is platform-restricted (BR-22)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.platform-restrict@example.com",
      businessRegistrationNumber: "BRN-V3-LOCK-5",
    });
    const lockedUserRecruiter = await createActiveRecruiterContext({
      email: "platform.locked@example.com",
      company: manager.company,
      employeeCode: "NV-LOCK-5A",
      membershipStatus: COMPANY_MEMBER_STATUS.LOCKED,
    });
    const terminatedUserRecruiter = await createActiveRecruiterContext({
      email: "platform.terminated@example.com",
      company: manager.company,
      employeeCode: "NV-LOCK-5B",
      membershipStatus: COMPANY_MEMBER_STATUS.LOCKED,
    });

    lockedUserRecruiter.user.status = USER_STATUS.LOCKED;
    await lockedUserRecruiter.user.save();
    terminatedUserRecruiter.user.status = USER_STATUS.TERMINATED;
    await terminatedUserRecruiter.user.save();

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const unlockLockedUser = await agent
      .post(
        `/api/company/recruiters/${lockedUserRecruiter.user._id.toString()}/unlock`,
      )
      .set("Authorization", `Bearer ${accessToken}`);
    const unlockTerminatedUser = await agent
      .post(
        `/api/company/recruiters/${terminatedUserRecruiter.user._id.toString()}/unlock`,
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(unlockLockedUser.status).toBe(403);
    expect(unlockTerminatedUser.status).toBe(403);
    expect(
      (await CompanyMember.findById(lockedUserRecruiter.membership._id)).status,
    ).toBe(COMPANY_MEMBER_STATUS.LOCKED);
    expect(
      (await CompanyMember.findById(terminatedUserRecruiter.membership._id))
        .status,
    ).toBe(COMPANY_MEMBER_STATUS.LOCKED);
    expect(
      (await User.findById(lockedUserRecruiter.user._id)).status,
    ).toBe(USER_STATUS.LOCKED);
    expect(
      (await User.findById(terminatedUserRecruiter.user._id)).status,
    ).toBe(USER_STATUS.TERMINATED);
  });

  it("unlock does not bypass Company-level restriction after membership returns ACTIVE (BR-23)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.company-restrict@example.com",
      businessRegistrationNumber: "BRN-V3-LOCK-6",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "company.restrict@example.com",
      company: manager.company,
      employeeCode: "NV-LOCK-6",
      membershipStatus: COMPANY_MEMBER_STATUS.LOCKED,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const unlock = await agent
      .post(`/api/company/recruiters/${recruiter.user._id.toString()}/unlock`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(unlock.status).toBe(200);
    expect(unlock.body.recruiter.membership.status).toBe(
      COMPANY_MEMBER_STATUS.ACTIVE,
    );

    await Company.findByIdAndUpdate(manager.company._id, {
      operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
    });

    const recruiterLogin = await agent.post("/api/auth/login").send({
      email: "company.restrict@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(recruiterLogin.status).toBe(200);

    const business = await agent
      .get("/api/company-staff-access-probe/business")
      .set("Authorization", `Bearer ${recruiterLogin.body.accessToken}`);

    expect(business.status).toBe(403);
    expect(
      (await CompanyMember.findById(recruiter.membership._id)).status,
    ).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
    expect(
      (await Company.findById(manager.company._id)).operationalStatus,
    ).toBe(COMPANY_OPERATIONAL_STATUS.LOCKED);
  });
});
