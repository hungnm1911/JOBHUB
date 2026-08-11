import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import JOB_STATUS from "../../src/constants/job-status.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";

import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";

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

const createPublishedJobWithSupporting = async ({
  companyId,
  createdByCompanyMemberId,
  primaryRecruiterCompanyMemberId = createdByCompanyMemberId,
  supportingRecruiterCompanyMemberIds = [],
  applicationDeadline,
} = {}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId,
    primaryRecruiterCompanyMemberId,
    supportingRecruiterCompanyMemberIds,
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15T00:00:00.000Z"),
    applicationDeadline,
    title: "Test Job for Replace Primary",
  });
};

const REPLACE_URL = (jobId) => `/api/jobs/${jobId}/team/replace-primary`;

describe("V6 Slice 04 — Replace Primary Recruiter (F04)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("CM replaces Primary with Supporting, old Primary kept as Supporting (BR-20/BR-21/BR-22)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f04.ok@example.com",
      businessRegistrationNumber: "BRN-F04-OK-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.f04.ok@example.com",
      company: manager.company,
      employeeCode: "NV-F04-PRI-1",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.f04.ok@example.com",
      company: manager.company,
      employeeCode: "NV-F04-SUP-1",
    });

    const deadline = new Date(Date.now() + 1000 * 60 * 60);
    const job = await createPublishedJobWithSupporting({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      applicationDeadline: deadline,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(REPLACE_URL(job._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        newPrimaryCompanyMemberId: supporting.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.team.primaryRecruiterCompanyMemberId).toBe(
      supporting.membership._id.toString(),
    );
    expect(response.body.team.supportingRecruiterCompanyMemberIds).toContain(
      primary.membership._id.toString(),
    );
    expect(
      response.body.team.supportingRecruiterCompanyMemberIds,
    ).not.toContain(supporting.membership._id.toString());

    const persisted = await Job.findById(job._id).lean();
    expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
      supporting.membership._id.toString(),
    );
    expect(
      persisted.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).toContain(primary.membership._id.toString());
    expect(
      persisted.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).not.toContain(supporting.membership._id.toString());
    expect(persisted.createdByCompanyMemberId.toString()).toBe(
      primary.membership._id.toString(),
    );
    expect(persisted.companyId.toString()).toBe(
      manager.company._id.toString(),
    );
    expect(persisted.status).toBe(JOB_STATUS.PUBLISHED);
  });

  it("CM replaces Primary, old Primary leaves team (BR-21)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f04.leave@example.com",
      businessRegistrationNumber: "BRN-F04-LEAVE-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.f04.leave@example.com",
      company: manager.company,
      employeeCode: "NV-F04-PRI-2",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.f04.leave@example.com",
      company: manager.company,
      employeeCode: "NV-F04-SUP-2",
    });

    const deadline = new Date(Date.now() + 1000 * 60 * 60);
    const job = await createPublishedJobWithSupporting({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      applicationDeadline: deadline,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(REPLACE_URL(job._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        newPrimaryCompanyMemberId: supporting.membership._id.toString(),
        keepOldPrimaryAsSupporting: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.team.primaryRecruiterCompanyMemberId).toBe(
      supporting.membership._id.toString(),
    );
    expect(
      response.body.team.supportingRecruiterCompanyMemberIds,
    ).not.toContain(primary.membership._id.toString());
    expect(
      response.body.team.supportingRecruiterCompanyMemberIds,
    ).not.toContain(supporting.membership._id.toString());
  });

  it("rejects when new Primary is not a Supporting of the Job (BR-20)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f04.notsup@example.com",
      businessRegistrationNumber: "BRN-F04-NOTSUP-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.f04.notsup@example.com",
      company: manager.company,
      employeeCode: "NV-F04-PRI-3",
    });
    const outsider = await createActiveRecruiterContext({
      email: "outsider.f04.notsup@example.com",
      company: manager.company,
      employeeCode: "NV-F04-OUT-3",
    });

    const deadline = new Date(Date.now() + 1000 * 60 * 60);
    const job = await createPublishedJobWithSupporting({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      applicationDeadline: deadline,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(REPLACE_URL(job._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        newPrimaryCompanyMemberId: outsider.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(409);
  });

  it("rejects when actor is Primary Recruiter, not CM (BR-19)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f04.priact@example.com",
      businessRegistrationNumber: "BRN-F04-PRIACT-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.f04.priact@example.com",
      company: manager.company,
      employeeCode: "NV-F04-PRI-4",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.f04.priact@example.com",
      company: manager.company,
      employeeCode: "NV-F04-SUP-4",
    });

    const deadline = new Date(Date.now() + 1000 * 60 * 60);
    const job = await createPublishedJobWithSupporting({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      applicationDeadline: deadline,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: primary.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(REPLACE_URL(job._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        newPrimaryCompanyMemberId: supporting.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(403);
  });

  it("rejects when Job is CLOSED (BR-12/BR-30)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f04.closed@example.com",
      businessRegistrationNumber: "BRN-F04-CLOSED-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.f04.closed@example.com",
      company: manager.company,
      employeeCode: "NV-F04-PRI-5",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.f04.closed@example.com",
      company: manager.company,
      employeeCode: "NV-F04-SUP-5",
    });

    const job = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      status: JOB_STATUS.CLOSED,
      publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60),
      title: "Closed Job",
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(REPLACE_URL(job._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        newPrimaryCompanyMemberId: supporting.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(409);
  });

  it("rejects when Job effectively expired (BR-13)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f04.exp@example.com",
      businessRegistrationNumber: "BRN-F04-EXP-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.f04.exp@example.com",
      company: manager.company,
      employeeCode: "NV-F04-PRI-6",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.f04.exp@example.com",
      company: manager.company,
      employeeCode: "NV-F04-SUP-6",
    });

    const pastDeadline = new Date(Date.now() - 1000 * 60);
    const job = await createPublishedJobWithSupporting({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      applicationDeadline: pastDeadline,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(REPLACE_URL(job._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        newPrimaryCompanyMemberId: supporting.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(409);
  });

  it("rejects when new Primary is LOCKED (BR-08/BR-10)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f04.locked@example.com",
      businessRegistrationNumber: "BRN-F04-LOCKED-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.f04.locked@example.com",
      company: manager.company,
      employeeCode: "NV-F04-PRI-7",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.f04.locked@example.com",
      company: manager.company,
      employeeCode: "NV-F04-SUP-7",
    });

    const deadline = new Date(Date.now() + 1000 * 60 * 60);
    const job = await createPublishedJobWithSupporting({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      applicationDeadline: deadline,
    });

    await CompanyMember.findByIdAndUpdate(supporting.membership._id, {
      status: COMPANY_MEMBER_STATUS.LOCKED,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(REPLACE_URL(job._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        newPrimaryCompanyMemberId: supporting.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(409);
  });

  it("rejects when new Primary has mustChangePassword=true (BR-10)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f04.mcp@example.com",
      businessRegistrationNumber: "BRN-F04-MCP-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.f04.mcp@example.com",
      company: manager.company,
      employeeCode: "NV-F04-PRI-8",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.f04.mcp@example.com",
      company: manager.company,
      employeeCode: "NV-F04-SUP-8",
    });

    const deadline = new Date(Date.now() + 1000 * 60 * 60);
    const job = await createPublishedJobWithSupporting({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      applicationDeadline: deadline,
    });

    await User.findByIdAndUpdate(supporting.user._id, {
      mustChangePassword: true,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(REPLACE_URL(job._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        newPrimaryCompanyMemberId: supporting.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(409);
  });

  it("replacement preserves createdByCompanyMemberId and companyId (BR-06/BR-09)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f04.immut@example.com",
      businessRegistrationNumber: "BRN-F04-IMMUT-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.f04.immut@example.com",
      company: manager.company,
      employeeCode: "NV-F04-PRI-9",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.f04.immut@example.com",
      company: manager.company,
      employeeCode: "NV-F04-SUP-9",
    });

    const deadline = new Date(Date.now() + 1000 * 60 * 60);
    const job = await createPublishedJobWithSupporting({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      applicationDeadline: deadline,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    await agent
      .post(REPLACE_URL(job._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        newPrimaryCompanyMemberId: supporting.membership._id.toString(),
        keepOldPrimaryAsSupporting: false,
      });

    const persisted = await Job.findById(job._id).lean();
    expect(persisted.createdByCompanyMemberId.toString()).toBe(
      primary.membership._id.toString(),
    );
    expect(persisted.companyId.toString()).toBe(
      manager.company._id.toString(),
    );
    expect(persisted.status).toBe(JOB_STATUS.PUBLISHED);
    expect(persisted.title).toBe("Test Job for Replace Primary");
  });

  it("rejects when keepOldPrimaryAsSupporting is omitted (F04 outcome choice required)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f04.default@example.com",
      businessRegistrationNumber: "BRN-F04-DEFAULT-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.f04.default@example.com",
      company: manager.company,
      employeeCode: "NV-F04-PRI-10",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.f04.default@example.com",
      company: manager.company,
      employeeCode: "NV-F04-SUP-10",
    });

    const deadline = new Date(Date.now() + 1000 * 60 * 60);
    const job = await createPublishedJobWithSupporting({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      applicationDeadline: deadline,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(REPLACE_URL(job._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        newPrimaryCompanyMemberId: supporting.membership._id.toString(),
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/keepOldPrimaryAsSupporting/i);

    const after = await Job.findById(job._id).lean();
    expect(after.primaryRecruiterCompanyMemberId.toString()).toBe(
      primary.membership._id.toString(),
    );
  });

  it("preserves other Supporting when replacing Primary with one of them", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f04.multi@example.com",
      businessRegistrationNumber: "BRN-F04-MULTI-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.f04.multi@example.com",
      company: manager.company,
      employeeCode: "NV-F04-PRI-11",
    });
    const sup1 = await createActiveRecruiterContext({
      email: "sup1.f04.multi@example.com",
      company: manager.company,
      employeeCode: "NV-F04-SUP-11A",
    });
    const sup2 = await createActiveRecruiterContext({
      email: "sup2.f04.multi@example.com",
      company: manager.company,
      employeeCode: "NV-F04-SUP-11B",
    });

    const deadline = new Date(Date.now() + 1000 * 60 * 60);
    const job = await createPublishedJobWithSupporting({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [
        sup1.membership._id,
        sup2.membership._id,
      ],
      applicationDeadline: deadline,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(REPLACE_URL(job._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        newPrimaryCompanyMemberId: sup1.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(200);
    const supportingIds =
      response.body.team.supportingRecruiterCompanyMemberIds;
    expect(supportingIds).toContain(primary.membership._id.toString());
    expect(supportingIds).toContain(sup2.membership._id.toString());
    expect(supportingIds).not.toContain(sup1.membership._id.toString());
    expect(response.body.team.primaryRecruiterCompanyMemberId).toBe(
      sup1.membership._id.toString(),
    );
  });

  it("rejects cross-tenant replacement attempt (BR-09)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f04.cross@example.com",
      businessRegistrationNumber: "BRN-F04-CROSS-1",
    });
    const otherManager = await createActiveCompanyManagerContext({
      email: "cm.f04.other@example.com",
      businessRegistrationNumber: "BRN-F04-CROSS-2",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.f04.cross@example.com",
      company: manager.company,
      employeeCode: "NV-F04-PRI-12",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.f04.cross@example.com",
      company: manager.company,
      employeeCode: "NV-F04-SUP-12",
    });

    const deadline = new Date(Date.now() + 1000 * 60 * 60);
    const job = await createPublishedJobWithSupporting({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      applicationDeadline: deadline,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: otherManager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(REPLACE_URL(job._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        newPrimaryCompanyMemberId: supporting.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(403);
  });

  it("validates body — missing newPrimaryCompanyMemberId returns 400", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f04.val@example.com",
      businessRegistrationNumber: "BRN-F04-VAL-1",
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(REPLACE_URL("aaaaaaaaaaaaaaaaaaaaaaaa"))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(400);
  });
});
