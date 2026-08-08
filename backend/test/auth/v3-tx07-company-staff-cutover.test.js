import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import {
  migrate,
  verify,
} from "../../src/database/migrations/v3-tx07-company-manager-to-company-staff.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import User from "../../src/models/user.model.js";
import { hashPassword } from "../../src/utils/hash-password.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const LEGACY_COMPANY_MANAGER_ROLE = "COMPANY_MANAGER";

const seedLegacyV2CompanyManagerPair = async ({
  email = "legacy.manager@example.com",
} = {}) => {
  const passwordHash = await hashPassword("password123");
  const managerId = new mongoose.Types.ObjectId();
  const companyId = new mongoose.Types.ObjectId();
  const now = new Date();

  await mongoose.connection.db.collection("users").insertOne({
    _id: managerId,
    fullName: "Legacy Manager",
    email,
    passwordHash,
    role: LEGACY_COMPANY_MANAGER_ROLE,
    status: USER_STATUS.PENDING_ACTIVATION,
    emailVerifiedAt: null,
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
  });

  await mongoose.connection.db.collection("companies").insertOne({
    _id: companyId,
    managerUserId: managerId,
    name: null,
    approvalStatus: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
    reviewSnapshot: null,
    submittedAt: null,
    reviewedByUserId: null,
    reviewedAt: null,
    activatedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    companyId,
    managerId,
  };
};

describe("TX-07 V2 Company Manager cutover migration", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("migrates legacy managerUserId pairs to COMPANY_STAFF + CompanyMember and removes managerUserId", async () => {
    const { companyId, managerId } = await seedLegacyV2CompanyManagerPair();

    const result = await migrate(mongoose.connection);

    expect(result.migratedCount).toBe(1);

    await verify(mongoose.connection);

    const user = await User.findById(managerId);
    const company = await Company.findById(companyId);
    const membership = await CompanyMember.findOne({
      userId: managerId,
      companyId,
    });
    const rawCompany = await mongoose.connection.db
      .collection("companies")
      .findOne({ _id: companyId });

    expect(user.role).toBe(USER_ROLE.COMPANY_STAFF);
    expect(user.status).toBe(USER_STATUS.PENDING_ACTIVATION);
    expect(membership).not.toBeNull();
    expect(membership.role).toBe(COMPANY_MEMBER_ROLE.COMPANY_MANAGER);
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
    expect(company).not.toBeNull();
    expect(rawCompany.managerUserId).toBeUndefined();
  });

  it("keeps exactly-one manager and no COMPANY_STAFF-without-membership invariants after cutover", async () => {
    await seedLegacyV2CompanyManagerPair({
      email: "legacy.a@example.com",
    });
    await seedLegacyV2CompanyManagerPair({
      email: "legacy.b@example.com",
    });

    await migrate(mongoose.connection);
    await verify(mongoose.connection);

    const staffCount = await User.countDocuments({
      role: USER_ROLE.COMPANY_STAFF,
    });
    const membershipCount = await CompanyMember.countDocuments({
      role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    });
    const companyCount = await Company.countDocuments();

    expect(staffCount).toBe(2);
    expect(membershipCount).toBe(2);
    expect(companyCount).toBe(2);
  });
});
