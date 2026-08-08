import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import mongoose from "mongoose";

import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Company from "../../src/models/company.model.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
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

const assertRecruiterProjection = (recruiter) => {
  expect(recruiter).toMatchObject({
    id: expect.any(String),
    fullName: expect.any(String),
    email: expect.any(String),
    role: USER_ROLE.COMPANY_STAFF,
    status: expect.any(String),
    mustChangePassword: expect.any(Boolean),
    membership: {
      id: expect.any(String),
      companyId: expect.any(String),
      role: COMPANY_MEMBER_ROLE.RECRUITER,
      status: expect.any(String),
      employeeCode: expect.any(String),
      jobTitle: expect.any(String),
    },
  });
  expect(recruiter).not.toHaveProperty("password");
  expect(recruiter).not.toHaveProperty("passwordHash");
  expect(recruiter).not.toHaveProperty("token");
  expect(recruiter).not.toHaveProperty("tokenHash");
  expect(recruiter).not.toHaveProperty("refreshToken");
  expect(recruiter).not.toHaveProperty("sessions");
  expect(JSON.stringify(recruiter)).not.toMatch(/passwordHash|tokenHash|refreshToken/i);
};

describe("V3 Slice 05 Recruiter list and detail (F08/F09)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("lists only Recruiters in the CM membership tenant with management fields (F08/BR-06/BR-07)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.list@example.com",
      businessRegistrationNumber: "BRN-V3-LIST-1",
    });
    const otherManager = await createActiveCompanyManagerContext({
      email: "cm.list-other@example.com",
      businessRegistrationNumber: "BRN-V3-LIST-2",
      name: "Other Co",
    });

    const first = await createActiveRecruiterContext({
      email: "list.one@example.com",
      company: manager.company,
      employeeCode: "NV-L1",
      jobTitle: "Sourcer",
      fullName: "List One",
    });
    const pending = await createPendingRecruiterWithActivationToken({
      email: "list.pending@example.com",
      company: manager.company,
      employeeCode: "NV-L2",
      jobTitle: "Coordinator",
      fullName: "List Pending",
    });
    const locked = await createActiveRecruiterContext({
      email: "list.locked@example.com",
      company: manager.company,
      employeeCode: "NV-L3",
      jobTitle: "Sourcer",
      fullName: "List Locked",
      membershipStatus: COMPANY_MEMBER_STATUS.LOCKED,
    });
    await createActiveRecruiterContext({
      email: "list.foreign@example.com",
      company: otherManager.company,
      employeeCode: "NV-FOREIGN",
      fullName: "Foreign Recruiter",
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get("/api/company/recruiters")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/recruiters retrieved/i);
    expect(response.body.recruiters).toHaveLength(3);

    const emails = response.body.recruiters.map((item) => item.email).sort();
    expect(emails).toEqual([
      "list.locked@example.com",
      "list.one@example.com",
      "list.pending@example.com",
    ]);

    for (const recruiter of response.body.recruiters) {
      assertRecruiterProjection(recruiter);
      expect(recruiter.membership.companyId).toBe(manager.company._id.toString());
    }

    const byEmail = Object.fromEntries(
      response.body.recruiters.map((item) => [item.email, item]),
    );

    expect(byEmail["list.one@example.com"]).toMatchObject({
      id: first.user._id.toString(),
      fullName: "List One",
      status: USER_STATUS.ACTIVE,
      mustChangePassword: false,
      membership: {
        employeeCode: "NV-L1",
        jobTitle: "Sourcer",
        status: COMPANY_MEMBER_STATUS.ACTIVE,
      },
    });
    expect(byEmail["list.pending@example.com"]).toMatchObject({
      id: pending.user._id.toString(),
      emailVerifiedAt: null,
      mustChangePassword: true,
      membership: {
        employeeCode: "NV-L2",
        status: COMPANY_MEMBER_STATUS.ACTIVE,
      },
    });
    expect(byEmail["list.locked@example.com"]).toMatchObject({
      id: locked.user._id.toString(),
      membership: {
        employeeCode: "NV-L3",
        status: COMPANY_MEMBER_STATUS.LOCKED,
      },
    });
  });

  it("returns same-tenant Recruiter detail and rejects cross-tenant or non-Recruiter targets (F09/BR-07/BR-29)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.detail@example.com",
      businessRegistrationNumber: "BRN-V3-DETAIL-1",
    });
    const otherManager = await createActiveCompanyManagerContext({
      email: "cm.detail-other@example.com",
      businessRegistrationNumber: "BRN-V3-DETAIL-2",
      name: "Detail Other Co",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "detail.target@example.com",
      company: manager.company,
      employeeCode: "NV-D1",
      jobTitle: "Talent Partner",
      fullName: "Detail Target",
    });
    const foreign = await createActiveRecruiterContext({
      email: "detail.foreign@example.com",
      company: otherManager.company,
      employeeCode: "NV-D-FOREIGN",
      fullName: "Detail Foreign",
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const detail = await agent
      .get(`/api/company/recruiters/${recruiter.user._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(detail.status).toBe(200);
    expect(detail.body.message).toMatch(/recruiter retrieved/i);
    assertRecruiterProjection(detail.body.recruiter);
    expect(detail.body.recruiter).toMatchObject({
      id: recruiter.user._id.toString(),
      fullName: "Detail Target",
      email: "detail.target@example.com",
      status: USER_STATUS.ACTIVE,
      membership: {
        companyId: manager.company._id.toString(),
        role: COMPANY_MEMBER_ROLE.RECRUITER,
        status: COMPANY_MEMBER_STATUS.ACTIVE,
        employeeCode: "NV-D1",
        jobTitle: "Talent Partner",
      },
    });

    const crossTenant = await agent
      .get(`/api/company/recruiters/${foreign.user._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(crossTenant.status).toBe(404);

    const nonRecruiter = await agent
      .get(`/api/company/recruiters/${manager.user._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(nonRecruiter.status).toBe(404);

    const invalidId = await agent
      .get("/api/company/recruiters/not-an-object-id")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(invalidId.status).toBe(400);
  });

  it("rejects client companyId expansion and Recruiter actors (BR-06/BR-07/BR-23)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.authz-list@example.com",
      businessRegistrationNumber: "BRN-V3-LIST-AUTHZ-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "authz.list.recruiter@example.com",
      company: manager.company,
      employeeCode: "NV-AUTHZ-L",
    });

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const withForeignCompany = await agent
      .get(
        `/api/company/recruiters?companyId=${new mongoose.Types.ObjectId().toString()}`,
      )
      .set("Authorization", `Bearer ${managerToken}`);

    expect(withForeignCompany.status).toBe(403);
    expect(withForeignCompany.body.error.message).toMatch(
      /not an authorization source/i,
    );

    const recruiterList = await agent
      .get("/api/company/recruiters")
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(recruiterList.status).toBe(403);
    expect(recruiterList.body.error.message).toMatch(
      /Company Manager access required/i,
    );

    const recruiterDetail = await agent
      .get(`/api/company/recruiters/${recruiter.user._id.toString()}`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(recruiterDetail.status).toBe(403);

    await Company.findByIdAndUpdate(manager.company._id, {
      operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
    });

    const lockedCompany = await agent
      .get("/api/company/recruiters")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(lockedCompany.status).toBe(403);
  });
});
