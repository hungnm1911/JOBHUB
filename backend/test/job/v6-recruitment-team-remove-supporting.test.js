import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import JOB_STATUS from "../../src/constants/job-status.js";

import Job from "../../src/models/job.model.js";

import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const FUTURE_DEADLINE = new Date("2099-12-31T23:59:59.000Z");
const PAST_DEADLINE = new Date("2020-01-01T00:00:00.000Z");

const createPublishedJob = async ({
  companyId,
  createdByCompanyMemberId,
  primaryRecruiterCompanyMemberId = createdByCompanyMemberId,
  supportingRecruiterCompanyMemberIds = [],
  applicationDeadline = FUTURE_DEADLINE,
} = {}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId,
    primaryRecruiterCompanyMemberId,
    supportingRecruiterCompanyMemberIds,
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15T00:00:00.000Z"),
    applicationDeadline,
    title: "Test Job",
  });
};

describe("V6 Slice 03 — Remove Supporting Recruiter (F03)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("allows Company Manager to remove Supporting on effectively published Job", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f03.ok@example.com",
      businessRegistrationNumber: "BRN-V6-F03-OK-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f03.primary@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-PRI-1",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f03.ok@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-SUP-1",
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
    });

    const token = await loginAndGetAccessToken(agent, {
      email: "cm.v6.f03.ok@example.com",
    });

    const response = await agent
      .delete(
        `/api/jobs/${job._id}/team/supporting/${supporting.membership._id}`,
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.team.supportingRecruiterCompanyMemberIds).toEqual([]);
    expect(response.body.team.primaryRecruiterCompanyMemberId).toBe(
      primary.membership._id.toString(),
    );

    const updatedJob = await Job.findById(job._id).lean();
    expect(updatedJob.supportingRecruiterCompanyMemberIds).toHaveLength(0);
    expect(updatedJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      primary.membership._id.toString(),
    );
    expect(updatedJob.createdByCompanyMemberId.toString()).toBe(
      primary.membership._id.toString(),
    );
    expect(updatedJob.companyId.toString()).toBe(
      manager.company._id.toString(),
    );
    expect(updatedJob.status).toBe(JOB_STATUS.PUBLISHED);
  });

  it("allows Primary Recruiter to remove Supporting", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f03.pri@example.com",
      businessRegistrationNumber: "BRN-V6-F03-PRI-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f03.pri.actor@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-PRI-2",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f03.pri@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-SUP-2",
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
    });

    const token = await loginAndGetAccessToken(agent, {
      email: "recruiter.v6.f03.pri.actor@example.com",
    });

    const response = await agent
      .delete(
        `/api/jobs/${job._id}/team/supporting/${supporting.membership._id}`,
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.team.supportingRecruiterCompanyMemberIds).toEqual([]);
  });

  it("denies Supporting Recruiter from removing another Supporting (BR-16)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f03.sup.deny@example.com",
      businessRegistrationNumber: "BRN-V6-F03-SUP-DENY",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f03.sup.deny@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-SD-PRI",
    });
    const supportingA = await createActiveRecruiterContext({
      email: "supporting.v6.f03.a@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-SD-A",
    });
    const supportingB = await createActiveRecruiterContext({
      email: "supporting.v6.f03.b@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-SD-B",
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [
        supportingA.membership._id,
        supportingB.membership._id,
      ],
    });

    const token = await loginAndGetAccessToken(agent, {
      email: "supporting.v6.f03.a@example.com",
    });

    const response = await agent
      .delete(
        `/api/jobs/${job._id}/team/supporting/${supportingB.membership._id}`,
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it("denies remove when target is not Supporting (not in list)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f03.notinlist@example.com",
      businessRegistrationNumber: "BRN-V6-F03-NIL",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f03.notinlist@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-NIL-PRI",
    });
    const outsider = await createActiveRecruiterContext({
      email: "outsider.v6.f03@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-NIL-OUT",
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
    });

    const token = await loginAndGetAccessToken(agent, {
      email: "cm.v6.f03.notinlist@example.com",
    });

    const response = await agent
      .delete(
        `/api/jobs/${job._id}/team/supporting/${outsider.membership._id}`,
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
  });

  it("denies remove when target is the Primary Recruiter", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f03.primary.deny@example.com",
      businessRegistrationNumber: "BRN-V6-F03-PD",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f03.primary.deny@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-PD-PRI",
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
    });

    const token = await loginAndGetAccessToken(agent, {
      email: "cm.v6.f03.primary.deny@example.com",
    });

    const response = await agent
      .delete(
        `/api/jobs/${job._id}/team/supporting/${primary.membership._id}`,
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
  });

  it("denies remove on DRAFT Job (BR-12)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f03.draft@example.com",
      businessRegistrationNumber: "BRN-V6-F03-DRAFT",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f03.draft@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-DRAFT-PRI",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f03.draft@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-DRAFT-SUP",
    });

    const job = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      status: JOB_STATUS.DRAFT,
      title: "Draft Job",
    });

    const token = await loginAndGetAccessToken(agent, {
      email: "cm.v6.f03.draft@example.com",
    });

    const response = await agent
      .delete(
        `/api/jobs/${job._id}/team/supporting/${supporting.membership._id}`,
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
  });

  it("denies remove on CLOSED Job (BR-30)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f03.closed@example.com",
      businessRegistrationNumber: "BRN-V6-F03-CLOSED",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f03.closed@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-CL-PRI",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f03.closed@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-CL-SUP",
    });

    const job = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      status: JOB_STATUS.CLOSED,
      publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      applicationDeadline: FUTURE_DEADLINE,
      title: "Closed Job",
    });

    const token = await loginAndGetAccessToken(agent, {
      email: "cm.v6.f03.closed@example.com",
    });

    const response = await agent
      .delete(
        `/api/jobs/${job._id}/team/supporting/${supporting.membership._id}`,
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
  });

  it("denies remove on effectively expired PUBLISHED Job (BR-13)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f03.expired@example.com",
      businessRegistrationNumber: "BRN-V6-F03-EXP",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f03.expired@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-EXP-PRI",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f03.expired@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-EXP-SUP",
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      applicationDeadline: PAST_DEADLINE,
    });

    const token = await loginAndGetAccessToken(agent, {
      email: "cm.v6.f03.expired@example.com",
    });

    const response = await agent
      .delete(
        `/api/jobs/${job._id}/team/supporting/${supporting.membership._id}`,
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
  });

  it("removes one Supporting while preserving other Supporting members", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f03.multi@example.com",
      businessRegistrationNumber: "BRN-V6-F03-MULTI",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f03.multi@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-M-PRI",
    });
    const supA = await createActiveRecruiterContext({
      email: "supa.v6.f03.multi@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-M-A",
    });
    const supB = await createActiveRecruiterContext({
      email: "supb.v6.f03.multi@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-M-B",
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [
        supA.membership._id,
        supB.membership._id,
      ],
    });

    const token = await loginAndGetAccessToken(agent, {
      email: "cm.v6.f03.multi@example.com",
    });

    const response = await agent
      .delete(
        `/api/jobs/${job._id}/team/supporting/${supA.membership._id}`,
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.team.supportingRecruiterCompanyMemberIds).toEqual([
      supB.membership._id.toString(),
    ]);
  });

  it("denies cross-tenant remove (BR-09/BR-32)", async () => {
    const agent = createTestAgent();
    const managerA = await createActiveCompanyManagerContext({
      email: "cm.v6.f03.tenantA@example.com",
      businessRegistrationNumber: "BRN-V6-F03-TA",
    });
    await createActiveCompanyManagerContext({
      email: "cm.v6.f03.tenantB@example.com",
      businessRegistrationNumber: "BRN-V6-F03-TB",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f03.tenantA@example.com",
      company: managerA.company,
      employeeCode: "NV-V6-F03-TA-PRI",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f03.tenantA@example.com",
      company: managerA.company,
      employeeCode: "NV-V6-F03-TA-SUP",
    });

    const job = await createPublishedJob({
      companyId: managerA.company._id,
      createdByCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
    });

    const token = await loginAndGetAccessToken(agent, {
      email: "cm.v6.f03.tenantB@example.com",
    });

    const response = await agent
      .delete(
        `/api/jobs/${job._id}/team/supporting/${supporting.membership._id}`,
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it("denies remove on persisted EXPIRED Job (BR-30)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f03.persexp@example.com",
      businessRegistrationNumber: "BRN-V6-F03-PE",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f03.persexp@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-PE-PRI",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f03.persexp@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F03-PE-SUP",
    });

    const job = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      status: JOB_STATUS.EXPIRED,
      publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      applicationDeadline: PAST_DEADLINE,
      title: "Expired Job",
    });

    const token = await loginAndGetAccessToken(agent, {
      email: "cm.v6.f03.persexp@example.com",
    });

    const response = await agent
      .delete(
        `/api/jobs/${job._id}/team/supporting/${supporting.membership._id}`,
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
  });
});
