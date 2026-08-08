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

const seedLegacyUser = async ({
  email,
  role = LEGACY_COMPANY_MANAGER_ROLE,
  userId = new mongoose.Types.ObjectId(),
} = {}) => {
  const passwordHash = await hashPassword("password123");
  const now = new Date();

  await mongoose.connection.db.collection("users").insertOne({
    _id: userId,
    fullName: "Legacy Manager",
    email,
    passwordHash,
    role,
    status: USER_STATUS.PENDING_ACTIVATION,
    emailVerifiedAt: null,
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
  });

  return userId;
};

const seedLegacyCompany = async ({
  managerId,
  companyId = new mongoose.Types.ObjectId(),
} = {}) => {
  const now = new Date();

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

  return companyId;
};

const seedLegacyV2CompanyManagerPair = async ({
  email = "legacy.manager@example.com",
  managerId = new mongoose.Types.ObjectId(),
  companyId = new mongoose.Types.ObjectId(),
  role = LEGACY_COMPANY_MANAGER_ROLE,
} = {}) => {
  await seedLegacyUser({ email, userId: managerId, role });
  await seedLegacyCompany({ managerId, companyId });

  return {
    companyId,
    managerId,
  };
};

const seedCompanyManagerMembership = async ({
  companyId,
  userId,
  status = COMPANY_MEMBER_STATUS.ACTIVE,
}) => {
  const now = new Date();

  await mongoose.connection.db.collection("companymembers").insertOne({
    userId,
    companyId,
    role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    status,
    employeeCode: null,
    jobTitle: null,
    createdAt: now,
    updatedAt: now,
  });
};

