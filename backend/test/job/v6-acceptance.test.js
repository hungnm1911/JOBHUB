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

const TEAM_URL = (jobId) => `/api/jobs/${jobId}/team`;
const ADD_SUPPORTING_URL = (jobId) => `/api/jobs/${jobId}/team/supporting`;
const REMOVE_SUPPORTING_URL = (jobId, memberId) =>
  `/api/jobs/${jobId}/team/supporting/${memberId}`;
const REPLACE_PRIMARY_URL = (jobId) => `/api/jobs/${jobId}/team/replace-primary`;
const REASSIGN_PRIMARY_URL = (jobId) => `/api/jobs/${jobId}/reassign-primary`;
const LOCK_URL = (userId) => `/api/company/recruiters/${userId}/lock`;
const TERMINATE_URL = (userId) => `/api/company/recruiters/${userId}/terminate`;
const UNLOCK_URL = (userId) => `/api/company/recruiters/${userId}/unlock`;
const CLOSE_URL = (jobId) => `/api/jobs/${jobId}/close`;
const EDIT_URL = (jobId) => `/api/jobs/${jobId}`;

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST_DEADLINE = new Date("2020-01-01T00:00:00.000Z");

let empCounter = 0;
const emp = () => `NV-ACC-${++empCounter}`;

const login = (agent, userEmail) =>
  loginAndGetAccessToken(agent, { email: userEmail });

const makeJob = async ({
  companyId,
  primaryMemberId,
  supportingIds = [],
  status = JOB_STATUS.PUBLISHED,
  applicationDeadline,
}) =>
  Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingIds,
    status,
    publishedAt: status === JOB_STATUS.DRAFT ? null : new Date("2026-01-15"),
    applicationDeadline,
    title: status === JOB_STATUS.DRAFT ? undefined : "Acceptance Job",
  });

