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
import WORK_MODE from "../../src/constants/work-mode.js";
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

describe("V5 Slice 02 — Edit DRAFT + content immutability (F02)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  const createPrimaryDraftViaApi = async (agent, recruiter) => {
    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post("/api/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Initial Title",
      });

    expect(response.status).toBe(201);

    return {
      accessToken,
      job: response.body.job,
    };
  };

  it("lets Primary Recruiter partially update DRAFT content without submit completeness (BR-08/BR-09)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.edit@example.com",
      businessRegistrationNumber: "BRN-V5-EDIT-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.edit@example.com",
      company: manager.company,
      employeeCode: "NV-EDIT-1",
    });
    const { accessToken, job } = await createPrimaryDraftViaApi(
      agent,
      recruiter,
    );

    const response = await agent
      .patch(`/api/jobs/${job.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "  Updated Backend Role  ",
        location: LOCATION.HA_NOI,
        employmentType: EMPLOYMENT_TYPE.FULL_TIME,
        workModes: [WORK_MODE.REMOTE],
        requiredSkills: ["Node.js"],
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/job draft updated/i);
    expect(response.body.job).toMatchObject({
      id: job.id,
      companyId: manager.company._id.toString(),
      createdByCompanyMemberId: recruiter.membership._id.toString(),
      primaryRecruiterCompanyMemberId: recruiter.membership._id.toString(),
      title: "Updated Backend Role",
      location: LOCATION.HA_NOI,
      employmentType: EMPLOYMENT_TYPE.FULL_TIME,
      workModes: [WORK_MODE.REMOTE],
      requiredSkills: ["Node.js"],
      jobDescription: null,
      salaryText: null,
      experienceLevelId: null,
      applicationDeadline: null,
      status: JOB_STATUS.DRAFT,
      publishedAt: null,
    });

    const persisted = await Job.findById(job.id).lean();

    expect(persisted.title).toBe("Updated Backend Role");
    expect(persisted.status).toBe(JOB_STATUS.DRAFT);
    expect(persisted.companyId.toString()).toBe(manager.company._id.toString());
    expect(persisted.createdByCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(persisted.publishedAt).toBeNull();
  });

  it("rejects ownership and lifecycle fields on edit (content-mutation boundary)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.boundary@example.com",
      businessRegistrationNumber: "BRN-V5-EDIT-2",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.boundary@example.com",
      company: manager.company,
      employeeCode: "NV-EDIT-2",
    });
    const { accessToken, job } = await createPrimaryDraftViaApi(
      agent,
      recruiter,
    );

    for (const body of [
      { status: JOB_STATUS.PUBLISHED },
      { companyId: manager.company._id.toString() },
      { createdByCompanyMemberId: new mongoose.Types.ObjectId().toString() },
      {
        primaryRecruiterCompanyMemberId: new mongoose.Types.ObjectId().toString(),
      },
      { publishedAt: new Date().toISOString() },
    ]) {
      const response = await agent
        .patch(`/api/jobs/${job.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(body);

      expect(response.status).toBe(400);
    }

    const persisted = await Job.findById(job.id).lean();

    expect(persisted.status).toBe(JOB_STATUS.DRAFT);
    expect(persisted.title).toBe("Initial Title");
    expect(persisted.companyId.toString()).toBe(manager.company._id.toString());
    expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(persisted.publishedAt).toBeNull();
  });

  it("rejects non-Primary same-company Recruiter and Company Manager (BR-09)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.primary@example.com",
      businessRegistrationNumber: "BRN-V5-EDIT-3",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.job.edit@example.com",
      company: manager.company,
      employeeCode: "NV-EDIT-3A",
    });
    const peer = await createActiveRecruiterContext({
      email: "peer.job.edit@example.com",
      company: manager.company,
      employeeCode: "NV-EDIT-3B",
    });
    const { job } = await createPrimaryDraftViaApi(agent, primary);

    const peerToken = await loginAndGetAccessToken(agent, {
      email: peer.user.email,
      password: DEFAULT_PASSWORD,
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const peerResponse = await agent
      .patch(`/api/jobs/${job.id}`)
      .set("Authorization", `Bearer ${peerToken}`)
      .send({ title: "Peer Hijack" });

    expect(peerResponse.status).toBe(403);
    expect(peerResponse.body.error.message).toMatch(/Primary Recruiter/i);

    const managerResponse = await agent
      .patch(`/api/jobs/${job.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ title: "Manager Hijack" });

    expect(managerResponse.status).toBe(403);

    const persisted = await Job.findById(job.id).lean();
    expect(persisted.title).toBe("Initial Title");
  });

  it("rejects cross-tenant Job id (BR-38)", async () => {
    const agent = createTestAgent();
    const companyA = await createActiveCompanyManagerContext({
      email: "cm.job.tenant.a@example.com",
      businessRegistrationNumber: "BRN-V5-EDIT-4A",
    });
    const recruiterA = await createActiveRecruiterContext({
      email: "recruiter.job.tenant.a@example.com",
      company: companyA.company,
      employeeCode: "NV-EDIT-4A",
    });
    const companyB = await createActiveCompanyManagerContext({
      email: "cm.job.tenant.b@example.com",
      businessRegistrationNumber: "BRN-V5-EDIT-4B",
    });
    const recruiterB = await createActiveRecruiterContext({
      email: "recruiter.job.tenant.b@example.com",
      company: companyB.company,
      employeeCode: "NV-EDIT-4B",
    });
    const { job } = await createPrimaryDraftViaApi(agent, recruiterA);
    const accessTokenB = await loginAndGetAccessToken(agent, {
      email: recruiterB.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .patch(`/api/jobs/${job.id}`)
      .set("Authorization", `Bearer ${accessTokenB}`)
      .send({ title: "Cross Tenant" });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/cross-tenant/i);

    const persisted = await Job.findById(job.id).lean();
    expect(persisted.title).toBe("Initial Title");
  });

  it.each([
    JOB_STATUS.PENDING_APPROVAL,
    JOB_STATUS.PUBLISHED,
    JOB_STATUS.CLOSED,
    JOB_STATUS.EXPIRED,
  ])(
    "rejects content mutation when Job status is %s (BR-19/BR-24/BR-25)",
    async (status) => {
      const agent = createTestAgent();
      const manager = await createActiveCompanyManagerContext({
        email: `cm.job.immutable.${status}@example.com`,
        businessRegistrationNumber: `BRN-V5-EDIT-${status}`,
      });
      const recruiter = await createActiveRecruiterContext({
        email: `recruiter.job.immutable.${status}@example.com`,
        company: manager.company,
        employeeCode: `NV-${status}`,
      });

      const job = await Job.create({
        companyId: manager.company._id,
        createdByCompanyMemberId: recruiter.membership._id,
        primaryRecruiterCompanyMemberId: recruiter.membership._id,
        title: "Frozen Title",
        status,
        publishedAt:
          status === JOB_STATUS.PENDING_APPROVAL
            ? null
            : new Date("2026-01-01T00:00:00.000Z"),
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .patch(`/api/jobs/${job._id.toString()}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Mutated Title" });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/only be edited while.*DRAFT/i);

      const persisted = await Job.findById(job._id).lean();
      expect(persisted.title).toBe("Frozen Title");
      expect(persisted.status).toBe(status);
    },
  );
});
