import mongoose from "mongoose";
import { PDFDocument } from "pdf-lib";
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

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Job from "../../src/models/job.model.js";
import { listCandidateSearchEligibleCandidateCvs } from "../../src/services/candidate-cv.service.js";
import * as fileService from "../../src/services/file.service.js";
import { LOCATION_VALIDATION_REASON } from "../../src/services/location.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
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

const HA_NOI_ALL = provinceOnlyLocation(TEST_LOCATION.HA_NOI);
const HO_CHI_MINH_ALL = provinceOnlyLocation(TEST_LOCATION.HO_CHI_MINH);
const HA_NOI_BA_DINH = Object.freeze({
  provinceCode: TEST_LOCATION.HA_NOI,
  districtCode: TEST_LOCATION.HA_NOI_BA_DINH,
});
const HA_NOI_BA_VI = Object.freeze({
  provinceCode: TEST_LOCATION.HA_NOI,
  districtCode: TEST_LOCATION.HA_NOI_BA_VI,
});
const HA_GIANG_CITY = Object.freeze({
  provinceCode: TEST_LOCATION.HA_GIANG,
  districtCode: TEST_LOCATION.HA_GIANG_CITY,
});

const CV_PATH = "/api/candidate/cvs";

const buildPdfBuffer = async (pageCount = 1) => {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    document.addPage();
  }

  return Buffer.from(await document.save());
};

