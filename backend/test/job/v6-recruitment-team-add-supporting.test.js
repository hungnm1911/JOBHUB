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
import COMPANY_APPROVAL_STATUS from "../../src/constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";

import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";

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

const createPublishedJob = async ({
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
    title: "Test Job",
  });
};

describe("V6 Slice 02 — Add Supporting Recruiter (F02, TX-02)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("allows Company Manager to add Supporting on effectively published Job and preserves invariants", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f02.ok@example.com",
      businessRegistrationNumber: "BRN-V6-F02-OK-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.primary@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-PRI-1",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f02.ok@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-SUP-1",
    });

    const applicationDeadline = new Date(Date.now() + 1000 * 60 * 60); // future
    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      applicationDeadline,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        supportingRecruiterCompanyMemberId:
          supporting.membership._id.toString(),
      });

    expect(response.status).toBe(200);
    expect(response.body.team.supportingRecruiterCompanyMemberIds).toEqual([
      supporting.membership._id.toString(),
    ]);

    const persistedJob = await Job.findById(job._id).lean();
    expect(persistedJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      primary.membership._id.toString(),
    );
    expect(persistedJob.createdByCompanyMemberId.toString()).toBe(
      primary.membership._id.toString(),
    );
    expect(persistedJob.companyId.toString()).toBe(manager.company._id.toString());
    expect(persistedJob.status).toBe(JOB_STATUS.PUBLISHED);
    expect(persistedJob.supportingRecruiterCompanyMemberIds).toEqual([
      supporting.membership._id,
    ]);
  });

  it("allows current Primary Recruiter to add Supporting (F02/BR-15)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f02.primary-actor@example.com",
      businessRegistrationNumber: "BRN-V6-F02-ACT-PRI",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.primary@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-PRI-2",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f02.primary-actor@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-SUP-2",
    });

    const applicationDeadline = new Date(Date.now() + 1000 * 60 * 60);
    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      applicationDeadline,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: primary.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        supportingRecruiterCompanyMemberId:
          supporting.membership._id.toString(),
      });

    expect(response.status).toBe(200);
    expect(
      response.body.team.supportingRecruiterCompanyMemberIds,
    ).toEqual([supporting.membership._id.toString()]);
  });

  it("rejects adding Supporting when Job is effectively expired (F02/BR-12/BR-13)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f02.expired@example.com",
      businessRegistrationNumber: "BRN-V6-F02-EXP-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.expired.primary@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-PRI-EXP-1",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f02.expired@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-SUP-EXP-1",
    });

    const applicationDeadline = new Date(Date.now() - 1000 * 60); // past
    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      applicationDeadline,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        supportingRecruiterCompanyMemberId:
          supporting.membership._id.toString(),
      });

    expect(response.status).toBe(409);

    const persistedJob = await Job.findById(job._id).lean();
    expect(persistedJob.supportingRecruiterCompanyMemberIds).toEqual([]);
  });

  it("rejects adding Supporting on CLOSED job (F02/BR-30)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f02.closed@example.com",
      businessRegistrationNumber: "BRN-V6-F02-CLOSED-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.closed.primary@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-PRI-CLOSED-1",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f02.closed@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-SUP-CLOSED-1",
    });

    const job = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      status: JOB_STATUS.CLOSED,
      publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60),
      title: "Test Job",
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        supportingRecruiterCompanyMemberId:
          supporting.membership._id.toString(),
      });

    expect(response.status).toBe(409);
    const persistedJob = await Job.findById(job._id).lean();
    expect(persistedJob.supportingRecruiterCompanyMemberIds).toEqual([]);
  });

  it("rejects target Recruiter when mandatory password change is not completed (F02/BR-10)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f02.pwchange@example.com",
      businessRegistrationNumber: "BRN-V6-F02-PW-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.pw.primary@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-PRI-PW-1",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f02.pw@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-SUP-PW-1",
      mustChangePassword: true,
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        supportingRecruiterCompanyMemberId:
          supporting.membership._id.toString(),
      });

    expect(response.status).toBe(409);

    const persistedJob = await Job.findById(job._id).lean();
    expect(persistedJob.supportingRecruiterCompanyMemberIds).toEqual([]);
  });

  it("rejects cross-tenant target Recruiter (F02/BR-09/BR-32)", async () => {
    const agent = createTestAgent();
    const managerA = await createActiveCompanyManagerContext({
      email: "cm.v6.f02.tenantA@example.com",
      businessRegistrationNumber: "BRN-V6-F02-TENA-1",
    });
    const managerB = await createActiveCompanyManagerContext({
      email: "cm.v6.f02.tenantB@example.com",
      businessRegistrationNumber: "BRN-V6-F02-TENB-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.tenantA.primary@example.com",
      company: managerA.company,
      employeeCode: "NV-V6-F02-PRI-TENA-1",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f02.tenantB@example.com",
      company: managerB.company,
      employeeCode: "NV-V6-F02-SUP-TENB-1",
    });

    const job = await createPublishedJob({
      companyId: managerA.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: managerA.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        supportingRecruiterCompanyMemberId:
          supporting.membership._id.toString(),
      });

    expect(response.status).toBe(409);
    const persistedJob = await Job.findById(job._id).lean();
    expect(persistedJob.supportingRecruiterCompanyMemberIds).toEqual([]);
  });

  it("rejects adding duplicate Supporting or adding current Primary (F02/BR-04/BR-17)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f02.dup@example.com",
      businessRegistrationNumber: "BRN-V6-F02-DUP-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.dup.primary@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-PRI-DUP-1",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f02.dup@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-SUP-DUP-1",
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const first = await agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        supportingRecruiterCompanyMemberId:
          supporting.membership._id.toString(),
      });
    expect(first.status).toBe(200);

    const dup = await agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        supportingRecruiterCompanyMemberId:
          supporting.membership._id.toString(),
      });
    expect(dup.status).toBe(409);

    const tryPrimary = await agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        supportingRecruiterCompanyMemberId:
          primary.membership._id.toString(),
      });
    expect(tryPrimary.status).toBe(409);
  });

  it("rejects when Company is not approved/operationally active (F02/BR-10)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f02.companyinactive@example.com",
      businessRegistrationNumber: "BRN-V6-F02-CIN-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.cin.primary@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-PRI-CIN-1",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f02.cin@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-SUP-CIN-1",
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60),
    });

    await Company.findByIdAndUpdate(manager.company._id, {
      approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
      operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        supportingRecruiterCompanyMemberId:
          supporting.membership._id.toString(),
      });

    expect(response.status).toBe(403);
  });

  it("does not expose Supporting/team-only data via generic job read (regression from F02)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f02.leakreg@example.com",
      businessRegistrationNumber: "BRN-V6-F02-LEAK-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.leakreg.primary@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-LEAK-PRI-1",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.f02.leakreg@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-LEAK-SUP-1",
    });
    const peer = await createActiveRecruiterContext({
      email: "peer.v6.f02.leakreg@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-LEAK-PEER-1",
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60),
    });

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    await agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        supportingRecruiterCompanyMemberId:
          supporting.membership._id.toString(),
      })
      .expect(200);

    const peerToken = await loginAndGetAccessToken(agent, {
      email: peer.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get(`/api/jobs/${job._id}`)
      .set("Authorization", `Bearer ${peerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.job).not.toHaveProperty(
      "supportingRecruiterCompanyMemberIds",
    );
  });

  it("TX-02 concurrency: lock/terminate the target recruiter cannot result in recruiter being Supporting on an un-ended Job", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f02.tx2@example.com",
      businessRegistrationNumber: "BRN-V6-F02-TX2-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.tx2.primary@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-TX2-PRI-1",
    });
    const target = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.tx2.target@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-TX2-TGT-1",
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60),
    });

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const addPromise = agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        supportingRecruiterCompanyMemberId: target.membership._id.toString(),
      });

    const lockPromise = agent
      .post(`/api/recruiters/${target.user._id}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);

    await Promise.allSettled([addPromise, lockPromise]);

    const persistedJob = await Job.findById(job._id).lean();
    const persistedMembership = await CompanyMember.findById(
      target.membership._id,
    ).lean();

    const targetInSupport =
      persistedJob.supportingRecruiterCompanyMemberIds.some(
        (id) => id.toString() === target.membership._id.toString(),
      );

    const membershipIsLockedOrTerminated =
      persistedMembership.status !== COMPANY_MEMBER_STATUS.ACTIVE;

    // TX-02 invariant: not allowed to have locked/terminated recruiter still
    // belonging to an active job team.
    expect(!(membershipIsLockedOrTerminated && targetInSupport)).toBe(true);
  });

  it("TX-02 concurrency: terminate the target recruiter cannot result in recruiter being Supporting on an un-ended Job", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f02.tx2.terminate@example.com",
      businessRegistrationNumber: "BRN-V6-F02-TX2-TERM-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.tx2.terminate.primary@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-TX2-TERM-PRI-1",
    });
    const target = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.tx2.terminate.target@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-TX2-TERM-TGT-1",
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60),
    });

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const addPromise = agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        supportingRecruiterCompanyMemberId: target.membership._id.toString(),
      });

    const terminatePromise = agent
      .post(`/api/recruiters/${target.user._id}/terminate`)
      .set("Authorization", `Bearer ${managerToken}`);

    await Promise.allSettled([addPromise, terminatePromise]);

    const persistedJob = await Job.findById(job._id).lean();
    const persistedMembership = await CompanyMember.findById(
      target.membership._id,
    ).lean();

    const targetInSupport = persistedJob.supportingRecruiterCompanyMemberIds.some(
      (id) => id.toString() === target.membership._id.toString(),
    );

    const membershipIsLockedOrTerminated =
      persistedMembership.status !== COMPANY_MEMBER_STATUS.ACTIVE;

    expect(!(membershipIsLockedOrTerminated && targetInSupport)).toBe(true);
  });

  it("rejects target Recruiter when membership is LOCKED (F02/BR-10)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.f02.targetlocked@example.com",
      businessRegistrationNumber: "BRN-V6-F02-TGTLOCK-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.targetlocked.primary@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-TGTLOCK-PRI-1",
    });
    const targetLocked = await createActiveRecruiterContext({
      email: "recruiter.v6.f02.targetlocked.target@example.com",
      company: manager.company,
      employeeCode: "NV-V6-F02-TGTLOCK-TGT-1",
      membershipStatus: COMPANY_MEMBER_STATUS.LOCKED,
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60),
    });

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${job._id}/team/supporting`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        supportingRecruiterCompanyMemberId:
          targetLocked.membership._id.toString(),
      });

    expect(response.status).toBe(409);
    const persistedJob = await Job.findById(job._id).lean();
    expect(persistedJob.supportingRecruiterCompanyMemberIds).toEqual([]);
  });
});

