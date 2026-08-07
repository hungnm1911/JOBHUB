import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Company from "../../src/models/company.model.js";
import User from "../../src/models/user.model.js";
import { hashPassword } from "../../src/utils/hash-password.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const createManagerAndDraftCompany = async ({ email }) => {
  const passwordHash = await hashPassword("password123");
  const manager = await User.create({
    fullName: "State Matrix Manager",
    email,
    passwordHash,
    role: USER_ROLE.COMPANY_MANAGER,
    status: USER_STATUS.PENDING_ACTIVATION,
    emailVerifiedAt: null,
    mustChangePassword: false,
  });

  const company = await Company.create({
    managerUserId: manager._id,
    name: "State Matrix Co",
    businessRegistrationNumber: `BRN-${email}`,
    approvalStatus: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
  });

  return { company, manager };
};

const expectWriteRejectedByPersistence = async (write) => {
  await expect(write()).rejects.toBeTruthy();
};

describe("Company persistence state-matrix enforcement", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("rejects invalid approval/operational pairs on document save", async () => {
    const { company } = await createManagerAndDraftCompany({
      email: "state.save-pair@example.com",
    });

    company.approvalStatus = COMPANY_APPROVAL_STATUS.PENDING;
    company.operationalStatus = COMPANY_OPERATIONAL_STATUS.ACTIVE;

    await expect(company.save()).rejects.toThrow(/Invalid Company state pair/i);
  });

  it("rejects invalid approval/operational pairs through findOneAndUpdate", async () => {
    const { company } = await createManagerAndDraftCompany({
      email: "state.findoneandupdate-pair@example.com",
    });

    await expectWriteRejectedByPersistence(() =>
      Company.findOneAndUpdate(
        { _id: company._id },
        {
          $set: {
            approvalStatus: COMPANY_APPROVAL_STATUS.PENDING,
            operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      ),
    );

    const persisted = await Company.findById(company._id);

    expect(persisted.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    );
    expect(persisted.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
  });

  it("rejects invalid approval/operational pairs through updateOne", async () => {
    const { company } = await createManagerAndDraftCompany({
      email: "state.updateone-pair@example.com",
    });

    await expectWriteRejectedByPersistence(() =>
      Company.updateOne(
        { _id: company._id },
        {
          $set: {
            approvalStatus: COMPANY_APPROVAL_STATUS.REJECTED,
            operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
          },
        },
      ),
    );

    const persisted = await Company.findById(company._id);

    expect(persisted.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    );
    expect(persisted.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
  });

  it("rejects incomplete APPROVED + ACTIVE through aggregation-pipeline update", async () => {
    const { company } = await createManagerAndDraftCompany({
      email: "state.pipeline-incomplete@example.com",
    });

    await expectWriteRejectedByPersistence(() =>
      Company.findOneAndUpdate(
        { _id: company._id },
        [
          {
            $set: {
              approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
              operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
              activatedAt: new Date(),
            },
          },
        ],
        {
          returnDocument: "after",
          updatePipeline: true,
        },
      ),
    );

    const persisted = await Company.findById(company._id);

    expect(persisted.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    );
    expect(persisted.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(persisted.reviewSnapshot).toBeNull();
    expect(persisted.activatedAt).toBeNull();
  });

  it("rejects conditional snapshot/timestamp violations through findOneAndUpdate", async () => {
    const { company } = await createManagerAndDraftCompany({
      email: "state.conditional@example.com",
    });

    const submittedAt = new Date("2026-01-01T00:00:00.000Z");
    const reviewedAt = new Date("2026-01-02T00:00:00.000Z");

    await expectWriteRejectedByPersistence(() =>
      Company.findOneAndUpdate(
        { _id: company._id },
        {
          $set: {
            approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
            operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
            reviewSnapshot: {
              name: "Conditional Co",
              businessRegistrationNumber: "BRN-CONDITIONAL",
            },
            submittedAt,
            reviewedByUserId: company.managerUserId,
            reviewedAt,
            activatedAt: new Date("2026-01-03T00:00:00.000Z"),
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
        },
      ),
    );

    const persisted = await Company.findById(company._id);

    expect(persisted.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    );
    expect(persisted.activatedAt).toBeNull();
    expect(persisted.reviewSnapshot).toBeNull();
  });

  it("rejects timestamp ordering violations through updateOne", async () => {
    const { company } = await createManagerAndDraftCompany({
      email: "state.timestamp-order@example.com",
    });

    const submittedAt = new Date("2026-02-02T00:00:00.000Z");
    const reviewedAt = new Date("2026-02-01T00:00:00.000Z");

    await expectWriteRejectedByPersistence(() =>
      Company.updateOne(
        { _id: company._id },
        {
          $set: {
            approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
            operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
            reviewSnapshot: {
              name: "Ordering Co",
              businessRegistrationNumber: "BRN-ORDERING",
            },
            submittedAt,
            reviewedByUserId: company.managerUserId,
            reviewedAt,
            activatedAt: null,
          },
        },
      ),
    );

    const persisted = await Company.findById(company._id);

    expect(persisted.approvalStatus).toBe(
      COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    );
    expect(persisted.submittedAt).toBeNull();
    expect(persisted.reviewedAt).toBeNull();
  });

  it("still allows a valid canonical state transition through findOneAndUpdate", async () => {
    const { company } = await createManagerAndDraftCompany({
      email: "state.valid-transition@example.com",
    });

    const submittedAt = new Date("2026-03-01T00:00:00.000Z");
    const reviewedAt = new Date("2026-03-02T00:00:00.000Z");

    const updated = await Company.findOneAndUpdate(
      { _id: company._id },
      {
        $set: {
          approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
          operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
          reviewSnapshot: {
            name: "Valid Co",
            businessRegistrationNumber: "BRN-VALID",
          },
          submittedAt,
          reviewedByUserId: company.managerUserId,
          reviewedAt,
          activatedAt: null,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    expect(updated.approvalStatus).toBe(COMPANY_APPROVAL_STATUS.APPROVED);
    expect(updated.operationalStatus).toBe(
      COMPANY_OPERATIONAL_STATUS.INACTIVE,
    );
    expect(updated.reviewSnapshot.name).toBe("Valid Co");
    expect(updated.activatedAt).toBeNull();
  });
});
