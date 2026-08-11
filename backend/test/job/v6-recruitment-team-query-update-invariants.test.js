import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import mongoose from "mongoose";

import JOB_STATUS from "../../src/constants/job-status.js";

import Job from "../../src/models/job.model.js";

import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const expectWriteRejectedByPersistence = async (write) => {
  await expect(write()).rejects.toBeTruthy();
};

const createDraftJob = async ({
  companyId,
  primaryMemberId,
  supportingIds = [],
}) =>
  Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingIds,
    status: JOB_STATUS.DRAFT,
    title: "Query Update Invariant Job",
  });

describe("V6 Job schema — Recruitment Team invariants on query updates", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("rejects findOneAndUpdate that sets Supporting to include current Primary", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.query.primary-in-supporting@example.com",
      businessRegistrationNumber: "BRN-V6-QUERY-PI-SUP",
    });
    const primary = await createActiveRecruiterContext({
      email: "pri.v6.query.primary-in-supporting@example.com",
      company: manager.company,
      employeeCode: "NV-V6-QUERY-PI-SUP",
    });
    const supporting = await createActiveRecruiterContext({
      email: "sup.v6.query.primary-in-supporting@example.com",
      company: manager.company,
      employeeCode: "NV-V6-QUERY-PI-SUP-2",
    });

    const job = await createDraftJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
      supportingIds: [supporting.membership._id],
    });

    await expectWriteRejectedByPersistence(() =>
      Job.findOneAndUpdate(
        { _id: job._id },
        {
          $set: {
            supportingRecruiterCompanyMemberIds: [
              primary.membership._id,
              supporting.membership._id,
            ],
          },
        },
        { returnDocument: "after", runValidators: true },
      ),
    );

    const persisted = await Job.findById(job._id).lean();
    expect(persisted.supportingRecruiterCompanyMemberIds.map((id) => id.toString())).toEqual([
      supporting.membership._id.toString(),
    ]);
  });

  it("rejects findOneAndUpdate that unsets supportingRecruiterCompanyMemberIds", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.query.unset-supporting@example.com",
      businessRegistrationNumber: "BRN-V6-QUERY-UNSET",
    });
    const primary = await createActiveRecruiterContext({
      email: "pri.v6.query.unset-supporting@example.com",
      company: manager.company,
      employeeCode: "NV-V6-QUERY-UNSET",
    });

    const job = await createDraftJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
    });

    await expectWriteRejectedByPersistence(() =>
      Job.findOneAndUpdate(
        { _id: job._id },
        { $unset: { supportingRecruiterCompanyMemberIds: "" } },
        { returnDocument: "after", runValidators: true },
      ),
    );

    const persisted = await Job.findById(job._id).lean();
    expect(persisted.supportingRecruiterCompanyMemberIds).toEqual([]);
  });

  it("rejects updateOne that creates duplicate Supporting entries", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.query.dup-supporting@example.com",
      businessRegistrationNumber: "BRN-V6-QUERY-DUP",
    });
    const primary = await createActiveRecruiterContext({
      email: "pri.v6.query.dup-supporting@example.com",
      company: manager.company,
      employeeCode: "NV-V6-QUERY-DUP",
    });
    const supporting = await createActiveRecruiterContext({
      email: "sup.v6.query.dup-supporting@example.com",
      company: manager.company,
      employeeCode: "NV-V6-QUERY-DUP-2",
    });

    const job = await createDraftJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
    });

    await expectWriteRejectedByPersistence(() =>
      Job.updateOne(
        { _id: job._id },
        {
          $set: {
            supportingRecruiterCompanyMemberIds: [
              supporting.membership._id,
              supporting.membership._id,
            ],
          },
        },
      ),
    );

    const persisted = await Job.findById(job._id).lean();
    expect(persisted.supportingRecruiterCompanyMemberIds).toEqual([]);
  });

  it("allows valid findOneAndUpdate that keeps Primary distinct from Supporting", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.query.valid-supporting@example.com",
      businessRegistrationNumber: "BRN-V6-QUERY-VALID",
    });
    const primary = await createActiveRecruiterContext({
      email: "pri.v6.query.valid-supporting@example.com",
      company: manager.company,
      employeeCode: "NV-V6-QUERY-VALID",
    });
    const supportingA = await createActiveRecruiterContext({
      email: "supA.v6.query.valid-supporting@example.com",
      company: manager.company,
      employeeCode: "NV-V6-QUERY-VALID-2",
    });
    const supportingB = await createActiveRecruiterContext({
      email: "supB.v6.query.valid-supporting@example.com",
      company: manager.company,
      employeeCode: "NV-V6-QUERY-VALID-3",
    });

    const job = await createDraftJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
    });

    const updated = await Job.findOneAndUpdate(
      { _id: job._id },
      {
        $set: {
          supportingRecruiterCompanyMemberIds: [
            supportingA.membership._id,
            supportingB.membership._id,
          ],
        },
      },
      { returnDocument: "after", runValidators: true },
    );

    expect(updated.supportingRecruiterCompanyMemberIds.map((id) => id.toString())).toEqual([
      supportingA.membership._id.toString(),
      supportingB.membership._id.toString(),
    ]);
    expect(updated.primaryRecruiterCompanyMemberId.toString()).toBe(
      primary.membership._id.toString(),
    );
  });

  it("allows valid findOneAndUpdate that sets empty Supporting array", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.query.empty-supporting@example.com",
      businessRegistrationNumber: "BRN-V6-QUERY-EMPTY",
    });
    const primary = await createActiveRecruiterContext({
      email: "pri.v6.query.empty-supporting@example.com",
      company: manager.company,
      employeeCode: "NV-V6-QUERY-EMPTY",
    });
    const supporting = await createActiveRecruiterContext({
      email: "sup.v6.query.empty-supporting@example.com",
      company: manager.company,
      employeeCode: "NV-V6-QUERY-EMPTY-2",
    });

    const job = await createDraftJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
      supportingIds: [supporting.membership._id],
    });

    const updated = await Job.findOneAndUpdate(
      { _id: job._id },
      { $set: { supportingRecruiterCompanyMemberIds: [] } },
      { returnDocument: "after", runValidators: true },
    );

    expect(updated.supportingRecruiterCompanyMemberIds).toEqual([]);
    expect(updated.primaryRecruiterCompanyMemberId.toString()).toBe(
      primary.membership._id.toString(),
    );
  });

  it("rejects findOneAndUpdate that sets Primary to a member already in Supporting", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.query.primary-from-supporting@example.com",
      businessRegistrationNumber: "BRN-V6-QUERY-PRI-FROM-SUP",
    });
    const primary = await createActiveRecruiterContext({
      email: "pri.v6.query.primary-from-supporting@example.com",
      company: manager.company,
      employeeCode: "NV-V6-QUERY-PRI-FROM-SUP",
    });
    const supporting = await createActiveRecruiterContext({
      email: "sup.v6.query.primary-from-supporting@example.com",
      company: manager.company,
      employeeCode: "NV-V6-QUERY-PRI-FROM-SUP-2",
    });

    const job = await createDraftJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
      supportingIds: [supporting.membership._id],
    });

    await expectWriteRejectedByPersistence(() =>
      Job.findOneAndUpdate(
        { _id: job._id },
        {
          $set: {
            primaryRecruiterCompanyMemberId: supporting.membership._id,
          },
        },
        { returnDocument: "after", runValidators: true },
      ),
    );

    const persisted = await Job.findById(job._id).lean();
    expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
      primary.membership._id.toString(),
    );
    expect(persisted.supportingRecruiterCompanyMemberIds.map((id) => id.toString())).toEqual([
      supporting.membership._id.toString(),
    ]);
  });

  describe("create/save regressions", () => {
    it("still rejects duplicate Supporting on Job.create", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.query.create-dup@example.com",
        businessRegistrationNumber: "BRN-V6-QUERY-CREATE-DUP",
      });
      const primary = await createActiveRecruiterContext({
        email: "pri.v6.query.create-dup@example.com",
        company: manager.company,
        employeeCode: "NV-V6-QUERY-CREATE-DUP",
      });
      const supportingId = new mongoose.Types.ObjectId();

      await expect(
        Job.create({
          companyId: manager.company._id,
          createdByCompanyMemberId: primary.membership._id,
          primaryRecruiterCompanyMemberId: primary.membership._id,
          supportingRecruiterCompanyMemberIds: [supportingId, supportingId],
          status: JOB_STATUS.DRAFT,
        }),
      ).rejects.toThrow(/must not contain duplicates/i);
    });

    it("still defaults Supporting to empty array on Job.create", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.query.create-default@example.com",
        businessRegistrationNumber: "BRN-V6-QUERY-CREATE-DEFAULT",
      });
      const primary = await createActiveRecruiterContext({
        email: "pri.v6.query.create-default@example.com",
        company: manager.company,
        employeeCode: "NV-V6-QUERY-CREATE-DEFAULT",
      });

      const job = await Job.create({
        companyId: manager.company._id,
        createdByCompanyMemberId: primary.membership._id,
        primaryRecruiterCompanyMemberId: primary.membership._id,
        status: JOB_STATUS.DRAFT,
      });

      expect(job.supportingRecruiterCompanyMemberIds).toEqual([]);
    });
  });
});
