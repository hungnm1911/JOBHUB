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
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import LOCATION from "../../src/constants/location.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import { migrate as migrateExperienceLevels } from "../../src/database/migrations/v4-experience-level-dataset.js";
import Category from "../../src/models/category.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job from "../../src/models/job.model.js";
import {
  createFieldCategory,
  createPositionCategory,
} from "../../src/services/category.service.js";
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

describe("V5 Slice 07 — Reject pending Job (F07 / TX-04)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  const seedCatalog = async () => {
    await migrateExperienceLevels();

    const field = await createFieldCategory({
      name: "Software Engineering",
    });
    const position = await createPositionCategory({
      name: "Backend Engineer",
      parentCategoryId: field.id,
    });
    const experienceLevel = await ExperienceLevel.findOne({
      code: EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS,
    }).lean();

    return {
      field,
      position,
      experienceLevelId: experienceLevel._id.toString(),
    };
  };

  const buildCompleteContent = (catalog, overrides = {}) => {
    return {
      title: "Backend Engineer",
      jobDescription: "Build Job lifecycle APIs.",
      requiredSkills: ["Node.js", "MongoDB"],
      salaryText: "Negotiate",
      fieldCategoryIds: [catalog.field.id],
      positionCategoryIds: [catalog.position.id],
      location: LOCATION.HA_NOI,
      employmentType: EMPLOYMENT_TYPE.FULL_TIME,
      workModes: [WORK_MODE.HYBRID],
      experienceLevelId: catalog.experienceLevelId,
      applicationDeadline: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      ...overrides,
    };
  };

  const createSubmittedPendingJob = async ({
    agent,
    recruiter,
    content,
  }) => {
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const createResponse = await agent
      .post("/api/jobs")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send(content);

    expect(createResponse.status).toBe(201);

    const submitResponse = await agent
      .post(`/api/jobs/${createResponse.body.job.id}/submit`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.job.status).toBe(JOB_STATUS.PENDING_APPROVAL);

    return {
      recruiterToken,
      job: submitResponse.body.job,
    };
  };

  it("lets Company Manager physically delete PENDING_APPROVAL without REJECTED persistence (BR-20/BR-23/TX-04)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reject@example.com",
      businessRegistrationNumber: "BRN-V5-F07-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.reject@example.com",
      company: manager.company,
      employeeCode: "NV-F07-1",
    });
    const catalog = await seedCatalog();
    const { job: pending } = await createSubmittedPendingJob({
      agent,
      recruiter,
      content: buildCompleteContent(catalog),
    });

    const companyCountBefore = await Company.countDocuments();
    const membershipCountBefore = await CompanyMember.countDocuments();
    const categoryCountBefore = await Category.countDocuments();
    const experienceLevelCountBefore = await ExperienceLevel.countDocuments();

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${pending.id}/reject`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/rejected/i);
    expect(response.body.jobId).toBe(pending.id);
    expect(response.body).not.toHaveProperty("job");
    expect(response.body).not.toHaveProperty("rejectedAt");
    expect(response.body).not.toHaveProperty("rejectedBy");
    expect(response.body).not.toHaveProperty("rejectionReason");

    expect(await Job.findById(pending.id)).toBeNull();
    expect(await Job.countDocuments()).toBe(0);

    expect(await Company.countDocuments()).toBe(companyCountBefore);
    expect(await CompanyMember.countDocuments()).toBe(membershipCountBefore);
    expect(await Category.countDocuments()).toBe(categoryCountBefore);
    expect(await ExperienceLevel.countDocuments()).toBe(
      experienceLevelCountBefore,
    );

    const company = await Company.findById(manager.company._id).lean();
    expect(company).not.toBeNull();
    const membership = await CompanyMember.findById(
      recruiter.membership._id,
    ).lean();
    expect(membership).not.toBeNull();
    expect(await Category.findById(catalog.field.id)).not.toBeNull();
    expect(
      await ExperienceLevel.findById(catalog.experienceLevelId),
    ).not.toBeNull();
  });

  it("rejects Recruiter reject and cross-tenant Manager reject (BR-20/BR-38)", async () => {
    const agent = createTestAgent();
    const companyA = await createActiveCompanyManagerContext({
      email: "cm.job.reject.a@example.com",
      businessRegistrationNumber: "BRN-V5-F07-2A",
    });
    const companyB = await createActiveCompanyManagerContext({
      email: "cm.job.reject.b@example.com",
      businessRegistrationNumber: "BRN-V5-F07-2B",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.reject.auth@example.com",
      company: companyA.company,
      employeeCode: "NV-F07-2",
    });
    const catalog = await seedCatalog();
    const { job: pending } = await createSubmittedPendingJob({
      agent,
      recruiter,
      content: buildCompleteContent(catalog),
    });

    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });
    const recruiterResponse = await agent
      .post(`/api/jobs/${pending.id}/reject`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(recruiterResponse.status).toBe(403);
    expect(await Job.findById(pending.id)).not.toBeNull();

    const foreignToken = await loginAndGetAccessToken(agent, {
      email: companyB.user.email,
      password: DEFAULT_PASSWORD,
    });
    const foreignResponse = await agent
      .post(`/api/jobs/${pending.id}/reject`)
      .set("Authorization", `Bearer ${foreignToken}`)
      .send({
        companyId: companyA.company._id.toString(),
      });

    expect(foreignResponse.status).toBe(403);
    expect(await Job.findById(pending.id)).not.toBeNull();
    expect((await Job.findById(pending.id).lean()).status).toBe(
      JOB_STATUS.PENDING_APPROVAL,
    );
  });

  it("does not delete DRAFT, PUBLISHED, CLOSED, or EXPIRED Jobs (BR-23/BR-32)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reject.boundary@example.com",
      businessRegistrationNumber: "BRN-V5-F07-3",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.reject.boundary@example.com",
      company: manager.company,
      employeeCode: "NV-F07-3",
    });

    const draft = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      primaryRecruiterCompanyMemberId: recruiter.membership._id,
      status: JOB_STATUS.DRAFT,
      title: "Draft Job",
      publishedAt: null,
    });
    const published = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      primaryRecruiterCompanyMemberId: recruiter.membership._id,
      status: JOB_STATUS.PUBLISHED,
      title: "Published Job",
      publishedAt: new Date("2026-01-15T00:00:00.000Z"),
    });
    const closed = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      primaryRecruiterCompanyMemberId: recruiter.membership._id,
      status: JOB_STATUS.CLOSED,
      title: "Closed Job",
      publishedAt: new Date("2026-01-15T00:00:00.000Z"),
    });
    const expired = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      primaryRecruiterCompanyMemberId: recruiter.membership._id,
      status: JOB_STATUS.EXPIRED,
      title: "Expired Job",
      publishedAt: new Date("2026-01-15T00:00:00.000Z"),
    });

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    for (const job of [draft, published, closed, expired]) {
      const response = await agent
        .post(`/api/jobs/${job._id}/reject`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/PENDING_APPROVAL/i);
      expect(await Job.findById(job._id)).not.toBeNull();
    }

    expect(await Job.countDocuments()).toBe(4);
  });

  it("rejects stale reject after approve and second reject of missing Job (TX-04)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reject.stale@example.com",
      businessRegistrationNumber: "BRN-V5-F07-4",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.reject.stale@example.com",
      company: manager.company,
      employeeCode: "NV-F07-4",
    });
    const catalog = await seedCatalog();
    const { job: pending } = await createSubmittedPendingJob({
      agent,
      recruiter,
      content: buildCompleteContent(catalog),
    });

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const approveResponse = await agent
      .post(`/api/jobs/${pending.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.job.status).toBe(JOB_STATUS.PUBLISHED);

    const staleReject = await agent
      .post(`/api/jobs/${pending.id}/reject`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(staleReject.status).toBe(409);
    expect(await Job.findById(pending.id)).not.toBeNull();
    expect((await Job.findById(pending.id).lean()).status).toBe(
      JOB_STATUS.PUBLISHED,
    );

    const otherPending = await createSubmittedPendingJob({
      agent,
      recruiter,
      content: buildCompleteContent(catalog, {
        title: "Second Pending Job",
      }),
    });

    const rejectResponse = await agent
      .post(`/api/jobs/${otherPending.job.id}/reject`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(rejectResponse.status).toBe(200);
    expect(await Job.findById(otherPending.job.id)).toBeNull();

    const secondReject = await agent
      .post(`/api/jobs/${otherPending.job.id}/reject`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(secondReject.status).toBe(404);
  });

  it("rejects client companyId expansion on reject (BR-38)", async () => {
    const agent = createTestAgent();
    const companyA = await createActiveCompanyManagerContext({
      email: "cm.job.reject.expand.a@example.com",
      businessRegistrationNumber: "BRN-V5-F07-5A",
    });
    const companyB = await createActiveCompanyManagerContext({
      email: "cm.job.reject.expand.b@example.com",
      businessRegistrationNumber: "BRN-V5-F07-5B",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.reject.expand@example.com",
      company: companyA.company,
      employeeCode: "NV-F07-5",
    });
    const catalog = await seedCatalog();
    const { job: pending } = await createSubmittedPendingJob({
      agent,
      recruiter,
      content: buildCompleteContent(catalog),
    });

    const managerToken = await loginAndGetAccessToken(agent, {
      email: companyA.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${pending.id}/reject`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        companyId: companyB.company._id.toString(),
      });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(
      /company identifier is not an authorization source/i,
    );
    expect(await Job.findById(pending.id)).not.toBeNull();
  });

  it("rejects unknown Job id", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reject.missing@example.com",
      businessRegistrationNumber: "BRN-V5-F07-6",
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${new mongoose.Types.ObjectId()}/reject`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(404);
  });
});
