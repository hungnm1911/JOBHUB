import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import mongoose from "mongoose";

import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_STATUS from "../../src/constants/user-status.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import {
  assertSameCompanyTenant,
  resolveCompanyManagerRecruiterManagementContext,
  resolveCompanyStaffBusinessContext,
  resolveCompanyStaffTenant,
} from "../../src/services/company.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  DEFAULT_PASSWORD,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

describe("V3 Slice 02 Company Staff authorization and tenant context", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("resolves tenant from CompanyMember and ignores non-expanding client companyId (F02/BR-07)", async () => {
    const { user, company, membership } =
      await createActiveCompanyManagerContext();

    const tenant = await resolveCompanyStaffTenant({
      userId: user._id,
      clientCompanyId: company._id.toString(),
    });

    expect(tenant.companyId.toString()).toBe(company._id.toString());
    expect(tenant.membership._id.toString()).toBe(membership._id.toString());
    expect(tenant.company._id.toString()).toBe(company._id.toString());
  });

  it("rejects client-supplied companyId that would expand tenant scope (BR-07)", async () => {
    const { user, company } = await createActiveCompanyManagerContext();
    const otherCompanyId = new mongoose.Types.ObjectId();

    await expect(
      resolveCompanyStaffTenant({
        userId: user._id,
        clientCompanyId: otherCompanyId.toString(),
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/not an authorization source/i),
    });

    expect(company._id.toString()).not.toBe(otherCompanyId.toString());
  });

  it("grants Company Manager recruiter-management context when all F14 layers pass (BR-06)", async () => {
    const { user, company, membership } =
      await createActiveCompanyManagerContext();

    const context = await resolveCompanyManagerRecruiterManagementContext({
      user,
    });

    expect(context.companyId.toString()).toBe(company._id.toString());
    expect(context.companyRole).toBe(COMPANY_MEMBER_ROLE.COMPANY_MANAGER);
    expect(context.membership._id.toString()).toBe(membership._id.toString());
  });

  it("denies business access when mustChangePassword is true (BR-13)", async () => {
    const { user } = await createActiveCompanyManagerContext({
      mustChangePassword: true,
      email: "cm.must-change@example.com",
      businessRegistrationNumber: "BRN-V3-MCP-1",
    });

    await expect(
      resolveCompanyStaffBusinessContext({ user }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/Password setup is required/i),
    });
  });

  it("denies business access when platform User is LOCKED even if membership is ACTIVE (BR-22/F15)", async () => {
    const { user, membership } = await createActiveCompanyManagerContext({
      email: "cm.locked@example.com",
      businessRegistrationNumber: "BRN-V3-LOCK-1",
    });

    user.status = USER_STATUS.LOCKED;
    await user.save();

    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);

    await expect(
      resolveCompanyStaffBusinessContext({ user }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/locked/i),
    });
  });

  it("denies business access when Company is LOCKED even if membership is ACTIVE (BR-23/F15)", async () => {
    const { user, company, membership } =
      await createActiveCompanyManagerContext({
        email: "cm.company-locked@example.com",
        businessRegistrationNumber: "BRN-V3-CO-LOCK-1",
      });

    company.operationalStatus = COMPANY_OPERATIONAL_STATUS.LOCKED;
    await company.save();

    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);

    await expect(
      resolveCompanyStaffBusinessContext({ user }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/not available for business access/i),
    });
  });

  it("denies business access when CompanyMember is LOCKED (F14)", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.for-locked-recruiter@example.com",
      businessRegistrationNumber: "BRN-V3-MEM-LOCK-1",
    });
    const { user, membership } = await createActiveRecruiterContext({
      email: "recruiter.locked-membership@example.com",
      company: manager.company,
      membershipStatus: COMPANY_MEMBER_STATUS.LOCKED,
    });

    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);

    await expect(
      resolveCompanyStaffBusinessContext({ user }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/membership is not active/i),
    });
  });

  it("denies business access when Company is not APPROVED + ACTIVE (BR-23)", async () => {
    const { user, company } = await createActiveCompanyManagerContext({
      email: "cm.inactive-company@example.com",
      businessRegistrationNumber: "BRN-V3-INACTIVE-1",
    });

    company.operationalStatus = COMPANY_OPERATIONAL_STATUS.INACTIVE;
    company.activatedAt = null;
    await company.save();

    await expect(
      resolveCompanyStaffBusinessContext({ user }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/not available for business access/i),
    });
  });

  it("allows Recruiter business access when F14 layers pass but rejects recruiter management (BR-24)", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.for-recruiter-authz@example.com",
      businessRegistrationNumber: "BRN-V3-REC-1",
    });
    const { user, company } = await createActiveRecruiterContext({
      email: "recruiter.peer@example.com",
      company: manager.company,
    });

    const businessContext = await resolveCompanyStaffBusinessContext({ user });

    expect(businessContext.companyRole).toBe(COMPANY_MEMBER_ROLE.RECRUITER);
    expect(businessContext.companyId.toString()).toBe(company._id.toString());

    await expect(
      resolveCompanyManagerRecruiterManagementContext({ user }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/Company Manager access required/i),
    });
  });

  it("rejects cross-tenant resource company ids (F02)", () => {
    const tenantCompanyId = new mongoose.Types.ObjectId();
    const otherCompanyId = new mongoose.Types.ObjectId();

    expect(() => {
      assertSameCompanyTenant({
        resourceCompanyId: otherCompanyId,
        tenantCompanyId,
      });
    }).toThrow(/Cross-tenant Company access/i);
  });

  it("HTTP probe grants recruiter-management access from membership tenant only", async () => {
    const agent = createTestAgent();
    const { user, company } = await createActiveCompanyManagerContext({
      email: "cm.probe@example.com",
      businessRegistrationNumber: "BRN-V3-PROBE-1",
    });
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    });

    const allowed = await agent
      .get("/api/company-staff-access-probe/recruiter-management")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(allowed.status).toBe(200);
    expect(allowed.body.authz.companyId).toBe(company._id.toString());
    expect(allowed.body.authz.companyRole).toBe(
      COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    );

    const foreignCompanyId = new mongoose.Types.ObjectId().toString();
    const rejected = await agent
      .get(
        `/api/company-staff-access-probe/recruiter-management?companyId=${foreignCompanyId}`,
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(rejected.status).toBe(403);
    expect(rejected.body.error.message).toMatch(
      /not an authorization source/i,
    );
  });

  it("HTTP probe denies Recruiter recruiter-management while allowing business access", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.probe-rec@example.com",
      businessRegistrationNumber: "BRN-V3-PROBE-REC-1",
    });
    const { user, company } = await createActiveRecruiterContext({
      email: "recruiter.probe@example.com",
      company: manager.company,
    });
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    });

    const business = await agent
      .get("/api/company-staff-access-probe/business")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(business.status).toBe(200);
    expect(business.body.authz.companyId).toBe(company._id.toString());
    expect(business.body.authz.companyRole).toBe(COMPANY_MEMBER_ROLE.RECRUITER);

    const management = await agent
      .get("/api/company-staff-access-probe/recruiter-management")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(management.status).toBe(403);
    expect(management.body.error.message).toMatch(
      /Company Manager access required/i,
    );
  });

  it("HTTP probe denies business access when Company is LOCKED (BR-23)", async () => {
    const agent = createTestAgent();
    const { user, company } = await createActiveCompanyManagerContext({
      email: "cm.probe-locked-co@example.com",
      businessRegistrationNumber: "BRN-V3-PROBE-CO-LOCK",
    });

    company.operationalStatus = COMPANY_OPERATIONAL_STATUS.LOCKED;
    await company.save();

    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get("/api/company-staff-access-probe/business")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(
      /not available for business access/i,
    );
  });

  it("HTTP probe denies business access when mustChangePassword is true (BR-13)", async () => {
    const agent = createTestAgent();
    const { user } = await createActiveCompanyManagerContext({
      email: "cm.probe-mcp@example.com",
      businessRegistrationNumber: "BRN-V3-PROBE-MCP",
      mustChangePassword: true,
    });
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get("/api/company-staff-access-probe/business")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/Password setup is required/i);
  });

  it("does not use approvalStatus alone without ACTIVE operational status", async () => {
    const { user, company } = await createActiveCompanyManagerContext({
      email: "cm.approved-inactive@example.com",
      businessRegistrationNumber: "BRN-V3-APPROVED-INACTIVE",
    });

    expect(company.approvalStatus).toBe(COMPANY_APPROVAL_STATUS.APPROVED);

    company.operationalStatus = COMPANY_OPERATIONAL_STATUS.INACTIVE;
    company.activatedAt = null;
    await company.save();

    const reloaded = await User.findById(user._id);

    await expect(
      resolveCompanyStaffBusinessContext({ user: reloaded }),
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    const membership = await CompanyMember.findOne({ userId: user._id });
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });
});
