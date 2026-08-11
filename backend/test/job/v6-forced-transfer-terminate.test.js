import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";

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

const TERMINATE_URL = (recruiterId) =>
  `/api/company/recruiters/${recruiterId}/terminate`;

const UNLOCK_URL = (recruiterId) =>
  `/api/company/recruiters/${recruiterId}/unlock`;

const createJobWithTeam = async ({
  companyId,
  primaryMembershipId,
  supportingMembershipIds = [],
  status = JOB_STATUS.PUBLISHED,
  applicationDeadline,
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMembershipId,
    primaryRecruiterCompanyMemberId: primaryMembershipId,
    supportingRecruiterCompanyMemberIds: supportingMembershipIds,
    status,
    publishedAt: status === JOB_STATUS.DRAFT ? null : new Date("2026-01-15T00:00:00.000Z"),
    applicationDeadline,
    title: status === JOB_STATUS.DRAFT ? null : "Test Job",
  });
};

const FUTURE_DEADLINE = () => new Date(Date.now() + 1000 * 60 * 60 * 24);
const PAST_DEADLINE = new Date("2020-01-01T00:00:00.000Z");

describe("V6 Slice 06 — Forced transfer before TERMINATE + unlock regression (F05 TERMINATE/UNLOCK)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  // --- TERMINATE forced transfer ---

  it("terminates Recruiter with no unfinished Jobs without transfers", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.no-jobs@example.com",
      businessRegistrationNumber: "BRN-S06-NO-JOBS",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.no-jobs@example.com",
      company: manager.company,
      employeeCode: "NV-S06-01",
    });
    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(TERMINATE_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
  });

  it("terminates ACTIVE Recruiter who is Primary of PUBLISHED Job with forced transfer to existing Supporting (BR-23/BR-26)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.pub-sup@example.com",
      businessRegistrationNumber: "BRN-S06-PUB-SUP",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.pub-sup@example.com",
      company: manager.company,
      employeeCode: "NV-S06-02",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.s06.pub-sup@example.com",
      company: manager.company,
      employeeCode: "NV-S06-03",
    });

    const job = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      supportingMembershipIds: [replacement.membership._id],
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(TERMINATE_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        transfers: [
          {
            jobId: job._id.toString(),
            replacementCompanyMemberId: replacement.membership._id.toString(),
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);

    const updatedJob = await Job.findById(job._id);
    expect(updatedJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );
    expect(
      updatedJob.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).not.toContain(recruiter.membership._id.toString());
    expect(
      updatedJob.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).not.toContain(replacement.membership._id.toString());
    // BR-32: createdBy, companyId, content, status unchanged.
    expect(updatedJob.createdByCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(updatedJob.companyId.toString()).toBe(manager.company._id.toString());
    expect(updatedJob.status).toBe(JOB_STATUS.PUBLISHED);
  });

  it("terminates ACTIVE Recruiter who is Primary of DRAFT Job via forced exception NONE→SUPPORTING→PRIMARY (BR-25)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.draft-exc@example.com",
      businessRegistrationNumber: "BRN-S06-DRAFT-EXC",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.draft-exc@example.com",
      company: manager.company,
      employeeCode: "NV-S06-04",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.s06.draft-exc@example.com",
      company: manager.company,
      employeeCode: "NV-S06-05",
    });

    const job = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      status: JOB_STATUS.DRAFT,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(TERMINATE_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        transfers: [
          {
            jobId: job._id.toString(),
            replacementCompanyMemberId: replacement.membership._id.toString(),
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);

    const updatedJob = await Job.findById(job._id);
    expect(updatedJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );
    expect(updatedJob.status).toBe(JOB_STATUS.DRAFT);
  });

  it("terminates ACTIVE Recruiter who is Primary of PENDING_APPROVAL Job via forced exception (BR-24/BR-25)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.pend-exc@example.com",
      businessRegistrationNumber: "BRN-S06-PEND-EXC",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.pend-exc@example.com",
      company: manager.company,
      employeeCode: "NV-S06-06",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.s06.pend-exc@example.com",
      company: manager.company,
      employeeCode: "NV-S06-07",
    });

    const job = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      status: JOB_STATUS.PENDING_APPROVAL,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(TERMINATE_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        transfers: [
          {
            jobId: job._id.toString(),
            replacementCompanyMemberId: replacement.membership._id.toString(),
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);

    const updatedJob = await Job.findById(job._id);
    expect(updatedJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );
    expect(updatedJob.status).toBe(JOB_STATUS.PENDING_APPROVAL);
  });

  it("removes Supporting responsibility on unfinished Jobs before terminate completion (BR-28)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.sup-rem@example.com",
      businessRegistrationNumber: "BRN-S06-SUP-REM",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.s06.sup-rem@example.com",
      company: manager.company,
      employeeCode: "NV-S06-08",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.sup-rem@example.com",
      company: manager.company,
      employeeCode: "NV-S06-09",
    });

    const job = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: primary.membership._id,
      supportingMembershipIds: [recruiter.membership._id],
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(TERMINATE_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);

    const updatedJob = await Job.findById(job._id);
    expect(
      updatedJob.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).not.toContain(recruiter.membership._id.toString());
    expect(updatedJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      primary.membership._id.toString(),
    );
  });

  it("blocks terminate when Primary Job has no replacement specified (BR-27)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.block@example.com",
      businessRegistrationNumber: "BRN-S06-BLOCK",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.block@example.com",
      company: manager.company,
      employeeCode: "NV-S06-10",
    });

    await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(TERMINATE_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(409);

    const membership = await CompanyMember.findById(recruiter.membership._id);
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("terminates LOCKED Recruiter with forced transfer (LOCKED→TERMINATED) (BR-23)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.locked-term@example.com",
      businessRegistrationNumber: "BRN-S06-LOCKED-TERM",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.locked-term@example.com",
      company: manager.company,
      employeeCode: "NV-S06-11",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.s06.locked-term@example.com",
      company: manager.company,
      employeeCode: "NV-S06-12",
    });

    const job = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      supportingMembershipIds: [replacement.membership._id],
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    // First lock (with forced transfer to move Primary away).
    await agent
      .post(`/api/company/recruiters/${recruiter.user._id}/lock`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        transfers: [
          {
            jobId: job._id.toString(),
            replacementCompanyMemberId: replacement.membership._id.toString(),
          },
        ],
      });

    const lockedMembership = await CompanyMember.findById(recruiter.membership._id);
    expect(lockedMembership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);

    // After lock, Recruiter has no active responsibility — terminate from LOCKED.
    const response = await agent
      .post(TERMINATE_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
  });

  it("handles multiple Jobs — both Primary and Supporting — before terminate (TX-03)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.multi@example.com",
      businessRegistrationNumber: "BRN-S06-MULTI",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.multi@example.com",
      company: manager.company,
      employeeCode: "NV-S06-13",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.s06.multi@example.com",
      company: manager.company,
      employeeCode: "NV-S06-14",
    });
    const otherPrimary = await createActiveRecruiterContext({
      email: "other-primary.s06.multi@example.com",
      company: manager.company,
      employeeCode: "NV-S06-15",
    });

    const jobAsPrimary = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      supportingMembershipIds: [replacement.membership._id],
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const jobAsSupporting = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: otherPrimary.membership._id,
      supportingMembershipIds: [recruiter.membership._id],
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(TERMINATE_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        transfers: [
          {
            jobId: jobAsPrimary._id.toString(),
            replacementCompanyMemberId: replacement.membership._id.toString(),
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);

    const updatedPrimaryJob = await Job.findById(jobAsPrimary._id);
    expect(updatedPrimaryJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );

    const updatedSupportingJob = await Job.findById(jobAsSupporting._id);
    expect(
      updatedSupportingJob.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).not.toContain(recruiter.membership._id.toString());
    expect(updatedSupportingJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      otherPrimary.membership._id.toString(),
    );
  });

  it("does not perform forced transfer on CLOSED/EXPIRED Jobs (BR-24/BR-30)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.ended@example.com",
      businessRegistrationNumber: "BRN-S06-ENDED",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.ended@example.com",
      company: manager.company,
      employeeCode: "NV-S06-16",
    });

    const closedJob = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      status: JOB_STATUS.CLOSED,
      applicationDeadline: PAST_DEADLINE,
    });

    const expiredJob = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      status: JOB_STATUS.EXPIRED,
      applicationDeadline: PAST_DEADLINE,
    });

    const effectivelyExpiredJob = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: PAST_DEADLINE,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(TERMINATE_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);

    // Historical team references preserved (BR-32).
    const c = await Job.findById(closedJob._id);
    expect(c.primaryRecruiterCompanyMemberId.toString()).toBe(recruiter.membership._id.toString());
    expect(c.createdByCompanyMemberId.toString()).toBe(recruiter.membership._id.toString());

    const e = await Job.findById(expiredJob._id);
    expect(e.primaryRecruiterCompanyMemberId.toString()).toBe(recruiter.membership._id.toString());

    const ee = await Job.findById(effectivelyExpiredJob._id);
    expect(ee.primaryRecruiterCompanyMemberId.toString()).toBe(recruiter.membership._id.toString());
  });

  it("does not delete Job, change createdByCompanyMemberId, or change companyId when terminating (BR-32)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.br32@example.com",
      businessRegistrationNumber: "BRN-S06-BR32",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.br32@example.com",
      company: manager.company,
      employeeCode: "NV-S06-17",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.s06.br32@example.com",
      company: manager.company,
      employeeCode: "NV-S06-18",
    });

    const job = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    await agent
      .post(TERMINATE_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        transfers: [
          {
            jobId: job._id.toString(),
            replacementCompanyMemberId: replacement.membership._id.toString(),
          },
        ],
      });

    const updatedJob = await Job.findById(job._id);
    expect(updatedJob).not.toBeNull();
    expect(updatedJob.createdByCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(updatedJob.companyId.toString()).toBe(manager.company._id.toString());
    expect(updatedJob.status).toBe(JOB_STATUS.PUBLISHED);
  });

  it("rejects terminate when replacement is ineligible (BR-08/BR-10)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.inelig@example.com",
      businessRegistrationNumber: "BRN-S06-INELIG",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.inelig@example.com",
      company: manager.company,
      employeeCode: "NV-S06-19",
    });
    const lockedReplacement = await createActiveRecruiterContext({
      email: "locked-rep.s06.inelig@example.com",
      company: manager.company,
      employeeCode: "NV-S06-20",
    });

    await CompanyMember.findByIdAndUpdate(lockedReplacement.membership._id, {
      status: COMPANY_MEMBER_STATUS.LOCKED,
    });

    const job = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(TERMINATE_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        transfers: [
          {
            jobId: job._id.toString(),
            replacementCompanyMemberId: lockedReplacement.membership._id.toString(),
          },
        ],
      });

    expect(response.status).toBe(409);

    const membership = await CompanyMember.findById(recruiter.membership._id);
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  // --- UNLOCK regression (BR-29) ---

  it("unlock does not restore Primary position after lock+forced-transfer (BR-29)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.unlock@example.com",
      businessRegistrationNumber: "BRN-S06-UNLOCK",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.unlock@example.com",
      company: manager.company,
      employeeCode: "NV-S06-21",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.s06.unlock@example.com",
      company: manager.company,
      employeeCode: "NV-S06-22",
    });

    const job = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      supportingMembershipIds: [replacement.membership._id],
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    // Lock with forced transfer.
    await agent
      .post(`/api/company/recruiters/${recruiter.user._id}/lock`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        transfers: [
          {
            jobId: job._id.toString(),
            replacementCompanyMemberId: replacement.membership._id.toString(),
          },
        ],
      });

    // Verify replacement is now Primary.
    const jobAfterLock = await Job.findById(job._id);
    expect(jobAfterLock.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );

    // Unlock.
    const unlockResponse = await agent
      .post(UNLOCK_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    expect(unlockResponse.status).toBe(200);
    expect(unlockResponse.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);

    // Team state unchanged after unlock — replacement is still Primary,
    // unlocked Recruiter is still NONE on the Job.
    const jobAfterUnlock = await Job.findById(job._id);
    expect(jobAfterUnlock.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );
    expect(
      jobAfterUnlock.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).not.toContain(recruiter.membership._id.toString());
  });

  it("unlock does not restore Supporting position after lock+forced-removal (BR-29)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.unlock-sup@example.com",
      businessRegistrationNumber: "BRN-S06-UNLOCK-SUP",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.s06.unlock-sup@example.com",
      company: manager.company,
      employeeCode: "NV-S06-23",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.unlock-sup@example.com",
      company: manager.company,
      employeeCode: "NV-S06-24",
    });

    const job = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: primary.membership._id,
      supportingMembershipIds: [recruiter.membership._id],
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    // Lock removes Supporting automatically.
    await agent
      .post(`/api/company/recruiters/${recruiter.user._id}/lock`)
      .set("Authorization", `Bearer ${accessToken}`);

    const jobAfterLock = await Job.findById(job._id);
    expect(
      jobAfterLock.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).not.toContain(recruiter.membership._id.toString());

    // Unlock.
    const unlockResponse = await agent
      .post(UNLOCK_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    expect(unlockResponse.status).toBe(200);

    // Supporting position is NOT restored.
    const jobAfterUnlock = await Job.findById(job._id);
    expect(
      jobAfterUnlock.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).not.toContain(recruiter.membership._id.toString());
  });

  it("unlock does not write primaryRecruiterCompanyMemberId or supportingRecruiterCompanyMemberIds", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.unlock-nw@example.com",
      businessRegistrationNumber: "BRN-S06-UNLOCK-NW",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.unlock-nw@example.com",
      company: manager.company,
      employeeCode: "NV-S06-25",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.s06.unlock-nw@example.com",
      company: manager.company,
      employeeCode: "NV-S06-26",
    });

    const job1 = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      supportingMembershipIds: [replacement.membership._id],
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const job2 = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: replacement.membership._id,
      supportingMembershipIds: [recruiter.membership._id],
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    // Lock with forced transfer.
    await agent
      .post(`/api/company/recruiters/${recruiter.user._id}/lock`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        transfers: [
          {
            jobId: job1._id.toString(),
            replacementCompanyMemberId: replacement.membership._id.toString(),
          },
        ],
      });

    // Capture team state after lock.
    const job1AfterLock = await Job.findById(job1._id).lean();
    const job2AfterLock = await Job.findById(job2._id).lean();

    // Unlock.
    await agent
      .post(UNLOCK_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    // Verify no Job documents changed.
    const job1AfterUnlock = await Job.findById(job1._id).lean();
    const job2AfterUnlock = await Job.findById(job2._id).lean();

    expect(job1AfterUnlock.primaryRecruiterCompanyMemberId.toString()).toBe(
      job1AfterLock.primaryRecruiterCompanyMemberId.toString(),
    );
    expect(
      job1AfterUnlock.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).toEqual(
      job1AfterLock.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    );

    expect(job2AfterUnlock.primaryRecruiterCompanyMemberId.toString()).toBe(
      job2AfterLock.primaryRecruiterCompanyMemberId.toString(),
    );
    expect(
      job2AfterUnlock.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).toEqual(
      job2AfterLock.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    );
  });

  it("terminate does not affect ended Jobs — historical references and Job existence preserved (BR-32)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.s06.hist@example.com",
      businessRegistrationNumber: "BRN-S06-HIST",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.s06.hist@example.com",
      company: manager.company,
      employeeCode: "NV-S06-27",
    });

    const closedJob = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      status: JOB_STATUS.CLOSED,
      applicationDeadline: PAST_DEADLINE,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(TERMINATE_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    const jobStillExists = await Job.findById(closedJob._id);
    expect(jobStillExists).not.toBeNull();
    expect(jobStillExists.createdByCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(jobStillExists.companyId.toString()).toBe(manager.company._id.toString());
  });
});
