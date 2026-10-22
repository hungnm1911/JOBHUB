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

// Wrap the real frozen AI Kit instance and logger so calls can be observed.
const normalizeJobSpy = vi.hoisted(() => vi.fn());
const warnSpy = vi.hoisted(() => vi.fn());

vi.mock("../../src/utils/logger.js", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    default: Object.freeze({ ...actual.default, warn: warnSpy }),
  };
});

vi.mock("../../src/services/ai-kit.service.js", async (importOriginal) => {
  const actual = await importOriginal();

  normalizeJobSpy.mockImplementation(actual.aiKit.normalizeJob);

  return {
    aiKit: Object.freeze({
      ...actual.aiKit,
      normalizeJob: normalizeJobSpy,
    }),
  };
});

import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import Category from "../../src/models/category.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job from "../../src/models/job.model.js";
import { aiKit } from "../../src/services/ai-kit.service.js";
import { normalizeInternalJob } from "../../src/services/job-ai-normalization.service.js";
import { overlayPersistedValue } from "../../src/utils/persisted-source.js";
import {
  closePublishedJob,
  getInternalJob,
  toPublicJob,
} from "../../src/services/job.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

let sequence = 0;

const createStaff = async () => {
  sequence += 1;
  const manager = await createActiveCompanyManagerContext({
    email: `cm.ai-b1.${sequence}@example.com`,
    businessRegistrationNumber: `BRN-AI-B1-${sequence}`,
  });
  const primary = await createActiveRecruiterContext({
    email: `recruiter.ai-b1.primary.${sequence}@example.com`,
    company: manager.company,
    employeeCode: `NV-AI-B1-P${sequence}`,
  });
  const peer = await createActiveRecruiterContext({
    email: `recruiter.ai-b1.peer.${sequence}@example.com`,
    company: manager.company,
    employeeCode: `NV-AI-B1-R${sequence}`,
  });

  return { manager, primary, peer };
};

const createTaxonomy = async () => {
  const field = await Category.create({
    name: "Software Engineering",
    level: CATEGORY_LEVEL.FIELD,
  });
  const otherField = await Category.create({
    name: "Data",
    level: CATEGORY_LEVEL.FIELD,
  });
  const position = await Category.create({
    name: "Backend Developer",
    level: CATEGORY_LEVEL.POSITION,
    parentCategoryId: field._id,
  });
  const experienceLevel = await ExperienceLevel.create({
    code: EXPERIENCE_LEVEL.THREE_TO_FIVE_YEARS,
  });

  return { field, otherField, position, experienceLevel };
};

const createJob = ({ staff, ...content }) => {
  return Job.create({
    companyId: staff.manager.company._id,
    createdByCompanyMemberId: staff.primary.membership._id,
    primaryRecruiterCompanyMemberId: staff.primary.membership._id,
    ...content,
  });
};

const createCompleteJob = async (staff, taxonomy) => {
  return createJob({
    staff,
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-10-01T00:00:00.000Z"),
    applicationDeadline: new Date("2026-12-01T00:00:00.000Z"),
    title: "Senior Backend Engineer",
    jobDescription: "Build Node.js services.\n\nOwn MongoDB data models.",
    requiredSkills: ["Node.js", "MongoDB", "Node.js"],
    salary: {
      type: "RANGE",
      minAmount: 30000000,
      maxAmount: 45000000,
      period: "MONTH",
      customPeriodLabel: null,
    },
    fieldCategoryIds: [taxonomy.otherField._id, taxonomy.field._id],
    positionCategoryIds: [taxonomy.position._id],
    experienceLevelId: taxonomy.experienceLevel._id,
    employmentType: "FULL_TIME",
    workModes: ["HYBRID", "ONSITE"],
    location: { provinceCode: "01", districtCode: "001" },
  });
};

const categoryValue = (category) => ({
  id: category._id.toString(),
  name: category.name,
  level: category.level,
  parentCategoryId:
    category.parentCategoryId == null
      ? null
      : category.parentCategoryId.toString(),
});

