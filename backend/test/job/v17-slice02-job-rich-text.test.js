import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import JOB_STATUS from "../../src/constants/job-status.js";
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

describe("V17 Slice 02 — Job Description Rich Text", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  const createActor = async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "v17.job.manager@example.com",
      businessRegistrationNumber: "BRN-V17-JOB",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "v17.job.recruiter@example.com",
      company: manager.company,
      employeeCode: "V17-JOB",
    });
    const token = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });
    return { agent, token };
  };

  it("creates a draft from sanitized nested Full HTML and derives plain text even when plain text is supplied", async () => {
    const { agent, token } = await createActor();
    const response = await agent
      .post("/api/jobs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Engineer",
        jobDescription: "stale client text",
        jobDescriptionHtml:
          '<section><h2>Engineering <em>lead</em></h2><div><p>Build <strong>APIs</strong></p><ul><li>Design</li><li>Review</li></ul></div></section><script>alert(1)</script>',
      });

    expect(response.status).toBe(201);
    expect(response.body.job).toMatchObject({
      title: "Engineer",
      jobDescription: "Engineering lead\n\nBuild APIs\n\nDesign\nReview",
      status: JOB_STATUS.DRAFT,
    });
    expect(response.body.job.jobDescriptionHtml).toContain("<strong>APIs</strong>");
    expect(response.body.job.jobDescriptionHtml).not.toMatch(/script|alert|section|div/i);

    const persisted = await Job.findById(response.body.job.id).lean();
    expect(persisted.jobDescription).toBe(response.body.job.jobDescription);
    expect(persisted.jobDescriptionHtml).toBe(response.body.job.jobDescriptionHtml);

    const detail = await agent
      .get(`/api/jobs/${response.body.job.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.job.jobDescriptionHtml).toBe(persisted.jobDescriptionHtml);
    expect(detail.body.job.jobDescription).toBe(persisted.jobDescription);

    const list = await agent
      .get("/api/jobs")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.jobs[0].jobDescriptionHtml).toBe(persisted.jobDescriptionHtml);
  });

  it("keeps both representations on unrelated patches, derives from HTML, then clears HTML on plain-only updates", async () => {
    const { agent, token } = await createActor();
    const created = await agent
      .post("/api/jobs")
      .set("Authorization", `Bearer ${token}`)
      .send({ jobDescriptionHtml: "<p>First <strong>role</strong></p>" });
    expect(created.status).toBe(201);
    const jobId = created.body.job.id;

    const unrelated = await agent
      .patch(`/api/jobs/${jobId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "New title" });
    expect(unrelated.status).toBe(200);
    expect(unrelated.body.job).toMatchObject({
      jobDescription: "First role",
      jobDescriptionHtml: "<p>First <strong>role</strong></p>",
    });

    const html = await agent
      .patch(`/api/jobs/${jobId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        jobDescription: "",
        jobDescriptionHtml: '<p>Second <strong>role</strong></p><img src="x">',
      });
    expect(html.status).toBe(200);
    expect(html.body.job).toMatchObject({
      jobDescription: "Second role",
      jobDescriptionHtml: "<p>Second <strong>role</strong></p>",
    });

    const plain = await agent
      .patch(`/api/jobs/${jobId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ jobDescription: "Legacy plain <strong>literal</strong>" });
    expect(plain.status).toBe(200);
    expect(plain.body.job).toMatchObject({
      jobDescription: "Legacy plain <strong>literal</strong>",
      jobDescriptionHtml: null,
    });
    const invalidPlain = await agent
      .patch(`/api/jobs/${jobId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ jobDescription: "   " });
    expect(invalidPlain.status).toBe(400);
    const persisted = await Job.findById(jobId).lean();
    expect(persisted.jobDescription).toBe(plain.body.job.jobDescription);
    expect(persisted.jobDescriptionHtml).toBeNull();
  });

  it("keeps legacy plain-only reads valid and respects draft validation and lifecycle", async () => {
    const { agent, token } = await createActor();
    const created = await agent
      .post("/api/jobs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        jobDescription: "<strong>literal text</strong>",
        salary: { type: "NEGOTIABLE" },
      });
    expect(created.status).toBe(201);
    const jobId = created.body.job.id;
    await Job.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(jobId) },
      { $unset: { jobDescriptionHtml: "" } },
    );
    const legacy = await agent
      .get(`/api/jobs/${jobId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(legacy.status).toBe(200);
    expect(legacy.body.job).toMatchObject({
      jobDescription: "<strong>literal text</strong>",
      jobDescriptionHtml: null,
    });

    const emptyHtml = await agent
      .patch(`/api/jobs/${jobId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ jobDescriptionHtml: "<p><img src=x></p>" });
    expect(emptyHtml.status).toBe(200);
    expect(emptyHtml.body.job).toMatchObject({
      jobDescription: null,
      jobDescriptionHtml: null,
    });

    await Job.updateOne(
      { _id: jobId },
      { $set: { status: JOB_STATUS.PENDING_APPROVAL } },
    );
    const locked = await agent
      .patch(`/api/jobs/${jobId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ jobDescriptionHtml: "<p>Cannot edit</p>" });
    expect(locked.status).toBe(409);
    const persisted = await Job.findById(jobId).lean();
    expect(persisted.jobDescription).toBeNull();
    expect(persisted.jobDescriptionHtml).toBeNull();
  });
});
