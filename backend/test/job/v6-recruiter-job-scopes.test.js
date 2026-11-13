import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import JOB_LIST_SCOPE from "../../src/constants/job-list-scope.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import { loadInternalJob } from "../../src/services/job.service.js";
import {
  createActiveCompanyManagerContext, createActiveRecruiterContext,
  createVerifiedUser, DEFAULT_PASSWORD, loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase, connectTestDatabase, createTestAgent, disconnectTestDatabase,
} from "../helpers/database.js";

const STATUSES = Object.values(JOB_STATUS);
const SCOPES = Object.values(JOB_LIST_SCOPE);
const ids = (jobs) => jobs.map((job) => job.id).sort();

describe("V6 Recruiter Job scopes and current-team content visibility", () => {
  let agent, manager, recruiter, peer, token;

  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);
  beforeEach(async () => {
    agent = createTestAgent();
    manager = await createActiveCompanyManagerContext({
      email: "manager.scopes@example.com", businessRegistrationNumber: "BRN-SCOPES",
    });
    recruiter = await createActiveRecruiterContext({
      email: "recruiter.scopes@example.com", company: manager.company, employeeCode: "SC-1",
    });
    peer = await createActiveRecruiterContext({
      email: "peer.scopes@example.com", company: manager.company, employeeCode: "SC-2",
    });
    token = await login(recruiter.user);
  });

  const login = (user) => loginAndGetAccessToken(agent, {
    email: user.email, password: DEFAULT_PASSWORD,
  });
  const get = (path, query = {}, accessToken = token) => agent.get(path)
    .query(query).set("Authorization", `Bearer ${accessToken}`);
  const list = (scope, query = {}) => get("/api/jobs", { scope, ...query });
  const makeJob = (overrides = {}) => Job.create({
    companyId: manager.company._id,
    createdByCompanyMemberId: peer.membership._id,
    primaryRecruiterCompanyMemberId: peer.membership._id,
    salary: { type: "NEGOTIABLE" }, title: "Private scope fixture",
    applicationDeadline: new Date(Date.now() + 86400000),
    ...overrides,
  });
  const seedMatrix = async () => {
    const primary = [], supporting = [], unrelated = [], foreign = [];
    for (const status of STATUSES) {
      primary.push(await makeJob({ status, primaryRecruiterCompanyMemberId: recruiter.membership._id }));
      supporting.push(await makeJob({ status, supportingRecruiterCompanyMemberIds: [recruiter.membership._id] }));
      unrelated.push(await makeJob({ status }));
      // Even a matching member reference cannot override the company predicate.
      foreign.push(await makeJob({ status, companyId: new mongoose.Types.ObjectId(),
        primaryRecruiterCompanyMemberId: recruiter.membership._id }));
      foreign.push(await makeJob({ status, companyId: new mongoose.Types.ObjectId(),
        supportingRecruiterCompanyMemberIds: [recruiter.membership._id] }));
    }
    return { primary, supporting, unrelated, foreign };
  };

  it.each(SCOPES)("%s filters the full company dataset and every listed Job is readable", async (scope) => {
    const { primary, supporting, unrelated } = await seedMatrix();
    const expected = {
      MY_TEAM: [...primary, ...supporting],
      MY_PRIMARY: primary,
      MY_SUPPORTING: supporting,
      COMPANY_PUBLISHED: [...primary, ...supporting, ...unrelated].filter((job) => job.status === JOB_STATUS.PUBLISHED),
    }[scope];
    const response = await list(scope);
    expect(response.status).toBe(200);
    expect(ids(response.body.jobs)).toEqual(ids(expected));
    expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: expected.length, totalPages: 1 });
    for (const job of response.body.jobs) {
      const detail = await get(`/api/jobs/${job.id}`);
      expect(detail.status).toBe(200);
      expect(detail.body.job).toEqual(job);
      expect(job).not.toHaveProperty("supportingRecruiterCompanyMemberIds");
      expect(job).not.toHaveProperty("myTeamRole");
    }
    const ordered = [...expected].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    const next = await list(scope, { page: 2, limit: 2, companyId: manager.company.id });
    expect(next.status).toBe(200);
    expect(next.body.jobs.map((job) => job.id)).toEqual(ordered.slice(2, 4).map((job) => job.id));
    expect(next.body.pagination).toEqual({ page: 2, limit: 2, total: expected.length, totalPages: Math.ceil(expected.length / 2) });
  });

  it.each(["PRIMARY", "SUPPORTING"])("removed %s loses private list/detail access immediately despite creator history", async (role) => {
    const jobs = [];
    for (const status of STATUSES) {
      jobs.push(await makeJob({ status, createdByCompanyMemberId: recruiter.membership._id,
        ...(role === "PRIMARY"
          ? { primaryRecruiterCompanyMemberId: recruiter.membership._id }
          : { supportingRecruiterCompanyMemberIds: [recruiter.membership._id] }),
      }));
    }
    expect((await list("MY_TEAM")).body.pagination.total).toBe(5);
    for (const job of jobs) {
      await Job.updateOne({ _id: job._id }, {
        $set: { primaryRecruiterCompanyMemberId: peer.membership._id },
        $pull: { supportingRecruiterCompanyMemberIds: recruiter.membership._id },
      });
      const detail = await get(`/api/jobs/${job.id}`);
      expect(detail.status).toBe(job.status === JOB_STATUS.PUBLISHED ? 200 : 403);
      if (detail.status === 403) {
        expect(detail.body).not.toHaveProperty("job");
        expect(JSON.stringify(detail.body)).not.toContain(job.title);
      }
    }
    for (const scope of ["MY_TEAM", "MY_PRIMARY", "MY_SUPPORTING"]) {
      const response = await list(scope);
      expect(response.body.jobs).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
    }
    const published = await list("COMPANY_PUBLISHED");
    expect(ids(published.body.jobs)).toEqual(ids(jobs.filter((job) => job.status === JOB_STATUS.PUBLISHED)));
  });

  it("actual Supporting removal endpoint revokes team scope but preserves company PUBLISHED read", async () => {
    const job = await makeJob({ status: JOB_STATUS.PUBLISHED,
      supportingRecruiterCompanyMemberIds: [recruiter.membership._id] });
    await agent.delete(`/api/jobs/${job.id}/team/supporting/${recruiter.membership.id}`)
      .set("Authorization", `Bearer ${await login(peer.user)}`).expect(200);
    expect((await list("MY_SUPPORTING")).body.jobs).toEqual([]);
    await get(`/api/jobs/${job.id}`).expect(200);
    expect(ids((await list("COMPANY_PUBLISHED")).body.jobs)).toEqual([job.id]);
  });

  it("authorized persisted-source reads use the same Supporting boundary and fail after removal", async () => {
    const job = await makeJob({ status: JOB_STATUS.EXPIRED,
      supportingRecruiterCompanyMemberIds: [recruiter.membership._id] });
    const input = { actorUser: recruiter.user, jobId: job.id };
    const source = await loadInternalJob(input, { includePersistedSource: true });
    expect(source.persistedJob._id.toString()).toBe(job.id);
    await Job.updateOne({ _id: job._id }, { $pull: { supportingRecruiterCompanyMemberIds: recruiter.membership._id } });
    await expect(loadInternalJob(input, { includePersistedSource: true })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("Supporting can read effectively expired PUBLISHED content without gaining ended team-read rights", async () => {
    const job = await makeJob({ status: JOB_STATUS.PUBLISHED, applicationDeadline: new Date(0),
      supportingRecruiterCompanyMemberIds: [recruiter.membership._id] });
    await get(`/api/jobs/${job.id}`).expect(200);
    await get(`/api/jobs/${job.id}/team`).expect(403);
    expect(ids((await list("MY_SUPPORTING")).body.jobs)).toEqual([job.id]);
  });

  it("Company Manager keeps legacy status visibility and cannot select Recruiter scopes", async () => {
    const { primary, supporting, unrelated } = await seedMatrix();
    const managerToken = await login(manager.user);
    const response = await get("/api/jobs", {}, managerToken);
    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("pagination");
    expect(ids(response.body.jobs)).toEqual(ids([...primary, ...supporting, ...unrelated].filter((job) => job.status !== JOB_STATUS.DRAFT)));
    for (const job of supporting) {
      await get(`/api/jobs/${job.id}`, {}, managerToken).expect(job.status === JOB_STATUS.DRAFT ? 403 : 200);
    }
    for (const scope of SCOPES) await get("/api/jobs", { scope }, managerToken).expect(403);
  });

  it("Supporting read adds no Job mutation, approval, assignment or primary-workspace authority", async () => {
    const supporting = { supportingRecruiterCompanyMemberIds: [recruiter.membership._id] };
    const draft = await makeJob(supporting);
    const pending = await makeJob({ ...supporting, status: JOB_STATUS.PENDING_APPROVAL });
    const published = await makeJob({ ...supporting, status: JOB_STATUS.PUBLISHED });
    await get(`/api/jobs/${draft.id}`).expect(200);
    const denyPost = (path, body = {}) => agent.post(path).set("Authorization", `Bearer ${token}`).send(body).expect(403);
    await agent.patch(`/api/jobs/${draft.id}`).set("Authorization", `Bearer ${token}`).send({ title: "Forbidden" }).expect(403);
    await denyPost(`/api/jobs/${draft.id}/submit`);
    await agent.delete(`/api/jobs/${draft.id}`).set("Authorization", `Bearer ${token}`).expect(403);
    await denyPost(`/api/jobs/${pending.id}/approve`);
    await denyPost(`/api/jobs/${pending.id}/reject`);
    await denyPost(`/api/jobs/${published.id}/close`);
    await get(`/api/jobs/${published.id}/workspace`).expect(403);
    await get(`/api/jobs/${published.id}/applications`).expect(403);
    await denyPost(`/api/jobs/${published.id}/applications/${new mongoose.Types.ObjectId()}/assign`, {
      assigneeCompanyMemberId: recruiter.membership.id, expectedVersion: 0,
    });
    await denyPost(`/api/jobs/${published.id}/team/supporting`, { supportingRecruiterCompanyMemberId: peer.membership.id });
    await denyPost(`/api/jobs/${published.id}/team/replace-primary`, {
      newPrimaryCompanyMemberId: recruiter.membership.id, keepOldPrimaryAsSupporting: false,
    });
    expect((await Job.findById(draft.id)).title).toBe(draft.title);
    expect((await Job.findById(published.id)).status).toBe(JOB_STATUS.PUBLISHED);
  });

  it("applies tenant guard to all scopes and rejects client identity overrides", async () => {
    const foreignCompanyId = new mongoose.Types.ObjectId();
    const job = await makeJob({ companyId: foreignCompanyId,
      supportingRecruiterCompanyMemberIds: [recruiter.membership._id] });
    await get(`/api/jobs/${job.id}`).expect(403);
    for (const scope of SCOPES) {
      const own = await list(scope, { companyId: manager.company.id });
      expect(own.status).toBe(200);
      expect(own.body.jobs).toEqual([]);
      await list(scope, { companyId: foreignCompanyId.toString() }).expect(403);
      for (const field of ["membershipId", "recruiterId", "role"]) {
        await list(scope, { [field]: peer.membership.id }).expect(400);
      }
    }
  });

  it("requires current active Company membership even when the Job retains team references", async () => {
    const job = await makeJob({ supportingRecruiterCompanyMemberIds: [recruiter.membership._id] });
    await CompanyMember.updateOne({ _id: recruiter.membership._id }, { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } });
    for (const scope of SCOPES) await list(scope).expect(403);
    await get(`/api/jobs/${job.id}`).expect(403);
  });

  it.each([USER_ROLE.CANDIDATE, USER_ROLE.PLATFORM_ADMIN])("%s and Guest retain denial for internal Job reads", async (role) => {
    const { user } = await createVerifiedUser({ email: `${role}@scopes.example.com`, role });
    const otherToken = await login(user);
    const job = await makeJob();
    for (const scope of SCOPES) await get("/api/jobs", { scope }, otherToken).expect(403);
    await get(`/api/jobs/${job.id}`, {}, otherToken).expect(403);
    await agent.get("/api/jobs?scope=MY_TEAM").expect(401);
    await agent.get(`/api/jobs/${job.id}`).expect(401);
  });

  it("paginates in stable createdAt/_id order with accurate full-dataset totals", async () => {
    const rows = [];
    const createdAt = new Date("2026-01-01T00:00:00Z");
    for (let index = 0; index < 25; index++) {
      rows.push(await makeJob({ primaryRecruiterCompanyMemberId: recruiter.membership._id, createdAt }));
    }
    const expected = rows.map((job) => job.id).sort();
    // More recent excluded documents must not affect totals or page boundaries.
    await makeJob();
    const first = await list("MY_PRIMARY");
    expect(first.status).toBe(200);
    expect(first.body.jobs.map((job) => job.id)).toEqual(expected.slice(0, 20));
    expect(first.body.pagination).toEqual({ page: 1, limit: 20, total: 25, totalPages: 2 });
    const second = await list("MY_PRIMARY", { page: 2 });
    expect(second.body.jobs.map((job) => job.id)).toEqual(expected.slice(20));
    const custom = await list("MY_PRIMARY", { page: 3, limit: 7 });
    expect(custom.body.jobs.map((job) => job.id)).toEqual(expected.slice(14, 21));
    expect(custom.body.pagination).toEqual({ page: 3, limit: 7, total: 25, totalPages: 4 });
    const beyond = await list("MY_PRIMARY", { page: 5, limit: 7 });
    expect(beyond.body.jobs).toEqual([]);
    expect(beyond.body.pagination).toEqual({ page: 5, limit: 7, total: 25, totalPages: 4 });
  });

  it.each(SCOPES)("%s returns canonical empty pagination", async (scope) => {
    const response = await list(scope, { page: 3, limit: 100 });
    expect(response.status).toBe(200);
    expect(response.body.jobs).toEqual([]);
    expect(response.body.pagination).toEqual({ page: 3, limit: 100, total: 0, totalPages: 0 });
  });

  it.each(["", "my_team", "ALL", "MY_TEAM "])("rejects invalid scope %j with the standard validation error", async (scope) => {
    const response = await list(scope);
    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ message: "Invalid scope query", details: { field: "scope" } });
  });

  it.each([
    ["page", "0"], ["page", "-1"], ["page", "1.5"], ["page", "1e2"],
    ["page", "9007199254740992"], ["page", "9007199254740991"],
    ["limit", "0"], ["limit", "-1"], ["limit", "1.5"], ["limit", "101"],
    ["limit", ""], ["limit", "abc"], ["page", "01"], ["page", " 2"],
  ])("rejects malformed %s=%s", async (field, value) => {
    const response = await list("MY_TEAM", { [field]: value });
    expect(response.status).toBe(400);
    expect(response.body.error.details.field).toBe(field);
  });

  it.each(["scope=MY_TEAM&scope=MY_PRIMARY", "scope=MY_TEAM&page=1&page=2", "scope=MY_TEAM&limit=1&limit=2"])("rejects repeated query parameters: %s", async (query) => {
    await get(`/api/jobs?${query}`).expect(400);
  });

  it.each(["q", "status", "sort"])("does not introduce an unsupported %s filter into scoped reads", async (field) => {
    const response = await list("MY_TEAM", { [field]: "CLOSED" });
    expect(response.status).toBe(400);
    expect(response.body.error.details.field).toBe(field);
  });

  it("preserves unscoped V5 results, payload, sorting and ignored legacy search/status/sort", async () => {
    const { primary, supporting, unrelated } = await seedMatrix();
    const expected = [...primary, ...supporting.filter((job) => job.status === JOB_STATUS.PUBLISHED),
      ...unrelated.filter((job) => job.status === JOB_STATUS.PUBLISHED)]
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    for (const query of [{}, { page: 2, limit: 1, q: "ignored", status: "CLOSED", sort: "-createdAt" }]) {
      const response = await get("/api/jobs", query);
      expect(response.status).toBe(200);
      expect(Object.keys(response.body).sort()).toEqual(["jobs", "message"]);
      expect(response.body.jobs.map((job) => job.id)).toEqual(expected.map((job) => job.id));
    }
  });

  it("keeps /managed primary-only, unpaginated and with its pipeline statistics payload", async () => {
    const primary = await makeJob({ primaryRecruiterCompanyMemberId: recruiter.membership._id });
    await makeJob({ supportingRecruiterCompanyMemberIds: [recruiter.membership._id] });
    const response = await get("/api/jobs/managed", { scope: "MY_SUPPORTING", page: 2, limit: 1 });
    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("pagination");
    expect(response.body).not.toHaveProperty("jobs");
    expect(response.body.managedJobs).toHaveLength(1);
    expect(response.body.managedJobs[0]).toMatchObject({
      job: { id: primary.id }, supportingRecruiterCount: 0,
      applicationCount: 0, unassignedCount: 0, currentWorkloadByAssignee: [],
    });
    expect(response.body.managedJobs[0]).toHaveProperty("countsByStatus");
    expect(response.body).toHaveProperty("currentWorkloadByAssignee");
  });
});
