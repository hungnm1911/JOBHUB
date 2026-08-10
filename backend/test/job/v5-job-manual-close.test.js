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
import WORK_MODE from "../../src/constants/work-mode.js";
import { migrate as migrateExperienceLevels } from "../../src/database/migrations/v4-experience-level-dataset.js";
import CompanyMember from "../../src/models/company-member.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job from "../../src/models/job.model.js";
import {
  createFieldCategory,
  createPositionCategory,
} from "../../src/services/category.service.js";
import { closePublishedJob } from "../../src/services/job.service.js";
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

describe("V5 Slice 10 — Manual close Job (F09 / TX-02)", () => {
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

  const assertHistoricalFieldsPreserved = (before, after) => {
    expect(after.companyId.toString()).toBe(before.companyId.toString());
    expect(after.createdByCompanyMemberId.toString()).toBe(
      before.createdByCompanyMemberId.toString(),
    );
    expect(after.primaryRecruiterCompanyMemberId.toString()).toBe(
      before.primaryRecruiterCompanyMemberId.toString(),
    );
    expect(after.publishedAt.toISOString()).toBe(
      before.publishedAt.toISOString(),
    );
    expect(after.title).toBe(before.title);
    expect(after.jobDescription).toBe(before.jobDescription);
    expect(after.requiredSkills).toEqual(before.requiredSkills);
    expect(after.salaryText).toBe(before.salaryText);
    expect(after.location).toBe(before.location);
    expect(after.employmentType).toBe(before.employmentType);
    expect(after.workModes).toEqual(before.workModes);
    expect(after.experienceLevelId.toString()).toBe(
      before.experienceLevelId.toString(),
    );
    expect(after.applicationDeadline.toISOString()).toBe(
      before.applicationDeadline.toISOString(),
    );
  };

  it("lets current Primary close PUBLISHED without mutating ownership/content (BR-28/BR-29/BR-32/TX-02)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.close.primary@example.com",
      businessRegistrationNumber: "BRN-V5-F09-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.close.primary@example.com",
      company: manager.company,
      employeeCode: "NV-F09-1",
    });
    const catalog = await seedCatalog();
    const { recruiterToken, job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: primary,
      content: buildCompleteContent(catalog),
    });

    const jobCountBefore = await Job.countDocuments();
    const before = await Job.findById(published.id).lean();

    const response = await agent
      .post(`/api/jobs/${published.id}/close`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/closed/i);
    expect(response.body.job.status).toBe(JOB_STATUS.CLOSED);
    expect(response.body.job.primaryRecruiterCompanyMemberId).toBe(
      primary.membership._id.toString(),
    );
    expect(response.body.job.createdByCompanyMemberId).toBe(
      primary.membership._id.toString(),
    );
    expect(response.body.job.companyId).toBe(manager.company._id.toString());
    expect(new Date(response.body.job.publishedAt).toISOString()).toBe(
      before.publishedAt.toISOString(),
    );
    expect(response.body.job.title).toBe(before.title);

    const after = await Job.findById(published.id).lean();
    expect(after).not.toBeNull();
    expect(after.status).toBe(JOB_STATUS.CLOSED);
    assertHistoricalFieldsPreserved(before, after);
    expect(await Job.countDocuments()).toBe(jobCountBefore);
  });

  it("lets Company Manager close PUBLISHED without mutating ownership/content (BR-28/TX-02)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.close.manager@example.com",
      businessRegistrationNumber: "BRN-V5-F09-2",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.close.manager@example.com",
      company: manager.company,
      employeeCode: "NV-F09-2",
    });
    const catalog = await seedCatalog();
    const { managerToken, job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: primary,
      content: buildCompleteContent(catalog),
    });

    const before = await Job.findById(published.id).lean();

    const response = await agent
      .post(`/api/jobs/${published.id}/close`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.job.status).toBe(JOB_STATUS.CLOSED);

    const after = await Job.findById(published.id).lean();
    expect(after.status).toBe(JOB_STATUS.CLOSED);
    assertHistoricalFieldsPreserved(before, after);
  });

  it("denies peer Recruiter, former Primary/creator, and cross-tenant close (BR-28/BR-38)", async () => {
    const agent = createTestAgent();
    const companyA = await createActiveCompanyManagerContext({
      email: "cm.job.close.auth.a@example.com",
      businessRegistrationNumber: "BRN-V5-F09-3A",
    });
    const companyB = await createActiveCompanyManagerContext({
      email: "cm.job.close.auth.b@example.com",
      businessRegistrationNumber: "BRN-V5-F09-3B",
    });
    const creator = await createActiveRecruiterContext({
      email: "recruiter.job.close.auth.creator@example.com",
      company: companyA.company,
      employeeCode: "NV-F09-3A",
    });
    const peer = await createActiveRecruiterContext({
      email: "recruiter.job.close.auth.peer@example.com",
      company: companyA.company,
      employeeCode: "NV-F09-3B",
    });
    const successor = await createActiveRecruiterContext({
      email: "recruiter.job.close.auth.successor@example.com",
      company: companyA.company,
      employeeCode: "NV-F09-3C",
    });
    const foreignRecruiter = await createActiveRecruiterContext({
      email: "recruiter.job.close.auth.foreign@example.com",
      company: companyB.company,
      employeeCode: "NV-F09-3D",
    });
    const catalog = await seedCatalog();
    const {
      managerToken,
      recruiterToken: creatorToken,
      job: published,
    } = await createPublishedJob({
      agent,
      manager: companyA,
      recruiter: creator,
      content: buildCompleteContent(catalog),
    });

    const peerToken = await loginAndGetAccessToken(agent, {
      email: peer.user.email,
      password: DEFAULT_PASSWORD,
    });
    const peerDenied = await agent
      .post(`/api/jobs/${published.id}/close`)
      .set("Authorization", `Bearer ${peerToken}`);

    expect(peerDenied.status).toBe(403);

    const reassign = await agent
      .post(`/api/jobs/${published.id}/reassign-primary`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        primaryRecruiterCompanyMemberId: successor.membership._id.toString(),
      });

    expect(reassign.status).toBe(200);

    const formerPrimaryDenied = await agent
      .post(`/api/jobs/${published.id}/close`)
      .set("Authorization", `Bearer ${creatorToken}`);

    expect(formerPrimaryDenied.status).toBe(403);
    expect((await Job.findById(published.id).lean()).status).toBe(
      JOB_STATUS.PUBLISHED,
    );

    const foreignToken = await loginAndGetAccessToken(agent, {
      email: foreignRecruiter.user.email,
      password: DEFAULT_PASSWORD,
    });
    const foreignDenied = await agent
      .post(`/api/jobs/${published.id}/close`)
      .set("Authorization", `Bearer ${foreignToken}`);

    expect(foreignDenied.status).toBe(403);

    const foreignManagerToken = await loginAndGetAccessToken(agent, {
      email: companyB.user.email,
      password: DEFAULT_PASSWORD,
    });
    const foreignManagerDenied = await agent
      .post(`/api/jobs/${published.id}/close`)
      .set("Authorization", `Bearer ${foreignManagerToken}`);

    expect(foreignManagerDenied.status).toBe(403);
    expect((await Job.findById(published.id).lean()).status).toBe(
      JOB_STATUS.PUBLISHED,
    );
  });

  it("rejects close when Job is not PUBLISHED (BR-29)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.close.status@example.com",
      businessRegistrationNumber: "BRN-V5-F09-4",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.close.status@example.com",
      company: manager.company,
      employeeCode: "NV-F09-4",
    });
    const catalog = await seedCatalog();
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: primary.user.email,
      password: DEFAULT_PASSWORD,
    });

    const createDraft = await agent
      .post("/api/jobs")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send(buildCompleteContent(catalog));

    expect(createDraft.status).toBe(201);

    const draftDenied = await agent
      .post(`/api/jobs/${createDraft.body.job.id}/close`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(draftDenied.status).toBe(409);

    const submit = await agent
      .post(`/api/jobs/${createDraft.body.job.id}/submit`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(submit.status).toBe(200);

    const pendingDenied = await agent
      .post(`/api/jobs/${createDraft.body.job.id}/close`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(pendingDenied.status).toBe(409);

    for (const status of [JOB_STATUS.CLOSED, JOB_STATUS.EXPIRED]) {
      const job = await Job.create({
        companyId: manager.company._id,
        createdByCompanyMemberId: primary.membership._id,
        primaryRecruiterCompanyMemberId: primary.membership._id,
        status,
        title: `${status} Job`,
        publishedAt: new Date("2026-01-15T00:00:00.000Z"),
      });

      const denied = await agent
        .post(`/api/jobs/${job._id}/close`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(denied.status).toBe(409);
      expect((await Job.findById(job._id).lean()).status).toBe(status);
    }
  });

  it("rejects stale close after Job leaves PUBLISHED and keeps CLOSED terminal (BR-29/BR-32/TX-02)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.close.stale@example.com",
      businessRegistrationNumber: "BRN-V5-F09-5",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.close.stale@example.com",
      company: manager.company,
      employeeCode: "NV-F09-5",
    });
    const catalog = await seedCatalog();
    const { managerToken, recruiterToken, job: published } =
      await createPublishedJob({
        agent,
        manager,
        recruiter: primary,
        content: buildCompleteContent(catalog),
      });

    const firstClose = await agent
      .post(`/api/jobs/${published.id}/close`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(firstClose.status).toBe(200);
    expect(firstClose.body.job.status).toBe(JOB_STATUS.CLOSED);

    const beforeSecond = await Job.findById(published.id).lean();

    const secondClose = await agent
      .post(`/api/jobs/${published.id}/close`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(secondClose.status).toBe(409);

    const afterSecond = await Job.findById(published.id).lean();
    expect(afterSecond.status).toBe(JOB_STATUS.CLOSED);
    assertHistoricalFieldsPreserved(beforeSecond, afterSecond);

    const contentMutation = await agent
      .patch(`/api/jobs/${published.id}`)
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({
        title: "Reopened title",
      });

    expect(contentMutation.status).toBe(409);
    expect((await Job.findById(published.id).lean()).title).toBe(
      beforeSecond.title,
    );
    expect(await Job.countDocuments({
      _id: published.id,
    })).toBe(1);
  });

  it("clears BR-41 outstanding Primary responsibility after close", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.close.br41@example.com",
      businessRegistrationNumber: "BRN-V5-F09-6",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.close.br41@example.com",
      company: manager.company,
      employeeCode: "NV-F09-6",
    });
    const catalog = await seedCatalog();
    const { managerToken, recruiterToken, job: published } =
      await createPublishedJob({
        agent,
        manager,
        recruiter: primary,
        content: buildCompleteContent(catalog),
      });

    const blockedWhilePublished = await agent
      .post(`/api/company/recruiters/${primary.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(blockedWhilePublished.status).toBe(409);

    const closeResponse = await agent
      .post(`/api/jobs/${published.id}/close`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(closeResponse.status).toBe(200);
    expect(closeResponse.body.job.status).toBe(JOB_STATUS.CLOSED);

    const lockAfterClose = await agent
      .post(`/api/company/recruiters/${primary.user._id.toString()}/lock`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(lockAfterClose.status).toBe(200);
    expect(
      (await CompanyMember.findById(primary.membership._id).lean()).status,
    ).toBe(COMPANY_MEMBER_STATUS.LOCKED);
    expect((await Job.findById(published.id).lean()).status).toBe(
      JOB_STATUS.CLOSED,
    );
  });

  it("rejects client companyId expansion and unknown Job id (BR-38)", async () => {
    const agent = createTestAgent();
    const companyA = await createActiveCompanyManagerContext({
      email: "cm.job.close.expand.a@example.com",
      businessRegistrationNumber: "BRN-V5-F09-7A",
    });
    const companyB = await createActiveCompanyManagerContext({
      email: "cm.job.close.expand.b@example.com",
      businessRegistrationNumber: "BRN-V5-F09-7B",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.close.expand@example.com",
      company: companyA.company,
      employeeCode: "NV-F09-7",
    });
    const catalog = await seedCatalog();
    const { job: published } = await createPublishedJob({
      agent,
      manager: companyA,
      recruiter: primary,
      content: buildCompleteContent(catalog),
    });

    const managerToken = await loginAndGetAccessToken(agent, {
      email: companyA.user.email,
      password: DEFAULT_PASSWORD,
    });

    const expanded = await agent
      .post(`/api/jobs/${published.id}/close`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        companyId: companyB.company._id.toString(),
      });

    expect(expanded.status).toBe(403);
    expect(expanded.body.error.message).toMatch(
      /company identifier is not an authorization source/i,
    );
    expect((await Job.findById(published.id).lean()).status).toBe(
      JOB_STATUS.PUBLISHED,
    );

    const missing = await agent
      .post(`/api/jobs/${new mongoose.Types.ObjectId()}/close`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(missing.status).toBe(404);
  });

  it("rejects Primary and CM close of persisted PUBLISHED Job past deadline without materializing EXPIRED (BR-28/BR-30/BR-31)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.close.effective-expired@example.com",
      businessRegistrationNumber: "BRN-V5-F09-EFF-1",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.close.effective-expired@example.com",
      company: manager.company,
      employeeCode: "NV-F09-EFF-1",
    });

    const pastDeadline = new Date(Date.now() - 60 * 1000);
    const published = await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: primary.membership._id,
      primaryRecruiterCompanyMemberId: primary.membership._id,
      status: JOB_STATUS.PUBLISHED,
      title: "Past Deadline Published Job",
      jobDescription: "Should not close after deadline.",
      requiredSkills: ["Node.js"],
      salaryText: "Negotiate",
      applicationDeadline: pastDeadline,
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const before = await Job.findById(published._id).lean();
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: primary.user.email,
      password: DEFAULT_PASSWORD,
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    const primaryClose = await agent
      .post(`/api/jobs/${published._id}/close`)
      .set("Authorization", `Bearer ${recruiterToken}`);

    expect(primaryClose.status).toBe(409);
    expect(primaryClose.body.error.message).toMatch(/PUBLISHED/i);

    const afterPrimaryAttempt = await Job.findById(published._id).lean();

    expect(afterPrimaryAttempt.status).toBe(JOB_STATUS.PUBLISHED);
    expect(afterPrimaryAttempt.primaryRecruiterCompanyMemberId.toString()).toBe(
      before.primaryRecruiterCompanyMemberId.toString(),
    );
    expect(afterPrimaryAttempt.createdByCompanyMemberId.toString()).toBe(
      before.createdByCompanyMemberId.toString(),
    );
    expect(afterPrimaryAttempt.companyId.toString()).toBe(
      before.companyId.toString(),
    );
    expect(afterPrimaryAttempt.publishedAt.toISOString()).toBe(
      before.publishedAt.toISOString(),
    );
    expect(afterPrimaryAttempt.title).toBe(before.title);
    expect(afterPrimaryAttempt.jobDescription).toBe(before.jobDescription);

    const managerClose = await agent
      .post(`/api/jobs/${published._id}/close`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(managerClose.status).toBe(409);
    expect(managerClose.body.error.message).toMatch(/PUBLISHED/i);

    const afterManagerAttempt = await Job.findById(published._id).lean();

    expect(afterManagerAttempt.status).toBe(JOB_STATUS.PUBLISHED);
    expect(afterManagerAttempt.primaryRecruiterCompanyMemberId.toString()).toBe(
      before.primaryRecruiterCompanyMemberId.toString(),
    );
    expect(afterManagerAttempt.createdByCompanyMemberId.toString()).toBe(
      before.createdByCompanyMemberId.toString(),
    );
    expect(afterManagerAttempt.companyId.toString()).toBe(
      before.companyId.toString(),
    );
    expect(afterManagerAttempt.publishedAt.toISOString()).toBe(
      before.publishedAt.toISOString(),
    );
    expect(afterManagerAttempt.title).toBe(before.title);
    expect(afterManagerAttempt.applicationDeadline.toISOString()).toBe(
      pastDeadline.toISOString(),
    );
  });

  it("rejects Primary close when clock crosses fixed deadline before conditional write (BR-28/BR-30/BR-31/TX-02)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.close.deadline-race.primary@example.com",
      businessRegistrationNumber: "BRN-V5-F09-EFF-2",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.close.deadline-race.primary@example.com",
      company: manager.company,
      employeeCode: "NV-F09-EFF-2",
    });
    const catalog = await seedCatalog();
    const { job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: primary,
      content: buildCompleteContent(catalog),
    });

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
        if (update?.$set?.status === JOB_STATUS.CLOSED) {
          resolveWriteReached();
          return holdWrite.then(() =>
            originalFindOneAndUpdate(filter, update, options),
          );
        }

        return originalFindOneAndUpdate(filter, update, options);
      },
    );

    const closePromise = closePublishedJob({
      actorUser: primary.user,
      jobId: published.id,
      now: operationNow,
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

    releaseWrite();

    await expect(closePromise).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/PUBLISHED/i),
    });

    const after = await Job.findById(published.id).lean();

    expect(after.status).toBe(JOB_STATUS.PUBLISHED);
    assertHistoricalFieldsPreserved(before, after);
    expect(after.applicationDeadline.toISOString()).toBe(
      deadline.toISOString(),
    );
  });

  it("rejects Company Manager close when clock crosses fixed deadline before conditional write (BR-28/BR-30/BR-31/TX-02)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.close.deadline-race.manager@example.com",
      businessRegistrationNumber: "BRN-V5-F09-EFF-3",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.close.deadline-race.manager@example.com",
      company: manager.company,
      employeeCode: "NV-F09-EFF-3",
    });
    const catalog = await seedCatalog();
    const { job: published } = await createPublishedJob({
      agent,
      manager,
      recruiter: primary,
      content: buildCompleteContent(catalog),
    });

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
        if (update?.$set?.status === JOB_STATUS.CLOSED) {
          resolveWriteReached();
          return holdWrite.then(() =>
            originalFindOneAndUpdate(filter, update, options),
          );
        }

        return originalFindOneAndUpdate(filter, update, options);
      },
    );

    const closePromise = closePublishedJob({
      actorUser: manager.user,
      jobId: published.id,
      now: operationNow,
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

    releaseWrite();

    await expect(closePromise).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/PUBLISHED/i),
    });

    const after = await Job.findById(published.id).lean();

    expect(after.status).toBe(JOB_STATUS.PUBLISHED);
    assertHistoricalFieldsPreserved(before, after);
    expect(after.applicationDeadline.toISOString()).toBe(
      deadline.toISOString(),
    );
  });
});