const rawJob = async (jobId) => {
  return Job.collection.findOne({ _id: jobId });
};

const expectAppError = async (promise, statusCode, details) => {
  const error = await promise.then(
    () => null,
    (caught) => caught,
  );

  expect(error).toMatchObject({ name: "AppError", statusCode });

  if (details) {
    expect(error.details).toMatchObject(details);
  }

  return error;
};

describe("AI-V01 Backend Slice B1 — internal Job → F01 normalization", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    normalizeJobSpy.mockClear();
    warnSpy.mockClear();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("returns READY for a complete Job with every structured, free-text, and taxonomy value preserved", async () => {
    const staff = await createStaff();
    const taxonomy = await createTaxonomy();
    const job = await createCompleteJob(staff, taxonomy);
    const before = await rawJob(job._id);
    const normalizeSpy = normalizeJobSpy;

    const result = await normalizeInternalJob({
      actorUser: staff.primary.user,
      jobId: job._id.toString(),
    });

    const expectedSource = {
      jobId: job._id.toString(),
      title: "Senior Backend Engineer",
      jobDescription: "Build Node.js services.\n\nOwn MongoDB data models.",
      requiredSkills: ["Node.js", "MongoDB", "Node.js"],
      salary: {
        type: "RANGE",
        minAmount: 30000000,
        maxAmount: 45000000,
        period: "MONTH",
        customPeriodLabel: null,
      },
      fieldCategoryIds: [
        taxonomy.otherField._id.toString(),
        taxonomy.field._id.toString(),
      ],
      positionCategoryIds: [taxonomy.position._id.toString()],
      experienceLevelId: taxonomy.experienceLevel._id.toString(),
      employmentType: "FULL_TIME",
      workModes: ["HYBRID", "ONSITE"],
      location: { provinceCode: "01", districtCode: "001" },
      taxonomy: {
        categories: [
          categoryValue(taxonomy.otherField),
          categoryValue(taxonomy.field),
          categoryValue(taxonomy.position),
        ],
        experienceLevel: {
          id: taxonomy.experienceLevel._id.toString(),
          code: EXPERIENCE_LEVEL.THREE_TO_FIVE_YEARS,
        },
      },
    };

    expect(normalizeSpy).toHaveBeenCalledOnce();
    expect(normalizeSpy).toHaveBeenCalledWith(expectedSource);
    expect(result).toEqual(aiKit.normalizeJob(expectedSource));
    expect(result.status).toBe("READY");
    expect(Object.isFrozen(result)).toBe(true);

    const { profile } = result;

    expect(profile.source).toEqual({ type: "JOB", jobId: job._id.toString() });
    expect(profile.freeText.jobDescription).toEqual({
      value: expectedSource.jobDescription,
      sourcePath: "/jobDescription",
    });
    expect(profile.metadata.requiredSkills.map(({ value }) => value)).toEqual(
      expectedSource.requiredSkills,
    );
    expect(profile.metadata.salary).toEqual({
      value: expectedSource.salary,
      sourcePath: "/salary",
    });
    expect(profile.metadata.location.value).toEqual(expectedSource.location);
    expect(profile.metadata.fieldCategories.map(({ value }) => value)).toEqual([
      categoryValue(taxonomy.otherField),
      categoryValue(taxonomy.field),
    ]);
    expect(profile.metadata.positionCategories[0].value).toEqual(
      categoryValue(taxonomy.position),
    );
    expect(profile.metadata.experienceLevel.value).toEqual(
      expectedSource.taxonomy.experienceLevel,
    );
    expect(await rawJob(job._id)).toEqual(before);
  });

  it("returns READY for a sparse DRAFT without submit or completeness validation", async () => {
    const staff = await createStaff();
    const job = await createJob({ staff, status: JOB_STATUS.DRAFT });

    const result = await normalizeInternalJob({
      actorUser: staff.primary.user,
      jobId: job._id.toString(),
    });

    expect(result.status).toBe("READY");
    expect(result.profile.freeText).toEqual({ title: null, jobDescription: null });
    expect(result.profile.metadata).toEqual({
      requiredSkills: [],
      salary: null,
      employmentType: null,
      workModes: [],
      location: null,
      fieldCategoryIds: [],
      positionCategoryIds: [],
      experienceLevelId: null,
      fieldCategories: [],
      positionCategories: [],
      experienceLevel: null,
    });
  });

  it("accepts a DRAFT POSITION whose parent FIELD is not yet selected (submit-only BR-11)", async () => {
    const staff = await createStaff();
    const taxonomy = await createTaxonomy();
    const job = await createJob({
      staff,
      status: JOB_STATUS.DRAFT,
      positionCategoryIds: [taxonomy.position._id],
    });

    const result = await normalizeInternalJob({
      actorUser: staff.primary.user,
      jobId: job._id.toString(),
    });

    expect(result.status).toBe("READY");
    expect(result.profile.metadata.positionCategories[0].value).toEqual(
      categoryValue(taxonomy.position),
    );
  });

  describe("taxonomy references", () => {
    it.each([
      [
        "an unknown FIELD Category",
        ({ position }) => ({
          fieldCategoryIds: [new mongoose.Types.ObjectId()],
          positionCategoryIds: [position._id],
        }),
        "fieldCategoryIds",
      ],
      [
        "a POSITION Category in fieldCategoryIds",
        ({ position }) => ({ fieldCategoryIds: [position._id] }),
        "fieldCategoryIds",
      ],
      [
        "a FIELD Category in positionCategoryIds",
        ({ field }) => ({ positionCategoryIds: [field._id] }),
        "positionCategoryIds",
      ],
      [
        "an unknown ExperienceLevel",
        () => ({ experienceLevelId: new mongoose.Types.ObjectId() }),
        "experienceLevelId",
      ],
    ])("refuses %s as an invalid reference without calling AI Kit", async (
      _label,
      buildReferences,
      field,
    ) => {
      const staff = await createStaff();
      const taxonomy = await createTaxonomy();
      const job = await createJob({
        staff,
        status: JOB_STATUS.DRAFT,
        ...buildReferences(taxonomy),
      });
      const normalizeSpy = normalizeJobSpy;

      await expectAppError(
        normalizeInternalJob({
          actorUser: staff.primary.user,
          jobId: job._id.toString(),
        }),
        400,
        { field },
      );
      expect(normalizeSpy).not.toHaveBeenCalled();
    });
  });

  describe("H3 source dependency boundary", () => {
    it("returns FAILED if the canonical loader cannot resolve authorization because MongoDB is unavailable", async () => {
      const staff = await createStaff();
      const job = await createJob({ staff, status: JOB_STATUS.DRAFT });
      vi.spyOn(CompanyMember, "findOne").mockRejectedValueOnce(
        new mongoose.mongo.MongoServerSelectionError(
          "private authorization diagnostic",
          {},
        ),
      );
      const jobReadSpy = vi.spyOn(Job, "findById");
      const taxonomySpy = vi.spyOn(Category, "find");

      const result = await normalizeInternalJob({
        actorUser: staff.primary.user,
        jobId: job._id.toString(),
      });

      expect(result).toEqual({ status: "FAILED", profile: null });
      expect(jobReadSpy).not.toHaveBeenCalled();
      expect(taxonomySpy).not.toHaveBeenCalled();
      expect(normalizeJobSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        "AI-V01 Job source lookup failed; normalization FAILED",
        { jobId: job._id.toString(), errorType: "MongoServerSelectionError" },
      );
    });

    it.each([false, true])("returns FAILED for a source DB outage (raw read: %s)", async (rawRead) => {
      const staff = await createStaff();
      const taxonomy = await createTaxonomy();
      const source = await createCompleteJob(staff, taxonomy);
      const before = await rawJob(source._id);
      const lookupError = new mongoose.mongo.MongoNetworkError(
        "private source diagnostic",
      );
      // Driver diagnostics can contain source data; neither result nor logs may echo it.
      lookupError.source = before;
      const taxonomySpy = vi.spyOn(Category, "find");
      const originalExec = mongoose.Query.prototype.exec;
      const querySpy = vi.spyOn(mongoose.Query.prototype, "exec").mockImplementation(function (...args) {
        if (
          this.model === Job &&
          this.op === "findOne" &&
          Boolean(this.mongooseOptions().lean) === rawRead
        ) {
          return Promise.reject(lookupError);
        }
        return originalExec.apply(this, args);
      });

      const result = await normalizeInternalJob({
        actorUser: staff.primary.user,
        jobId: source._id.toString(),
      });

      expect(result).toEqual({ status: "FAILED", profile: null });
      expect(Object.keys(result).sort()).toEqual(["profile", "status"]);
      expect(normalizeJobSpy).not.toHaveBeenCalled();
      expect(taxonomySpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        "AI-V01 Job source lookup failed; normalization FAILED",
        { jobId: source._id.toString(), errorType: "MongoNetworkError" },
      );
      expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("private source diagnostic");
      querySpy.mockRestore();
      expect(await rawJob(source._id)).toEqual(before);
    });

    it.each([
      ["source", () => new TypeError("source implementation defect")],
      ["raw", () => new TypeError("raw implementation defect")],
      ["projection", () => new TypeError("projection implementation defect")],
      ["taxonomy", () => new TypeError("taxonomy implementation defect")],
      ["taxonomy", () => new Error("MongoDB unavailable")],
      [
        "taxonomy",
        () => new mongoose.mongo.MongoServerError({
          code: 18,
          message: "DB authentication refused",
        }),
      ],
    ])("propagates an unexpected %s error unchanged (%#)", async (stage, createError) => {
      const staff = await createStaff();
      const taxonomy = await createTaxonomy();
      const source = await createCompleteJob(staff, taxonomy);
      const error = createError();
      const originalExec = mongoose.Query.prototype.exec;
      vi.spyOn(mongoose.Query.prototype, "exec").mockImplementation(async function (...args) {
        if (this.model === Job && this.op === "findOne") {
          const rawRead = Boolean(this.mongooseOptions().lean);
          if (
            (stage === "source" && !rawRead) ||
            (stage === "raw" && rawRead)
          ) {
            throw error;
          }
          const result = await originalExec.apply(this, args);
          if (stage === "projection" && !rawRead && result) {
            result.toObject = () => {
              throw error;
            };
          }
          return result;
        }
        return originalExec.apply(this, args);
      });
      if (stage === "taxonomy") {
        vi.spyOn(Category, "find").mockRejectedValueOnce(error);
      }

      await expect(normalizeInternalJob({
        actorUser: staff.primary.user,
        jobId: source._id.toString(),
      })).rejects.toBe(error);
      expect(normalizeJobSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("taxonomy lookup dependency failure", () => {
    it.each([
      ["Category", () => vi.spyOn(Category, "find")],
      ["ExperienceLevel", () => vi.spyOn(ExperienceLevel, "findById")],
    ])("returns FAILED without a profile when the %s lookup fails", async (
      _label,
      spyLookup,
    ) => {
      const staff = await createStaff();
      const taxonomy = await createTaxonomy();
      const job = await createCompleteJob(staff, taxonomy);
      const lookupError = new mongoose.mongo.MongoNetworkError(
        "private driver diagnostic",
      );
      spyLookup().mockRejectedValueOnce(lookupError);
      const normalizeSpy = normalizeJobSpy;

      const result = await normalizeInternalJob({
        actorUser: staff.primary.user,
        jobId: job._id.toString(),
      });

      expect(result).toEqual({ status: "FAILED", profile: null });
      expect(normalizeSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        "AI-V01 Job taxonomy lookup failed; normalization FAILED",
        { jobId: job._id.toString(), errorType: "MongoNetworkError" },
      );
    });
  });

  describe("projection", () => {
    it.each([null, "001"])(
      "refuses persisted FOREIGN Location with districtCode %s before taxonomy or AI Kit",
      async (districtCode) => {
        const staff = await createStaff();
        const job = await createJob({ staff, status: JOB_STATUS.DRAFT });
        await Job.collection.updateOne(
          { _id: job._id },
          { $set: { location: { provinceCode: "FOREIGN", districtCode } } },
        );
        const before = await rawJob(job._id);
        const taxonomySpy = vi.spyOn(Category, "find");

        const error = await expectAppError(
          normalizeInternalJob({
            actorUser: staff.primary.user,
            jobId: job._id.toString(),
          }),
          500,
        );

        expect(error.message).toBe("Job cannot be projected to the AI-V01 Job source");
        expect(error.details.issues).toContain("/location/provinceCode must not be FOREIGN");
        expect(error.cause).toBeUndefined();
        expect(taxonomySpy).not.toHaveBeenCalled();
        expect(normalizeJobSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();
        expect(await rawJob(job._id)).toEqual(before);
      },
    );

    it.each([
      null,
      { provinceCode: "1", districtCode: null },
      { provinceCode: "1", districtCode: "2" },
    ])("keeps valid persisted Location %j READY without changing source or provenance", async (location) => {
      const staff = await createStaff();
      const job = await createJob({ staff, status: JOB_STATUS.DRAFT, location });
      const before = await rawJob(job._id);

      const result = await normalizeInternalJob({
        actorUser: staff.primary.user,
        jobId: job._id.toString(),
      });

      expect(result.status).toBe("READY");
      expect(result.profile.metadata.location).toEqual(
        location === null ? null : { value: location, sourcePath: "/location" },
      );
      expect(normalizeJobSpy.mock.calls[0][0].location).toEqual(location);
      expect(await rawJob(job._id)).toEqual(before);
    });

    it("refuses a persisted location the public serializer would null instead of dropping it", async () => {
      const staff = await createStaff();
      const job = await createJob({ staff, status: JOB_STATUS.DRAFT });
      await Job.collection.updateOne(
        { _id: job._id },
        { $set: { location: { districtCode: "001" } } },
      );

      expect(
        (
          await getInternalJob({
            actorUser: staff.primary.user,
            jobId: job._id.toString(),
          })
        ).location,
      ).toBeNull();

      const error = await expectAppError(
        normalizeInternalJob({
          actorUser: staff.primary.user,
          jobId: job._id.toString(),
        }),
        500,
      );

      expect(error.message).toBe(
        "Job cannot be projected to the AI-V01 Job source",
      );
      expect(error.cause).toMatchObject({ code: "INVALID_JOB_INPUT" });
      expect(error.details.issues).toEqual(
        expect.arrayContaining([expect.stringContaining("/location")]),
      );
    });

    // Each persisted value is one Mongoose would hydrate into a valid-looking
    // value (cast failure -> default, or a successful but source-changing cast).
    it.each([
      [
        "an uncastable experienceLevelId (hydrated to null)",
        { experienceLevelId: "bad" },
        "/experienceLevelId",
        "BACKEND",
      ],
      [
        "an uncastable fieldCategoryIds entry",
        { fieldCategoryIds: ["bad"] },
        "/fieldCategoryIds/0",
        "BACKEND",
      ],
      [
        "a string positionCategoryIds entry (cast to ObjectId)",
        { positionCategoryIds: ["507f1f77bcf86cd799439011"] },
        "/positionCategoryIds/0",
        "BACKEND",
      ],
      [
        "a numeric title (cast to a string)",
        { title: 5 },
        "/title",
        "AI_KIT",
      ],
      [
        "a scalar requiredSkills (cast to a one-item array)",
        { requiredSkills: "Node.js" },
        "/requiredSkills",
        "AI_KIT",
      ],
      [
        "a scalar workModes (cast to a one-item array)",
        { workModes: "HYBRID" },
        "/workModes",
        "AI_KIT",
      ],
    ])("refuses %s instead of returning READY", async (
      _label,
      corruption,
      issuePath,
      refusedBy,
    ) => {
      const staff = await createStaff();
      const job = await createJob({ staff, status: JOB_STATUS.DRAFT });
      await Job.collection.updateOne({ _id: job._id }, { $set: corruption });
      const before = await rawJob(job._id);

      const error = await expectAppError(
        normalizeInternalJob({
          actorUser: staff.primary.user,
          jobId: job._id.toString(),
        }),
        500,
      );

      expect(error.message).toBe(
        "Job cannot be projected to the AI-V01 Job source",
      );
      expect(error.details.issues).toEqual(
        expect.arrayContaining([expect.stringContaining(issuePath)]),
      );

      if (refusedBy === "AI_KIT") {
        expect(error.cause).toMatchObject({ code: "INVALID_JOB_INPUT" });
      } else {
        expect(error.cause).toBeUndefined();
        expect(normalizeJobSpy).not.toHaveBeenCalled();
      }

      expect(warnSpy).not.toHaveBeenCalled();
      expect(await rawJob(job._id)).toEqual(before);
    });

    it("treats truly absent persisted fields as their schema defaults and stays READY", async () => {
      const staff = await createStaff();
      const job = await createJob({ staff, status: JOB_STATUS.DRAFT });
      await Job.collection.updateOne(
        { _id: job._id },
        {
          $unset: {
            title: "",
            requiredSkills: "",
            fieldCategoryIds: "",
            experienceLevelId: "",
            workModes: "",
            location: "",
          },
        },
      );
      const before = await rawJob(job._id);

      const result = await normalizeInternalJob({
        actorUser: staff.primary.user,
        jobId: job._id.toString(),
      });

      expect(result.status).toBe("READY");
      expect(result.profile.freeText.title).toBeNull();
      expect(result.profile.metadata).toMatchObject({
        requiredSkills: [],
        fieldCategoryIds: [],
        experienceLevelId: null,
        workModes: [],
        location: null,
      });
      expect(await rawJob(job._id)).toEqual(before);
    });

    it("preserves BSON Undefined object keys and array indices instead of applying defaults", () => {
      const BSON = mongoose.mongo.BSON;
      const encoded = Buffer.from(
        BSON.serialize({ title: null, requiredSkills: [null] }),
      );
      const cstring = (value) =>
        Buffer.concat([Buffer.from(value), Buffer.from([0])]);
      const titleTypeIndex = encoded.indexOf(cstring("title")) - 1;
      const skillsKeyIndex = encoded.indexOf(cstring("requiredSkills"));
      const skillIndexTypeIndex =
        encoded.indexOf(cstring("0"), skillsKeyIndex) - 1;

      expect(encoded[titleTypeIndex]).toBe(BSON.BSONType.null);
      expect(encoded[skillIndexTypeIndex]).toBe(BSON.BSONType.null);
      encoded[titleTypeIndex] = BSON.BSONType.undefined;
      encoded[skillIndexTypeIndex] = BSON.BSONType.undefined;

      // The BSON decoder preserves deprecated Undefined as an own property;
      // absent fields remain distinguishable from present-undefined values.
      const persisted = BSON.deserialize(encoded);
      const source = overlayPersistedValue(persisted, {
        title: "schema default",
        requiredSkills: ["schema default"],
        absentTitle: "schema default",
      });

      expect(Object.hasOwn(persisted, "title")).toBe(true);
      expect(Object.hasOwn(persisted.requiredSkills, 0)).toBe(true);
      expect(Object.hasOwn(source, "title")).toBe(true);
      expect(source.title).toBeUndefined();
      expect(Object.hasOwn(source.requiredSkills, 0)).toBe(true);
      expect(source.requiredSkills[0]).toBeUndefined();
      expect(source.absentTitle).toBe("schema default");

      let error;

      try {
        aiKit.normalizeJob({
          jobId: new mongoose.Types.ObjectId().toString(),
          title: source.title,
          jobDescription: null,
          requiredSkills: source.requiredSkills,
          salary: null,
          fieldCategoryIds: [],
          positionCategoryIds: [],
          experienceLevelId: null,
          employmentType: null,
          workModes: [],
          location: null,
          taxonomy: { categories: [], experienceLevel: null },
        });
      } catch (caught) {
        error = caught;
      }

      expect(error).toMatchObject({ code: "INVALID_JOB_INPUT" });
    });

    it("records that a new JS undefined write reaches MongoDB as BSON Null", async () => {
      const staff = await createStaff();
      const job = await createJob({ staff, status: JOB_STATUS.DRAFT });

      await Job.collection.updateOne(
        { _id: job._id },
        { $set: { title: undefined } },
      );

      const persisted = await rawJob(job._id);

      expect(Object.hasOwn(persisted, "title")).toBe(true);
      expect(persisted.title).toBeNull();
    });

    it("refuses a present undefined from the authorized raw Job read", async () => {
      const staff = await createStaff();
      const job = await createJob({
        staff,
        status: JOB_STATUS.DRAFT,
        requiredSkills: ["Node.js"],
      });
      const before = await rawJob(job._id);
      const originalExec = mongoose.Query.prototype.exec;
      let rawReadObserved = false;

      vi.spyOn(mongoose.Query.prototype, "exec").mockImplementation(
        async function (...args) {
          const result = await originalExec.apply(this, args);

          if (this.model === Job && this.op === "findOne" && this.mongooseOptions().lean) {
            rawReadObserved = true;
            // Simulate legacy BSON Undefined after decoding. The MongoDB
            // driver serializes new JS undefined writes as BSON Null.
            result.title = undefined;
            result.requiredSkills[0] = undefined;
          }

          return result;
        },
      );

      const error = await expectAppError(
        normalizeInternalJob({
          actorUser: staff.primary.user,
          jobId: job._id.toString(),
        }),
        500,
      );

      expect(rawReadObserved).toBe(true);
      expect(error.cause).toMatchObject({ code: "INVALID_JOB_INPUT" });
      expect(error.details.issues).toEqual(
        expect.arrayContaining([
          expect.stringContaining("/title"),
          expect.stringContaining("/requiredSkills/0"),
        ]),
      );
      expect(await rawJob(job._id)).toEqual(before);
    });
  });

  describe("authorization and visibility", () => {
    it.each(["peer", "primary", "manager"])(
      "rechecks raw-source visibility for %s when the domain closes the Job between reads",
      async (actor) => {
        const staff = await createStaff();
        const taxonomy = await createTaxonomy();
        const job = await createCompleteJob(staff, taxonomy);
        const input = {
          actorUser: staff[actor].user,
          jobId: job._id.toString(),
        };
        expect((await getInternalJob(input)).status).toBe(JOB_STATUS.PUBLISHED);
        const findTaxonomySpy = vi.spyOn(Category, "find");
        const originalExec = mongoose.Query.prototype.exec;
        let authorizedReadCompleted = false;
        let closedBetweenReads = false;

        vi.spyOn(mongoose.Query.prototype, "exec").mockImplementation(
          async function (...args) {
            const isJobRead = this.model === Job && this.op === "findOne";

            if (isJobRead && this.mongooseOptions().lean && !closedBetweenReads) {
              expect(authorizedReadCompleted).toBe(true);
              closedBetweenReads = true;
              await closePublishedJob({
                actorUser: staff.primary.user,
                jobId: job._id.toString(),
              });
            }

            const result = await originalExec.apply(this, args);

            if (isJobRead && !this.mongooseOptions().lean && result) {
              authorizedReadCompleted = true;
            }

            return result;
          },
        );

        if (actor === "peer") {
          const error = await expectAppError(normalizeInternalJob(input), 403, {
            field: "jobId",
          });
          const domainError = await expectAppError(getInternalJob(input), 403);
          expect(error.message).toBe(domainError.message);
          expect(error.details).toEqual(domainError.details);
          expect(findTaxonomySpy).not.toHaveBeenCalled();
          expect(normalizeJobSpy).not.toHaveBeenCalled();
        } else {
          expect((await normalizeInternalJob(input)).status).toBe("READY");
          expect((await getInternalJob(input)).status).toBe(JOB_STATUS.CLOSED);
          expect(normalizeJobSpy).toHaveBeenCalledOnce();
        }

        expect(closedBetweenReads).toBe(true);
        expect((await rawJob(job._id)).status).toBe(JOB_STATUS.CLOSED);
      },
    );

    it.each(["peer", "primary", "manager"])(
      "rejects cross-tenant %s for PUBLISHED and CLOSED Jobs, including a forged client Company",
      async (actor) => {
        const staff = await createStaff();
        const otherStaff = await createStaff();
        const taxonomy = await createTaxonomy();
        const job = await createCompleteJob(staff, taxonomy);
        const findTaxonomySpy = vi.spyOn(Category, "find");

        for (const status of [JOB_STATUS.PUBLISHED, JOB_STATUS.CLOSED]) {
          if (status === JOB_STATUS.CLOSED) {
            await closePublishedJob({
              actorUser: staff.primary.user,
              jobId: job._id.toString(),
            });
          }

          for (const clientCompanyId of [
            undefined,
            staff.manager.company._id.toString(),
          ]) {
            const input = {
              actorUser: otherStaff[actor].user,
              jobId: job._id.toString(),
              clientCompanyId,
            };
            const error = await expectAppError(normalizeInternalJob(input), 403);
            const domainError = await expectAppError(getInternalJob(input), 403);
            expect(error.message).toBe(domainError.message);
            expect(error.details).toEqual(domainError.details);
          }
        }

        expect(findTaxonomySpy).not.toHaveBeenCalled();
        expect(normalizeJobSpy).not.toHaveBeenCalled();
      },
    );

    it("reuses internal Job visibility: peer DRAFT, Manager DRAFT, cross-tenant, Candidate, unknown, and malformed ids are refused before lookup", async () => {
      const staff = await createStaff();
      const otherStaff = await createStaff();
      const draft = await createJob({ staff, status: JOB_STATUS.DRAFT });
      const candidate = await createVerifiedUser({
        email: "candidate.ai-b1@example.com",
        role: USER_ROLE.CANDIDATE,
      });
      const findSpy = vi.spyOn(Category, "find");
      const normalizeSpy = normalizeJobSpy;
      const jobId = draft._id.toString();

      for (const [actorUser, id, statusCode] of [
        [staff.peer.user, jobId, 403],
        [staff.manager.user, jobId, 403],
        [otherStaff.primary.user, jobId, 403],
        [candidate.user, jobId, 403],
        [staff.primary.user, new mongoose.Types.ObjectId().toString(), 404],
        [staff.primary.user, "not-an-object-id", 400],
      ]) {
        await expectAppError(
          normalizeInternalJob({ actorUser, jobId: id }),
          statusCode,
        );
      }

      await expectAppError(
        normalizeInternalJob({
          actorUser: staff.primary.user,
          jobId,
          clientCompanyId: otherStaff.manager.company._id.toString(),
        }),
        403,
      );
      expect(findSpy).not.toHaveBeenCalled();
      expect(normalizeSpy).not.toHaveBeenCalled();
    });

    it("lets a peer Recruiter normalize a same-Company PUBLISHED Job", async () => {
      const staff = await createStaff();
      const taxonomy = await createTaxonomy();
      const job = await createCompleteJob(staff, taxonomy);

      const result = await normalizeInternalJob({
        actorUser: staff.peer.user,
        jobId: job._id.toString(),
      });

      expect(result.status).toBe("READY");
    });

    it("keeps getInternalJob returning the public Job projection", async () => {
      const staff = await createStaff();
      const taxonomy = await createTaxonomy();
      const job = await createCompleteJob(staff, taxonomy);

      expect(
        await getInternalJob({
          actorUser: staff.primary.user,
          jobId: job._id.toString(),
        }),
      ).toEqual(toPublicJob(await Job.findById(job._id)));
    });
  });
});
