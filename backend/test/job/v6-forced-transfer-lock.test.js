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

const LOCK_URL = (recruiterId) =>
  `/api/company/recruiters/${recruiterId}/lock`;

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

describe("V6 Slice 05 — Forced transfer before LOCK (F05 LOCK)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("locks Recruiter with no unfinished Jobs without transfers", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.no-jobs@example.com",
      businessRegistrationNumber: "BRN-F05-NO-JOBS",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.no-jobs@example.com",
      company: manager.company,
      employeeCode: "NV-F05-01",
    });
    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(LOCK_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
  });

  it("locks Recruiter who is Primary of PUBLISHED Job with forced transfer to existing Supporting (BR-02/BR-20/BR-22/BR-26)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.pub-sup@example.com",
      businessRegistrationNumber: "BRN-F05-PUB-SUP",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.pub-sup@example.com",
      company: manager.company,
      employeeCode: "NV-F05-02",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.f05.pub-sup@example.com",
      company: manager.company,
      employeeCode: "NV-F05-03",
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
      .post(LOCK_URL(recruiter.user._id))
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
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);

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
    expect(updatedJob.createdByCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(updatedJob.companyId.toString()).toBe(manager.company._id.toString());
    expect(updatedJob.status).toBe(JOB_STATUS.PUBLISHED);
  });

  it("locks Recruiter who is Primary of DRAFT Job via forced exception NONE→SUPPORTING→PRIMARY (BR-25)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.draft-exc@example.com",
      businessRegistrationNumber: "BRN-F05-DRAFT-EXC",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.draft-exc@example.com",
      company: manager.company,
      employeeCode: "NV-F05-04",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.f05.draft-exc@example.com",
      company: manager.company,
      employeeCode: "NV-F05-05",
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
      .post(LOCK_URL(recruiter.user._id))
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
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);

    const updatedJob = await Job.findById(job._id);
    expect(updatedJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );
    expect(
      updatedJob.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).not.toContain(recruiter.membership._id.toString());
    expect(updatedJob.status).toBe(JOB_STATUS.DRAFT);
  });

  it("locks Recruiter who is Primary of PENDING_APPROVAL Job via forced exception (BR-24/BR-25)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.pend-exc@example.com",
      businessRegistrationNumber: "BRN-F05-PEND-EXC",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.pend-exc@example.com",
      company: manager.company,
      employeeCode: "NV-F05-06",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.f05.pend-exc@example.com",
      company: manager.company,
      employeeCode: "NV-F05-07",
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
      .post(LOCK_URL(recruiter.user._id))
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
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);

    const updatedJob = await Job.findById(job._id);
    expect(updatedJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );
    expect(updatedJob.status).toBe(JOB_STATUS.PENDING_APPROVAL);
  });

  it("removes Supporting responsibility on unfinished Jobs before lock completion (BR-28)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.sup-rem@example.com",
      businessRegistrationNumber: "BRN-F05-SUP-REM",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.f05.sup-rem@example.com",
      company: manager.company,
      employeeCode: "NV-F05-08",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.sup-rem@example.com",
      company: manager.company,
      employeeCode: "NV-F05-09",
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
      .post(LOCK_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);

    const updatedJob = await Job.findById(job._id);
    expect(
      updatedJob.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).not.toContain(recruiter.membership._id.toString());
    expect(updatedJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      primary.membership._id.toString(),
    );
  });

  it("handles both Primary and Supporting Jobs in the same lock request (TX-03 per-Job)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.both@example.com",
      businessRegistrationNumber: "BRN-F05-BOTH",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.both@example.com",
      company: manager.company,
      employeeCode: "NV-F05-10",
    });
    const otherPrimary = await createActiveRecruiterContext({
      email: "otherprimary.f05.both@example.com",
      company: manager.company,
      employeeCode: "NV-F05-11",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.f05.both@example.com",
      company: manager.company,
      employeeCode: "NV-F05-12",
    });

    const primaryJob = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      supportingMembershipIds: [replacement.membership._id],
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const supportingJob = await createJobWithTeam({
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
      .post(LOCK_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        transfers: [
          {
            jobId: primaryJob._id.toString(),
            replacementCompanyMemberId: replacement.membership._id.toString(),
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);

    const updatedPrimaryJob = await Job.findById(primaryJob._id);
    expect(updatedPrimaryJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );

    const updatedSupportingJob = await Job.findById(supportingJob._id);
    expect(
      updatedSupportingJob.supportingRecruiterCompanyMemberIds.map((id) =>
        id.toString(),
      ),
    ).not.toContain(recruiter.membership._id.toString());
  });

  it("blocks lock when Recruiter is Primary but no transfer specified (BR-27)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.no-xfer@example.com",
      businessRegistrationNumber: "BRN-F05-NO-XFER",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.no-xfer@example.com",
      company: manager.company,
      employeeCode: "NV-F05-13",
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
      .post(LOCK_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/outstanding Primary/i);

    const membership = await CompanyMember.findById(recruiter.membership._id);
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("blocks lock when replacement is ineligible (LOCKED) (BR-08/BR-10/TX-02)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.inelig@example.com",
      businessRegistrationNumber: "BRN-F05-INELIG",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.inelig@example.com",
      company: manager.company,
      employeeCode: "NV-F05-14",
    });
    const lockedReplacement = await createActiveRecruiterContext({
      email: "locked.f05.inelig@example.com",
      company: manager.company,
      employeeCode: "NV-F05-15",
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
      .post(LOCK_URL(recruiter.user._id))
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

  it("does not transfer on CLOSED or EXPIRED Jobs (BR-30)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.ended@example.com",
      businessRegistrationNumber: "BRN-F05-ENDED",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.ended@example.com",
      company: manager.company,
      employeeCode: "NV-F05-16",
    });

    await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      status: JOB_STATUS.CLOSED,
      applicationDeadline: PAST_DEADLINE,
    });

    await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      status: JOB_STATUS.EXPIRED,
      applicationDeadline: PAST_DEADLINE,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(LOCK_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
  });

  it("does not transfer on effectively expired PUBLISHED Job (BR-13/BR-24)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.eff-exp@example.com",
      businessRegistrationNumber: "BRN-F05-EFF-EXP",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.eff-exp@example.com",
      company: manager.company,
      employeeCode: "NV-F05-17",
    });

    await createJobWithTeam({
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
      .post(LOCK_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
  });

  it("preserves createdByCompanyMemberId, companyId, content, and Job lifecycle state (BR-32)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.preserve@example.com",
      businessRegistrationNumber: "BRN-F05-PRESERVE",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.preserve@example.com",
      company: manager.company,
      employeeCode: "NV-F05-18",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.f05.preserve@example.com",
      company: manager.company,
      employeeCode: "NV-F05-19",
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
      .post(LOCK_URL(recruiter.user._id))
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
    expect(updatedJob.createdByCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(updatedJob.companyId.toString()).toBe(manager.company._id.toString());
    expect(updatedJob.status).toBe(JOB_STATUS.PUBLISHED);
    expect(updatedJob.title).toBe("Test Job");
  });

  it("old Primary ends at NONE — not kept as Supporting (BR-26)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.br26@example.com",
      businessRegistrationNumber: "BRN-F05-BR26",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.br26@example.com",
      company: manager.company,
      employeeCode: "NV-F05-20",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.f05.br26@example.com",
      company: manager.company,
      employeeCode: "NV-F05-21",
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

    await agent
      .post(LOCK_URL(recruiter.user._id))
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
    expect(
      updatedJob.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).not.toContain(recruiter.membership._id.toString());
    expect(updatedJob.primaryRecruiterCompanyMemberId.toString()).not.toBe(
      recruiter.membership._id.toString(),
    );
  });

  it("handles multiple Primary Jobs requiring transfer (TX-03 independent per-Job)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.multi@example.com",
      businessRegistrationNumber: "BRN-F05-MULTI",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.multi@example.com",
      company: manager.company,
      employeeCode: "NV-F05-22",
    });
    const replacement1 = await createActiveRecruiterContext({
      email: "replacement1.f05.multi@example.com",
      company: manager.company,
      employeeCode: "NV-F05-23",
    });
    const replacement2 = await createActiveRecruiterContext({
      email: "replacement2.f05.multi@example.com",
      company: manager.company,
      employeeCode: "NV-F05-24",
    });

    const job1 = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      supportingMembershipIds: [replacement1.membership._id],
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    const job2 = await createJobWithTeam({
      companyId: manager.company._id,
      primaryMembershipId: recruiter.membership._id,
      status: JOB_STATUS.DRAFT,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(LOCK_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        transfers: [
          {
            jobId: job1._id.toString(),
            replacementCompanyMemberId: replacement1.membership._id.toString(),
          },
          {
            jobId: job2._id.toString(),
            replacementCompanyMemberId: replacement2.membership._id.toString(),
          },
        ],
      });

    expect(response.status).toBe(200);

    const updatedJob1 = await Job.findById(job1._id);
    expect(updatedJob1.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement1.membership._id.toString(),
    );

    const updatedJob2 = await Job.findById(job2._id);
    expect(updatedJob2.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement2.membership._id.toString(),
    );
  });

  it("rejects replacement that is the Recruiter being locked", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.self@example.com",
      businessRegistrationNumber: "BRN-F05-SELF",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.self@example.com",
      company: manager.company,
      employeeCode: "NV-F05-25",
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
      .post(LOCK_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        transfers: [
          {
            jobId: job._id.toString(),
            replacementCompanyMemberId: recruiter.membership._id.toString(),
          },
        ],
      });

    expect(response.status).toBe(409);

    const membership = await CompanyMember.findById(recruiter.membership._id);
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("rejects replacement from different Company (BR-09)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.cross@example.com",
      businessRegistrationNumber: "BRN-F05-CROSS",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.cross@example.com",
      company: manager.company,
      employeeCode: "NV-F05-26",
    });

    const otherManager = await createActiveCompanyManagerContext({
      email: "cm.f05.cross-other@example.com",
      businessRegistrationNumber: "BRN-F05-CROSS-OTHER",
    });
    const crossTenantReplacement = await createActiveRecruiterContext({
      email: "cross.f05@example.com",
      company: otherManager.company,
      employeeCode: "NV-F05-27",
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
      .post(LOCK_URL(recruiter.user._id))
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        transfers: [
          {
            jobId: job._id.toString(),
            replacementCompanyMemberId: crossTenantReplacement.membership._id.toString(),
          },
        ],
      });

    expect(response.status).toBe(409);

    const membership = await CompanyMember.findById(recruiter.membership._id);
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("Job always has exactly one Primary after forced transfer (BR-02)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.f05.one-pri@example.com",
      businessRegistrationNumber: "BRN-F05-ONE-PRI",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.f05.one-pri@example.com",
      company: manager.company,
      employeeCode: "NV-F05-28",
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.f05.one-pri@example.com",
      company: manager.company,
      employeeCode: "NV-F05-29",
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

    await agent
      .post(LOCK_URL(recruiter.user._id))
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
    expect(updatedJob.primaryRecruiterCompanyMemberId).toBeTruthy();
    expect(updatedJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );
    expect(
      updatedJob.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).not.toContain(replacement.membership._id.toString());
  });
});