describe("V4.1 Slice 03 — Candidate preferred Locations V4.1 (F03)", () => {
  let providerFetch;
  let sequence = 0;

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

  const createCandidateContext = async () => {
    sequence += 1;

    const { user } = await createVerifiedUser({
      email: `candidate.v41.s03.${sequence}@example.com`,
      fullName: `Slice03 Candidate ${sequence}`,
    });
    const category = await Category.create({
      name: `V41 S03 Field ${sequence}`,
      level: CATEGORY_LEVEL.FIELD,
      parentCategoryId: null,
    });
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    return { agent, accessToken, user, category };
  };

  const draftBody = (context, overrides = {}) => {
    return {
      name: "Location Draft",
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      categoryId: context.category._id.toString(),
      ...overrides,
    };
  };

  const createGeneratedDraft = (context, overrides) => {
    return context.agent
      .post(CV_PATH)
      .set("Authorization", `Bearer ${context.accessToken}`)
      .send(draftBody(context, overrides));
  };

  const updateMetadata = (context, cvId, body) => {
    return context.agent
      .patch(`${CV_PATH}/${cvId}`)
      .set("Authorization", `Bearer ${context.accessToken}`)
      .send(body);
  };

  const readRawPreferredLocations = async (cvId) => {
    const raw = await CandidateCV.collection.findOne({
      _id: new mongoose.Types.ObjectId(cvId),
    });

    return raw.preferredLocations;
  };

  const expectLocationRejection = (response, { field, reason }) => {
    expect(response.status).toBe(400);
    expect(response.body.error.details).toMatchObject({
      field,
      ...(reason ? { reason } : {}),
    });
  };

  const createSearchRecruiter = async () => {
    sequence += 1;

    const manager = await createActiveCompanyManagerContext({
      email: `cm.v41.s03.${sequence}@example.com`,
      businessRegistrationNumber: `BRN-V41-S03-${sequence}`,
    });
    const recruiter = await createActiveRecruiterContext({
      email: `recruiter.v41.s03.${sequence}@example.com`,
      company: manager.company,
      employeeCode: `NV-V41-S03-${sequence}`,
    });

    await Job.create({
      companyId: manager.company._id,
      createdByCompanyMemberId: recruiter.membership._id,
      primaryRecruiterCompanyMemberId: recruiter.membership._id,
      supportingRecruiterCompanyMemberIds: [],
      status: JOB_STATUS.DRAFT,
    });

    return recruiter;
  };

  describe("create Generated Draft with structured preferred Locations", () => {
    it("persists a Province-wide preference as provinceCode with districtCode = null (BR-05, BR-12)", async () => {
      const context = await createCandidateContext();

      const response = await createGeneratedDraft(context, {
        preferredLocations: [{ provinceCode: TEST_LOCATION.HA_NOI }],
      });

      expect(response.status).toBe(201);
      expect(response.body.cv.preferredLocations).toEqual([HA_NOI_ALL]);

      const raw = await readRawPreferredLocations(response.body.cv.id);

      expect(raw).toEqual([HA_NOI_ALL]);
      expect(raw[0]).not.toHaveProperty("_id");
    });

    it("persists a Province + one District-level unit preference (BR-06)", async () => {
      const context = await createCandidateContext();

      const response = await createGeneratedDraft(context, {
        preferredLocations: [HA_NOI_BA_VI],
      });

      expect(response.status).toBe(201);
      expect(response.body.cv.preferredLocations).toEqual([HA_NOI_BA_VI]);
      expect(await readRawPreferredLocations(response.body.cv.id)).toEqual([
        HA_NOI_BA_VI,
      ]);
    });

    it("persists several District-level units of the same Province as one subset (BR-12, BR-14)", async () => {
      const context = await createCandidateContext();

      const response = await createGeneratedDraft(context, {
        preferredLocations: [HA_NOI_BA_DINH, HA_NOI_BA_VI],
      });

      expect(response.status).toBe(201);
      expect(await readRawPreferredLocations(response.body.cv.id)).toEqual([
        HA_NOI_BA_DINH,
        HA_NOI_BA_VI,
      ]);
    });

    it("persists preferences across several Provinces mixing Province-wide and District subsets (BR-11, BR-13)", async () => {
      const context = await createCandidateContext();
      const preferredLocations = [
        HA_NOI_BA_DINH,
        HA_NOI_BA_VI,
        HO_CHI_MINH_ALL,
        HA_GIANG_CITY,
      ];

      const response = await createGeneratedDraft(context, { preferredLocations });

      expect(response.status).toBe(201);
      expect(response.body.cv.preferredLocations).toEqual(preferredLocations);
      expect(await readRawPreferredLocations(response.body.cv.id)).toEqual(
        preferredLocations,
      );
    });

    it("keeps empty/omitted preferred Locations valid without calling the provider", async () => {
      const context = await createCandidateContext();

      const omitted = await createGeneratedDraft(context);
      const empty = await createGeneratedDraft(context, {
        name: "Empty Locations",
        preferredLocations: [],
      });

      expect(omitted.status).toBe(201);
      expect(empty.status).toBe(201);
      expect(omitted.body.cv.preferredLocations).toEqual([]);
      expect(empty.body.cv.preferredLocations).toEqual([]);
      expect(providerFetch).not.toHaveBeenCalled();
    });
  });

  describe("rejections (no CandidateCV is persisted)", () => {
    it("rejects Province-wide and District-level unit selections of the same Province (BR-12)", async () => {
      const context = await createCandidateContext();

      const response = await createGeneratedDraft(context, {
        preferredLocations: [HA_NOI_ALL, HA_NOI_BA_VI],
      });

      expectLocationRejection(response, { field: "preferredLocations" });
      expect(response.body.error.message).toMatch(/Province-wide/);
      expect(providerFetch).not.toHaveBeenCalled();
      expect(await CandidateCV.countDocuments()).toBe(0);
    });

    it("rejects duplicate Province-wide and duplicate District-level unit selections", async () => {
      const context = await createCandidateContext();

      for (const preferredLocations of [
        [HA_NOI_ALL, { provinceCode: TEST_LOCATION.HA_NOI }],
        [HA_NOI_BA_VI, HO_CHI_MINH_ALL, HA_NOI_BA_VI],
      ]) {
        const response = await createGeneratedDraft(context, {
          preferredLocations,
        });

        expectLocationRejection(response, { field: "preferredLocations" });
        expect(response.body.error.message).toMatch(/duplicate/);
      }

      expect(providerFetch).not.toHaveBeenCalled();
      expect(await CandidateCV.countDocuments()).toBe(0);
    });

    it("rejects a District-level unit without a Province (BR-05, BR-08)", async () => {
      const context = await createCandidateContext();

      for (const selection of [
        { districtCode: TEST_LOCATION.HA_NOI_BA_VI },
        { provinceCode: null, districtCode: TEST_LOCATION.HA_NOI_BA_VI },
      ]) {
        expectLocationRejection(
          await createGeneratedDraft(context, {
            preferredLocations: [selection],
          }),
          {
            field: "preferredLocations.0.districtCode",
            reason:
              LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_REQUIRES_PROVINCE,
          },
        );
      }

      expect(providerFetch).not.toHaveBeenCalled();
      expect(await CandidateCV.countDocuments()).toBe(0);
    });

    it("rejects a District-level unit that belongs to another Province (BR-06)", async () => {
      const context = await createCandidateContext();

      expectLocationRejection(
        await createGeneratedDraft(context, {
          preferredLocations: [
            HO_CHI_MINH_ALL,
            {
              provinceCode: TEST_LOCATION.HA_GIANG,
              districtCode: TEST_LOCATION.HA_NOI_BA_VI,
            },
          ],
        }),
        {
          field: "preferredLocations.1.districtCode",
          reason: LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_IN_PROVINCE,
        },
      );
      expect(await CandidateCV.countDocuments()).toBe(0);
    });

    it("rejects unknown Province and unknown District-level unit codes", async () => {
      const context = await createCandidateContext();

      expectLocationRejection(
        await createGeneratedDraft(context, {
          preferredLocations: [
            { provinceCode: TEST_LOCATION.UNKNOWN_PROVINCE },
          ],
        }),
        {
          field: "preferredLocations.0.provinceCode",
          reason: LOCATION_VALIDATION_REASON.PROVINCE_NOT_FOUND,
        },
      );
      expectLocationRejection(
        await createGeneratedDraft(context, {
          preferredLocations: [
            {
              provinceCode: TEST_LOCATION.HA_NOI,
              districtCode: TEST_LOCATION.UNKNOWN_DISTRICT,
            },
          ],
        }),
        {
          field: "preferredLocations.0.districtCode",
          reason: LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_FOUND,
        },
      );
      expect(await CandidateCV.countDocuments()).toBe(0);
    });

    it("rejects FOREIGN, REMOTE, ALL, and legacy V4 literals as items or as codes (BR-21, BR-22, BR-23)", async () => {
      const context = await createCandidateContext();

      for (const literal of ["FOREIGN", "REMOTE", "ALL", "HA_NOI", "HO_CHI_MINH"]) {
        expectLocationRejection(
          await createGeneratedDraft(context, { preferredLocations: [literal] }),
          { field: "preferredLocations.0" },
        );
      }

      for (const provinceCode of ["FOREIGN", "REMOTE", "ALL", "HA_NOI"]) {
        expectLocationRejection(
          await createGeneratedDraft(context, {
            preferredLocations: [{ provinceCode }],
          }),
          {
            field: "preferredLocations.0.provinceCode",
            reason: LOCATION_VALIDATION_REASON.PROVINCE_NOT_FOUND,
          },
        );
      }

      expectLocationRejection(
        await createGeneratedDraft(context, {
          preferredLocations: [
            { provinceCode: TEST_LOCATION.HA_NOI, districtCode: "ALL" },
          ],
        }),
        {
          field: "preferredLocations.0.districtCode",
          reason: LOCATION_VALIDATION_REASON.DISTRICT_LEVEL_UNIT_NOT_FOUND,
        },
      );
      expect(await CandidateCV.countDocuments()).toBe(0);
    });

    it("rejects names, Ward codes, and other non-canonical selection fields", async () => {
      const context = await createCandidateContext();

      for (const selection of [
        { ...HA_NOI_BA_VI, wardCode: "9619" },
        { ...HA_NOI_BA_VI, districtName: "Huyện Ba Vì" },
      ]) {
        const response = await createGeneratedDraft(context, {
          preferredLocations: [selection],
        });

        expect(response.status).toBe(400);
      }

      expect(providerFetch).not.toHaveBeenCalled();
      expect(await CandidateCV.countDocuments()).toBe(0);
    });

    it("fails closed with 502 and no CandidateCV when the Location provider is unavailable", async () => {
      vi.unstubAllGlobals();
      stubLocationProvider({
        "/p/": () => jsonResponse({ detail: "down" }, 503),
      });
      const context = await createCandidateContext();

      const response = await createGeneratedDraft(context, {
        preferredLocations: [HA_NOI_ALL],
      });

      expect(response.status).toBe(502);
      expect(await CandidateCV.countDocuments()).toBe(0);
    });
  });

  describe("create Uploaded CV with structured preferred Locations", () => {
    it("creates UPLOADED/ACTIVE with canonical selections and rejects invalid selections before upload", async () => {
      const uploadSpy = vi
        .spyOn(fileService, "uploadFileBuffer")
        .mockResolvedValue({
          publicId: "jobhub/candidate-cvs/uploaded/v41-s03",
          bytes: 1234,
          resourceType: "raw",
        });
      const context = await createCandidateContext();
      const pdfBuffer = await buildPdfBuffer(1);

      const rejected = await context.agent
        .post(`${CV_PATH}/uploaded`)
        .set("Authorization", `Bearer ${context.accessToken}`)
        .field("name", "Rejected Uploaded")
        .field("visibility", CANDIDATE_CV_VISIBILITY.PRIVATE)
        .field("categoryId", context.category._id.toString())
        .field(
          "preferredLocations",
          JSON.stringify([HA_NOI_ALL, HA_NOI_BA_DINH]),
        )
        .attach("file", pdfBuffer, "resume.pdf");

      expectLocationRejection(rejected, { field: "preferredLocations" });
      expect(uploadSpy).not.toHaveBeenCalled();
      expect(await CandidateCV.countDocuments()).toBe(0);

      const created = await context.agent
        .post(`${CV_PATH}/uploaded`)
        .set("Authorization", `Bearer ${context.accessToken}`)
        .field("name", "Uploaded With Locations")
        .field("visibility", CANDIDATE_CV_VISIBILITY.PUBLIC)
        .field("categoryId", context.category._id.toString())
        .field(
          "preferredLocations",
          JSON.stringify([HA_NOI_BA_VI, HO_CHI_MINH_ALL]),
        )
        .attach("file", pdfBuffer, "resume.pdf");

      expect(created.status).toBe(201);
      expect(created.body.cv).toMatchObject({
        sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
        status: CANDIDATE_CV_STATUS.ACTIVE,
        preferredLocations: [HA_NOI_BA_VI, HO_CHI_MINH_ALL],
      });
      expect(await readRawPreferredLocations(created.body.cv.id)).toEqual([
        HA_NOI_BA_VI,
        HO_CHI_MINH_ALL,
      ]);
      expect(uploadSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("update preferred Locations (Data §8.5–§8.8)", () => {
    it("moves between Province-wide and District subsets without leaving contradictory state", async () => {
      const context = await createCandidateContext();
      const created = await createGeneratedDraft(context, {
        preferredLocations: [HO_CHI_MINH_ALL],
      });
      const cvId = created.body.cv.id;
      const transitions = [
        // §8.5 add a Province-wide preference for another Province.
        [HO_CHI_MINH_ALL, HA_NOI_ALL],
        // §8.6 Province-wide → District subset.
        [HO_CHI_MINH_ALL, HA_NOI_BA_DINH, HA_NOI_BA_VI],
        // §8.8 change the District subset.
        [HO_CHI_MINH_ALL, HA_NOI_BA_VI],
        // §8.7 District subset → Province-wide.
        [HO_CHI_MINH_ALL, HA_NOI_ALL],
        // Remove a Province preference.
        [HA_NOI_ALL],
        [],
      ];

      for (const preferredLocations of transitions) {
        const response = await updateMetadata(context, cvId, {
          preferredLocations,
        });

        expect(response.status).toBe(200);
        expect(response.body.cv.preferredLocations).toEqual(preferredLocations);
        expect(await readRawPreferredLocations(cvId)).toEqual(
          preferredLocations,
        );
      }
    });

    it("rejects invalid updates and leaves the persisted selection set unchanged", async () => {
      const context = await createCandidateContext();
      const created = await createGeneratedDraft(context, {
        preferredLocations: [HA_NOI_BA_VI],
      });
      const cvId = created.body.cv.id;

      for (const preferredLocations of [
        [HA_NOI_BA_VI, HA_NOI_ALL],
        [HA_NOI_BA_VI, HA_NOI_BA_VI],
        [{ districtCode: TEST_LOCATION.HA_NOI_BA_VI }],
        [{ provinceCode: TEST_LOCATION.HO_CHI_MINH, districtCode: TEST_LOCATION.HA_NOI_BA_VI }],
        [{ provinceCode: TEST_LOCATION.UNKNOWN_PROVINCE }],
        ["FOREIGN"],
        ["HA_NOI"],
      ]) {
        const response = await updateMetadata(context, cvId, {
          name: "Should Not Persist",
          preferredLocations,
        });

        expect(response.status).toBe(400);
      }

      const persisted = await CandidateCV.findById(cvId).lean();

      expect(persisted.preferredLocations).toEqual([HA_NOI_BA_VI]);
      expect(persisted.name).toBe("Location Draft");
    });

    it("keeps ownership, archive, and lifecycle rules ahead of Location validation", async () => {
      const owner = await createCandidateContext();
      const other = await createCandidateContext();
      const created = await createGeneratedDraft(owner, {
        preferredLocations: [HA_NOI_ALL],
      });
      const cvId = created.body.cv.id;
      providerFetch.mockClear();

      const foreign = await updateMetadata(other, cvId, {
        preferredLocations: [HO_CHI_MINH_ALL],
      });

      expect(foreign.status).toBe(404);
      expect(providerFetch).not.toHaveBeenCalled();

      const updated = await updateMetadata(owner, cvId, {
        preferredLocations: [HA_NOI_BA_VI],
      });
      const persisted = await CandidateCV.findById(cvId).lean();

      expect(updated.status).toBe(200);
      expect(persisted.candidateUserId.toString()).toBe(owner.user._id.toString());
      expect(persisted.sourceType).toBe(CANDIDATE_CV_SOURCE_TYPE.GENERATED);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(persisted.isDefault).toBe(false);
      expect(persisted.archivedAt).toBeNull();

      await CandidateCV.updateOne(
        { _id: cvId },
        { $set: { archivedAt: new Date() } },
      );
      providerFetch.mockClear();

      const archived = await updateMetadata(owner, cvId, {
        preferredLocations: [HO_CHI_MINH_ALL],
      });

      expect(archived.status).toBe(409);
      expect(providerFetch).not.toHaveBeenCalled();
      expect((await CandidateCV.findById(cvId).lean()).preferredLocations).toEqual(
        [HA_NOI_BA_VI],
      );
    });

    it("does not touch other CandidateCV fields or Location when either side is patched alone", async () => {
      const context = await createCandidateContext();
      const created = await createGeneratedDraft(context, {
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        preferredLocations: [HA_NOI_ALL],
        skillTags: ["Node.js"],
        employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
        workModes: [WORK_MODE.REMOTE],
      });
      const cvId = created.body.cv.id;
      const before = await CandidateCV.findById(cvId).lean();

      const locationOnly = await updateMetadata(context, cvId, {
        preferredLocations: [HA_NOI_BA_DINH],
      });
      const afterLocation = await CandidateCV.findById(cvId).lean();

      expect(locationOnly.status).toBe(200);
      expect(afterLocation).toMatchObject({
        name: before.name,
        visibility: before.visibility,
        categoryId: before.categoryId,
        experienceLevelId: before.experienceLevelId,
        skillTags: before.skillTags,
        employmentTypes: before.employmentTypes,
        workModes: before.workModes,
        generatedContent: before.generatedContent,
        preferredLocations: [HA_NOI_BA_DINH],
      });

      providerFetch.mockClear();

      const otherOnly = await updateMetadata(context, cvId, {
        name: "Renamed",
        workModes: [WORK_MODE.HYBRID],
      });

      expect(otherOnly.status).toBe(200);
      expect(otherOnly.body.cv.preferredLocations).toEqual([HA_NOI_BA_DINH]);
      expect(providerFetch).not.toHaveBeenCalled();
    });
  });

  describe("displayLocation stays independent free text", () => {
    it("does not derive, validate, or change displayLocation from preferred Locations (Data §15.2)", async () => {
      const context = await createCandidateContext();
      const created = await createGeneratedDraft(context, {
        preferredLocations: [HA_NOI_ALL],
      });
      const cvId = created.body.cv.id;
      providerFetch.mockClear();

      const builderSave = await context.agent
        .put(`${CV_PATH}/${cvId}/generated-content`)
        .set("Authorization", `Bearer ${context.accessToken}`)
        .send({
          personalInfo: {
            fullName: "Jane Candidate",
            displayLocation: "Remote / FOREIGN — anywhere",
          },
        });

      expect(builderSave.status).toBe(200);
      expect(builderSave.body.cv.generatedContent.personalInfo.displayLocation).toBe(
        "Remote / FOREIGN — anywhere",
      );
      expect(builderSave.body.cv.preferredLocations).toEqual([HA_NOI_ALL]);
      expect(providerFetch).not.toHaveBeenCalled();

      const locationUpdate = await updateMetadata(context, cvId, {
        preferredLocations: [HO_CHI_MINH_ALL],
      });

      expect(locationUpdate.status).toBe(200);
      expect(
        locationUpdate.body.cv.generatedContent.personalInfo.displayLocation,
      ).toBe("Remote / FOREIGN — anywhere");
    });
  });

  describe("reads", () => {
    it("serializes structured selections on My CVs list/detail and Candidate Search results", async () => {
      const context = await createCandidateContext();
      const preferredLocations = [HA_NOI_BA_VI, HO_CHI_MINH_ALL];
      const created = await createGeneratedDraft(context, {
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        preferredLocations,
      });
      const cvId = created.body.cv.id;

      const list = await context.agent
        .get(CV_PATH)
        .set("Authorization", `Bearer ${context.accessToken}`);
      const detail = await context.agent
        .get(`${CV_PATH}/${cvId}`)
        .set("Authorization", `Bearer ${context.accessToken}`);

      expect(list.body.cvs[0].preferredLocations).toEqual(preferredLocations);
      expect(detail.body.cv.preferredLocations).toEqual(preferredLocations);

      await CandidateCV.updateOne(
        { _id: cvId },
        { $set: { status: CANDIDATE_CV_STATUS.ACTIVE } },
      );
      const recruiter = await createSearchRecruiter();
      const results = await listCandidateSearchEligibleCandidateCvs({
        actorUser: recruiter.user,
      });

      expect(results).toHaveLength(1);
      expect(results[0].preferredLocations).toEqual(preferredLocations);
    });

    it("does not project un-migrated legacy literals as V4.1 Locations", async () => {
      const context = await createCandidateContext();
      const legacy = await createGeneratedDraft(context, {
        name: "Legacy",
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      });

      await CandidateCV.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(legacy.body.cv.id) },
        { $set: { preferredLocations: ["HA_NOI", "FOREIGN"] } },
      );

      const detail = await context.agent
        .get(`${CV_PATH}/${legacy.body.cv.id}`)
        .set("Authorization", `Bearer ${context.accessToken}`);

      expect(detail.status).toBe(200);
      expect(detail.body.cv.preferredLocations).toEqual([]);
    });
  });

  describe("persistence model (Data §6, §10.1)", () => {
    const baseFields = (candidateUserId, categoryId) => ({
      candidateUserId,
      name: "Model CV",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.DRAFT,
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      categoryId,
      generatedContent: {},
    });

    it("enforces structured shape, distinct selections, and Province-wide/subset exclusivity", async () => {
      const { user, category } = await createCandidateContext();
      const base = baseFields(user._id, category._id);

      for (const preferredLocations of [
        ["HA_NOI"],
        ["FOREIGN"],
        [{ districtCode: TEST_LOCATION.HA_NOI_BA_VI }],
        [{ provinceCode: "" }],
        [{ provinceCode: TEST_LOCATION.HA_NOI, districtCode: "" }],
        [HA_NOI_BA_VI, HA_NOI_BA_VI],
        [HA_NOI_ALL, HA_NOI_ALL],
        [HA_NOI_ALL, HA_NOI_BA_VI],
      ]) {
        await expect(
          CandidateCV.create({ ...base, preferredLocations }),
        ).rejects.toThrow(mongoose.Error.ValidationError);
      }

      const created = await CandidateCV.create({
        ...base,
        preferredLocations: [
          { provinceCode: TEST_LOCATION.HA_NOI },
          HO_CHI_MINH_ALL,
        ],
      });
      const raw = await CandidateCV.collection.findOne({ _id: created._id });

      expect(raw.preferredLocations).toEqual([HA_NOI_ALL, HO_CHI_MINH_ALL]);

      await expect(
        CandidateCV.findOneAndUpdate(
          { _id: created._id },
          { $set: { preferredLocations: [HO_CHI_MINH_ALL, HA_NOI_ALL, HA_NOI_BA_VI] } },
          { runValidators: true },
        ),
      ).rejects.toThrow(mongoose.Error.ValidationError);
      expect(
        (await CandidateCV.collection.findOne({ _id: created._id }))
          .preferredLocations,
      ).toEqual([HA_NOI_ALL, HO_CHI_MINH_ALL]);
    });

    it("declares the canonical Candidate Search Location index with the V14 partial scope", async () => {
      await CandidateCV.syncIndexes();
      const indexes = await CandidateCV.collection.indexes();
      const index = indexes.find(
        (candidate) =>
          JSON.stringify(candidate.key) ===
          JSON.stringify({
            "preferredLocations.provinceCode": 1,
            "preferredLocations.districtCode": 1,
            updatedAt: -1,
            _id: -1,
          }),
      );

      expect(index).toBeTruthy();
      expect(index.partialFilterExpression).toEqual({
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        archivedAt: null,
      });
    });
  });
});