const countCompaniesWithManagerUserId = async () => {
  return mongoose.connection.db.collection("companies").countDocuments({
    managerUserId: { $exists: true },
  });
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

  it("fails when the legacy manager User is missing and keeps managerUserId", async () => {
    const missingManagerId = new mongoose.Types.ObjectId();
    const companyId = await seedLegacyCompany({ managerId: missingManagerId });

    await expect(migrate(mongoose.connection)).rejects.toThrow(
      /legacy manager user .* is missing/i,
    );

    const rawCompany = await mongoose.connection.db
      .collection("companies")
      .findOne({ _id: companyId });
    const pairMembership = await mongoose.connection.db
      .collection("companymembers")
      .findOne({ companyId, userId: missingManagerId });

    expect(rawCompany.managerUserId).toEqual(missingManagerId);
    expect(pairMembership).toBeNull();
    expect(await countCompaniesWithManagerUserId()).toBe(1);
  });

  it("fails when the legacy manager User has an invalid role and keeps managerUserId", async () => {
    const { companyId, managerId } = await seedLegacyV2CompanyManagerPair({
      email: "wrong.role@example.com",
      role: USER_ROLE.CANDIDATE,
    });

    await expect(migrate(mongoose.connection)).rejects.toThrow(
      /invalid role/i,
    );

    const legacyManager = await mongoose.connection.db
      .collection("users")
      .findOne({ _id: managerId });
    const rawCompany = await mongoose.connection.db
      .collection("companies")
      .findOne({ _id: companyId });
    const pairMembership = await mongoose.connection.db
      .collection("companymembers")
      .findOne({ companyId, userId: managerId });

    expect(legacyManager.role).toBe(USER_ROLE.CANDIDATE);
    expect(rawCompany.managerUserId).toEqual(managerId);
    expect(pairMembership).toBeNull();
    expect(await countCompaniesWithManagerUserId()).toBe(1);
  });

  it("rejects cutover when an existing COMPANY_MANAGER membership is not the legacy managerUserId pair", async () => {
    const { companyId, managerId } = await seedLegacyV2CompanyManagerPair({
      email: "legacy.pair@example.com",
    });
    const wrongManagerId = await seedLegacyUser({
      email: "wrong.manager@example.com",
    });

    await seedCompanyManagerMembership({
      companyId,
      userId: wrongManagerId,
    });

    await expect(migrate(mongoose.connection)).rejects.toThrow(
      /legacy Company–Manager pair/i,
    );

    const rawCompany = await mongoose.connection.db
      .collection("companies")
      .findOne({ _id: companyId });
    const legacyManager = await mongoose.connection.db
      .collection("users")
      .findOne({ _id: managerId });
    const pairMembership = await mongoose.connection.db
      .collection("companymembers")
      .findOne({ companyId, userId: managerId });

    expect(rawCompany.managerUserId).toEqual(managerId);
    expect(legacyManager.role).toBe(LEGACY_COMPANY_MANAGER_ROLE);
    expect(pairMembership).toBeNull();
    expect(await countCompaniesWithManagerUserId()).toBe(1);
  });

  it("fails verification for orphan COMPANY_MANAGER users and blocks managerUserId removal", async () => {
    const { companyId, managerId } = await seedLegacyV2CompanyManagerPair({
      email: "legacy.pair@example.com",
    });
    const orphanId = await seedLegacyUser({
      email: "orphan.manager@example.com",
    });

    await expect(migrate(mongoose.connection)).rejects.toThrow(
      /TX-07 verification failed: .*COMPANY_MANAGER/i,
    );

    const orphan = await mongoose.connection.db
      .collection("users")
      .findOne({ _id: orphanId });
    const rawCompany = await mongoose.connection.db
      .collection("companies")
      .findOne({ _id: companyId });
    const pairMembership = await mongoose.connection.db
      .collection("companymembers")
      .findOne({ companyId, userId: managerId });
    const legacyManager = await mongoose.connection.db
      .collection("users")
      .findOne({ _id: managerId });

    expect(orphan.role).toBe(LEGACY_COMPANY_MANAGER_ROLE);
    expect(rawCompany.managerUserId).toEqual(managerId);
    expect(pairMembership).not.toBeNull();
    expect(pairMembership.role).toBe(COMPANY_MEMBER_ROLE.COMPANY_MANAGER);
    expect(legacyManager.role).toBe(USER_ROLE.COMPANY_STAFF);
    expect(await countCompaniesWithManagerUserId()).toBe(1);
  });

  it("does not complete global cutover when one persistence unit fails and keeps all managerUserId values", async () => {
    const healthy = await seedLegacyV2CompanyManagerPair({
      email: "healthy.manager@example.com",
    });
    const conflicted = await seedLegacyV2CompanyManagerPair({
      email: "conflicted.manager@example.com",
    });
    const wrongManagerId = await seedLegacyUser({
      email: "conflict.other@example.com",
    });

    await seedCompanyManagerMembership({
      companyId: conflicted.companyId,
      userId: wrongManagerId,
    });

    await expect(migrate(mongoose.connection)).rejects.toThrow(
      /legacy Company–Manager pair/i,
    );

    const healthyCompany = await mongoose.connection.db
      .collection("companies")
      .findOne({ _id: healthy.companyId });
    const conflictedCompany = await mongoose.connection.db
      .collection("companies")
      .findOne({ _id: conflicted.companyId });

    expect(healthyCompany.managerUserId).toEqual(healthy.managerId);
    expect(conflictedCompany.managerUserId).toEqual(conflicted.managerId);
    expect(await countCompaniesWithManagerUserId()).toBe(2);

    await expect(verify(mongoose.connection)).rejects.toThrow(
      /still have managerUserId/i,
    );
  });

  it("blocks managerUserId removal when a COMPANY_MANAGER membership points to a non-COMPANY_STAFF user", async () => {
    const { companyId, managerId } = await seedLegacyV2CompanyManagerPair({
      email: "legacy.valid@example.com",
    });
    const nonStaffCompanyId = new mongoose.Types.ObjectId();
    const nonStaffUserId = await seedLegacyUser({
      email: "non.staff.member@example.com",
      role: USER_ROLE.CANDIDATE,
    });

    await mongoose.connection.db.collection("companies").insertOne({
      _id: nonStaffCompanyId,
      name: null,
      approvalStatus: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
      reviewSnapshot: null,
      submittedAt: null,
      reviewedByUserId: null,
      reviewedAt: null,
      activatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await seedCompanyManagerMembership({
      companyId: nonStaffCompanyId,
      userId: nonStaffUserId,
    });

    await expect(migrate(mongoose.connection)).rejects.toThrow(
      /does not point to a COMPANY_STAFF user/i,
    );

    const rawCompany = await mongoose.connection.db
      .collection("companies")
      .findOne({ _id: companyId });
    const legacyManager = await mongoose.connection.db
      .collection("users")
      .findOne({ _id: managerId });

    expect(rawCompany.managerUserId).toEqual(managerId);
    expect(legacyManager.role).toBe(USER_ROLE.COMPANY_STAFF);
    expect(await countCompaniesWithManagerUserId()).toBe(1);
  });

  it("is idempotent when the exact legacy pair membership already exists", async () => {
    const { companyId, managerId } = await seedLegacyV2CompanyManagerPair({
      email: "legacy.idempotent@example.com",
    });

    await seedCompanyManagerMembership({
      companyId,
      userId: managerId,
    });

    const result = await migrate(mongoose.connection);

    expect(result.migratedCount).toBe(1);

    await verify(mongoose.connection);

    const membershipCount = await CompanyMember.countDocuments({
      companyId,
      userId: managerId,
      role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    });
    const user = await User.findById(managerId);
    const rawCompany = await mongoose.connection.db
      .collection("companies")
      .findOne({ _id: companyId });

    expect(membershipCount).toBe(1);
    expect(user.role).toBe(USER_ROLE.COMPANY_STAFF);
    expect(rawCompany.managerUserId).toBeUndefined();
    expect(await countCompaniesWithManagerUserId()).toBe(0);
  });
});
