import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
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

describe("V3 Slice 08 Recruiter termination and historical retention (F13/F16/TX-05)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("terminates ACTIVE→TERMINATED with session revoke and identity retention (F13/F16/BR-19/BR-21/TX-05)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.terminate-active@example.com",
      businessRegistrationNumber: "BRN-V3-TERM-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "terminate.active@example.com",
      company: manager.company,
      employeeCode: "NV-TERM-1",
      jobTitle: "Talent Sourcer",
    });
    const { session } = await createSessionWithRefreshToken(recruiter.user);
    await createSessionWithRefreshToken(recruiter.user);

    const companyBefore = await Company.findById(manager.company._id);
    const userBefore = await User.findById(recruiter.user._id);
    const membershipBefore = await CompanyMember.findById(
      recruiter.membership._id,
    );

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(
        `/api/company/recruiters/${recruiter.user._id.toString()}/terminate`,
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/recruiter terminated/i);
    expect(response.body.recruiter.membership.status).toBe(
      COMPANY_MEMBER_STATUS.TERMINATED,
    );
    expect(response.body.recruiter.status).toBe(USER_STATUS.ACTIVE);
    expect(response.body.recruiter.email).toBe("terminate.active@example.com");
    expect(response.body.recruiter.membership.employeeCode).toBe("NV-TERM-1");
    expect(response.body.recruiter.membership.jobTitle).toBe("Talent Sourcer");

    const persistedUser = await User.findById(recruiter.user._id);
    const persistedMembership = await CompanyMember.findById(
      recruiter.membership._id,
    );
    const persistedCompany = await Company.findById(manager.company._id);
    const sessions = await AuthSession.find({ userId: recruiter.user._id });

    expect(persistedUser).not.toBeNull();
    expect(persistedMembership).not.toBeNull();
    expect(persistedUser.status).toBe(userBefore.status);
    expect(persistedUser.email).toBe(userBefore.email);
    expect(persistedUser.fullName).toBe(userBefore.fullName);
    expect(persistedMembership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
    expect(persistedMembership.employeeCode).toBe(
      membershipBefore.employeeCode,
    );
    expect(persistedMembership.jobTitle).toBe(membershipBefore.jobTitle);
    expect(persistedMembership.companyId.toString()).toBe(
      manager.company._id.toString(),
    );
    expect(persistedMembership.userId.toString()).toBe(
      recruiter.user._id.toString(),
    );
    expect(persistedCompany.operationalStatus).toBe(
      companyBefore.operationalStatus,
    );
    expect(persistedCompany.approvalStatus).toBe(companyBefore.approvalStatus);
    expect(sessions).toHaveLength(0);
    expect(await AuthSession.findById(session._id)).toBeNull();

    const detail = await agent
      .get(`/api/company/recruiters/${recruiter.user._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(detail.status).toBe(200);
    expect(detail.body.recruiter.membership.status).toBe(
      COMPANY_MEMBER_STATUS.TERMINATED,
    );
    expect(detail.body.recruiter.email).toBe("terminate.active@example.com");
  });

  it("terminates LOCKED→TERMINATED with session revoke (F13/BR-19/TX-05)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.terminate-locked@example.com",
      businessRegistrationNumber: "BRN-V3-TERM-2",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "terminate.locked@example.com",
      company: manager.company,
      employeeCode: "NV-TERM-2",
      membershipStatus: COMPANY_MEMBER_STATUS.LOCKED,
    });
    const { session } = await createSessionWithRefreshToken(recruiter.user);

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(
        `/api/company/recruiters/${recruiter.user._id.toString()}/terminate`,
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(
      COMPANY_MEMBER_STATUS.TERMINATED,
    );
    expect(await AuthSession.findById(session._id)).toBeNull();
    expect(
      await AuthSession.countDocuments({ userId: recruiter.user._id }),
    ).toBe(0);
    expect(
      (await CompanyMember.findById(recruiter.membership._id)).status,
    ).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
    expect((await User.findById(recruiter.user._id)).status).toBe(
      USER_STATUS.ACTIVE,
    );
  });

  it("rejects cross-tenant terminate and already-TERMINATED targets", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.terminate-reject@example.com",
      businessRegistrationNumber: "BRN-V3-TERM-3",
    });
    const otherManager = await createActiveCompanyManagerContext({
      email: "cm.terminate-other@example.com",
      businessRegistrationNumber: "BRN-V3-TERM-4",
      name: "Other Terminate Co",
    });
    const terminated = await createActiveRecruiterContext({
      email: "already.terminated@example.com",
      company: manager.company,
      employeeCode: "NV-TERM-3A",
      membershipStatus: COMPANY_MEMBER_STATUS.TERMINATED,
    });
    const foreign = await createActiveRecruiterContext({
      email: "foreign.terminate@example.com",
      company: otherManager.company,
      employeeCode: "NV-TERM-3B",
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const alreadyTerminated = await agent
      .post(
        `/api/company/recruiters/${terminated.user._id.toString()}/terminate`,
      )
      .set("Authorization", `Bearer ${accessToken}`);
    const foreignTerminate = await agent
      .post(`/api/company/recruiters/${foreign.user._id.toString()}/terminate`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(alreadyTerminated.status).toBe(409);
    expect(foreignTerminate.status).toBe(404);
    expect(
      (await CompanyMember.findById(terminated.membership._id)).status,
    ).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
    expect(
      (await CompanyMember.findById(foreign.membership._id)).status,
    ).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("keeps TERMINATED terminal and blocks lock/unlock/second terminate (BR-19)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.terminal@example.com",
      businessRegistrationNumber: "BRN-V3-TERM-5",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "terminal.state@example.com",
      company: manager.company,
      employeeCode: "NV-TERM-5",
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const terminate = await agent
      .post(
        `/api/company/recruiters/${recruiter.user._id.toString()}/terminate`,
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(terminate.status).toBe(200);

    const lock = await agent
      .post(`/api/company/recruiters/${recruiter.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${accessToken}`);
    const unlock = await agent
      .post(`/api/company/recruiters/${recruiter.user._id.toString()}/unlock`)
      .set("Authorization", `Bearer ${accessToken}`);
    const secondTerminate = await agent
      .post(
        `/api/company/recruiters/${recruiter.user._id.toString()}/terminate`,
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(lock.status).toBe(409);
    expect(unlock.status).toBe(409);
    expect(secondTerminate.status).toBe(409);
    expect(
      (await CompanyMember.findById(recruiter.membership._id)).status,
    ).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
  });

  it("retains email for history and rejects reuse for a new Recruiter (BR-20/F16)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.email-retain@example.com",
      businessRegistrationNumber: "BRN-V3-TERM-6",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "retain.email@example.com",
      fullName: "Historical Recruiter",
      company: manager.company,
      employeeCode: "NV-TERM-6",
      jobTitle: "Campus Recruiter",
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const terminate = await agent
      .post(
        `/api/company/recruiters/${recruiter.user._id.toString()}/terminate`,
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(terminate.status).toBe(200);

    const recreate = await agent
      .post("/api/company/recruiters")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "New Hire",
        email: "retain.email@example.com",
        employeeCode: "NV-TERM-6B",
        jobTitle: "Recruiter",
      });

    expect(recreate.status).toBe(409);
    expect(recreate.body.error.message).toMatch(/email/i);

    const persistedUser = await User.findById(recruiter.user._id);
    const persistedMembership = await CompanyMember.findById(
      recruiter.membership._id,
    );

    expect(persistedUser.email).toBe("retain.email@example.com");
    expect(persistedUser.fullName).toBe("Historical Recruiter");
    expect(persistedMembership.employeeCode).toBe("NV-TERM-6");
    expect(persistedMembership.jobTitle).toBe("Campus Recruiter");
    expect(persistedMembership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
    expect(await User.countDocuments({ email: "retain.email@example.com" })).toBe(
      1,
    );
  });
});
