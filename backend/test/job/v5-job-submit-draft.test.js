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

import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import LOCATION from "../../src/constants/location.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import { migrate as migrateExperienceLevels } from "../../src/database/migrations/v4-experience-level-dataset.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job from "../../src/models/job.model.js";
import {
  createFieldCategory,
  createPositionCategory,
} from "../../src/services/category.service.js";
import {
  submitDraftJob,
  updateDraftJob,
} from "../../src/services/job.service.js";
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

describe("V5 Slice 04 — Submit Job for approval (F04)", () => {
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

    const fieldA = await createFieldCategory({
      name: "Software Engineering",
    });
    const fieldB = await createFieldCategory({
      name: "Product Design",
    });
    const positionA = await createPositionCategory({
      name: "Backend Engineer",
      parentCategoryId: fieldA.id,
    });
    const positionB = await createPositionCategory({
      name: "UI Designer",
      parentCategoryId: fieldB.id,
    });
    const experienceLevel = await ExperienceLevel.findOne({
      code: EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS,
    }).lean();

    return {
      fieldA,
      fieldB,
      positionA,
      positionB,
      experienceLevelId: experienceLevel._id.toString(),
    };
  };

  const buildCompleteContent = (catalog, overrides = {}) => {
    return {
      title: "Backend Engineer",
      jobDescription: "Build Job lifecycle APIs.",
      requiredSkills: ["Node.js", "MongoDB"],
      salaryText: "Negotiate",
      fieldCategoryIds: [catalog.fieldA.id],
      positionCategoryIds: [catalog.positionA.id],
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

  const createCompleteDraftViaApi = async (agent, recruiter, content) => {
    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const createResponse = await agent
      .post("/api/jobs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(content);

    expect(createResponse.status).toBe(201);

    return {
      accessToken,
      job: createResponse.body.job,
    };
  };

  it("lets Primary Recruiter submit a complete DRAFT to PENDING_APPROVAL without mutating content (BR-10–BR-18)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.submit@example.com",
      businessRegistrationNumber: "BRN-V5-SUB-1",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.submit@example.com",
      company: manager.company,
      employeeCode: "NV-SUB-1",
    });
    const catalog = await seedCatalog();
    const content = buildCompleteContent(catalog);
    const { accessToken, job } = await createCompleteDraftViaApi(
      agent,
      recruiter,
      content,
    );

    const response = await agent
      .post(`/api/jobs/${job.id}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/submitted for approval/i);
    expect(response.body.job).toMatchObject({
      id: job.id,
      companyId: manager.company._id.toString(),
      createdByCompanyMemberId: recruiter.membership._id.toString(),
      primaryRecruiterCompanyMemberId: recruiter.membership._id.toString(),
      title: content.title,
      jobDescription: content.jobDescription,
      requiredSkills: content.requiredSkills,
      salaryText: content.salaryText,
      fieldCategoryIds: content.fieldCategoryIds,
      positionCategoryIds: content.positionCategoryIds,
      location: content.location,
      employmentType: content.employmentType,
      workModes: content.workModes,
      experienceLevelId: content.experienceLevelId,
      status: JOB_STATUS.PENDING_APPROVAL,
      publishedAt: null,
    });
    expect(new Date(response.body.job.applicationDeadline).toISOString()).toBe(
      new Date(content.applicationDeadline).toISOString(),
    );

    const persisted = await Job.findById(job.id).lean();

    expect(persisted.status).toBe(JOB_STATUS.PENDING_APPROVAL);
    expect(persisted.publishedAt).toBeNull();
    expect(persisted.title).toBe(content.title);
    expect(persisted.companyId.toString()).toBe(manager.company._id.toString());
    expect(persisted.createdByCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
  });

  it("rejects incomplete DRAFT content at the submit completeness gate (BR-08/BR-10)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.submit.incomplete@example.com",
      businessRegistrationNumber: "BRN-V5-SUB-2",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.submit.incomplete@example.com",
      company: manager.company,
      employeeCode: "NV-SUB-2",
    });
    const catalog = await seedCatalog();
    const { accessToken, job } = await createCompleteDraftViaApi(
      agent,
      recruiter,
      {
        title: "Partial Draft Only",
      },
    );

    const response = await agent
      .post(`/api/jobs/${job.id}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/required before submit/i);

    const persisted = await Job.findById(job.id).lean();

    expect(persisted.status).toBe(JOB_STATUS.DRAFT);
    expect(persisted.title).toBe("Partial Draft Only");

    // Completeness still does not apply to create/edit paths.
    const patchResponse = await agent
      .patch(`/api/jobs/${job.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        jobDescription: "Still partial",
        fieldCategoryIds: [catalog.fieldA.id],
      });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.job.status).toBe(JOB_STATUS.DRAFT);
  });

  it("rejects inconsistent Category hierarchy and unknown ExperienceLevel (BR-11/BR-15/BR-16)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.submit.catalog@example.com",
      businessRegistrationNumber: "BRN-V5-SUB-3",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.submit.catalog@example.com",
      company: manager.company,
      employeeCode: "NV-SUB-3",
    });
    const catalog = await seedCatalog();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const inconsistent = await createCompleteDraftViaApi(
      agent,
      recruiter,
      buildCompleteContent(catalog, {
        fieldCategoryIds: [catalog.fieldA.id],
        positionCategoryIds: [catalog.positionB.id],
      }),
    );

    const inconsistentResponse = await agent
      .post(`/api/jobs/${inconsistent.job.id}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(inconsistentResponse.status).toBe(400);
    expect(inconsistentResponse.body.error.message).toMatch(/POSITION Category/i);
    expect(
      (await Job.findById(inconsistent.job.id).lean()).status,
    ).toBe(JOB_STATUS.DRAFT);

    const unknownExperience = await createCompleteDraftViaApi(
      agent,
      recruiter,
      buildCompleteContent(catalog, {
        experienceLevelId: new mongoose.Types.ObjectId().toString(),
      }),
    );

    const unknownResponse = await agent
      .post(`/api/jobs/${unknownExperience.job.id}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(unknownResponse.status).toBe(400);
    expect(unknownResponse.body.error.message).toMatch(/ExperienceLevel/i);
    expect(
      (await Job.findById(unknownExperience.job.id).lean()).status,
    ).toBe(JOB_STATUS.DRAFT);
  });

  it("rejects expired applicationDeadline and non-DRAFT status (BR-17/BR-19)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.submit.deadline@example.com",
      businessRegistrationNumber: "BRN-V5-SUB-4",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.submit.deadline@example.com",
      company: manager.company,
      employeeCode: "NV-SUB-4",
    });
    const catalog = await seedCatalog();
    const { accessToken, job } = await createCompleteDraftViaApi(
      agent,
      recruiter,
      buildCompleteContent(catalog, {
        applicationDeadline: new Date(
          Date.now() - 60 * 1000,
        ).toISOString(),
      }),
    );

    const expiredResponse = await agent
      .post(`/api/jobs/${job.id}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(expiredResponse.status).toBe(400);
    expect(expiredResponse.body.error.message).toMatch(/applicationDeadline/i);
    expect((await Job.findById(job.id).lean()).status).toBe(JOB_STATUS.DRAFT);

    const complete = await createCompleteDraftViaApi(
      agent,
      recruiter,
      buildCompleteContent(catalog),
    );
    const submitResponse = await agent
      .post(`/api/jobs/${complete.job.id}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(submitResponse.status).toBe(200);

    const secondSubmit = await agent
      .post(`/api/jobs/${complete.job.id}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(secondSubmit.status).toBe(409);

    const editLocked = await agent
      .patch(`/api/jobs/${complete.job.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Should stay locked",
      });

    expect(editLocked.status).toBe(409);
    expect((await Job.findById(complete.job.id).lean()).title).toBe(
      "Backend Engineer",
    );
  });

  it("rejects non-Primary peer and cross-tenant submit (BR-18/BR-38)", async () => {
    const agent = createTestAgent();
    const companyA = await createActiveCompanyManagerContext({
      email: "cm.job.submit.a@example.com",
      businessRegistrationNumber: "BRN-V5-SUB-5A",
    });
    const companyB = await createActiveCompanyManagerContext({
      email: "cm.job.submit.b@example.com",
      businessRegistrationNumber: "BRN-V5-SUB-5B",
    });
    const primary = await createActiveRecruiterContext({
      email: "recruiter.job.submit.primary@example.com",
      company: companyA.company,
      employeeCode: "NV-SUB-5",
    });
    const peer = await createActiveRecruiterContext({
      email: "recruiter.job.submit.peer@example.com",
      company: companyA.company,
      employeeCode: "NV-SUB-6",
    });
    const outsider = await createActiveRecruiterContext({
      email: "recruiter.job.submit.outsider@example.com",
      company: companyB.company,
      employeeCode: "NV-SUB-7",
    });
    const catalog = await seedCatalog();
    const { job } = await createCompleteDraftViaApi(
      agent,
      primary,
      buildCompleteContent(catalog),
    );

    const peerToken = await loginAndGetAccessToken(agent, {
      email: peer.user.email,
      password: DEFAULT_PASSWORD,
    });
    const peerResponse = await agent
      .post(`/api/jobs/${job.id}/submit`)
      .set("Authorization", `Bearer ${peerToken}`)
      .send({});

    expect(peerResponse.status).toBe(403);

    const outsiderToken = await loginAndGetAccessToken(agent, {
      email: outsider.user.email,
      password: DEFAULT_PASSWORD,
    });
    const outsiderResponse = await agent
      .post(`/api/jobs/${job.id}/submit`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({});

    expect(outsiderResponse.status).toBe(403);

    const managerToken = await loginAndGetAccessToken(agent, {
      email: companyA.user.email,
      password: DEFAULT_PASSWORD,
    });
    const managerResponse = await agent
      .post(`/api/jobs/${job.id}/submit`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({});

    expect(managerResponse.status).toBe(403);
    expect((await Job.findById(job.id).lean()).status).toBe(JOB_STATUS.DRAFT);
  });

  it("rejects client companyId expansion on submit (BR-38)", async () => {
    const agent = createTestAgent();
    const companyA = await createActiveCompanyManagerContext({
      email: "cm.job.submit.expand.a@example.com",
      businessRegistrationNumber: "BRN-V5-SUB-6A",
    });
    const companyB = await createActiveCompanyManagerContext({
      email: "cm.job.submit.expand.b@example.com",
      businessRegistrationNumber: "BRN-V5-SUB-6B",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.submit.expand@example.com",
      company: companyA.company,
      employeeCode: "NV-SUB-8",
    });
    const catalog = await seedCatalog();
    const { accessToken, job } = await createCompleteDraftViaApi(
      agent,
      recruiter,
      buildCompleteContent(catalog),
    );

    const response = await agent
      .post(`/api/jobs/${job.id}/submit`)
      .query({
        companyId: companyB.company._id.toString(),
      })
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        companyId: companyB.company._id.toString(),
      });

    expect(response.status).toBe(403);
    expect((await Job.findById(job.id).lean()).status).toBe(JOB_STATUS.DRAFT);
  });

  it("rejects stale submit when edit changes validated DRAFT content before transition (F04/BR-10/BR-19/TX-02)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.submit.stale@example.com",
      businessRegistrationNumber: "BRN-V5-SUB-STALE",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.submit.stale@example.com",
      company: manager.company,
      employeeCode: "NV-SUB-STALE",
    });
    const catalog = await seedCatalog();
    const content = buildCompleteContent(catalog);
    const { job } = await createCompleteDraftViaApi(agent, recruiter, content);

    const beforeRace = await Job.findById(job.id).lean();
    const completeTitle = beforeRace.title;

    const originalFindOneAndUpdate = Job.findOneAndUpdate.bind(Job);
    let releaseSubmitTransition;
    const holdSubmitTransition = new Promise((resolve) => {
      releaseSubmitTransition = resolve;
    });
    let resolveSubmitTransitionReached;
    const submitTransitionReached = new Promise((resolve) => {
      resolveSubmitTransitionReached = resolve;
    });

    // Hold only the DRAFT → PENDING_APPROVAL write so an edit can land after
    // submit validation has already succeeded against the complete snapshot.
    vi.spyOn(Job, "findOneAndUpdate").mockImplementation(
      (filter, update, options) => {
        if (update?.$set?.status === JOB_STATUS.PENDING_APPROVAL) {
          resolveSubmitTransitionReached();
          return holdSubmitTransition.then(() =>
            originalFindOneAndUpdate(filter, update, options),
          );
        }

        return originalFindOneAndUpdate(filter, update, options);
      },
    );

    const submitPromise = submitDraftJob({
      recruiterUser: recruiter.user,
      jobId: job.id,
    });

    await submitTransitionReached;

    const edited = await updateDraftJob({
      recruiterUser: recruiter.user,
      jobId: job.id,
      content: {
        title: null,
      },
    });

    expect(edited.status).toBe(JOB_STATUS.DRAFT);
    expect(edited.title).toBeNull();

    releaseSubmitTransition();

    await expect(submitPromise).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/content changed before submit/i),
    });

    const persisted = await Job.findById(job.id).lean();

    expect(persisted.status).toBe(JOB_STATUS.DRAFT);
    expect(persisted.title).toBeNull();
    expect(persisted.title).not.toBe(completeTitle);
    expect(persisted.publishedAt).toBeNull();
    expect(persisted.companyId.toString()).toBe(
      manager.company._id.toString(),
    );
    expect(persisted.createdByCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(persisted.jobDescription).toBe(content.jobDescription);
  });

  it("rejects stale submit when intervening edit shares the validated updatedAt (F04/BR-10/BR-19/TX-02)", async () => {
    const agent = createTestAgent();
    const manager = await createActiveCompanyManagerContext({
      email: "cm.job.submit.stale.same-ts@example.com",
      businessRegistrationNumber: "BRN-V5-SUB-STALE-TS",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.job.submit.stale.same-ts@example.com",
      company: manager.company,
      employeeCode: "NV-SUB-STALE-TS",
    });
    const catalog = await seedCatalog();
    const content = buildCompleteContent(catalog);
    const { job } = await createCompleteDraftViaApi(agent, recruiter, content);

    const beforeRace = await Job.findById(job.id).lean();
    const validatedUpdatedAt = beforeRace.updatedAt;

    const originalFindOneAndUpdate = Job.findOneAndUpdate.bind(Job);
    let releaseSubmitTransition;
    const holdSubmitTransition = new Promise((resolve) => {
      releaseSubmitTransition = resolve;
    });
    let resolveSubmitTransitionReached;
    const submitTransitionReached = new Promise((resolve) => {
      resolveSubmitTransitionReached = resolve;
    });

    vi.spyOn(Job, "findOneAndUpdate").mockImplementation(
      (filter, update, options) => {
        if (update?.$set?.status === JOB_STATUS.PENDING_APPROVAL) {
          resolveSubmitTransitionReached();
          return holdSubmitTransition.then(() =>
            originalFindOneAndUpdate(filter, update, options),
          );
        }

        return originalFindOneAndUpdate(filter, update, options);
      },
    );

    const submitPromise = submitDraftJob({
      recruiterUser: recruiter.user,
      jobId: job.id,
    });

    await submitTransitionReached;

    // Simulate finite timestamp resolution: content changes while updatedAt
    // remains the exact value observed by submit validation.
    await Job.collection.updateOne(
      {
        _id: new mongoose.Types.ObjectId(job.id),
      },
      {
        $set: {
          title: null,
          updatedAt: validatedUpdatedAt,
        },
      },
    );

    const midRace = await Job.findById(job.id).lean();

    expect(midRace.status).toBe(JOB_STATUS.DRAFT);
    expect(midRace.title).toBeNull();
    expect(midRace.updatedAt.getTime()).toBe(validatedUpdatedAt.getTime());

    releaseSubmitTransition();

    await expect(submitPromise).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/content changed before submit/i),
    });

    const persisted = await Job.findById(job.id).lean();

    expect(persisted.status).toBe(JOB_STATUS.DRAFT);
    expect(persisted.title).toBeNull();
    expect(persisted.publishedAt).toBeNull();
    expect(persisted.companyId.toString()).toBe(
      manager.company._id.toString(),
    );
    expect(persisted.createdByCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
      recruiter.membership._id.toString(),
    );
    expect(persisted.jobDescription).toBe(content.jobDescription);
    expect(persisted.updatedAt.getTime()).toBe(validatedUpdatedAt.getTime());
  });
});
