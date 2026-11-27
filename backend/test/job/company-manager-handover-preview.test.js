import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_STATUS from "../../src/constants/user-status.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import {
  createActiveCompanyManagerContext, createActiveRecruiterContext,
  DEFAULT_PASSWORD, loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import { clearDatabase, connectTestDatabase, createTestAgent, disconnectTestDatabase } from "../helpers/database.js";

const jobFor = (company, primary, status, extra = {}) => Job.create({
  companyId: company._id, createdByCompanyMemberId: primary.membership._id,
  primaryRecruiterCompanyMemberId: primary.membership._id,
  status, salary: { type: "NEGOTIABLE" }, title: "CONFIDENTIAL DRAFT CONTENT",
  applicationDeadline: new Date(Date.now() + 86_400_000), ...extra,
});

describe("Company Manager forced-transfer preview", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  it("projects only unfinished Primary identifiers, counts Supporting, and pages eligible same-Company replacements without writes", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext();
    const source = await createActiveRecruiterContext({ company: manager.company, email: "source@example.com", employeeCode: "SOURCE" });
    const replacement = await createActiveRecruiterContext({ company: manager.company, email: "replacement@example.com", employeeCode: "REPLACE", fullName: "Eligible Person" });
    await createActiveRecruiterContext({ company: manager.company, email: "locked@example.com", employeeCode: "LOCK", membershipStatus: COMPANY_MEMBER_STATUS.LOCKED });
    const restricted = await createActiveRecruiterContext({ company: manager.company, email: "restricted@example.com", employeeCode: "RESTRICT" });
    restricted.user.status = USER_STATUS.LOCKED; await restricted.user.save();
    const pending = await createActiveRecruiterContext({ company: manager.company, email: "pending@example.com", employeeCode: "PENDING" });
    pending.user.mustChangePassword = true; await pending.user.save();
    const draft = await jobFor(manager.company, source, JOB_STATUS.DRAFT);
    const awaiting = await jobFor(manager.company, source, JOB_STATUS.PENDING_APPROVAL);
    await jobFor(manager.company, source, JOB_STATUS.PUBLISHED, { applicationDeadline: new Date("2020-01-01") });
    await jobFor(manager.company, source, JOB_STATUS.CLOSED);
    await jobFor(manager.company, replacement, JOB_STATUS.PUBLISHED, { supportingRecruiterCompanyMemberIds: [source.membership._id] });
    const beforeJobs = JSON.stringify(await Job.find().sort({ _id: 1 }).lean());
    const beforeMembers = JSON.stringify(await CompanyMember.find().sort({ _id: 1 }).lean());
    const token = await loginAndGetAccessToken(agent, { email: manager.user.email, password: DEFAULT_PASSWORD });
    const response = await agent.get(`/api/company/recruiters/${source.user._id}/handover?limit=1&q=Eligible`).set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.primaryJobs).toEqual(expect.arrayContaining([
      { jobId: String(draft._id), status: JOB_STATUS.DRAFT },
      { jobId: String(awaiting._id), status: JOB_STATUS.PENDING_APPROVAL },
    ]));
    expect(response.body.primaryJobs).toHaveLength(2);
    expect(response.body.supportingJobCount).toBe(1);
    expect(response.body.recruiters).toEqual([{ companyMemberId: String(replacement.membership._id), fullName: "Eligible Person", jobTitle: replacement.membership.jobTitle }]);
    expect(response.body.pagination).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });
    expect(JSON.stringify(response.body)).not.toMatch(/CONFIDENTIAL|password|token|email|companyId|applicationDeadline/);
    expect(JSON.stringify(await Job.find().sort({ _id: 1 }).lean())).toBe(beforeJobs);
    expect(JSON.stringify(await CompanyMember.find().sort({ _id: 1 }).lean())).toBe(beforeMembers);
    const secondPage = await agent.get(`/api/company/recruiters/${source.user._id}/handover?page=2&limit=1`).set("Authorization", `Bearer ${token}`);
    expect(secondPage.body.recruiters).toHaveLength(0);
    expect(secondPage.body.pagination.total).toBe(1);
  });

  it("denies foreign, invalid, non-Recruiter targets, Recruiter actors, and unsupported tenant query", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext();
    const other = await createActiveCompanyManagerContext({ email: "other.cm@example.com", businessRegistrationNumber: "OTHER-COMPANY" });
    const source = await createActiveRecruiterContext({ company: manager.company, email: "source@example.com", employeeCode: "SOURCE" });
    const foreign = await createActiveRecruiterContext({ company: other.company, email: "foreign@example.com", employeeCode: "FOREIGN" });
    const token = await loginAndGetAccessToken(agent, { email: manager.user.email, password: DEFAULT_PASSWORD });
    const get = (id, suffix = "") => agent.get(`/api/company/recruiters/${id}/handover${suffix}`).set("Authorization", `Bearer ${token}`);
    expect((await get(foreign.user._id)).status).toBe(404);
    expect((await get(manager.user._id)).status).toBe(404);
    expect((await get("invalid")).status).toBe(400);
    expect((await get(source.user._id, `?companyId=${other.company._id}`)).status).toBe(403);
    expect((await get(source.user._id, `?companyId=${manager.company._id}`)).status).toBe(400);
    const recruiterToken = await loginAndGetAccessToken(agent, { email: source.user.email, password: DEFAULT_PASSWORD });
    expect((await agent.get(`/api/company/recruiters/${source.user._id}/handover`).set("Authorization", `Bearer ${recruiterToken}`)).status).toBe(403);
    expect((await agent.get(`/api/company/recruiters/${source.user._id}/handover`)).status).toBe(401);
    source.membership.status = COMPANY_MEMBER_STATUS.TERMINATED; await source.membership.save();
    expect((await get(source.user._id)).status).toBe(409);
  });
});
