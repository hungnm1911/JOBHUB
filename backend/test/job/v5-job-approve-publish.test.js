import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import LOCATION from "../../src/constants/location.js";
import USER_STATUS from "../../src/constants/user-status.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import { migrate as migrateExperienceLevels } from "../../src/database/migrations/v4-experience-level-dataset.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
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

describe("V5 Slice 06 — Approve and publish Job (F06 / TX-01)", () => {
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

  it("lets Company Manager approve PENDING_APPROVAL atomically to PUBLISHED with publishedAt (BR-20/BR-21/TX-01)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.approve@example.com",
      businessRegistrationNumber: "BRN-V5-F06-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.approve@example.com",
      company: manager.company,
      employeeCode: "NV-F06-1",
    });
    const catalog = await seedCatalog();
    const content = buildCompleteContent(catalog);
    const { job: pending } = await createSubmittedPendingJob({
      agent,
      recruiter,
      content,
    });

    const beforeApprove = Date.now();
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${pending.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    const afterApprove = Date.now();

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/approved and published/i);
    expect(response.body.job).toMatchObject({
      id: pending.id,
      companyId: manager.company._id.toString(),
      status: JOB_STATUS.PUBLISHED,
      title: content.title,
      jobDescription: content.jobDescription,
      requiredSkills: content.requiredSkills,
      salaryText: content.salaryText,
      location: content.location,
      employmentType: content.employmentType,
      workModes: content.workModes,
      createdByCompanyMemberId: recruiter.membership._id.toString(),
      primaryRecruiterCompanyMemberId: recruiter.membership._id.toString(),
    });
    expect(response.body.job.publishedAt).toEqual(expect.any(String));
    const publishedAtMs = new Date(response.body.job.publishedAt).getTime();
    expect(publishedAtMs).toBeGreaterThanOrEqual(beforeApprove - 1000);
    expect(publishedAtMs).toBeLessThanOrEqual(afterApprove + 1000);

    const persisted = await Job.findById(pending.id).lean();
    expect(persisted.status).toBe(JOB_STATUS.PUBLISHED);
    expect(persisted.publishedAt).toBeInstanceOf(Date);
    expect(persisted.title).toBe(content.title);
    expect(persisted.companyId.toString()).toBe(manager.company._id.toString());
    expect(persisted.createdByCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
  });

  it("rejects Recruiter approve and cross-tenant Manager approve (BR-20/BR-38)", async () => {
    const agent = createTestAgent();
    const companyA = await createActiveCompanyManagerContext({
      email: "cm.job.approve.a@example.com",
      businessRegistrationNumber: "BRN-V5-F06-2A",
    });
    const companyB = await createActiveCompanyManagerContext({
      email: "cm.job.approve.b@example.com",
      businessRegistrationNumber: "BRN-V5-F06-2B",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.approve.auth@example.com",
      company: companyA.company,
      employeeCode: "NV-F06-2",
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
      .post(`/api/jobs/${pending.id}/approve`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(recruiterResponse.status).toBe(403);

    const foreignToken = await loginAndGetAccessToken(agent, {
      email: companyB.user.email,
      password: DEFAULT_PASSWORD,
    });
    const foreignResponse = await agent
      .post(`/api/jobs/${pending.id}/approve`)
      .set("Authorization", `Bearer ${foreignToken}`)
      .send({
        companyId: companyA.company._id.toString(),
      });

    expect(foreignResponse.status).toBe(403);

    const persisted = await Job.findById(pending.id).lean();
    expect(persisted.status).toBe(JOB_STATUS.PENDING_APPROVAL);
    expect(persisted.publishedAt).toBeNull();
  });

  it("rejects approve when deadline expired or Primary is no longer valid (BR-22)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.approve.reval@example.com",
      businessRegistrationNumber: "BRN-V5-F06-3",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.approve.reval@example.com",
      company: manager.company,
      employeeCode: "NV-F06-3",
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

    await Job.findByIdAndUpdate(pending.id, {
      $set: {
        applicationDeadline: new Date(Date.now() - 60_000),
      },
    });

    const expiredResponse = await agent
      .post(`/api/jobs/${pending.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(expiredResponse.status).toBe(400);
    expect(expiredResponse.body.error.message).toMatch(/applicationDeadline/i);

    await Job.findByIdAndUpdate(pending.id, {
      $set: {
        applicationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await User.findByIdAndUpdate(recruiter.user._id, {
      $set: {
        status: USER_STATUS.LOCKED,
      },
    });

    const lockedPrimaryResponse = await agent
      .post(`/api/jobs/${pending.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(lockedPrimaryResponse.status).toBe(409);
    expect(lockedPrimaryResponse.body.error.message).toMatch(
      /Primary Recruiter is no longer valid/i,
    );

    await User.findByIdAndUpdate(recruiter.user._id, {
      $set: {
        status: USER_STATUS.ACTIVE,
      },
    });
    await recruiter.membership.updateOne({
      $set: {
        status: COMPANY_MEMBER_STATUS.LOCKED,
      },
    });

    const lockedMembershipResponse = await agent
      .post(`/api/jobs/${pending.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(lockedMembershipResponse.status).toBe(409);
    expect(lockedMembershipResponse.body.error.message).toMatch(
      /Primary Recruiter is no longer valid/i,
    );

    const persisted = await Job.findById(pending.id).lean();
    expect(persisted.status).toBe(JOB_STATUS.PENDING_APPROVAL);
    expect(persisted.publishedAt).toBeNull();
  });

  it("rejects non-PENDING_APPROVAL and keeps published content immutable (BR-21/BR-24)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.approve.immutable@example.com",
      businessRegistrationNumber: "BRN-V5-F06-4",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.approve.immutable@example.com",
      company: manager.company,
      employeeCode: "NV-F06-4",
    });
    const catalog = await seedCatalog();
    const content = buildCompleteContent(catalog);
    const { job: pending, recruiterToken } = await createSubmittedPendingJob({
      agent,
      recruiter,
      content,
    });

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const approveResponse = await agent
      .post(`/api/jobs/${pending.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(approveResponse.status).toBe(200);

    const secondApprove = await agent
      .post(`/api/jobs/${pending.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(secondApprove.status).toBe(409);
    expect(secondApprove.body.error.message).toMatch(/PENDING_APPROVAL/i);

    const mutateResponse = await agent
      .patch(`/api/jobs/${pending.id}`)
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({
        title: "Mutated After Publish",
      });

    expect(mutateResponse.status).toBe(409);
    expect(mutateResponse.body.error.message).toMatch(
      /only be edited while.*DRAFT/i,
    );

    const draftOnly = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      primaryRecruiterCompanyMemberId: recruiter.membership._id,
      status: JOB_STATUS.DRAFT,
      title: "Still Draft",
      publishedAt: null,
    });

    const draftApprove = await agent
      .post(`/api/jobs/${draftOnly._id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(draftApprove.status).toBe(409);

    const persistedPublished = await Job.findById(pending.id).lean();
    expect(persistedPublished.status).toBe(JOB_STATUS.PUBLISHED);
    expect(persistedPublished.publishedAt).toBeInstanceOf(Date);
    expect(persistedPublished.title).toBe(content.title);

    const persistedDraft = await Job.findById(draftOnly._id).lean();
    expect(persistedDraft.status).toBe(JOB_STATUS.DRAFT);
    expect(persistedDraft.publishedAt).toBeNull();
  });

  it("rejects client companyId expansion on approve (BR-38)", async () => {
    const agent = createTestAgent();
    const companyA = await createActiveCompanyManagerContext({
      email: "cm.job.approve.expand.a@example.com",
      businessRegistrationNumber: "BRN-V5-F06-5A",
    });
    const companyB = await createActiveCompanyManagerContext({
      email: "cm.job.approve.expand.b@example.com",
      businessRegistrationNumber: "BRN-V5-F06-5B",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.approve.expand@example.com",
      company: companyA.company,
      employeeCode: "NV-F06-5",
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
      .post(`/api/jobs/${pending.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        companyId: companyB.company._id.toString(),
      });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(
      /company identifier is not an authorization source/i,
    );

    const persisted = await Job.findById(pending.id).lean();
    expect(persisted.status).toBe(JOB_STATUS.PENDING_APPROVAL);
    expect(persisted.publishedAt).toBeNull();
  });

  it("rejects unknown Job id", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.approve.missing@example.com",
      businessRegistrationNumber: "BRN-V5-F06-6",
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${new mongoose.Types.ObjectId()}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(404);
  });
});
