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

const createPrimaryJob = async ({
  companyId,
  membershipId,
  status,
  publishedAt = null,
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: membershipId,
    primaryRecruiterCompanyMemberId: membershipId,
    status,
    publishedAt,
    title: status === JOB_STATUS.DRAFT ? null : "Owned Job",
  });
};

describe("V5 Slice 01 — Recruiter lock/terminate BR-41 responsibility guard", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it.each([
    JOB_STATUS.DRAFT,
    JOB_STATUS.PENDING_APPROVAL,
    JOB_STATUS.PUBLISHED,
  ])(
    "blocks lock while Recruiter is Primary of %s Job",
    async (status) => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: `cm.br41.lock.${status}@example.com`,
        businessRegistrationNumber: `BRN-V5-BR41-${status}`,
      });
      const recruiter = await createActiveRecruiterContext({
        email: `recruiter.br41.lock.${status}@example.com`,
        company: manager.company,
        employeeCode: `NV-${status}`,
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });

      await createPrimaryJob({
        companyId: manager.company._id,
        membershipId: recruiter.membership._id,
        status,
        publishedAt:
          status === JOB_STATUS.PUBLISHED ? new Date("2026-01-01") : null,
      });

      const response = await agent
        .post(
          `/api/company/recruiters/${recruiter.user._id.toString()}/lock`,
        )
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(
        /outstanding Primary Job responsibility/i,
      );

      const membership = await CompanyMember.findById(recruiter.membership._id);
      expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
    },
  );

  it("blocks terminate while Recruiter is Primary of a DRAFT Job", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.br41.terminate@example.com",
      businessRegistrationNumber: "BRN-V5-BR41-2",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.br41.terminate@example.com",
      company: manager.company,
      employeeCode: "NV-BR41-2",
    });
    await createPrimaryJob({
      companyId: manager.company._id,
      membershipId: recruiter.membership._id,
      status: JOB_STATUS.DRAFT,
    });
    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/company/recruiters/${recruiter.user._id.toString()}/terminate`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(
      /outstanding Primary Job responsibility/i,
    );

    const membership = await CompanyMember.findById(recruiter.membership._id);
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("allows lock when Primary Jobs are only CLOSED or EXPIRED", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.br41.allow@example.com",
      businessRegistrationNumber: "BRN-V5-BR41-3",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.br41.allow@example.com",
      company: manager.company,
      employeeCode: "NV-BR41-3",
    });
    const publishedAt = new Date("2026-01-01T00:00:00.000Z");

    await createPrimaryJob({
      companyId: manager.company._id,
      membershipId: recruiter.membership._id,
      status: JOB_STATUS.CLOSED,
      publishedAt,
    });
    await createPrimaryJob({
      companyId: manager.company._id,
      membershipId: recruiter.membership._id,
      status: JOB_STATUS.EXPIRED,
      publishedAt,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/company/recruiters/${recruiter.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(
      COMPANY_MEMBER_STATUS.LOCKED,
    );

    const membership = await CompanyMember.findById(recruiter.membership._id);
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
  });

  it("allows terminate when Recruiter has no outstanding Primary Jobs", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.br41.term.ok@example.com",
      businessRegistrationNumber: "BRN-V5-BR41-4",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.br41.term.ok@example.com",
      company: manager.company,
      employeeCode: "NV-BR41-4",
    });
    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/company/recruiters/${recruiter.user._id.toString()}/terminate`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.recruiter.membership.status).toBe(
      COMPANY_MEMBER_STATUS.TERMINATED,
    );
  });
});
