import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Job from "../../src/models/job.model.js";
import { assertRecruiterCandidateSearchJobMembership } from "../../src/services/job.service.js";
import {
  DEFAULT_PASSWORD,
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const createJob = async ({
  companyId,
  createdByCompanyMemberId,
  primaryRecruiterCompanyMemberId = createdByCompanyMemberId,
  supportingRecruiterCompanyMemberIds = [],
  status = JOB_STATUS.DRAFT,
  applicationDeadline = null,
} = {}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId,
    primaryRecruiterCompanyMemberId,
    supportingRecruiterCompanyMemberIds,
    status,
    applicationDeadline,
  });
};

describe("V14 Slice 01 — Recruiter Candidate Search eligibility (F01)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("declares V14 same-company Job-team lookup indexes", async () => {
    await Job.syncIndexes();

    const indexes = await Job.collection.indexes();
    const indexKeysList = indexes.map((idx) => Object.keys(idx.key));

    expect(indexKeysList).toContainEqual([
      "companyId",
      "primaryRecruiterCompanyMemberId",
    ]);
    expect(indexKeysList).toContainEqual([
      "companyId",
      "supportingRecruiterCompanyMemberIds",
    ]);
  });

  it("accepts recruiter eligibility proof from a DRAFT same-company Job (BR-03)", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v14.proof@example.com",
      businessRegistrationNumber: "BRN-V14-PROOF-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.v14.proof@example.com",
      company: manager.company,
      employeeCode: "NV-V14-PROOF-1",
    });

    const proofJob = await createJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      status: JOB_STATUS.DRAFT,
    });

    const resolved = await assertRecruiterCandidateSearchJobMembership({
      companyId: manager.company._id,
      recruiterCompanyMemberId: recruiter.membership._id,
    });

    expect(resolved._id.toString()).toBe(proofJob._id.toString());
  });

  it("accepts recruiter eligibility proof from a supporting membership on a CLOSED Job (BR-03)", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v14.closed@example.com",
      businessRegistrationNumber: "BRN-V14-CLOSED-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.v14.closed@example.com",
      company: manager.company,
      employeeCode: "NV-V14-CLOSED-P",
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v14.closed@example.com",
      company: manager.company,
      employeeCode: "NV-V14-CLOSED-S",
    });

    const proofJob = await createJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      supportingRecruiterCompanyMemberIds: [supporting.membership._id],
      status: JOB_STATUS.CLOSED,
    });

    const resolved = await assertRecruiterCandidateSearchJobMembership({
      companyId: manager.company._id,
      recruiterCompanyMemberId: supporting.membership._id,
    });

    expect(resolved._id.toString()).toBe(proofJob._id.toString());
  });

  it("rejects recruiter without any current same-company Job-team membership (BR-03)", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v14.nojob@example.com",
      businessRegistrationNumber: "BRN-V14-NOJOB-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.v14.nojob@example.com",
      company: manager.company,
      employeeCode: "NV-V14-NOJOB-1",
    });

    await expect(
      assertRecruiterCandidateSearchJobMembership({
        companyId: manager.company._id,
        recruiterCompanyMemberId: recruiter.membership._id,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringMatching(/at least one Job/i),
    });
  });

  it("rejects a recruiter when their only Job membership belongs to another Company (BR-02/BR-03)", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v14.tenant@example.com",
      businessRegistrationNumber: "BRN-V14-TENANT-1",
    });
    const foreignManager = await createActiveCompanyManagerContext({
      email: "cm.v14.tenant.foreign@example.com",
      businessRegistrationNumber: "BRN-V14-TENANT-2",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.v14.tenant@example.com",
      company: manager.company,
      employeeCode: "NV-V14-TENANT-1",
    });
    const foreignRecruiter = await createActiveRecruiterContext({
      email: "recruiter.v14.tenant.foreign@example.com",
      company: foreignManager.company,
      employeeCode: "NV-V14-TENANT-2",
    });

    await createJob({
      companyId: foreignManager.company._id,
      createdByCompanyMemberId: foreignRecruiter.membership._id,
      primaryRecruiterCompanyMemberId: foreignRecruiter.membership._id,
      supportingRecruiterCompanyMemberIds: [recruiter.membership._id],
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: new Date("2024-01-01T00:00:00.000Z"),
    });

    await expect(
      assertRecruiterCandidateSearchJobMembership({
        companyId: manager.company._id,
        recruiterCompanyMemberId: recruiter.membership._id,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("HTTP probe grants Candidate Search only to eligible Recruiters and returns proofJobId", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v14.http@example.com",
      businessRegistrationNumber: "BRN-V14-HTTP-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.v14.http@example.com",
      company: manager.company,
      employeeCode: "NV-V14-HTTP-1",
    });

    const proofJob = await createJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      status: JOB_STATUS.EXPIRED,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get("/api/company-staff-access-probe/candidate-search")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.authz.companyRole).toBe(COMPANY_MEMBER_ROLE.RECRUITER);
    expect(response.body.authz.membershipStatus).toBe(
      COMPANY_MEMBER_STATUS.ACTIVE,
    );
    expect(response.body.authz.proofJobId).toBe(proofJob._id.toString());
  });

  it("HTTP probe denies Recruiter without any Job-team membership (BR-03/BR-33)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v14.http.nojob@example.com",
      businessRegistrationNumber: "BRN-V14-HTTP-2",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.v14.http.nojob@example.com",
      company: manager.company,
      employeeCode: "NV-V14-HTTP-2",
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get("/api/company-staff-access-probe/candidate-search")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/at least one Job/i);
  });

  it("HTTP probe denies Company Manager even with active Company business access (BR-05)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v14.http.cm@example.com",
      businessRegistrationNumber: "BRN-V14-HTTP-3",
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get("/api/company-staff-access-probe/candidate-search")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/Recruiter access required/i);
  });

  it("HTTP probe denies Candidate even if authenticated (BR-01)", async () => {
    const agent = createTestAgent();
    const candidate = await createVerifiedUser({
      email: "candidate.v14.http@example.com",
      fullName: "Candidate V14",
      role: USER_ROLE.CANDIDATE,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: candidate.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get("/api/company-staff-access-probe/candidate-search")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/Company Staff access required/i);
  });

  it("HTTP probe re-derives eligibility and denies after Company is no longer active (BR-02/BR-04/BR-33)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v14.dynamic@example.com",
      businessRegistrationNumber: "BRN-V14-DYNAMIC-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.v14.dynamic@example.com",
      company: manager.company,
      employeeCode: "NV-V14-DYNAMIC-1",
    });

    await createJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      status: JOB_STATUS.DRAFT,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const allowed = await agent
      .get("/api/company-staff-access-probe/candidate-search")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(allowed.status).toBe(200);

    manager.company.operationalStatus = COMPANY_OPERATIONAL_STATUS.LOCKED;
    await manager.company.save();

    const denied = await agent
      .get("/api/company-staff-access-probe/candidate-search")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(denied.status).toBe(403);
    expect(denied.body.error.message).toMatch(/not available for business access/i);
  });

  it("HTTP probe re-derives eligibility and denies after the last Job-team membership is removed (BR-04/BR-33)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v14.dynamic.team@example.com",
      businessRegistrationNumber: "BRN-V14-DYNAMIC-2",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.v14.dynamic.team@example.com",
      company: manager.company,
      employeeCode: "NV-V14-DYNAMIC-2",
    });
    const replacementPrimary = await createActiveRecruiterContext({
      email: "replacement.v14.dynamic.team@example.com",
      company: manager.company,
      employeeCode: "NV-V14-DYNAMIC-3",
    });

    const proofJob = await createJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: new Date("2020-01-01T00:00:00.000Z"),
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const allowed = await agent
      .get("/api/company-staff-access-probe/candidate-search")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(allowed.status).toBe(200);
    expect(allowed.body.authz.proofJobId).toBe(proofJob._id.toString());

    await Job.updateOne(
      { _id: proofJob._id },
      {
        $set: {
          primaryRecruiterCompanyMemberId: replacementPrimary.membership._id,
          supportingRecruiterCompanyMemberIds: [],
        },
      },
    );

    const denied = await agent
      .get("/api/company-staff-access-probe/candidate-search")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(denied.status).toBe(403);
    expect(denied.body.error.message).toMatch(/at least one Job/i);
  });

  it("HTTP probe denies recruiter with locked membership before Job lookup (BR-02)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v14.lockedmem@example.com",
      businessRegistrationNumber: "BRN-V14-LOCKED-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.v14.lockedmem@example.com",
      company: manager.company,
      employeeCode: "NV-V14-LOCKED-1",
      membershipStatus: COMPANY_MEMBER_STATUS.LOCKED,
    });

    await createJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: manager.membership._id,
      primaryRecruiterCompanyMemberId: manager.membership._id,
      supportingRecruiterCompanyMemberIds: [recruiter.membership._id],
      status: JOB_STATUS.DRAFT,
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get("/api/company-staff-access-probe/candidate-search")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/membership is not active/i);
  });

  it("HTTP probe denies platform-locked company-staff user before Job lookup (BR-02)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v14.lockeduser@example.com",
      businessRegistrationNumber: "BRN-V14-LOCKED-2",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.v14.lockeduser@example.com",
      company: manager.company,
      employeeCode: "NV-V14-LOCKED-2",
    });

    await createJob({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      status: JOB_STATUS.DRAFT,
    });

    recruiter.user.status = USER_STATUS.LOCKED;
    await recruiter.user.save();

    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get("/api/company-staff-access-probe/candidate-search")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.message).toMatch(/invalid or expired access token/i);
  });
});
