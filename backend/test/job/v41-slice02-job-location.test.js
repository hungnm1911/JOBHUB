import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import { migrate as migrateExperienceLevels } from "../../src/database/migrations/v4-experience-level-dataset.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job from "../../src/models/job.model.js";
import {
  createFieldCategory,
  createPositionCategory,
} from "../../src/services/category.service.js";
import { toPublicJobLocation } from "../../src/services/job.service.js";
import { LOCATION_VALIDATION_REASON } from "../../src/services/location.service.js";
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
import {
  jsonResponse,
  provinceOnlyLocation,
  stubLocationProvider,
  TEST_LOCATION,
} from "../helpers/location-provider.js";

const HA_NOI_BA_VI = Object.freeze({
  provinceCode: TEST_LOCATION.HA_NOI,
  districtCode: TEST_LOCATION.HA_NOI_BA_VI,
});

describe("V4.1 Slice 02 — Job Location V4.1 (F02)", () => {
  let providerFetch;

  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(() => {
    providerFetch = stubLocationProvider();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  let sequence = 0;

  const createRecruiterContext = async () => {
    sequence += 1;

    const manager = await createActiveCompanyManagerContext({
      email: `cm.v41.s02.${sequence}@example.com`,
      businessRegistrationNumber: `BRN-V41-S02-${sequence}`,
    });
    const recruiter = await createActiveRecruiterContext({
      email: `recruiter.v41.s02.${sequence}@example.com`,
      company: manager.company,
      employeeCode: `NV-V41-S02-${sequence}`,
    });
    const agent = createTestAgent();
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    return { agent, manager, recruiter, recruiterToken, managerToken };
  };

  const createDraft = (context, body) => {
    return context.agent
      .post("/api/jobs")
      .set("Authorization", `Bearer ${context.recruiterToken}`)
      .send(body);
  };

  const updateDraft = (context, jobId, body, token = context.recruiterToken) => {
    return context.agent
      .patch(`/api/jobs/${jobId}`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  };

  const readPersistedLocation = async (jobId) => {
    const persisted = await Job.findById(jobId).lean();

    return persisted.location;
  };

  const expectLocationRejection = (response, { field, reason }) => {
    expect(response.status).toBe(400);
    expect(response.body.error.details).toMatchObject({
      field,
      ...(reason ? { reason } : {}),
    });
  };

  const seedCatalog = async () => {
    await migrateExperienceLevels();

    const field = await createFieldCategory({ name: "Software Engineering" });
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
      requiredSkills: ["Node.js"],
      salary: { type: "NEGOTIABLE" },
      fieldCategoryIds: [catalog.field.id],
      positionCategoryIds: [catalog.position.id],
      location: provinceOnlyLocation(),
      employmentType: EMPLOYMENT_TYPE.FULL_TIME,
      workModes: [WORK_MODE.REMOTE],
      experienceLevelId: catalog.experienceLevelId,
      applicationDeadline: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      ...overrides,
    };
  };

  describe("create DRAFT with a V4.1 Location", () => {
    it("accepts a Province-only Location and persists districtCode = null (BR-05, BR-07)", async () => {
      const context = await createRecruiterContext();

      const response = await createDraft(context, {
        location: { provinceCode: TEST_LOCATION.HA_NOI },
      });

      expect(response.status).toBe(201);
      expect(response.body.job.location).toEqual({
        provinceCode: TEST_LOCATION.HA_NOI,
        districtCode: null,
      });
      expect(await readPersistedLocation(response.body.job.id)).toEqual({
        provinceCode: TEST_LOCATION.HA_NOI,
        districtCode: null,
      });
    });

    it("accepts a Province + District-level unit that belongs to the Province (BR-06, BR-10)", async () => {
      const context = await createRecruiterContext();

      const response = await createDraft(context, { location: HA_NOI_BA_VI });

      expect(response.status).toBe(201);
      expect(response.body.job.location).toEqual(HA_NOI_BA_VI);
      expect(await readPersistedLocation(response.body.job.id)).toEqual(
        HA_NOI_BA_VI,
      );
    });

    it("keeps Location optional on DRAFT (UNSET) without calling the provider", async () => {
      const context = await createRecruiterContext();

      const response = await createDraft(context, { title: "No Location" });

      expect(response.status).toBe(201);
      expect(response.body.job.location).toBeNull();
      expect(await readPersistedLocation(response.body.job.id)).toBeNull();
      expect(providerFetch).not.toHaveBeenCalled();
    });

    it("rejects District-level-unit-only Locations (BR-05, BR-08)", async () => {
      const context = await createRecruiterContext();

      for (const location of [
        { districtCode: TEST_LOCATION.HA_NOI_BA_VI },
        { provinceCode: null, districtCode: TEST_LOCATION.HA_NOI_BA_VI },
      ]) {
        const response = await createDraft(context, { location });

        expectLocationRejection(response, {
          field: "districtCode",
          reason:
            LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_REQUIRES_PROVINCE,
        });
      }

      expectLocationRejection(await createDraft(context, { location: {} }), {
        field: "provinceCode",
        reason: LOCATION_VALIDATION_REASON.PROVINCE_REQUIRED,
      });
      expect(await Job.countDocuments()).toBe(0);
    });

    it("rejects a District-level unit that belongs to another Province (BR-06)", async () => {
      const context = await createRecruiterContext();

      const response = await createDraft(context, {
        location: {
          provinceCode: TEST_LOCATION.HA_GIANG,
          districtCode: TEST_LOCATION.HA_NOI_BA_VI,
        },
      });

      expectLocationRejection(response, {
        field: "districtCode",
        reason: LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_IN_PROVINCE,
      });
      expect(await Job.countDocuments()).toBe(0);
    });

    it("rejects a Province or District-level unit that does not exist", async () => {
      const context = await createRecruiterContext();

      expectLocationRejection(
        await createDraft(context, {
          location: { provinceCode: TEST_LOCATION.UNKNOWN_PROVINCE },
        }),
        {
          field: "provinceCode",
          reason: LOCATION_VALIDATION_REASON.PROVINCE_NOT_FOUND,
        },
      );
      expectLocationRejection(
        await createDraft(context, {
          location: {
            provinceCode: TEST_LOCATION.HA_NOI,
            districtCode: TEST_LOCATION.UNKNOWN_DISTRICT,
          },
        }),
        {
          field: "districtCode",
          reason: LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_FOUND,
        },
      );
      expect(await Job.countDocuments()).toBe(0);
    });

    it("rejects FOREIGN, REMOTE, and legacy V4 literals as scalar or as Province codes (BR-21, BR-22, BR-23)", async () => {
      const context = await createRecruiterContext();

      for (const literal of ["FOREIGN", "REMOTE", "HA_NOI", "HO_CHI_MINH"]) {
        expectLocationRejection(
          await createDraft(context, { location: literal }),
          { field: "location" },
        );
        expectLocationRejection(
          await createDraft(context, { location: { provinceCode: literal } }),
          {
            field: "provinceCode",
            reason: LOCATION_VALIDATION_REASON.PROVINCE_NOT_FOUND,
          },
        );
      }

      expectLocationRejection(
        await createDraft(context, {
          location: { provinceCode: TEST_LOCATION.HA_NOI, districtCode: "ALL" },
        }),
        {
          field: "districtCode",
          reason: LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_FOUND,
        },
      );
      expect(await Job.countDocuments()).toBe(0);
    });

    it("rejects multiple Locations and fields outside Province/District-level unit (BR-04, BR-10)", async () => {
      const context = await createRecruiterContext();

      for (const location of [
        [provinceOnlyLocation(), HA_NOI_BA_VI],
        { ...HA_NOI_BA_VI, wardCode: "9619" },
        { ...HA_NOI_BA_VI, districtName: "Huyện Ba Vì" },
      ]) {
        const response = await createDraft(context, { location });

        expect(response.status).toBe(400);
      }

      expect(await Job.countDocuments()).toBe(0);
    });

    it("fails closed with no Job created when the provider is unavailable", async () => {
      const context = await createRecruiterContext();
      stubLocationProvider({
        "/p/": () => jsonResponse({ detail: "down" }, 503),
      });

      const response = await createDraft(context, {
        location: provinceOnlyLocation(),
      });

      expect(response.status).toBe(502);
      expect(await Job.countDocuments()).toBe(0);
    });

    it("keeps Recruiter authorization ahead of Location validation", async () => {
      const context = await createRecruiterContext();

      const response = await context.agent
        .post("/api/jobs")
        .set("Authorization", `Bearer ${context.managerToken}`)
        .send({ location: provinceOnlyLocation() });

      expect(response.status).toBe(403);
      expect(providerFetch).not.toHaveBeenCalled();
      expect(await Job.countDocuments()).toBe(0);
    });
  });

  describe("update DRAFT Location transitions", () => {
    const createUnsetDraft = async (context) => {
      const response = await createDraft(context, { title: "Draft" });

      expect(response.status).toBe(201);

      return response.body.job.id;
    };

    it("walks UNSET → PROVINCE_ONLY → PROVINCE_DISTRICT → PROVINCE_ONLY → UNSET", async () => {
      const context = await createRecruiterContext();
      const jobId = await createUnsetDraft(context);

      let response = await updateDraft(context, jobId, {
        location: { provinceCode: TEST_LOCATION.HA_NOI },
      });
      expect(response.status).toBe(200);
      expect(response.body.job.location).toEqual(provinceOnlyLocation());

      response = await updateDraft(context, jobId, { location: HA_NOI_BA_VI });
      expect(response.status).toBe(200);
      expect(response.body.job.location).toEqual(HA_NOI_BA_VI);
      expect(await readPersistedLocation(jobId)).toEqual(HA_NOI_BA_VI);

      response = await updateDraft(context, jobId, {
        location: { provinceCode: TEST_LOCATION.HA_NOI },
      });
      expect(response.status).toBe(200);
      expect(await readPersistedLocation(jobId)).toEqual(
        provinceOnlyLocation(),
      );

      response = await updateDraft(context, jobId, { location: null });
      expect(response.status).toBe(200);
      expect(response.body.job.location).toBeNull();
      expect(await readPersistedLocation(jobId)).toBeNull();
    });

    it("changing Province replaces the Location as one unit and never keeps the old District-level unit (Data §8.4)", async () => {
      const context = await createRecruiterContext();
      const created = await createDraft(context, { location: HA_NOI_BA_VI });
      const jobId = created.body.job.id;

      const response = await updateDraft(context, jobId, {
        location: { provinceCode: TEST_LOCATION.HO_CHI_MINH },
      });

      expect(response.status).toBe(200);
      expect(await readPersistedLocation(jobId)).toEqual({
        provinceCode: TEST_LOCATION.HO_CHI_MINH,
        districtCode: null,
      });

      const switched = await updateDraft(context, jobId, {
        location: {
          provinceCode: TEST_LOCATION.HA_GIANG,
          districtCode: TEST_LOCATION.HA_GIANG_CITY,
        },
      });

      expect(switched.status).toBe(200);
      expect(await readPersistedLocation(jobId)).toEqual({
        provinceCode: TEST_LOCATION.HA_GIANG,
        districtCode: TEST_LOCATION.HA_GIANG_CITY,
      });
    });

    it("rejects a new Province paired with the previous Province's District and leaves Location unchanged", async () => {
      const context = await createRecruiterContext();
      const created = await createDraft(context, { location: HA_NOI_BA_VI });
      const jobId = created.body.job.id;

      const response = await updateDraft(context, jobId, {
        title: "Should Not Persist",
        location: {
          provinceCode: TEST_LOCATION.HO_CHI_MINH,
          districtCode: TEST_LOCATION.HA_NOI_BA_VI,
        },
      });

      expectLocationRejection(response, {
        field: "districtCode",
        reason: LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_IN_PROVINCE,
      });

      const persisted = await Job.findById(jobId).lean();

      expect(persisted.location).toEqual(HA_NOI_BA_VI);
      expect(persisted.title).toBeNull();
    });

    it("leaves Location untouched when the patch does not include it", async () => {
      const context = await createRecruiterContext();
      const created = await createDraft(context, { location: HA_NOI_BA_VI });
      providerFetch.mockClear();

      const response = await updateDraft(context, created.body.job.id, {
        title: "Renamed",
        workModes: [WORK_MODE.HYBRID],
      });

      expect(response.status).toBe(200);
      expect(response.body.job.location).toEqual(HA_NOI_BA_VI);
      expect(response.body.job.workModes).toEqual([WORK_MODE.HYBRID]);
      expect(providerFetch).not.toHaveBeenCalled();
    });

    it("rejects invalid Locations on update without changing persisted state", async () => {
      const context = await createRecruiterContext();
      const created = await createDraft(context, { location: HA_NOI_BA_VI });
      const jobId = created.body.job.id;

      for (const location of [
        "FOREIGN",
        { districtCode: TEST_LOCATION.HA_NOI_BA_VI },
        { provinceCode: TEST_LOCATION.UNKNOWN_PROVINCE },
        { provinceCode: "REMOTE" },
      ]) {
        const response = await updateDraft(context, jobId, { location });

        expect(response.status).toBe(400);
      }

      expect(await readPersistedLocation(jobId)).toEqual(HA_NOI_BA_VI);
    });

    it("keeps Primary-only, tenant, and DRAFT-only edit rules ahead of Location validation", async () => {
      const context = await createRecruiterContext();
      const created = await createDraft(context, { location: HA_NOI_BA_VI });
      const jobId = created.body.job.id;
      const peer = await createActiveRecruiterContext({
        email: `peer.v41.s02.${sequence}@example.com`,
        company: context.manager.company,
        employeeCode: `NV-V41-S02-PEER-${sequence}`,
      });
      const peerToken = await loginAndGetAccessToken(context.agent, {
        email: peer.user.email,
        password: DEFAULT_PASSWORD,
      });
      const foreign = await createRecruiterContext();
      providerFetch.mockClear();

      const peerResponse = await updateDraft(
        context,
        jobId,
        { location: provinceOnlyLocation(TEST_LOCATION.HO_CHI_MINH) },
        peerToken,
      );
      const foreignResponse = await updateDraft(
        context,
        jobId,
        { location: provinceOnlyLocation(TEST_LOCATION.HO_CHI_MINH) },
        foreign.recruiterToken,
      );

      expect(peerResponse.status).toBe(403);
      expect(foreignResponse.status).toBe(403);

      await Job.updateOne(
        { _id: jobId },
        { $set: { status: JOB_STATUS.PENDING_APPROVAL } },
      );

      const frozenResponse = await updateDraft(context, jobId, {
        location: provinceOnlyLocation(TEST_LOCATION.HO_CHI_MINH),
      });

      expect(frozenResponse.status).toBe(409);
      expect(providerFetch).not.toHaveBeenCalled();
      expect(await readPersistedLocation(jobId)).toEqual(HA_NOI_BA_VI);
    });
  });

  describe("submit completeness and lifecycle preservation", () => {
    it("treats Province-only as a completed Location at submit without calling the provider (BR-07, BR-10)", async () => {
      const context = await createRecruiterContext();
      const catalog = await seedCatalog();
      const created = await createDraft(context, buildCompleteContent(catalog));
      providerFetch.mockClear();

      const response = await context.agent
        .post(`/api/jobs/${created.body.job.id}/submit`)
        .set("Authorization", `Bearer ${context.recruiterToken}`);

      expect(response.status).toBe(200);
      expect(response.body.job.status).toBe(JOB_STATUS.PENDING_APPROVAL);
      expect(response.body.job.location).toEqual(provinceOnlyLocation());
      expect(providerFetch).not.toHaveBeenCalled();
    });

    it("still requires a Location at submit, including for REMOTE WorkMode Jobs (V5 BR-12, BR-22)", async () => {
      const context = await createRecruiterContext();
      const catalog = await seedCatalog();
      const created = await createDraft(
        context,
        buildCompleteContent(catalog, {
          location: null,
          workModes: [WORK_MODE.REMOTE],
        }),
      );

      const response = await context.agent
        .post(`/api/jobs/${created.body.job.id}/submit`)
        .set("Authorization", `Bearer ${context.recruiterToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.details).toMatchObject({ field: "location" });
      expect((await Job.findById(created.body.job.id).lean()).status).toBe(
        JOB_STATUS.DRAFT,
      );
    });

    it("does not accept a persisted legacy scalar Location as a V4.1 Location at submit or on read", async () => {
      const context = await createRecruiterContext();
      const catalog = await seedCatalog();
      const created = await createDraft(context, buildCompleteContent(catalog));
      const jobId = created.body.job.id;

      for (const legacyLiteral of ["HA_NOI", "FOREIGN"]) {
        await Job.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(jobId) },
          { $set: { location: legacyLiteral } },
        );

        const readResponse = await context.agent
          .get(`/api/jobs/${jobId}`)
          .set("Authorization", `Bearer ${context.recruiterToken}`);

        expect(readResponse.status).toBe(200);
        expect(readResponse.body.job.location).toBeNull();

        const submitResponse = await context.agent
          .post(`/api/jobs/${jobId}/submit`)
          .set("Authorization", `Bearer ${context.recruiterToken}`);

        expect(submitResponse.status).toBe(400);
        expect(submitResponse.body.error.details).toMatchObject({
          field: "location",
        });
      }

      const persisted = await Job.collection.findOne({
        _id: new mongoose.Types.ObjectId(jobId),
      });

      expect(persisted.status).toBe(JOB_STATUS.DRAFT);
      expect(persisted.location).toBe("FOREIGN");
    });

    it("keeps the same canonical Location through submit, approve, reads, Discovery, reassign, and close", async () => {
      const context = await createRecruiterContext();
      const catalog = await seedCatalog();
      const successor = await createActiveRecruiterContext({
        email: `successor.v41.s02.${sequence}@example.com`,
        company: context.manager.company,
        employeeCode: `NV-V41-S02-SUCC-${sequence}`,
      });
      const content = buildCompleteContent(catalog, {
        location: HA_NOI_BA_VI,
        workModes: [WORK_MODE.REMOTE, WORK_MODE.HYBRID],
      });
      const created = await createDraft(context, content);
      const jobId = created.body.job.id;

      expect(created.status).toBe(201);
      providerFetch.mockClear();

      const submitted = await context.agent
        .post(`/api/jobs/${jobId}/submit`)
        .set("Authorization", `Bearer ${context.recruiterToken}`);
      const approved = await context.agent
        .post(`/api/jobs/${jobId}/approve`)
        .set("Authorization", `Bearer ${context.managerToken}`);
      const internalRead = await context.agent
        .get(`/api/jobs/${jobId}`)
        .set("Authorization", `Bearer ${context.managerToken}`);
      const internalList = await context.agent
        .get("/api/jobs")
        .set("Authorization", `Bearer ${context.managerToken}`);
      const discoveryList = await context.agent.get("/api/job-discovery/jobs");
      const discoveryDetail = await context.agent.get(
        `/api/job-discovery/jobs/${jobId}`,
      );
      const addedSupporting = await context.agent
        .post(`/api/jobs/${jobId}/team/supporting`)
        .set("Authorization", `Bearer ${context.managerToken}`)
        .send({
          supportingRecruiterCompanyMemberId: successor.membership._id.toString(),
        });
      const reassigned = await context.agent
        .post(`/api/jobs/${jobId}/reassign-primary`)
        .set("Authorization", `Bearer ${context.managerToken}`)
        .send({
          primaryRecruiterCompanyMemberId: successor.membership._id.toString(),
          keepOldPrimaryAsSupporting: true,
        });
      const closed = await context.agent
        .post(`/api/jobs/${jobId}/close`)
        .set("Authorization", `Bearer ${context.managerToken}`);

      expect(submitted.status).toBe(200);
      expect(approved.status).toBe(200);
      expect(approved.body.job.status).toBe(JOB_STATUS.PUBLISHED);
      expect(internalRead.status).toBe(200);
      expect(internalList.status).toBe(200);
      expect(discoveryList.status).toBe(200);
      expect(discoveryDetail.status).toBe(200);
      expect(addedSupporting.status).toBe(200);
      expect(reassigned.status).toBe(200);
      expect(closed.status).toBe(200);
      expect(closed.body.job.status).toBe(JOB_STATUS.CLOSED);

      for (const location of [
        submitted.body.job.location,
        approved.body.job.location,
        internalRead.body.job.location,
        internalList.body.jobs.find((job) => job.id === jobId).location,
        discoveryList.body.jobs.find((job) => job.id === jobId).location,
        discoveryDetail.body.job.location,
        reassigned.body.job.location,
        closed.body.job.location,
      ]) {
        expect(location).toEqual(HA_NOI_BA_VI);
      }

      const persisted = await Job.findById(jobId).lean();

      expect(persisted.location).toEqual(HA_NOI_BA_VI);
      expect(persisted.workModes).toEqual([WORK_MODE.REMOTE, WORK_MODE.HYBRID]);
      expect(persisted.companyId.toString()).toBe(
        context.manager.company._id.toString(),
      );
      expect(persisted.createdByCompanyMemberId.toString()).toBe(
        context.recruiter.membership._id.toString(),
      );
      expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
        successor.membership._id.toString(),
      );
      expect(persisted.title).toBe(content.title);
      expect(persisted.employmentType).toBe(content.employmentType);
      expect(providerFetch).not.toHaveBeenCalled();
    });
  });

  describe("persistence and serialization boundary", () => {
    it("enforces the embedded JobLocation shape at schema level (Data §10.1)", async () => {
      const context = await createRecruiterContext();
      const base = {
        companyId: context.manager.company._id,
        createdByCompanyMemberId: context.recruiter.membership._id,
        primaryRecruiterCompanyMemberId: context.recruiter.membership._id,
      };

      for (const location of [
        "HA_NOI",
        "FOREIGN",
        { districtCode: TEST_LOCATION.HA_NOI_BA_VI },
        { provinceCode: "" },
        { provinceCode: TEST_LOCATION.HA_NOI, districtCode: "" },
      ]) {
        await expect(Job.create({ ...base, location })).rejects.toThrow(
          mongoose.Error.ValidationError,
        );
      }

      const provinceOnly = await Job.create({
        ...base,
        location: { provinceCode: TEST_LOCATION.HA_NOI },
      });
      const raw = await Job.collection.findOne({ _id: provinceOnly._id });

      expect(raw.location).toEqual({
        provinceCode: TEST_LOCATION.HA_NOI,
        districtCode: null,
      });
      expect(raw.location).not.toHaveProperty("_id");
    });

    it("rejects FOREIGN as a persisted Province code at document and update validation (Data §10.1, BR-21)", async () => {
      const context = await createRecruiterContext();
      const base = {
        companyId: context.manager.company._id,
        createdByCompanyMemberId: context.recruiter.membership._id,
        primaryRecruiterCompanyMemberId: context.recruiter.membership._id,
      };

      for (const location of [
        { provinceCode: "FOREIGN", districtCode: null },
        { provinceCode: "FOREIGN", districtCode: TEST_LOCATION.HA_NOI_BA_VI },
      ]) {
        const error = await new Job({ ...base, location })
          .validate()
          .catch((caught) => caught);

        expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
        expect(error.errors).toHaveProperty(["location.provinceCode"]);
        await expect(Job.create({ ...base, location })).rejects.toThrow(
          mongoose.Error.ValidationError,
        );
      }

      expect(await Job.countDocuments()).toBe(0);

      // Catalog existence (including REMOTE) stays with the semantic boundary.
      for (const location of [
        { provinceCode: TEST_LOCATION.HA_NOI, districtCode: null },
        HA_NOI_BA_VI,
        { provinceCode: "REMOTE", districtCode: null },
      ]) {
        await expect(
          new Job({ ...base, location }).validate(),
        ).resolves.toBeUndefined();
      }

      const created = await Job.create({ ...base, location: HA_NOI_BA_VI });

      for (const update of [
        { $set: { location: { provinceCode: "FOREIGN", districtCode: null } } },
        { $set: { "location.provinceCode": "FOREIGN" } },
      ]) {
        await expect(
          Job.findOneAndUpdate({ _id: created._id }, update, {
            returnDocument: "after",
            runValidators: true,
          }),
        ).rejects.toThrow(mongoose.Error.ValidationError);
        expect(
          (await Job.collection.findOne({ _id: created._id })).location,
        ).toEqual(HA_NOI_BA_VI);
      }
    });

    it("declares the canonical V4.1 Job Location discovery indexes (Data §5.4)", async () => {
      await Job.init();

      const indexKeys = (await Job.collection.indexes()).map((index) =>
        JSON.stringify(index.key),
      );

      expect(indexKeys).toContain(
        JSON.stringify({
          status: 1,
          "location.provinceCode": 1,
          applicationDeadline: 1,
        }),
      );
      expect(indexKeys).toContain(
        JSON.stringify({
          status: 1,
          "location.provinceCode": 1,
          "location.districtCode": 1,
          applicationDeadline: 1,
        }),
      );
    });

    it("projects only canonical structured Locations for every Job read", () => {
      const hydrated = Job.hydrate({
        _id: new mongoose.Types.ObjectId(),
        location: HA_NOI_BA_VI,
      });
      const legacyHydrated = Job.hydrate({
        _id: new mongoose.Types.ObjectId(),
        location: "HA_NOI",
      });

      expect(toPublicJobLocation(hydrated.location)).toEqual(HA_NOI_BA_VI);
      expect(
        toPublicJobLocation({ provinceCode: TEST_LOCATION.HA_NOI }),
      ).toEqual(provinceOnlyLocation());
      expect(
        toPublicJobLocation({ ...HA_NOI_BA_VI, wardCode: "9619" }),
      ).toEqual(HA_NOI_BA_VI);
      expect(toPublicJobLocation(legacyHydrated.location)).toBeNull();
      expect(toPublicJobLocation("FOREIGN")).toBeNull();
      expect(toPublicJobLocation(null)).toBeNull();
      expect(toPublicJobLocation(undefined)).toBeNull();
    });
  });
});
