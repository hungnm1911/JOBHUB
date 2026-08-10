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

describe("V5 Slice 08 — Manual pre-publication delete (F12 / TX-04)", () => {
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

  const createDraftJobViaApi = async ({ agent, recruiter, content }) => {
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const createResponse = await agent
      .post("/api/jobs")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send(content);

    expect(createResponse.status).toBe(201);

    return {
      recruiterToken,
      job: createResponse.body.job,
    };
  };

  const createSubmittedPendingJob = async ({
    agent,
    recruiter,
    content,
  }) => {
    const { recruiterToken, job: draft } = await createDraftJobViaApi({
      agent,
      recruiter,
      content,
    });

    const submitResponse = await agent
      .post(`/api/jobs/${draft.id}/submit`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.job.status).toBe(JOB_STATUS.PENDING_APPROVAL);

    return {
      recruiterToken,
      job: submitResponse.body.job,
    };
  };

  it("lets current Primary Recruiter physically delete DRAFT without soft-delete fields (BR-33/BR-34/TX-04)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.delete.draft@example.com",
      businessRegistrationNumber: "BRN-V5-F12-DRAFT",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.delete.draft@example.com",
      company: manager.company,
      employeeCode: "NV-F12-DRAFT",
    });
    const catalog = await seedCatalog();
    const { recruiterToken, job: draft } = await createDraftJobViaApi({
      agent,
      recruiter,
      content: buildCompleteContent(catalog, {
        title: "Partial draft ok",
        jobDescription: null,
      }),
    });

    const companyCountBefore = await Company.countDocuments();
    const membershipCountBefore = await CompanyMember.countDocuments();
    const categoryCountBefore = await Category.countDocuments();
    const experienceLevelCountBefore = await ExperienceLevel.countDocuments();

    const response = await agent
      .delete(`/api/jobs/${draft.id}`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/deleted/i);
    expect(response.body.jobId).toBe(draft.id);
    expect(response.body).not.toHaveProperty("job");
    expect(response.body).not.toHaveProperty("deletedAt");
    expect(response.body).not.toHaveProperty("isDeleted");
    expect(response.body).not.toHaveProperty("deletionReason");

    expect(await Job.findById(draft.id)).toBeNull();
    expect(await Job.countDocuments()).toBe(0);

    expect(await Company.countDocuments()).toBe(companyCountBefore);
    expect(await CompanyMember.countDocuments()).toBe(membershipCountBefore);
    expect(await Category.countDocuments()).toBe(categoryCountBefore);
    expect(await ExperienceLevel.countDocuments()).toBe(
      experienceLevelCountBefore,
    );
  });

  it("lets Company Manager physically delete PENDING_APPROVAL without soft-delete fields (BR-33/TX-04)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.delete.pending@example.com",
      businessRegistrationNumber: "BRN-V5-F12-PENDING",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.delete.pending@example.com",
      company: manager.company,
      employeeCode: "NV-F12-PENDING",
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
      .delete(`/api/jobs/${pending.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/deleted/i);
    expect(response.body.jobId).toBe(pending.id);
    expect(response.body).not.toHaveProperty("job");
    expect(response.body).not.toHaveProperty("deletedAt");
    expect(response.body).not.toHaveProperty("isDeleted");

    expect(await Job.findById(pending.id)).toBeNull();
    expect(await Job.countDocuments()).toBe(0);

    expect(await Company.countDocuments()).toBe(companyCountBefore);
    expect(await CompanyMember.countDocuments()).toBe(membershipCountBefore);
    expect(await Category.countDocuments()).toBe(categoryCountBefore);
    expect(await ExperienceLevel.countDocuments()).toBe(
      experienceLevelCountBefore,
    );
  });

  it("denies Company Manager DRAFT delete, peer Recruiter DRAFT delete, and Primary PENDING delete (BR-33/BR-34)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.delete.auth@example.com",
      businessRegistrationNumber: "BRN-V5-F12-AUTH",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.delete.primary@example.com",
      company: manager.company,
      employeeCode: "NV-F12-AUTH-P",
    });
    const peer = await createActiveRecruiterContext({
      email: "recruiter.job.delete.peer@example.com",
      company: manager.company,
      employeeCode: "NV-F12-AUTH-PEER",
    });
    const catalog = await seedCatalog();
    const { recruiterToken: primaryToken, job: draft } =
      await createDraftJobViaApi({
        agent,
        recruiter: primary,
        content: buildCompleteContent(catalog, {
          title: "Owned draft",
        }),
      });
    const { job: pending } = await createSubmittedPendingJob({
      agent,
      recruiter: primary,
      content: buildCompleteContent(catalog, {
        title: "Owned pending",
      }),
    });

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });
    const peerToken = await loginAndGetAccessToken(agent, {
      email: peer.user.email,
      password: DEFAULT_PASSWORD,
    });

    const managerDraftDelete = await agent
      .delete(`/api/jobs/${draft.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(managerDraftDelete.status).toBe(403);
    expect(await Job.findById(draft.id)).not.toBeNull();

    const peerDraftDelete = await agent
      .delete(`/api/jobs/${draft.id}`)
      .set("Authorization", `Bearer ${peerToken}`);

    expect(peerDraftDelete.status).toBe(403);
    expect(await Job.findById(draft.id)).not.toBeNull();

    const primaryPendingDelete = await agent
      .delete(`/api/jobs/${pending.id}`)
      .set("Authorization", `Bearer ${primaryToken}`);

    expect(primaryPendingDelete.status).toBe(403);
    expect(await Job.findById(pending.id)).not.toBeNull();
  });

  it("denies cross-tenant Manager delete (BR-38)", async () => {
    const agent = createTestAgent();
    const companyA = await createActiveCompanyManagerContext({
      email: "cm.job.delete.a@example.com",
      businessRegistrationNumber: "BRN-V5-F12-AUTH-A",
    });
    const companyB = await createActiveCompanyManagerContext({
      email: "cm.job.delete.b@example.com",
      businessRegistrationNumber: "BRN-V5-F12-AUTH-B",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.delete.auth@example.com",
      company: companyA.company,
      employeeCode: "NV-F12-AUTH",
    });
    const catalog = await seedCatalog();
    const { job: pending } = await createSubmittedPendingJob({
      agent,
      recruiter,
      content: buildCompleteContent(catalog),
    });

    const foreignToken = await loginAndGetAccessToken(agent, {
      email: companyB.user.email,
      password: DEFAULT_PASSWORD,
    });
    const foreignResponse = await agent
      .delete(`/api/jobs/${pending.id}`)
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

  it("preserves PUBLISHED, CLOSED, and EXPIRED historical Jobs (BR-32/BR-33)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.delete.boundary@example.com",
      businessRegistrationNumber: "BRN-V5-F12-BOUND",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.delete.boundary@example.com",
      company: manager.company,
      employeeCode: "NV-F12-BOUND",
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
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    for (const job of [published, closed, expired]) {
      const managerResponse = await agent
        .delete(`/api/jobs/${job._id}`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(managerResponse.status).toBe(409);
      expect(managerResponse.body.error.message).toMatch(
        /never been published|DRAFT or PENDING_APPROVAL/i,
      );

      const recruiterResponse = await agent
        .delete(`/api/jobs/${job._id}`)
        .set("Authorization", `Bearer ${recruiterToken}`);

      expect(recruiterResponse.status).toBe(409);
      expect(await Job.findById(job._id)).not.toBeNull();
    }

    expect(await Job.countDocuments()).toBe(3);
  });

  it("rejects stale delete after approve/submit and second delete of missing Job (TX-04)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.delete.stale@example.com",
      businessRegistrationNumber: "BRN-V5-F12-STALE",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.delete.stale@example.com",
      company: manager.company,
      employeeCode: "NV-F12-STALE",
    });
    const catalog = await seedCatalog();
    const { recruiterToken, job: pending } = await createSubmittedPendingJob({
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

    const staleDelete = await agent
      .delete(`/api/jobs/${pending.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(staleDelete.status).toBe(409);
    expect(await Job.findById(pending.id)).not.toBeNull();
    expect((await Job.findById(pending.id).lean()).status).toBe(
      JOB_STATUS.PUBLISHED,
    );

    const { job: draft } = await createDraftJobViaApi({
      agent,
      recruiter,
      content: buildCompleteContent(catalog, {
        title: "Second draft",
      }),
    });

    const submitResponse = await agent
      .post(`/api/jobs/${draft.id}/submit`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(submitResponse.status).toBe(200);

    const stalePrimaryDelete = await agent
      .delete(`/api/jobs/${draft.id}`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(stalePrimaryDelete.status).toBe(403);
    expect(await Job.findById(draft.id)).not.toBeNull();
    expect((await Job.findById(draft.id).lean()).status).toBe(
      JOB_STATUS.PENDING_APPROVAL,
    );

    const { job: deletableDraft } = await createDraftJobViaApi({
      agent,
      recruiter,
      content: buildCompleteContent(catalog, {
        title: "Deletable draft",
      }),
    });

    const deleteResponse = await agent
      .delete(`/api/jobs/${deletableDraft.id}`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(deleteResponse.status).toBe(200);
    expect(await Job.findById(deletableDraft.id)).toBeNull();

    const secondDelete = await agent
      .delete(`/api/jobs/${deletableDraft.id}`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(secondDelete.status).toBe(404);
  });

  it("rejects client companyId expansion on delete (BR-38)", async () => {
    const agent = createTestAgent();
    const companyA = await createActiveCompanyManagerContext({
      email: "cm.job.delete.expand.a@example.com",
      businessRegistrationNumber: "BRN-V5-F12-EXP-A",
    });
    const companyB = await createActiveCompanyManagerContext({
      email: "cm.job.delete.expand.b@example.com",
      businessRegistrationNumber: "BRN-V5-F12-EXP-B",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.delete.expand@example.com",
      company: companyA.company,
      employeeCode: "NV-F12-EXP",
    });
    const catalog = await seedCatalog();
    const { recruiterToken, job: draft } = await createDraftJobViaApi({
      agent,
      recruiter,
      content: buildCompleteContent(catalog, {
        title: "Tenant draft",
      }),
    });
    const { job: pending } = await createSubmittedPendingJob({
      agent,
      recruiter,
      content: buildCompleteContent(catalog, {
        title: "Tenant pending",
      }),
    });

    const primaryExpanded = await agent
      .delete(`/api/jobs/${draft.id}`)
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({
        companyId: companyB.company._id.toString(),
      });

    expect(primaryExpanded.status).toBe(403);
    expect(await Job.findById(draft.id)).not.toBeNull();

    const managerToken = await loginAndGetAccessToken(agent, {
      email: companyA.user.email,
      password: DEFAULT_PASSWORD,
    });

    const managerExpanded = await agent
      .delete(`/api/jobs/${pending.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        companyId: companyB.company._id.toString(),
      });

    expect(managerExpanded.status).toBe(403);
    expect(managerExpanded.body.error.message).toMatch(
      /company identifier is not an authorization source/i,
    );
    expect(await Job.findById(pending.id)).not.toBeNull();
  });

  it("clears outstanding Primary responsibility after Primary DRAFT delete (BR-41 consequence)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.delete.br41@example.com",
      businessRegistrationNumber: "BRN-V5-F12-BR41",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.delete.br41@example.com",
      company: manager.company,
      employeeCode: "NV-F12-BR41",
    });
    const catalog = await seedCatalog();
    const { recruiterToken, job: draft } = await createDraftJobViaApi({
      agent,
      recruiter,
      content: buildCompleteContent(catalog, {
        title: "Blocking draft",
      }),
    });

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const blockedLock = await agent
      .post(`/api/company/recruiters/${recruiter.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(blockedLock.status).toBe(409);

    const deleteResponse = await agent
      .delete(`/api/jobs/${draft.id}`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(deleteResponse.status).toBe(200);
    expect(await Job.findById(draft.id)).toBeNull();

    const lockResponse = await agent
      .post(`/api/company/recruiters/${recruiter.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(lockResponse.status).toBe(200);
    expect(
      (await CompanyMember.findById(recruiter.membership._id).lean()).status,
    ).toBe(COMPANY_MEMBER_STATUS.LOCKED);
  });

  it("rejects unknown Job id", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.delete.missing@example.com",
      businessRegistrationNumber: "BRN-V5-F12-MISS",
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .delete(`/api/jobs/${new mongoose.Types.ObjectId()}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(404);
  });
});
