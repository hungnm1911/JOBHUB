import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import { resolveCompanyStaffMembership } from "../../src/services/company.service.js";
import { createCompanyStaffWithMembership } from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

describe("CompanyMember persistence and F01 role resolution", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("resolves Company Staff company role from CompanyMember only", async () => {
    const { user, company, membership } = await createCompanyStaffWithMembership({
      email: "staff.f01@example.com",
      status: USER_STATUS.PENDING_ACTIVATION,
    });

    const resolved = await resolveCompanyStaffMembership({ userId: user._id });

    expect(resolved._id.toString()).toBe(membership._id.toString());
    expect(resolved.companyId.toString()).toBe(company._id.toString());
    expect(resolved.role).toBe(COMPANY_MEMBER_ROLE.COMPANY_MANAGER);
    expect(resolved.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
    expect(user.role).toBe(USER_ROLE.COMPANY_STAFF);
  });

  it("enforces one membership per user and one COMPANY_MANAGER per company", async () => {
    const first = await createCompanyStaffWithMembership({
      email: "first.cm@example.com",
    });
    const passwordHash = await User.findById(first.user._id)
      .select("+passwordHash")
      .then((doc) => doc.passwordHash);
    const secondUser = await User.create({
      fullName: "Second Staff",
      email: "second.cm@example.com",
      passwordHash,
      role: USER_ROLE.COMPANY_STAFF,
      status: USER_STATUS.PENDING_ACTIVATION,
      emailVerifiedAt: null,
      mustChangePassword: false,
    });

    await expect(
      CompanyMember.create({
        userId: first.user._id,
        companyId: first.company._id,
        role: COMPANY_MEMBER_ROLE.RECRUITER,
        status: COMPANY_MEMBER_STATUS.ACTIVE,
        employeeCode: "NV001",
        jobTitle: "Recruiter",
      }),
    ).rejects.toMatchObject({ code: 11000 });

    await expect(
      CompanyMember.create({
        userId: secondUser._id,
        companyId: first.company._id,
        role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
        status: COMPANY_MEMBER_STATUS.ACTIVE,
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("rejects COMPANY_MANAGER membership with non-ACTIVE status (BR-26)", async () => {
    const { user, company } = await createCompanyStaffWithMembership({
      email: "cm.active-only@example.com",
    });

    await CompanyMember.deleteOne({ userId: user._id });

    await expect(
      CompanyMember.create({
        userId: user._id,
        companyId: company._id,
        role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
        status: COMPANY_MEMBER_STATUS.LOCKED,
      }),
    ).rejects.toThrow(/ACTIVE/i);
  });

  it("requires employeeCode and jobTitle for RECRUITER membership", async () => {
    const { company } = await createCompanyStaffWithMembership({
      email: "cm.for-recruiter-schema@example.com",
    });
    const recruiter = await User.create({
      fullName: "Recruiter Schema",
      email: "recruiter.schema@example.com",
      passwordHash: "hash",
      role: USER_ROLE.COMPANY_STAFF,
      status: USER_STATUS.ACTIVE,
      emailVerifiedAt: new Date(),
      mustChangePassword: true,
    });

    await expect(
      CompanyMember.create({
        userId: recruiter._id,
        companyId: company._id,
        role: COMPANY_MEMBER_ROLE.RECRUITER,
        status: COMPANY_MEMBER_STATUS.ACTIVE,
      }),
    ).rejects.toThrow(/employeeCode|jobTitle/i);
  });
});
