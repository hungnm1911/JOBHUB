import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import LOCATION from "../../src/constants/location.js";
import USER_ROLE from "../../src/constants/user-role.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import Job from "../../src/models/job.model.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  DEFAULT_PASSWORD,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

describe("V5 Slice 01 — Job foundation + create DRAFT (F01)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("POST /api/jobs", () => {
    it("lets a valid Recruiter create a partial DRAFT owned by membership Company (BR-01–BR-08)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.create@example.com",
        businessRegistrationNumber: "BRN-V5-JOB-1",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.job.create@example.com",
        company: manager.company,
        employeeCode: "NV-JOB-1",
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
      expect(response.body.message).toMatch(/job draft created/i);
      expect(response.body.job).toMatchObject({
        companyId: manager.company._id.toString(),
        createdByCompanyMemberId: recruiter.membership._id.toString(),
        primaryRecruiterCompanyMemberId: recruiter.membership._id.toString(),
        title: null,
        jobDescription: null,
        requiredSkills: [],
        salaryText: null,
        fieldCategoryIds: [],
        positionCategoryIds: [],
        location: null,
        employmentType: null,
        workModes: [],
        experienceLevelId: null,
        applicationDeadline: null,
        status: JOB_STATUS.DRAFT,
        publishedAt: null,
      });
      expect(response.body.job.id).toEqual(expect.any(String));
      expect(response.body.job).not.toHaveProperty("supportingRecruiterIds");

      const persisted = await Job.findById(response.body.job.id).lean();

      expect(persisted).toMatchObject({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        primaryRecruiterCompanyMemberId: recruiter.membership._id,
        status: JOB_STATUS.DRAFT,
        publishedAt: null,
        title: null,
        requiredSkills: [],
        workModes: [],
      });
      expect(persisted).not.toHaveProperty("supportingRecruiterIds");
    });

    it("persists optional partial content without requiring submit completeness (BR-08)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.partial@example.com",
        businessRegistrationNumber: "BRN-V5-JOB-2",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.job.partial@example.com",
        company: manager.company,
        employeeCode: "NV-JOB-2",
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post("/api/jobs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "  Backend Engineer  ",
          location: LOCATION.HA_NOI,
          employmentType: EMPLOYMENT_TYPE.FULL_TIME,
          workModes: [WORK_MODE.HYBRID, WORK_MODE.REMOTE],
          requiredSkills: ["Node.js"],
        });

      expect(response.status).toBe(201);
      expect(response.body.job).toMatchObject({
        title: "Backend Engineer",
        location: LOCATION.HA_NOI,
        employmentType: EMPLOYMENT_TYPE.FULL_TIME,
        workModes: [WORK_MODE.HYBRID, WORK_MODE.REMOTE],
        requiredSkills: ["Node.js"],
        jobDescription: null,
        salaryText: null,
        fieldCategoryIds: [],
        positionCategoryIds: [],
        experienceLevelId: null,
        applicationDeadline: null,
        status: JOB_STATUS.DRAFT,
      });
    });

    it("rejects Company Manager, Candidate, and Platform Admin (BR-01)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.deny@example.com",
        businessRegistrationNumber: "BRN-V5-JOB-3",
      });
      await createVerifiedUser({
        email: "candidate.job.deny@example.com",
        role: USER_ROLE.CANDIDATE,
      });
      await createVerifiedUser({
        email: "admin.job.deny@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });

      const managerToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });
      const candidateToken = await loginAndGetAccessToken(agent, {
        email: "candidate.job.deny@example.com",
      });
      const adminToken = await loginAndGetAccessToken(agent, {
        email: "admin.job.deny@example.com",
      });

      for (const token of [managerToken, candidateToken, adminToken]) {
        const response = await agent
          .post("/api/jobs")
          .set("Authorization", `Bearer ${token}`)
          .send({});

        expect(response.status).toBe(403);
      }
    });

    it("rejects client-supplied foreign companyId (BR-03/BR-38)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.tenant@example.com",
        businessRegistrationNumber: "BRN-V5-JOB-4",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.job.tenant@example.com",
        company: manager.company,
        employeeCode: "NV-JOB-4",
      });
      const foreignCompanyId = new mongoose.Types.ObjectId().toString();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(`/api/jobs?companyId=${foreignCompanyId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.error.message).toMatch(/not an authorization source/i);
      expect(await Job.countDocuments()).toBe(0);
    });

    it("rejects unknown body fields including status and companyId (BR-03)", async () => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.strict@example.com",
        businessRegistrationNumber: "BRN-V5-JOB-5",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.job.strict@example.com",
        company: manager.company,
        employeeCode: "NV-JOB-5",
      });
      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });

      const withStatus = await agent
        .post("/api/jobs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          status: JOB_STATUS.PUBLISHED,
        });

      expect(withStatus.status).toBe(400);

      const withCompanyId = await agent
        .post("/api/jobs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          companyId: manager.company._id.toString(),
        });

      expect(withCompanyId.status).toBe(400);
      expect(await Job.countDocuments()).toBe(0);
    });
  });

  describe("Job persistence foundation", () => {
    it("keeps companyId and creator immutable and declares Primary indexes", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.job.model@example.com",
        businessRegistrationNumber: "BRN-V5-JOB-6",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.job.model@example.com",
        company: manager.company,
        employeeCode: "NV-JOB-6",
      });

      const job = await Job.create({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        primaryRecruiterCompanyMemberId: recruiter.membership._id,
      });

      job.companyId = new mongoose.Types.ObjectId();
      job.createdByCompanyMemberId = new mongoose.Types.ObjectId();
      await job.save();

      const persisted = await Job.findById(job._id).lean();

      expect(persisted.companyId.toString()).toBe(manager.company._id.toString());
      expect(persisted.createdByCompanyMemberId.toString()).toBe(
        recruiter.membership._id.toString(),
      );
      expect(persisted.status).toBe(JOB_STATUS.DRAFT);

      const indexes = await Job.collection.indexes();
      const indexKeys = indexes.map((index) => JSON.stringify(index.key));

      expect(indexKeys).toContain(
        JSON.stringify({ companyId: 1, status: 1 }),
      );
      expect(indexKeys).toContain(
        JSON.stringify({
          companyId: 1,
          primaryRecruiterCompanyMemberId: 1,
          status: 1,
        }),
      );
    });
  });
});
