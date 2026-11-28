import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import Job from "../../src/models/job.model.js";
import { createActiveCompanyManagerContext, createActiveRecruiterContext, DEFAULT_PASSWORD, loginAndGetAccessToken } from "../helpers/auth-fixtures.js";
import { clearDatabase, connectTestDatabase, createTestAgent, disconnectTestDatabase } from "../helpers/database.js";

beforeAll(connectTestDatabase);
afterEach(clearDatabase);
afterAll(disconnectTestDatabase);
for (const query of ["", "?page=1&limit=20"]) {
  it(`preserves V5 Manager visibility when Applications embed a Job (${query || "legacy"})`, async () => {
    const cm = await createActiveCompanyManagerContext();
    const recruiter = await createActiveRecruiterContext({ company: cm.company });
    const agent = createTestAgent();
    const token = await loginAndGetAccessToken(agent, { email: cm.user.email, password: DEFAULT_PASSWORD });
    for (const status of ["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "CLOSED", "EXPIRED"]) {
      const job = await Job.create({ companyId: cm.company._id, createdByCompanyMemberId: recruiter.membership._id,
        primaryRecruiterCompanyMemberId: recruiter.membership._id, status, salary: { type: "NEGOTIABLE" },
        title: "Private recruitment plan", jobDescription: "Unsubmitted content" });
      const response = await agent.get(`/api/jobs/${job._id}/applications${query}`).set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(status === "DRAFT" ? 403 : 200);
      if (status === "DRAFT") expect(JSON.stringify(response.body)).not.toMatch(/Private recruitment plan|Unsubmitted content/);
      else expect(response.body.job.title).toBe(job.title);
    }
  });
}
