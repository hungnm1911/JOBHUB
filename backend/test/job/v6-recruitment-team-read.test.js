import mongoose from "mongoose";
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
  migrate,
  verify,
} from "../../src/database/migrations/v6-supporting-recruiter-backfill.js";
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

const createJob = async ({
  companyId,
  createdByCompanyMemberId,
  primaryRecruiterCompanyMemberId = createdByCompanyMemberId,
  supportingRecruiterCompanyMemberIds = [],
  status = JOB_STATUS.DRAFT,
  title = "Test Job",
  publishedAt = null,
  applicationDeadline = null,
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId,
    primaryRecruiterCompanyMemberId,
    supportingRecruiterCompanyMemberIds,
    status,
    title,
    publishedAt,
    applicationDeadline,
  });
};

describe("V6 Slice 01 — Recruitment Team persistence + read (F01)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("Job schema — supportingRecruiterCompanyMemberIds", () => {
    it("defaults to empty array and persists with new Jobs", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.schema@example.com",
        businessRegistrationNumber: "BRN-V6-S1",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.schema@example.com",
        company: manager.company,
        employeeCode: "NV-V6-1",
      });

      const job = await Job.create({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        primaryRecruiterCompanyMemberId: recruiter.membership._id,
        status: JOB_STATUS.DRAFT,
      });

      const persisted = await Job.findById(job._id).lean();

      expect(persisted.supportingRecruiterCompanyMemberIds).toEqual([]);
    });

    it("rejects duplicate Supporting members", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.dup@example.com",
        businessRegistrationNumber: "BRN-V6-S2",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.dup@example.com",
        company: manager.company,
        employeeCode: "NV-V6-2",
      });
      const supportingId = new mongoose.Types.ObjectId();

      await expect(
        Job.create({
          companyId: manager.company._id,
          createdByCompanyMemberId: recruiter.membership._id,
          primaryRecruiterCompanyMemberId: recruiter.membership._id,
          supportingRecruiterCompanyMemberIds: [supportingId, supportingId],
          status: JOB_STATUS.DRAFT,
        }),
      ).rejects.toThrow(/must not contain duplicates/i);
    });

    it("rejects Primary appearing in Supporting list", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.overlap@example.com",
        businessRegistrationNumber: "BRN-V6-S3",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.overlap@example.com",
        company: manager.company,
        employeeCode: "NV-V6-3",
      });

      await expect(
        Job.create({
          companyId: manager.company._id,
          createdByCompanyMemberId: recruiter.membership._id,
          primaryRecruiterCompanyMemberId: recruiter.membership._id,
          supportingRecruiterCompanyMemberIds: [recruiter.membership._id],
          status: JOB_STATUS.DRAFT,
        }),
      ).rejects.toThrow(/Primary Recruiter must not appear/i);
    });

    it("declares V6 lookup indexes", async () => {
      await Job.init();
      const indexes = await Job.collection.indexes();
      const indexKeysList = indexes.map((idx) => Object.keys(idx.key));

      expect(indexKeysList).toContainEqual([
        "primaryRecruiterCompanyMemberId",
        "status",
        "applicationDeadline",
      ]);
      expect(indexKeysList).toContainEqual([
        "supportingRecruiterCompanyMemberIds",
        "status",
        "applicationDeadline",
      ]);
    });
  });

  describe("V5 create DRAFT compatibility", () => {
    it("POST /api/jobs creates Job with empty Supporting (BR-03/BR-07)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.create@example.com",
        businessRegistrationNumber: "BRN-V6-C1",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.create@example.com",
        company: manager.company,
        employeeCode: "NV-V6-C1",
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post("/api/jobs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(201);
      // supportingRecruiterCompanyMemberIds must NOT appear in generic Job response
      expect(response.body.job).not.toHaveProperty(
        "supportingRecruiterCompanyMemberIds",
      );

      const persisted = await Job.findById(response.body.job.id).lean();

      expect(persisted.supportingRecruiterCompanyMemberIds).toEqual([]);
    });
  });

  describe("v6-supporting-recruiter-backfill migration", () => {
    it("backfills existing V5 Jobs with empty Supporting array and verifies indexes", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.mig@example.com",
        businessRegistrationNumber: "BRN-V6-M1",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.mig@example.com",
        company: manager.company,
        employeeCode: "NV-V6-M1",
      });

      await mongoose.connection.db.collection("jobs").insertOne(
        {
          companyId: manager.company._id,
          createdByCompanyMemberId: recruiter.membership._id,
          primaryRecruiterCompanyMemberId: recruiter.membership._id,
          status: JOB_STATUS.DRAFT,
          title: "Legacy V5 Job",
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { bypassDocumentValidation: true },
      );

      const result = await migrate(mongoose.connection);

      expect(result.modifiedCount).toBe(1);

      const jobs = await Job.find().lean();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].supportingRecruiterCompanyMemberIds).toEqual([]);

      await expect(verify(mongoose.connection)).resolves.toMatchObject({
        ok: true,
      });
    });

    it("is idempotent on re-run", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.idem@example.com",
        businessRegistrationNumber: "BRN-V6-M2",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.idem@example.com",
        company: manager.company,
        employeeCode: "NV-V6-M2",
      });

      await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
      });

      const first = await migrate(mongoose.connection);
      const second = await migrate(mongoose.connection);

      expect(first.matchedCount).toBe(0);
      expect(second.matchedCount).toBe(0);
    });
  });

  describe("GET /api/jobs/:jobId/team", () => {
    it("allows Company Manager to read Recruitment Team (BR-14)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.team@example.com",
        businessRegistrationNumber: "BRN-V6-T1",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.team@example.com",
        company: manager.company,
        employeeCode: "NV-V6-T1",
      });
      const supporting = await createActiveRecruiterContext({
        email: "supporting.v6.team@example.com",
        company: manager.company,
        employeeCode: "NV-V6-T2",
      });

      const job = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        supportingRecruiterCompanyMemberIds: [supporting.membership._id],
        status: JOB_STATUS.PUBLISHED,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
        applicationDeadline: new Date("2027-12-31T00:00:00.000Z"),
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/jobs/${job._id}/team`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.team).toEqual({
        jobId: job._id.toString(),
        primaryRecruiterCompanyMemberId: recruiter.membership._id.toString(),
        supportingRecruiterCompanyMemberIds: [
          supporting.membership._id.toString(),
        ],
      });
    });

    it("allows current Primary to read Recruitment Team (BR-15)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.prim@example.com",
        businessRegistrationNumber: "BRN-V6-T2",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.prim@example.com",
        company: manager.company,
        employeeCode: "NV-V6-T3",
      });

      const job = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        status: JOB_STATUS.DRAFT,
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/jobs/${job._id}/team`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.team.primaryRecruiterCompanyMemberId).toBe(
        recruiter.membership._id.toString(),
      );
    });

    it("allows current Supporting to read Recruitment Team read-only (BR-16)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.supp@example.com",
        businessRegistrationNumber: "BRN-V6-T3",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.supp.primary@example.com",
        company: manager.company,
        employeeCode: "NV-V6-T4",
      });
      const supporting = await createActiveRecruiterContext({
        email: "supporting.v6.supp@example.com",
        company: manager.company,
        employeeCode: "NV-V6-T5",
      });

      const job = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        supportingRecruiterCompanyMemberIds: [supporting.membership._id],
        status: JOB_STATUS.PUBLISHED,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
        applicationDeadline: new Date("2027-12-31T00:00:00.000Z"),
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/jobs/${job._id}/team`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.team.supportingRecruiterCompanyMemberIds).toContain(
        supporting.membership._id.toString(),
      );
    });

    it("denies peer Recruiter not in team", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.deny@example.com",
        businessRegistrationNumber: "BRN-V6-T4",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.deny.primary@example.com",
        company: manager.company,
        employeeCode: "NV-V6-T6",
      });
      const peer = await createActiveRecruiterContext({
        email: "peer.v6.deny@example.com",
        company: manager.company,
        employeeCode: "NV-V6-T7",
      });

      const job = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        status: JOB_STATUS.PUBLISHED,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
        applicationDeadline: new Date("2027-12-31T00:00:00.000Z"),
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: peer.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/jobs/${job._id}/team`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });

    it("denies cross-tenant access (BR-09/BR-32)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.cross@example.com",
        businessRegistrationNumber: "BRN-V6-T5",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.cross@example.com",
        company: manager.company,
        employeeCode: "NV-V6-T8",
      });
      const foreignManager = await createActiveCompanyManagerContext({
        email: "cm.v6.foreign@example.com",
        businessRegistrationNumber: "BRN-V6-T6",
      });

      const job = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        status: JOB_STATUS.DRAFT,
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: foreignManager.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/jobs/${job._id}/team`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });

    it("allows reading historical team on CLOSED/EXPIRED Jobs (BR-11)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.hist@example.com",
        businessRegistrationNumber: "BRN-V6-T7",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.hist@example.com",
        company: manager.company,
        employeeCode: "NV-V6-T9",
      });
      const supporting = await createActiveRecruiterContext({
        email: "supporting.v6.hist@example.com",
        company: manager.company,
        employeeCode: "NV-V6-T10",
      });

      const closedJob = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        supportingRecruiterCompanyMemberIds: [supporting.membership._id],
        status: JOB_STATUS.CLOSED,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      });

      const expiredJob = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        supportingRecruiterCompanyMemberIds: [supporting.membership._id],
        status: JOB_STATUS.EXPIRED,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });

      for (const job of [closedJob, expiredJob]) {
        const response = await agent
          .get(`/api/jobs/${job._id}/team`)
          .set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.team.supportingRecruiterCompanyMemberIds).toEqual([
          supporting.membership._id.toString(),
        ]);
      }
    });

    it("does not expand Supporting into V5 internal Job visibility", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.noexpand@example.com",
        businessRegistrationNumber: "BRN-V6-T8",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.noexpand@example.com",
        company: manager.company,
        employeeCode: "NV-V6-T11",
      });
      const supporting = await createActiveRecruiterContext({
        email: "supporting.v6.noexpand@example.com",
        company: manager.company,
        employeeCode: "NV-V6-T12",
      });

      const draftJob = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        supportingRecruiterCompanyMemberIds: [supporting.membership._id],
        status: JOB_STATUS.DRAFT,
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
        password: DEFAULT_PASSWORD,
      });

      // Supporting can read team...
      const teamResponse = await agent
        .get(`/api/jobs/${draftJob._id}/team`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(teamResponse.status).toBe(200);

      // ...but cannot read the Job content via generic visibility
      const jobResponse = await agent
        .get(`/api/jobs/${draftJob._id}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(jobResponse.status).toBe(403);
    });
  });

  describe("Slice 01 acceptance — team information leak fix", () => {
    it("peer Recruiter reads generic PUBLISHED Job without team data", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.leak1@example.com",
        businessRegistrationNumber: "BRN-V6-LK1",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.leak1@example.com",
        company: manager.company,
        employeeCode: "NV-V6-LK1",
      });
      const supporting = await createActiveRecruiterContext({
        email: "supporting.v6.leak1@example.com",
        company: manager.company,
        employeeCode: "NV-V6-LK2",
      });
      const peer = await createActiveRecruiterContext({
        email: "peer.v6.leak1@example.com",
        company: manager.company,
        employeeCode: "NV-V6-LK3",
      });

      await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        supportingRecruiterCompanyMemberIds: [supporting.membership._id],
        status: JOB_STATUS.PUBLISHED,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
        applicationDeadline: new Date("2027-12-31T00:00:00.000Z"),
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: peer.user.email,
        password: DEFAULT_PASSWORD,
      });

      // Peer can read PUBLISHED via V5 internal visibility
      const listRes = await agent
        .get("/api/jobs")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.jobs.length).toBeGreaterThan(0);

      for (const job of listRes.body.jobs) {
        expect(job).not.toHaveProperty("supportingRecruiterCompanyMemberIds");
      }

      // Detail also does not expose team
      const detailRes = await agent
        .get(`/api/jobs/${listRes.body.jobs[0].id}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.job).not.toHaveProperty(
        "supportingRecruiterCompanyMemberIds",
      );
    });

    it("active Primary on non-ended Job can read Recruitment Team", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.act1@example.com",
        businessRegistrationNumber: "BRN-V6-ACT1",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.act1@example.com",
        company: manager.company,
        employeeCode: "NV-V6-ACT1",
      });

      const job = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        status: JOB_STATUS.PUBLISHED,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
        applicationDeadline: new Date("2027-12-31T00:00:00.000Z"),
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/jobs/${job._id}/team`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
    });

    it("active Supporting on non-ended Job can read Recruitment Team", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.act2@example.com",
        businessRegistrationNumber: "BRN-V6-ACT2",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.act2@example.com",
        company: manager.company,
        employeeCode: "NV-V6-ACT2",
      });
      const supporting = await createActiveRecruiterContext({
        email: "supporting.v6.act2@example.com",
        company: manager.company,
        employeeCode: "NV-V6-ACT3",
      });

      const job = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        supportingRecruiterCompanyMemberIds: [supporting.membership._id],
        status: JOB_STATUS.PUBLISHED,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
        applicationDeadline: new Date("2027-12-31T00:00:00.000Z"),
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/jobs/${job._id}/team`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
    });

    it("historical Primary on CLOSED Job is denied F01 team read", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.hist2@example.com",
        businessRegistrationNumber: "BRN-V6-HIST2",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.hist2@example.com",
        company: manager.company,
        employeeCode: "NV-V6-HIST2",
      });

      const job = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        status: JOB_STATUS.CLOSED,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/jobs/${job._id}/team`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });

    it("historical Supporting on CLOSED Job is denied F01 team read", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.hist3@example.com",
        businessRegistrationNumber: "BRN-V6-HIST3",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.hist3@example.com",
        company: manager.company,
        employeeCode: "NV-V6-HIST3",
      });
      const supporting = await createActiveRecruiterContext({
        email: "supporting.v6.hist3@example.com",
        company: manager.company,
        employeeCode: "NV-V6-HIST4",
      });

      const job = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        supportingRecruiterCompanyMemberIds: [supporting.membership._id],
        status: JOB_STATUS.CLOSED,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/jobs/${job._id}/team`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });

    it("historical Primary/Supporting on EXPIRED Job is denied F01 team read", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.hist4@example.com",
        businessRegistrationNumber: "BRN-V6-HIST4",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.hist4@example.com",
        company: manager.company,
        employeeCode: "NV-V6-HIST5",
      });
      const supporting = await createActiveRecruiterContext({
        email: "supporting.v6.hist4@example.com",
        company: manager.company,
        employeeCode: "NV-V6-HIST6",
      });

      const job = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        supportingRecruiterCompanyMemberIds: [supporting.membership._id],
        status: JOB_STATUS.EXPIRED,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      });

      const primaryToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      const supportingToken = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
        password: DEFAULT_PASSWORD,
      });

      for (const token of [primaryToken, supportingToken]) {
        const response = await agent
          .get(`/api/jobs/${job._id}/team`)
          .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(403);
      }
    });

    it("effectively expired PUBLISHED Job denies Recruiter team read", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.effexp@example.com",
        businessRegistrationNumber: "BRN-V6-EFF1",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.effexp@example.com",
        company: manager.company,
        employeeCode: "NV-V6-EFF1",
      });

      const job = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        status: JOB_STATUS.PUBLISHED,
        publishedAt: new Date("2025-01-15T00:00:00.000Z"),
        applicationDeadline: new Date("2025-06-01T00:00:00.000Z"),
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/jobs/${job._id}/team`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });

    it("Company Manager can still read team on CLOSED/EXPIRED Jobs", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.cmhist@example.com",
        businessRegistrationNumber: "BRN-V6-CMH1",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.cmhist@example.com",
        company: manager.company,
        employeeCode: "NV-V6-CMH1",
      });

      const closedJob = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        status: JOB_STATUS.CLOSED,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/jobs/${closedJob._id}/team`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
    });

    it("cross-tenant access remains blocked", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.xtenant@example.com",
        businessRegistrationNumber: "BRN-V6-XT1",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.xtenant@example.com",
        company: manager.company,
        employeeCode: "NV-V6-XT1",
      });
      const foreignManager = await createActiveCompanyManagerContext({
        email: "cm.v6.foreign2@example.com",
        businessRegistrationNumber: "BRN-V6-XT2",
      });
      const foreignRecruiter = await createActiveRecruiterContext({
        email: "recruiter.v6.foreign2@example.com",
        company: foreignManager.company,
        employeeCode: "NV-V6-XT2",
      });

      const job = await createJob({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        status: JOB_STATUS.PUBLISHED,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
        applicationDeadline: new Date("2027-12-31T00:00:00.000Z"),
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: foreignRecruiter.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .get(`/api/jobs/${job._id}/team`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
    });
  });
});