describe("V6 Slice 07 — Final acceptance + regression closure", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });
  afterEach(async () => {
    await clearDatabase();
    empCounter = 0;
  });
  afterAll(async () => {
    await disconnectTestDatabase();
  });

  // ─── Team invariants (BR-01–BR-07) ───

  describe("Team invariants", () => {
    it("add/replace sequence keeps exactly one Primary, no duplicate Supporting, Primary not in Supporting", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm1@t.co", businessRegistrationNumber: "BRN-1" });
      const r1 = await createActiveRecruiterContext({ email: "r1@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2@t.co", company: mgr.company, employeeCode: emp() });
      const r3 = await createActiveRecruiterContext({ email: "r3@t.co", company: mgr.company, employeeCode: emp() });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, applicationDeadline: FUTURE_DEADLINE() });
      const token = await login(agent, mgr.user.email);

      await agent.post(ADD_SUPPORTING_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ supportingRecruiterCompanyMemberId: r2.membership._id.toString() }).expect(200);
      await agent.post(ADD_SUPPORTING_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ supportingRecruiterCompanyMemberId: r3.membership._id.toString() }).expect(200);
      await agent.post(REPLACE_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ newPrimaryCompanyMemberId: r2.membership._id.toString(), keepOldPrimaryAsSupporting: true }).expect(200);

      const j = await Job.findById(job._id).lean();
      expect(j.primaryRecruiterCompanyMemberId.toString()).toBe(r2.membership._id.toString());
      const sIds = j.supportingRecruiterCompanyMemberIds.map(id => id.toString());
      expect(sIds).toContain(r1.membership._id.toString());
      expect(sIds).toContain(r3.membership._id.toString());
      expect(sIds).not.toContain(r2.membership._id.toString());
      expect(new Set(sIds).size).toBe(sIds.length);
    });

    it("createdByCompanyMemberId unchanged through add/remove/replace/forced-transfer", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm2@t.co", businessRegistrationNumber: "BRN-2" });
      const r1 = await createActiveRecruiterContext({ email: "r1b@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2b@t.co", company: mgr.company, employeeCode: emp() });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, applicationDeadline: FUTURE_DEADLINE() });
      const creator = job.createdByCompanyMemberId.toString();
      const token = await login(agent, mgr.user.email);

      await agent.post(ADD_SUPPORTING_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ supportingRecruiterCompanyMemberId: r2.membership._id.toString() }).expect(200);
      await agent.post(REPLACE_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ newPrimaryCompanyMemberId: r2.membership._id.toString(), keepOldPrimaryAsSupporting: false }).expect(200);

      const j = await Job.findById(job._id).lean();
      expect(j.createdByCompanyMemberId.toString()).toBe(creator);
    });

    it("Primary/Supporting is per-Job, not User or CompanyMember role", async () => {
      const mgr = await createActiveCompanyManagerContext({ email: "cm3@t.co", businessRegistrationNumber: "BRN-3" });
      const r1 = await createActiveRecruiterContext({ email: "r1c@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2c@t.co", company: mgr.company, employeeCode: emp() });

      await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, supportingIds: [r2.membership._id], applicationDeadline: FUTURE_DEADLINE() });
      await makeJob({ companyId: mgr.company._id, primaryMemberId: r2.membership._id, supportingIds: [r1.membership._id], applicationDeadline: FUTURE_DEADLINE() });

      const member = await CompanyMember.findById(r1.membership._id).lean();
      expect(member).not.toHaveProperty("isPrimaryRecruiter");
      expect(member).not.toHaveProperty("primaryJobIds");
      const user = await User.findById(r1.user._id).lean();
      expect(user).not.toHaveProperty("isPrimaryRecruiter");
    });
  });

  // ─── F01 read boundary ───

  describe("F01 read authorization boundary", () => {
    it("CM reads team on any status; historical Primary on CLOSED denied", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm4@t.co", businessRegistrationNumber: "BRN-4" });
      const r1 = await createActiveRecruiterContext({ email: "r1d@t.co", company: mgr.company, employeeCode: emp() });

      const draftJob = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, status: JOB_STATUS.DRAFT, applicationDeadline: null });
      const closedJob = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, status: JOB_STATUS.CLOSED, applicationDeadline: PAST_DEADLINE });

      const cmToken = await login(agent, mgr.user.email);
      await agent.get(TEAM_URL(draftJob._id)).set("Authorization", `Bearer ${cmToken}`).expect(200);
      await agent.get(TEAM_URL(closedJob._id)).set("Authorization", `Bearer ${cmToken}`).expect(200);

      const r1Token = await login(agent, r1.user.email);
      await agent.get(TEAM_URL(closedJob._id)).set("Authorization", `Bearer ${r1Token}`).expect(403);
    });

    it("effectively expired PUBLISHED denies Recruiter team read", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm5@t.co", businessRegistrationNumber: "BRN-5" });
      const r1 = await createActiveRecruiterContext({ email: "r1e@t.co", company: mgr.company, employeeCode: emp() });

      const expJob = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, applicationDeadline: PAST_DEADLINE });
      const r1Token = await login(agent, r1.user.email);
      await agent.get(TEAM_URL(expJob._id)).set("Authorization", `Bearer ${r1Token}`).expect(403);
    });

    it("generic Job list does not leak supportingRecruiterCompanyMemberIds", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm6@t.co", businessRegistrationNumber: "BRN-6" });
      const r1 = await createActiveRecruiterContext({ email: "r1f@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2f@t.co", company: mgr.company, employeeCode: emp() });

      await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, supportingIds: [r2.membership._id], applicationDeadline: FUTURE_DEADLINE() });

      const cmToken = await login(agent, mgr.user.email);
      const res = await agent.get("/api/jobs").set("Authorization", `Bearer ${cmToken}`).expect(200);
      for (const job of res.body.jobs) {
        expect(job).not.toHaveProperty("supportingRecruiterCompanyMemberIds");
      }
    });
  });

  // ─── F02 add Supporting ───

  describe("F02 add Supporting constraints", () => {
    it("rejected on DRAFT and PENDING_APPROVAL (normal team management)", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm7@t.co", businessRegistrationNumber: "BRN-7" });
      const r1 = await createActiveRecruiterContext({ email: "r1g@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2g@t.co", company: mgr.company, employeeCode: emp() });

      const draftJob = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, status: JOB_STATUS.DRAFT, applicationDeadline: null });
      const pendJob = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, status: JOB_STATUS.PENDING_APPROVAL, applicationDeadline: FUTURE_DEADLINE() });

      const token = await login(agent, mgr.user.email);
      await agent.post(ADD_SUPPORTING_URL(draftJob._id)).set("Authorization", `Bearer ${token}`).send({ supportingRecruiterCompanyMemberId: r2.membership._id.toString() }).expect(409);
      await agent.post(ADD_SUPPORTING_URL(pendJob._id)).set("Authorization", `Bearer ${token}`).send({ supportingRecruiterCompanyMemberId: r2.membership._id.toString() }).expect(409);
    });

    it("rejected on effectively expired PUBLISHED", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm8@t.co", businessRegistrationNumber: "BRN-8" });
      const r1 = await createActiveRecruiterContext({ email: "r1h@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2h@t.co", company: mgr.company, employeeCode: emp() });

      const expJob = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, applicationDeadline: PAST_DEADLINE });
      const token = await login(agent, mgr.user.email);
      await agent.post(ADD_SUPPORTING_URL(expJob._id)).set("Authorization", `Bearer ${token}`).send({ supportingRecruiterCompanyMemberId: r2.membership._id.toString() }).expect(409);
    });

    it("rejects adding Primary as Supporting and cross-tenant Recruiter", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm9@t.co", businessRegistrationNumber: "BRN-9" });
      const r1 = await createActiveRecruiterContext({ email: "r1i@t.co", company: mgr.company, employeeCode: emp() });
      const fMgr = await createActiveCompanyManagerContext({ email: "fcm@t.co", businessRegistrationNumber: "BRN-F" });
      const fR = await createActiveRecruiterContext({ email: "fr@t.co", company: fMgr.company, employeeCode: emp() });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, applicationDeadline: FUTURE_DEADLINE() });
      const token = await login(agent, mgr.user.email);

      await agent.post(ADD_SUPPORTING_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ supportingRecruiterCompanyMemberId: r1.membership._id.toString() }).expect(409);
      await agent.post(ADD_SUPPORTING_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ supportingRecruiterCompanyMemberId: fR.membership._id.toString() }).expect(409);
    });
  });

  // ─── F03 remove Supporting ───

  describe("F03 remove Supporting", () => {
    it("removes without changing Primary, creator, company, or status", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm10@t.co", businessRegistrationNumber: "BRN-10" });
      const r1 = await createActiveRecruiterContext({ email: "r1j@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2j@t.co", company: mgr.company, employeeCode: emp() });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, supportingIds: [r2.membership._id], applicationDeadline: FUTURE_DEADLINE() });
      const token = await login(agent, mgr.user.email);
      await agent.delete(REMOVE_SUPPORTING_URL(job._id, r2.membership._id)).set("Authorization", `Bearer ${token}`).expect(200);

      const j = await Job.findById(job._id).lean();
      expect(j.primaryRecruiterCompanyMemberId.toString()).toBe(r1.membership._id.toString());
      expect(j.supportingRecruiterCompanyMemberIds).toHaveLength(0);
      expect(j.status).toBe(JOB_STATUS.PUBLISHED);
      expect(j.createdByCompanyMemberId.toString()).toBe(r1.membership._id.toString());
    });
  });

  // ─── F04 replace Primary ───

  describe("F04 replace Primary", () => {
    it("only CM; successor must be Supporting; explicit outcome required; legacy path same", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm11@t.co", businessRegistrationNumber: "BRN-11" });
      const r1 = await createActiveRecruiterContext({ email: "r1k@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2k@t.co", company: mgr.company, employeeCode: emp() });
      const r3 = await createActiveRecruiterContext({ email: "r3k@t.co", company: mgr.company, employeeCode: emp() });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, supportingIds: [r2.membership._id], applicationDeadline: FUTURE_DEADLINE() });
      const cmToken = await login(agent, mgr.user.email);

      // r3 not Supporting — rejected
      await agent.post(REPLACE_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${cmToken}`).send({ newPrimaryCompanyMemberId: r3.membership._id.toString(), keepOldPrimaryAsSupporting: true }).expect(409);

      // Missing keepOldPrimaryAsSupporting — 400
      await agent.post(REPLACE_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${cmToken}`).send({ newPrimaryCompanyMemberId: r2.membership._id.toString() }).expect(400);

      // Primary cannot self-replace
      const r1Token = await login(agent, r1.user.email);
      await agent.post(REPLACE_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${r1Token}`).send({ newPrimaryCompanyMemberId: r2.membership._id.toString(), keepOldPrimaryAsSupporting: true }).expect(403);

      // Legacy reassign-primary also requires explicit outcome
      await agent.post(REASSIGN_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${cmToken}`).send({ primaryRecruiterCompanyMemberId: r2.membership._id.toString() }).expect(400);

      // Legacy with explicit outcome works
      await agent.post(REASSIGN_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${cmToken}`).send({ primaryRecruiterCompanyMemberId: r2.membership._id.toString(), keepOldPrimaryAsSupporting: true }).expect(200);
    });
  });

  // ─── TX-01 atomic outcome ───

  describe("TX-01 atomic team mutation", () => {
    it("replace leaves exactly one Primary, no intermediate missing/dual state", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm12@t.co", businessRegistrationNumber: "BRN-12" });
      const r1 = await createActiveRecruiterContext({ email: "r1l@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2l@t.co", company: mgr.company, employeeCode: emp() });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, supportingIds: [r2.membership._id], applicationDeadline: FUTURE_DEADLINE() });
      const token = await login(agent, mgr.user.email);
      await agent.post(REPLACE_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ newPrimaryCompanyMemberId: r2.membership._id.toString(), keepOldPrimaryAsSupporting: false }).expect(200);

      const j = await Job.findById(job._id).lean();
      expect(j.primaryRecruiterCompanyMemberId.toString()).toBe(r2.membership._id.toString());
      expect(j.supportingRecruiterCompanyMemberIds.map(id => id.toString())).not.toContain(r2.membership._id.toString());
    });
  });

  // ─── TX-02 concurrency boundary ───

  describe("TX-02 team assignment vs lock/terminate", () => {
    it("cannot add LOCKED Recruiter as Supporting", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm13@t.co", businessRegistrationNumber: "BRN-13" });
      const r1 = await createActiveRecruiterContext({ email: "r1m@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2m@t.co", company: mgr.company, employeeCode: emp() });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, applicationDeadline: FUTURE_DEADLINE() });
      const token = await login(agent, mgr.user.email);

      await agent.post(LOCK_URL(r2.user._id)).set("Authorization", `Bearer ${token}`).send({ transfers: [] }).expect(200);
      await agent.post(ADD_SUPPORTING_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ supportingRecruiterCompanyMemberId: r2.membership._id.toString() }).expect(409);
    });

    it("cannot promote TERMINATED Recruiter (still in Supporting list) to Primary", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm14@t.co", businessRegistrationNumber: "BRN-14" });
      const r1 = await createActiveRecruiterContext({ email: "r1n@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2n@t.co", company: mgr.company, employeeCode: emp() });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, supportingIds: [r2.membership._id], applicationDeadline: FUTURE_DEADLINE() });
      const token = await login(agent, mgr.user.email);

      await agent.post(TERMINATE_URL(r2.user._id)).set("Authorization", `Bearer ${token}`).send({ transfers: [] }).expect(200);
      await agent.post(REPLACE_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ newPrimaryCompanyMemberId: r2.membership._id.toString(), keepOldPrimaryAsSupporting: true }).expect(409);
    });
  });

  // ─── F05 forced transfer ───

  describe("F05 forced transfer", () => {
    it("LOCK processes all unfinished Jobs; CLOSED/EXPIRED excluded", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm15@t.co", businessRegistrationNumber: "BRN-15" });
      const r1 = await createActiveRecruiterContext({ email: "r1o@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2o@t.co", company: mgr.company, employeeCode: emp() });

      const pubJob = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, supportingIds: [r2.membership._id], applicationDeadline: FUTURE_DEADLINE() });
      const supJob = await makeJob({ companyId: mgr.company._id, primaryMemberId: r2.membership._id, supportingIds: [r1.membership._id], applicationDeadline: FUTURE_DEADLINE() });
      const closedJob = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, status: JOB_STATUS.CLOSED, applicationDeadline: PAST_DEADLINE });

      const token = await login(agent, mgr.user.email);
      await agent.post(LOCK_URL(r1.user._id)).set("Authorization", `Bearer ${token}`).send({ transfers: [{ jobId: pubJob._id.toString(), replacementCompanyMemberId: r2.membership._id.toString() }] }).expect(200);

      const j1 = await Job.findById(pubJob._id).lean();
      expect(j1.primaryRecruiterCompanyMemberId.toString()).toBe(r2.membership._id.toString());
      expect(j1.supportingRecruiterCompanyMemberIds.map(id => id.toString())).not.toContain(r1.membership._id.toString());

      const j2 = await Job.findById(supJob._id).lean();
      expect(j2.supportingRecruiterCompanyMemberIds.map(id => id.toString())).not.toContain(r1.membership._id.toString());

      // CLOSED unchanged
      const jC = await Job.findById(closedJob._id).lean();
      expect(jC.primaryRecruiterCompanyMemberId.toString()).toBe(r1.membership._id.toString());
    });

    it("blocks lock when no replacement provided for unfinished Primary Job", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm16@t.co", businessRegistrationNumber: "BRN-16" });
      const r1 = await createActiveRecruiterContext({ email: "r1p@t.co", company: mgr.company, employeeCode: emp() });

      await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, applicationDeadline: FUTURE_DEADLINE() });
      const token = await login(agent, mgr.user.email);
      await agent.post(LOCK_URL(r1.user._id)).set("Authorization", `Bearer ${token}`).send({ transfers: [] }).expect(409);
    });

    it("forced-transfer exception NONE→SUPPORTING→PRIMARY only in F05, not normal F04", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm17@t.co", businessRegistrationNumber: "BRN-17" });
      const r1 = await createActiveRecruiterContext({ email: "r1q@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2q@t.co", company: mgr.company, employeeCode: emp() });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, applicationDeadline: FUTURE_DEADLINE() });
      const token = await login(agent, mgr.user.email);

      // Normal replace with non-Supporting — rejected
      await agent.post(REPLACE_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ newPrimaryCompanyMemberId: r2.membership._id.toString(), keepOldPrimaryAsSupporting: true }).expect(409);

      // Forced transfer (lock) with NONE replacement — succeeds
      await agent.post(LOCK_URL(r1.user._id)).set("Authorization", `Bearer ${token}`).send({ transfers: [{ jobId: job._id.toString(), replacementCompanyMemberId: r2.membership._id.toString() }] }).expect(200);

      const j = await Job.findById(job._id).lean();
      expect(j.primaryRecruiterCompanyMemberId.toString()).toBe(r2.membership._id.toString());
    });

    it("outgoing Primary ends at NONE (not Supporting) after forced transfer", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm18@t.co", businessRegistrationNumber: "BRN-18" });
      const r1 = await createActiveRecruiterContext({ email: "r1r@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2r@t.co", company: mgr.company, employeeCode: emp() });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, supportingIds: [r2.membership._id], applicationDeadline: FUTURE_DEADLINE() });
      const token = await login(agent, mgr.user.email);
      await agent.post(LOCK_URL(r1.user._id)).set("Authorization", `Bearer ${token}`).send({ transfers: [{ jobId: job._id.toString(), replacementCompanyMemberId: r2.membership._id.toString() }] }).expect(200);

      const j = await Job.findById(job._id).lean();
      expect(j.supportingRecruiterCompanyMemberIds.map(id => id.toString())).not.toContain(r1.membership._id.toString());
    });

    it("forced transfer allowed on DRAFT Job; preserves lifecycle state", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm19@t.co", businessRegistrationNumber: "BRN-19" });
      const r1 = await createActiveRecruiterContext({ email: "r1s@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2s@t.co", company: mgr.company, employeeCode: emp() });

      const draftJob = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, status: JOB_STATUS.DRAFT, applicationDeadline: null });
      const token = await login(agent, mgr.user.email);
      await agent.post(LOCK_URL(r1.user._id)).set("Authorization", `Bearer ${token}`).send({ transfers: [{ jobId: draftJob._id.toString(), replacementCompanyMemberId: r2.membership._id.toString() }] }).expect(200);

      const j = await Job.findById(draftJob._id).lean();
      expect(j.primaryRecruiterCompanyMemberId.toString()).toBe(r2.membership._id.toString());
      expect(j.status).toBe(JOB_STATUS.DRAFT);
    });
  });

  // ─── Unlock does not restore team ───

  describe("Unlock regression (BR-29)", () => {
    it("unlock after forced transfer does not restore old team positions", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm20@t.co", businessRegistrationNumber: "BRN-20" });
      const r1 = await createActiveRecruiterContext({ email: "r1t@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2t@t.co", company: mgr.company, employeeCode: emp() });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, supportingIds: [r2.membership._id], applicationDeadline: FUTURE_DEADLINE() });
      const token = await login(agent, mgr.user.email);

      await agent.post(LOCK_URL(r1.user._id)).set("Authorization", `Bearer ${token}`).send({ transfers: [{ jobId: job._id.toString(), replacementCompanyMemberId: r2.membership._id.toString() }] }).expect(200);
      await agent.post(UNLOCK_URL(r1.user._id)).set("Authorization", `Bearer ${token}`).expect(200);

      const j = await Job.findById(job._id).lean();
      expect(j.primaryRecruiterCompanyMemberId.toString()).toBe(r2.membership._id.toString());
      expect(j.supportingRecruiterCompanyMemberIds.map(id => id.toString())).not.toContain(r1.membership._id.toString());
    });
  });

  // ─── Supporting does not inherit V5 permissions ───

  describe("Supporting does not inherit V5 lifecycle permissions (BR-31)", () => {
    it("Supporting cannot close Job", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm21@t.co", businessRegistrationNumber: "BRN-21" });
      const r1 = await createActiveRecruiterContext({ email: "r1u@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2u@t.co", company: mgr.company, employeeCode: emp() });

      await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, supportingIds: [r2.membership._id], applicationDeadline: FUTURE_DEADLINE() });
      const r2Token = await login(agent, r2.user.email);
      const jobs = await Job.find({ companyId: mgr.company._id }).lean();
      await agent.post(CLOSE_URL(jobs[0]._id)).set("Authorization", `Bearer ${r2Token}`).expect(403);
    });

    it("Supporting cannot edit DRAFT Job", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm22@t.co", businessRegistrationNumber: "BRN-22" });
      const r1 = await createActiveRecruiterContext({ email: "r1v@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2v@t.co", company: mgr.company, employeeCode: emp() });

      const draftJob = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, supportingIds: [r2.membership._id], status: JOB_STATUS.DRAFT, applicationDeadline: null });
      const r2Token = await login(agent, r2.user.email);
      await agent.patch(EDIT_URL(draftJob._id)).set("Authorization", `Bearer ${r2Token}`).send({ title: "Hacked" }).expect(403);
    });
  });

  // ─── Cross-tenant blocking ───

  describe("Cross-tenant blocked", () => {
    it("foreign CM cannot read team, add, or replace on other company Job", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm23@t.co", businessRegistrationNumber: "BRN-23" });
      const r1 = await createActiveRecruiterContext({ email: "r1w@t.co", company: mgr.company, employeeCode: emp() });
      const fMgr = await createActiveCompanyManagerContext({ email: "fcm2@t.co", businessRegistrationNumber: "BRN-F2" });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, applicationDeadline: FUTURE_DEADLINE() });
      const fToken = await login(agent, fMgr.user.email);

      await agent.get(TEAM_URL(job._id)).set("Authorization", `Bearer ${fToken}`).expect(403);
      await agent.post(ADD_SUPPORTING_URL(job._id)).set("Authorization", `Bearer ${fToken}`).send({ supportingRecruiterCompanyMemberId: r1.membership._id.toString() }).expect(403);
      await agent.post(REPLACE_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${fToken}`).send({ newPrimaryCompanyMemberId: r1.membership._id.toString(), keepOldPrimaryAsSupporting: true }).expect(403);
    });
  });

  // ─── Effective-expiration deadline semantics ───

  describe("Effective-expiration at operation boundary", () => {
    it("all normal team ops denied on persisted PUBLISHED with past deadline", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm24@t.co", businessRegistrationNumber: "BRN-24" });
      const r1 = await createActiveRecruiterContext({ email: "r1x@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2x@t.co", company: mgr.company, employeeCode: emp() });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, supportingIds: [r2.membership._id], applicationDeadline: PAST_DEADLINE });
      const token = await login(agent, mgr.user.email);

      await agent.post(ADD_SUPPORTING_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ supportingRecruiterCompanyMemberId: r2.membership._id.toString() }).expect(409);
      await agent.delete(REMOVE_SUPPORTING_URL(job._id, r2.membership._id)).set("Authorization", `Bearer ${token}`).expect(409);
      await agent.post(REPLACE_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ newPrimaryCompanyMemberId: r2.membership._id.toString(), keepOldPrimaryAsSupporting: true }).expect(409);
    });
  });

  // ─── Historical references ───

  describe("Historical references preserved", () => {
    it("CLOSED/EXPIRED team refs unchanged after lock of historical Primary", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm25@t.co", businessRegistrationNumber: "BRN-25" });
      const r1 = await createActiveRecruiterContext({ email: "r1y@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2y@t.co", company: mgr.company, employeeCode: emp() });

      const closedJob = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, supportingIds: [r2.membership._id], status: JOB_STATUS.CLOSED, applicationDeadline: PAST_DEADLINE });
      const token = await login(agent, mgr.user.email);

      await agent.post(LOCK_URL(r1.user._id)).set("Authorization", `Bearer ${token}`).send({ transfers: [] }).expect(200);

      const j = await Job.findById(closedJob._id).lean();
      expect(j.primaryRecruiterCompanyMemberId.toString()).toBe(r1.membership._id.toString());
      expect(j.supportingRecruiterCompanyMemberIds.map(id => id.toString())).toContain(r2.membership._id.toString());
    });
  });

  // ─── Sequential operations ───

  describe("Sequential add/remove/replace keeps team invariants", () => {
    it("full sequence on same Job maintains valid state", async () => {
      const agent = createTestAgent();
      const mgr = await createActiveCompanyManagerContext({ email: "cm26@t.co", businessRegistrationNumber: "BRN-26" });
      const r1 = await createActiveRecruiterContext({ email: "r1z@t.co", company: mgr.company, employeeCode: emp() });
      const r2 = await createActiveRecruiterContext({ email: "r2z@t.co", company: mgr.company, employeeCode: emp() });
      const r3 = await createActiveRecruiterContext({ email: "r3z@t.co", company: mgr.company, employeeCode: emp() });

      const job = await makeJob({ companyId: mgr.company._id, primaryMemberId: r1.membership._id, applicationDeadline: FUTURE_DEADLINE() });
      const token = await login(agent, mgr.user.email);

      await agent.post(ADD_SUPPORTING_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ supportingRecruiterCompanyMemberId: r2.membership._id.toString() }).expect(200);
      await agent.post(ADD_SUPPORTING_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ supportingRecruiterCompanyMemberId: r3.membership._id.toString() }).expect(200);
      await agent.post(REPLACE_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ newPrimaryCompanyMemberId: r2.membership._id.toString(), keepOldPrimaryAsSupporting: true }).expect(200);
      await agent.delete(REMOVE_SUPPORTING_URL(job._id, r1.membership._id)).set("Authorization", `Bearer ${token}`).expect(200);
      await agent.post(REPLACE_PRIMARY_URL(job._id)).set("Authorization", `Bearer ${token}`).send({ newPrimaryCompanyMemberId: r3.membership._id.toString(), keepOldPrimaryAsSupporting: false }).expect(200);

      const j = await Job.findById(job._id).lean();
      expect(j.primaryRecruiterCompanyMemberId.toString()).toBe(r3.membership._id.toString());
      expect(j.supportingRecruiterCompanyMemberIds).toHaveLength(0);
      expect(j.createdByCompanyMemberId.toString()).toBe(r1.membership._id.toString());
      expect(j.companyId.toString()).toBe(mgr.company._id.toString());
    });
  });

  // ─── Deferred scope absence ───

  describe("Explicit absence of deferred V6 scope", () => {
    it("no Invitation/RecruitmentTeam/history collections", async () => {
      const collections = await Job.db.db.listCollections().toArray();
      const names = collections.map(c => c.name);
      expect(names).not.toContain("invitations");
      expect(names).not.toContain("recruitment_teams");
      expect(names).not.toContain("job_recruitment_members");
      expect(names).not.toContain("recruitment_team_history");
      expect(names).not.toContain("responsibility_transfer_history");
      expect(names).not.toContain("notifications");
    });

    it("no custom Supporting permission or auto-restore fields in schema", async () => {
      const jobPaths = Object.keys(Job.schema.paths);
      expect(jobPaths).not.toContain("supportingPermissions");
      expect(jobPaths).not.toContain("teamPermission");
      expect(jobPaths).not.toContain("previousPrimaryRecruiterCompanyMemberId");
      expect(jobPaths).not.toContain("previousSupportingRecruiterCompanyMemberIds");

      const memberPaths = Object.keys(CompanyMember.schema.paths);
      expect(memberPaths).not.toContain("jobRole");
      expect(memberPaths).not.toContain("recruitmentRole");
      expect(memberPaths).not.toContain("primaryJobIds");
      expect(memberPaths).not.toContain("supportingJobIds");
    });
  });

  // ─── V5 compat ───

  describe("V5 compatibility", () => {
    it("Job without explicit supportingRecruiterCompanyMemberIds defaults to empty array", async () => {
      const mgr = await createActiveCompanyManagerContext({ email: "cm27@t.co", businessRegistrationNumber: "BRN-27" });
      const r1 = await createActiveRecruiterContext({ email: "r1aa@t.co", company: mgr.company, employeeCode: emp() });

      const job = await Job.create({ companyId: mgr.company._id, createdByCompanyMemberId: r1.membership._id, primaryRecruiterCompanyMemberId: r1.membership._id, status: JOB_STATUS.DRAFT });
      const loaded = await Job.findById(job._id).lean();
      expect(loaded.supportingRecruiterCompanyMemberIds).toEqual([]);
    });
  });
});
