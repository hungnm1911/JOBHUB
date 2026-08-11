import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import LOCATION from "../../src/constants/location.js";
import USER_STATUS from "../../src/constants/user-status.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import { migrate as migrateExperienceLevels } from "../../src/database/migrations/v4-experience-level-dataset.js";
import CompanyMember from "../../src/models/company-member.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  createFieldCategory,
  createPositionCategory,
} from "../../src/services/category.service.js";
import { reassignPrimaryRecruiter } from "../../src/services/job.service.js";
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

describe("V5 Slice 09 — Reassign Primary Recruiter (F08 / TX-03)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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

  const addSupporting = async (jobId, companyMemberId) => {
    await Job.findByIdAndUpdate(jobId, {
      $addToSet: { supportingRecruiterCompanyMemberIds: companyMemberId },
    });
  };

  const createPublishedJob = async ({ agent, manager, recruiter, content }) => {
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

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const approveResponse = await agent
      .post(`/api/jobs/${createResponse.body.job.id}/approve`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.job.status).toBe(JOB_STATUS.PUBLISHED);

    return {
      managerToken,
      recruiterToken,
      job: approveResponse.body.job,
    };
  };

  it("lets Company Manager reassign Primary on PUBLISHED without mutating creator/content (BR-05/BR-06/BR-26/BR-27/TX-03)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reassign@example.com",
      businessRegistrationNumber: "BRN-V5-F08-1",
    });
    const creator = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.creator@example.com",
      company: manager.company,
      employeeCode: "NV-F08-1A",
    });
    const successor = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.successor@example.com",
      company: manager.company,
      employeeCode: "NV-F08-1B",
    });
    const catalog = await seedCatalog();
    const { managerToken, job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: creator,
      content: buildCompleteContent(catalog),
    });

    await addSupporting(published.id, successor.membership._id);

    const membershipCountBefore = await CompanyMember.countDocuments();
    const before = await Job.findById(published.id).lean();

    const response = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId: successor.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/reassigned/i);
    expect(response.body.job.status).toBe(JOB_STATUS.PUBLISHED);
    expect(response.body.job.primaryRecruiterCompanyMemberId).toBe(
      successor.membership._id.toString(),
    );
    expect(response.body.job.createdByCompanyMemberId).toBe(
      creator.membership._id.toString(),
    );
    expect(response.body.job.companyId).toBe(manager.company._id.toString());
    expect(response.body.job.title).toBe(before.title);
    expect(response.body.job.jobDescription).toBe(before.jobDescription);
    expect(new Date(response.body.job.publishedAt).toISOString()).toBe(
      new Date(before.publishedAt).toISOString(),
    );

    const after = await Job.findById(published.id).lean();
    expect(after.primaryRecruiterCompanyMemberId.toString()).toBe(
      successor.membership._id.toString(),
    );
    expect(after.createdByCompanyMemberId.toString()).toBe(
      creator.membership._id.toString(),
    );
    expect(after.status).toBe(JOB_STATUS.PUBLISHED);
    expect(after.companyId.toString()).toBe(manager.company._id.toString());
    expect(after.publishedAt.toISOString()).toBe(
      before.publishedAt.toISOString(),
    );
    expect(after.title).toBe(before.title);
    expect(await CompanyMember.countDocuments()).toBe(membershipCountBefore);
  });

  it("denies Recruiter reassignment and cross-tenant Manager reassignment (BR-38/BR-43)", async () => {
    const agent = createTestAgent();
    const companyA = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.a@example.com",
      businessRegistrationNumber: "BRN-V5-F08-2A",
    });
    const companyB = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.b@example.com",
      businessRegistrationNumber: "BRN-V5-F08-2B",
    });
    const creator = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.auth@example.com",
      company: companyA.company,
      employeeCode: "NV-F08-2A",
    });
    const peer = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.peer@example.com",
      company: companyA.company,
      employeeCode: "NV-F08-2B",
    });
    const foreignRecruiter = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.foreign@example.com",
      company: companyB.company,
      employeeCode: "NV-F08-2C",
    });
    const catalog = await seedCatalog();
    const { managerToken, recruiterToken, job: published } =
      await createPublishedJob({
        agent,
        manager: companyA,
        recruiter: creator,
        content: buildCompleteContent(catalog),
      });

    await addSupporting(published.id, peer.membership._id);

    const recruiterResponse = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({
        primaryRecruiterCompanyMemberId: peer.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(recruiterResponse.status).toBe(403);
    expect(
      (await Job.findById(published.id).lean()).primaryRecruiterCompanyMemberId.toString(),
    ).toBe(creator.membership._id.toString());

    const foreignToken = await loginAndGetAccessToken(agent, {
      email: companyB.user.email,
      password: DEFAULT_PASSWORD,
    });
    const foreignResponse = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${foreignToken}`)
      .send({
        companyId: companyA.company._id.toString(),
        primaryRecruiterCompanyMemberId: peer.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(foreignResponse.status).toBe(403);
    expect(
      (await Job.findById(published.id).lean()).primaryRecruiterCompanyMemberId.toString(),
    ).toBe(creator.membership._id.toString());

    const crossTenantPrimary = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId:
          foreignRecruiter.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(crossTenantPrimary.status).toBe(409);
    expect(
      (await Job.findById(published.id).lean()).primaryRecruiterCompanyMemberId.toString(),
    ).toBe(creator.membership._id.toString());
  });

  it("rejects reassignment for DRAFT, PENDING_APPROVAL, CLOSED, and EXPIRED (BR-26)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.boundary@example.com",
      businessRegistrationNumber: "BRN-V5-F08-3",
    });
    const creator = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.boundary@example.com",
      company: manager.company,
      employeeCode: "NV-F08-3A",
    });
    const successor = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.boundary.b@example.com",
      company: manager.company,
      employeeCode: "NV-F08-3B",
    });

    const draft = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: creator.membership._id,
      primaryRecruiterCompanyMemberId: creator.membership._id,
      supportingRecruiterCompanyMemberIds: [successor.membership._id],
      status: JOB_STATUS.DRAFT,
      title: "Draft Job",
      publishedAt: null,
    });
    const pending = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: creator.membership._id,
      primaryRecruiterCompanyMemberId: creator.membership._id,
      supportingRecruiterCompanyMemberIds: [successor.membership._id],
      status: JOB_STATUS.PENDING_APPROVAL,
      title: "Pending Job",
      publishedAt: null,
    });
    const closed = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: creator.membership._id,
      primaryRecruiterCompanyMemberId: creator.membership._id,
      supportingRecruiterCompanyMemberIds: [successor.membership._id],
      status: JOB_STATUS.CLOSED,
      title: "Closed Job",
      publishedAt: new Date("2026-01-15T00:00:00.000Z"),
    });
    const expired = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: creator.membership._id,
      primaryRecruiterCompanyMemberId: creator.membership._id,
      supportingRecruiterCompanyMemberIds: [successor.membership._id],
      status: JOB_STATUS.EXPIRED,
      title: "Expired Job",
      publishedAt: new Date("2026-01-15T00:00:00.000Z"),
    });

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    for (const job of [draft, pending, closed, expired]) {
      const response = await agent
        .post(`/api/jobs/${job._id}/reassign-primary`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          primaryRecruiterCompanyMemberId: successor.membership._id.toString(),
          keepOldPrimaryAsSupporting: true,
        });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/PUBLISHED/i);
      expect(
        (await Job.findById(job._id).lean()).primaryRecruiterCompanyMemberId.toString(),
      ).toBe(creator.membership._id.toString());
    }
  });

  it("rejects inactive or missing successor Primary (BR-07)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.invalid@example.com",
      businessRegistrationNumber: "BRN-V5-F08-4",
    });
    const creator = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.invalid.a@example.com",
      company: manager.company,
      employeeCode: "NV-F08-4A",
    });
    const lockedSuccessor = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.invalid.b@example.com",
      company: manager.company,
      employeeCode: "NV-F08-4B",
    });
    const catalog = await seedCatalog();
    const { managerToken, job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: creator,
      content: buildCompleteContent(catalog),
    });

    await addSupporting(published.id, lockedSuccessor.membership._id);
    await CompanyMember.findByIdAndUpdate(lockedSuccessor.membership._id, {
      status: COMPANY_MEMBER_STATUS.LOCKED,
    });

    const lockedResponse = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId:
          lockedSuccessor.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(lockedResponse.status).toBe(409);

    const terminatedSuccessor = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.invalid.c@example.com",
      company: manager.company,
      employeeCode: "NV-F08-4C",
    });
    await addSupporting(published.id, terminatedSuccessor.membership._id);
    await CompanyMember.findByIdAndUpdate(terminatedSuccessor.membership._id, {
      status: COMPANY_MEMBER_STATUS.TERMINATED,
    });

    const terminatedResponse = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId:
          terminatedSuccessor.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(terminatedResponse.status).toBe(409);

    const inactiveUserSuccessor = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.invalid.d@example.com",
      company: manager.company,
      employeeCode: "NV-F08-4D",
    });
    await addSupporting(published.id, inactiveUserSuccessor.membership._id);
    await User.findByIdAndUpdate(inactiveUserSuccessor.user._id, {
      status: USER_STATUS.LOCKED,
    });

    const inactiveUserResponse = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId:
          inactiveUserSuccessor.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(inactiveUserResponse.status).toBe(409);

    const missingResponse = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId: new mongoose.Types.ObjectId().toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(missingResponse.status).toBe(409);
    expect(
      (await Job.findById(published.id).lean()).primaryRecruiterCompanyMemberId.toString(),
    ).toBe(creator.membership._id.toString());
  });

  it("rejects stale reassignment after Job leaves PUBLISHED (TX-03)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.stale@example.com",
      businessRegistrationNumber: "BRN-V5-F08-5",
    });
    const creator = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.stale.a@example.com",
      company: manager.company,
      employeeCode: "NV-F08-5A",
    });
    const successor = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.stale.b@example.com",
      company: manager.company,
      employeeCode: "NV-F08-5B",
    });
    const catalog = await seedCatalog();
    const { managerToken, job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: creator,
      content: buildCompleteContent(catalog),
    });

    await addSupporting(published.id, successor.membership._id);

    await Job.findByIdAndUpdate(published.id, {
      status: JOB_STATUS.CLOSED,
    });

    const response = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId: successor.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(409);
    expect(
      (await Job.findById(published.id).lean()).primaryRecruiterCompanyMemberId.toString(),
    ).toBe(creator.membership._id.toString());
    expect((await Job.findById(published.id).lean()).status).toBe(
      JOB_STATUS.CLOSED,
    );
  });

  it("moves BR-41 outstanding Primary responsibility to the new Primary", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.br41@example.com",
      businessRegistrationNumber: "BRN-V5-F08-6",
    });
    const creator = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.br41.a@example.com",
      company: manager.company,
      employeeCode: "NV-F08-6A",
    });
    const successor = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.br41.b@example.com",
      company: manager.company,
      employeeCode: "NV-F08-6B",
    });
    const catalog = await seedCatalog();
    const { managerToken, job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: creator,
      content: buildCompleteContent(catalog),
    });

    await addSupporting(published.id, successor.membership._id);

    const blockedOld = await agent
      .post(`/api/company/recruiters/${creator.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(blockedOld.status).toBe(409);

    const reassignResponse = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId: successor.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(reassignResponse.status).toBe(200);

    // After V6 F05, lock auto-removes Supporting responsibility on
    // unfinished Jobs before completion, so lock now succeeds directly.
    const lockOldAfterReassign = await agent
      .post(`/api/company/recruiters/${creator.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(lockOldAfterReassign.status).toBe(200);
    expect(
      (await CompanyMember.findById(creator.membership._id).lean()).status,
    ).toBe(COMPANY_MEMBER_STATUS.LOCKED);

    const blockedNew = await agent
      .post(`/api/company/recruiters/${successor.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(blockedNew.status).toBe(409);
    expect(
      (await CompanyMember.findById(successor.membership._id).lean()).status,
    ).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("rejects client companyId expansion on reassignment (BR-38)", async () => {
    const agent = createTestAgent();
    const companyA = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.expand.a@example.com",
      businessRegistrationNumber: "BRN-V5-F08-7A",
    });
    const companyB = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.expand.b@example.com",
      businessRegistrationNumber: "BRN-V5-F08-7B",
    });
    const creator = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.expand.a@example.com",
      company: companyA.company,
      employeeCode: "NV-F08-7A",
    });
    const successor = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.expand.b@example.com",
      company: companyA.company,
      employeeCode: "NV-F08-7B",
    });
    const catalog = await seedCatalog();
    const { job: published } = await createPublishedJob({
      agent,
      manager: companyA,
      recruiter: creator,
      content: buildCompleteContent(catalog),
    });

    await addSupporting(published.id, successor.membership._id);

    const managerToken = await loginAndGetAccessToken(agent, {
      email: companyA.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        companyId: companyB.company._id.toString(),
        primaryRecruiterCompanyMemberId: successor.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(
      /company identifier is not an authorization source/i,
    );
    expect(
      (await Job.findById(published.id).lean()).primaryRecruiterCompanyMemberId.toString(),
    ).toBe(creator.membership._id.toString());
  });

  it("rejects unknown Job id and missing Primary id", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.missing@example.com",
      businessRegistrationNumber: "BRN-V5-F08-8",
    });
    const successor = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.missing@example.com",
      company: manager.company,
      employeeCode: "NV-F08-8",
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const missingJob = await agent
      .post(`/api/jobs/${new mongoose.Types.ObjectId()}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId: successor.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(missingJob.status).toBe(404);

    const published = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: successor.membership._id,
      primaryRecruiterCompanyMemberId: successor.membership._id,
      status: JOB_STATUS.PUBLISHED,
      title: "Published Job",
      publishedAt: new Date("2026-01-15T00:00:00.000Z"),
    });

    const missingPrimary = await agent
      .post(`/api/jobs/${published._id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({});

    expect(missingPrimary.status).toBe(400);
    expect(missingPrimary.body.error.message).toMatch(
      /Primary Recruiter CompanyMember id|expected string/i,
    );
    expect(missingPrimary.body.error.details.field).toBe(
      "primaryRecruiterCompanyMemberId",
    );
  });

  it("rejects reassignment of persisted PUBLISHED Job past deadline without materializing EXPIRED (BR-26/BR-30/BR-31)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.effective-expired@example.com",
      businessRegistrationNumber: "BRN-V5-F08-EFF-1",
    });
    const creator = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.effective-expired.a@example.com",
      company: manager.company,
      employeeCode: "NV-F08-EFF-1A",
    });
    const successor = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.effective-expired.b@example.com",
      company: manager.company,
      employeeCode: "NV-F08-EFF-1B",
    });

    const pastDeadline = new Date(Date.now() - 60 * 1000);
    const published = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: creator.membership._id,
      primaryRecruiterCompanyMemberId: creator.membership._id,
      supportingRecruiterCompanyMemberIds: [successor.membership._id],
      status: JOB_STATUS.PUBLISHED,
      title: "Past Deadline Published Job",
      applicationDeadline: pastDeadline,
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const before = await Job.findById(published._id).lean();
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .post(`/api/jobs/${published._id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId: successor.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/PUBLISHED/i);

    const after = await Job.findById(published._id).lean();

    expect(after.status).toBe(JOB_STATUS.PUBLISHED);
    expect(after.primaryRecruiterCompanyMemberId.toString()).toBe(
      creator.membership._id.toString(),
    );
    expect(after.createdByCompanyMemberId.toString()).toBe(
      before.createdByCompanyMemberId.toString(),
    );
    expect(after.companyId.toString()).toBe(before.companyId.toString());
    expect(after.publishedAt.toISOString()).toBe(
      before.publishedAt.toISOString(),
    );
    expect(after.title).toBe(before.title);
    expect(after.applicationDeadline.toISOString()).toBe(
      pastDeadline.toISOString(),
    );
  });

  it("rejects NONE → PRIMARY via legacy reassign path after V6 (BR-20)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.none-primary@example.com",
      businessRegistrationNumber: "BRN-V5-F08-BR20",
    });
    const creator = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.none-primary.a@example.com",
      company: manager.company,
      employeeCode: "NV-F08-BR20A",
    });
    const outsider = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.none-primary.b@example.com",
      company: manager.company,
      employeeCode: "NV-F08-BR20B",
    });
    const catalog = await seedCatalog();
    const { managerToken, job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: creator,
      content: buildCompleteContent(catalog),
    });

    const response = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId: outsider.membership._id.toString(),
        keepOldPrimaryAsSupporting: true,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/Supporting/i);

    const after = await Job.findById(published.id).lean();
    expect(after.primaryRecruiterCompanyMemberId.toString()).toBe(
      creator.membership._id.toString(),
    );
    expect(after.createdByCompanyMemberId.toString()).toBe(
      creator.membership._id.toString(),
    );
    expect(after.companyId.toString()).toBe(manager.company._id.toString());
    expect(after.status).toBe(JOB_STATUS.PUBLISHED);
  });

  it("rejects legacy reassignment when keepOldPrimaryAsSupporting is not provided (F04 outcome choice required)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.no-outcome@example.com",
      businessRegistrationNumber: "BRN-V5-F08-NO-OUTCOME",
    });
    const creator = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.no-outcome.a@example.com",
      company: manager.company,
      employeeCode: "NV-F08-NOA",
    });
    const successor = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.no-outcome.b@example.com",
      company: manager.company,
      employeeCode: "NV-F08-NOB",
    });
    const catalog = await seedCatalog();
    const { managerToken, job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: creator,
      content: buildCompleteContent(catalog),
    });

    await addSupporting(published.id, successor.membership._id);

    const response = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId: successor.membership._id.toString(),
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/keepOldPrimaryAsSupporting/i);

    const after = await Job.findById(published.id).lean();
    expect(after.primaryRecruiterCompanyMemberId.toString()).toBe(
      creator.membership._id.toString(),
    );
    expect(after.status).toBe(JOB_STATUS.PUBLISHED);
  });

  it("legacy path with explicit keepOldPrimaryAsSupporting=false removes old Primary from team (F04 NONE outcome)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.none-outcome@example.com",
      businessRegistrationNumber: "BRN-V5-F08-NONE-OUT",
    });
    const creator = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.none-outcome.a@example.com",
      company: manager.company,
      employeeCode: "NV-F08-NONEA",
    });
    const successor = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.none-outcome.b@example.com",
      company: manager.company,
      employeeCode: "NV-F08-NONEB",
    });
    const catalog = await seedCatalog();
    const { managerToken, job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: creator,
      content: buildCompleteContent(catalog),
    });

    await addSupporting(published.id, successor.membership._id);

    const response = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId: successor.membership._id.toString(),
        keepOldPrimaryAsSupporting: false,
      });

    expect(response.status).toBe(200);

    const after = await Job.findById(published.id).lean();
    expect(after.primaryRecruiterCompanyMemberId.toString()).toBe(
      successor.membership._id.toString(),
    );
    expect(
      (after.supportingRecruiterCompanyMemberIds || []).map((id) =>
        id.toString(),
      ),
    ).not.toContain(creator.membership._id.toString());
    expect(
      (after.supportingRecruiterCompanyMemberIds || []).map((id) =>
        id.toString(),
      ),
    ).not.toContain(successor.membership._id.toString());
    expect(after.createdByCompanyMemberId.toString()).toBe(
      creator.membership._id.toString(),
    );
    expect(after.companyId.toString()).toBe(manager.company._id.toString());
    expect(after.status).toBe(JOB_STATUS.PUBLISHED);
  });

  it("rejects stale reassignment when clock crosses fixed deadline before conditional write (BR-26/BR-30/BR-31/TX-03)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.reassign.deadline-race@example.com",
      businessRegistrationNumber: "BRN-V5-F08-EFF-2",
    });
    const creator = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.deadline-race.a@example.com",
      company: manager.company,
      employeeCode: "NV-F08-EFF-2A",
    });
    const successor = await createActiveRecruiterContext({
      email: "recruiter.job.reassign.deadline-race.b@example.com",
      company: manager.company,
      employeeCode: "NV-F08-EFF-2B",
    });
    const catalog = await seedCatalog();
    const { job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: creator,
      content: buildCompleteContent(catalog),
    });

    await addSupporting(published.id, successor.membership._id);

    // Fixed deadline T. Operation starts before T; clock alone crosses T while
    // the Job document deadline stays unchanged (no post-start deadline mutation).
    const deadline = new Date(Date.now() + 300);
    await Job.collection.updateOne(
      {
        _id: new mongoose.Types.ObjectId(published.id),
      },
      {
        $set: {
          applicationDeadline: deadline,
        },
      },
    );

    const operationNow = new Date();
    expect(operationNow.getTime()).toBeLessThan(deadline.getTime());

    const before = await Job.findById(published.id).lean();
    const originalFindOneAndUpdate = Job.findOneAndUpdate.bind(Job);
    let releaseWrite;
    const holdWrite = new Promise((resolve) => {
      releaseWrite = resolve;
    });
    let resolveWriteReached;
    const writeReached = new Promise((resolve) => {
      resolveWriteReached = resolve;
    });

    vi.spyOn(Job, "findOneAndUpdate").mockImplementation(
      (filter, update, options) => {
        if (update?.$set?.primaryRecruiterCompanyMemberId != null) {
          resolveWriteReached();
          return holdWrite.then(() =>
            originalFindOneAndUpdate(filter, update, options),
          );
        }

        return originalFindOneAndUpdate(filter, update, options);
      },
    );

    const reassignPromise = reassignPrimaryRecruiter({
      managerUser: manager.user,
      jobId: published.id,
      primaryRecruiterCompanyMemberId: successor.membership._id.toString(),
      keepOldPrimaryAsSupporting: true,
    });

    await writeReached;

    const remainingMs = deadline.getTime() - Date.now() + 40;
    if (remainingMs > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, remainingMs);
      });
    }

    expect(Date.now()).toBeGreaterThanOrEqual(deadline.getTime());

    const duringHold = await Job.findById(published.id).lean();
    expect(duringHold.applicationDeadline.toISOString()).toBe(
      deadline.toISOString(),
    );
    expect(duringHold.status).toBe(JOB_STATUS.PUBLISHED);
    expect(duringHold.primaryRecruiterCompanyMemberId.toString()).toBe(
      creator.membership._id.toString(),
    );

    releaseWrite();

    await expect(reassignPromise).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/PUBLISHED/i),
    });

    const after = await Job.findById(published.id).lean();

    expect(after.status).toBe(JOB_STATUS.PUBLISHED);
    expect(after.primaryRecruiterCompanyMemberId.toString()).toBe(
      creator.membership._id.toString(),
    );
    expect(after.createdByCompanyMemberId.toString()).toBe(
      before.createdByCompanyMemberId.toString(),
    );
    expect(after.companyId.toString()).toBe(before.companyId.toString());
    expect(after.publishedAt.toISOString()).toBe(
      before.publishedAt.toISOString(),
    );
    expect(after.title).toBe(before.title);
    expect(after.applicationDeadline.toISOString()).toBe(
      deadline.toISOString(),
    );
  });
});
