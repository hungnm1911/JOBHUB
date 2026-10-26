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
const normalizeGeneratedCvSpy = vi.hoisted(() => vi.fn());
const warnSpy = vi.hoisted(() => vi.fn());

vi.mock("../../src/utils/logger.js", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    default: Object.freeze({ ...actual.default, warn: warnSpy }),
  };
});

vi.mock("../../src/services/ai-kit.service.js", async (importOriginal) => {
  const actual = await importOriginal();

  normalizeGeneratedCvSpy.mockImplementation(actual.aiKit.normalizeGeneratedCv);

  return {
    aiKit: Object.freeze({
      ...actual.aiKit,
      normalizeGeneratedCv: normalizeGeneratedCvSpy,
    }),
  };
});

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import USER_ROLE from "../../src/constants/user-role.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import { aiKit } from "../../src/services/ai-kit.service.js";
import { normalizeOwnGeneratedCandidateCv } from "../../src/services/candidate-cv-ai-normalization.service.js";
import {
  overlayPersistedValue,
  toPersistedIsoDate,
} from "../../src/utils/persisted-source.js";
import {
  getOwnActiveCandidateCv,
  toPublicCandidateCvDetail,
} from "../../src/services/candidate-cv.service.js";
import { createVerifiedUser } from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const CONTACT = Object.freeze({
  fullName: "Jane Candidate",
  email: "jane.private@example.com",
  phone: "+84901234567",
  displayLocation: "Ha Noi, Vietnam",
  avatarUrl: "https://cdn.example.com/avatar.png",
});

let sequence = 0;

const createCandidate = async () => {
  sequence += 1;

  return (
    await createVerifiedUser({ email: `candidate.ai-b2.${sequence}@example.com` })
  ).user;
};

const createTaxonomy = async () => {
  const field = await Category.create({
    name: "Software Engineering",
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

  return { field, position, experienceLevel };
};

const createGeneratedDraft = ({ candidate, categoryId, ...content }) => {
  return CandidateCV.create({
    candidateUserId: candidate._id,
    name: "Private Draft CV",
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status: CANDIDATE_CV_STATUS.DRAFT,
    visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId,
    generatedContent: {},
    ...content,
  });
};

const FULL_CONTENT = Object.freeze({
  personalInfo: {
    ...CONTACT,
    links: [
      "https://github.com/jane",
      "https://linkedin.com/in/jane",
      "https://github.com/jane",
    ],
  },
  professionalSummary: "Backend engineer.\n\nFocused on Node.js services.",
  educations: [
    {
      institutionName: "Hanoi University of Science and Technology",
      degree: "BEng",
      fieldOfStudy: "Computer Science",
      startDate: new Date("2014-09-01T00:00:00.000Z"),
      endDate: new Date("2018-06-30T17:00:00.000Z"),
    },
    { institutionName: "Online Bootcamp" },
  ],
  skills: ["Node.js", "MongoDB", "Node.js"],
  workExperiences: [
    {
      companyName: "Acme",
      position: "Senior Backend Engineer",
      startDate: new Date("2021-03-15T08:30:00.000Z"),
      endDate: null,
      description: "Own the payments API.",
      achievements: ["Cut p99 latency by 40%", "Led migration"],
    },
    {
      companyName: "Acme",
      position: "Backend Engineer",
      startDate: new Date("2018-07-01T00:00:00.000Z"),
      endDate: new Date("2021-03-14T00:00:00.000Z"),
    },
  ],
  projects: [
    {
      name: "Ledger",
      role: "Lead",
      technologies: ["Node.js", "Kafka", "Node.js"],
      description: "Event-sourced ledger.",
      projectUrl: "https://example.com/ledger",
    },
  ],
  certifications: [
    {
      name: "AWS Developer Associate",
      issuer: "AWS",
      issueDate: new Date("2022-05-10T00:00:00.000Z"),
      expirationDate: new Date("2025-05-10T00:00:00.000Z"),
      credentialId: "AWS-123",
      credentialUrl: "https://aws.example.com/verify/AWS-123",
    },
  ],
  languages: [
    { name: "English", proficiency: "FLUENT" },
    { name: "Japanese", proficiency: null },
  ],
  hiddenSections: ["projects", "certifications"],
});

const createCompleteDraft = (candidate, taxonomy) => {
  return createGeneratedDraft({
    candidate,
    categoryId: taxonomy.position._id,
    experienceLevelId: taxonomy.experienceLevel._id,
    skillTags: ["Node.js", "Backend", "Node.js"],
    employmentTypes: ["FULL_TIME", "CONTRACT"],
    workModes: ["REMOTE", "HYBRID"],
    preferredLocations: [
      { provinceCode: "79", districtCode: null },
      { provinceCode: "1", districtCode: "271" },
    ],
    generatedContent: FULL_CONTENT,
  });
};

const iso = (date) => date.toISOString();

const expectedCompleteSource = (cv, taxonomy) => ({
  candidateCvId: cv._id.toString(),
  categoryId: taxonomy.position._id.toString(),
  experienceLevelId: taxonomy.experienceLevel._id.toString(),
  skillTags: ["Node.js", "Backend", "Node.js"],
  employmentTypes: ["FULL_TIME", "CONTRACT"],
  workModes: ["REMOTE", "HYBRID"],
  preferredLocations: [
    { provinceCode: "79", districtCode: null },
    { provinceCode: "1", districtCode: "271" },
  ],
  generatedContent: {
    personalInfo: { links: FULL_CONTENT.personalInfo.links },
    professionalSummary: FULL_CONTENT.professionalSummary,
    educations: [
      {
        institutionName: "Hanoi University of Science and Technology",
        degree: "BEng",
        fieldOfStudy: "Computer Science",
        startDate: "2014-09-01T00:00:00.000Z",
        endDate: "2018-06-30T17:00:00.000Z",
      },
      {
        institutionName: "Online Bootcamp",
        degree: null,
        fieldOfStudy: null,
        startDate: null,
        endDate: null,
      },
    ],
    skills: ["Node.js", "MongoDB", "Node.js"],
    workExperiences: [
      {
        companyName: "Acme",
        position: "Senior Backend Engineer",
        startDate: "2021-03-15T08:30:00.000Z",
        endDate: null,
        description: "Own the payments API.",
        achievements: ["Cut p99 latency by 40%", "Led migration"],
      },
      {
        companyName: "Acme",
        position: "Backend Engineer",
        startDate: "2018-07-01T00:00:00.000Z",
        endDate: "2021-03-14T00:00:00.000Z",
        description: null,
        achievements: [],
      },
    ],
    projects: FULL_CONTENT.projects,
    certifications: [
      {
        ...FULL_CONTENT.certifications[0],
        issueDate: iso(FULL_CONTENT.certifications[0].issueDate),
        expirationDate: iso(FULL_CONTENT.certifications[0].expirationDate),
      },
    ],
    languages: FULL_CONTENT.languages,
    hiddenSections: ["projects", "certifications"],
  },
  taxonomy: {
    category: {
      id: taxonomy.position._id.toString(),
      name: "Backend Developer",
      level: CATEGORY_LEVEL.POSITION,
      parentCategoryId: taxonomy.field._id.toString(),
    },
    experienceLevel: {
      id: taxonomy.experienceLevel._id.toString(),
      code: EXPERIENCE_LEVEL.THREE_TO_FIVE_YEARS,
    },
  },
});

const rawCv = (cvId) => CandidateCV.collection.findOne({ _id: cvId });

const normalizeOwn = (candidate, cv, onAuthorizedSource) => {
  return normalizeOwnGeneratedCandidateCv({
    candidateUserId: candidate._id,
    actorUser: candidate,
    candidateCvId: cv._id.toString(),
    onAuthorizedSource,
  });
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

describe("AI-V01 Backend Slice B2 — Generated CV → F02 normalization", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    normalizeGeneratedCvSpy.mockClear();
    warnSpy.mockClear();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("returns READY for a PRIVATE DRAFT with content, preferences, dates, order, duplicates, hidden sections, and links preserved", async () => {
    const candidate = await createCandidate();
    const taxonomy = await createTaxonomy();
    const cv = await createCompleteDraft(candidate, taxonomy);
    const before = await rawCv(cv._id);
    const expectedSource = expectedCompleteSource(cv, taxonomy);
    const onAuthorizedSource = vi.fn();

    const result = await normalizeOwn(candidate, cv, onAuthorizedSource);

    expect(normalizeGeneratedCvSpy).toHaveBeenCalledOnce();
    expect(normalizeGeneratedCvSpy).toHaveBeenCalledWith(expectedSource);
    expect(result).toEqual(aiKit.normalizeGeneratedCv(expectedSource));
    expect(result.status).toBe("READY");
    expect(onAuthorizedSource).toHaveBeenCalledExactlyOnceWith(before);
    expect(Object.isFrozen(result)).toBe(true);

    const { profile } = result;
    const cvId = cv._id.toString();

    expect(profile.source).toEqual({ type: "GENERATED_CV", candidateCvId: cvId });
    expect(profile.freeText.professionalSummary).toEqual({
      value: FULL_CONTENT.professionalSummary,
      sourcePath: "/generatedContent/professionalSummary",
    });
    expect(profile.metadata.category).toEqual({
      value: expectedSource.taxonomy.category,
      sourcePath: "/taxonomy/category",
    });
    expect(profile.metadata.experienceLevel.value).toEqual(
      expectedSource.taxonomy.experienceLevel,
    );
    expect(profile.metadata.skillTags.map(({ value }) => value)).toEqual([
      "Node.js",
      "Backend",
      "Node.js",
    ]);
    expect(profile.metadata.employmentTypes.map(({ value }) => value)).toEqual([
      "FULL_TIME",
      "CONTRACT",
    ]);
    expect(profile.metadata.workModes.map(({ value }) => value)).toEqual([
      "REMOTE",
      "HYBRID",
    ]);
    expect(profile.metadata.preferredLocations).toEqual([
      {
        value: { provinceCode: "79", districtCode: null },
        sourcePath: "/preferredLocations/0",
      },
      {
        value: { provinceCode: "1", districtCode: "271" },
        sourcePath: "/preferredLocations/1",
      },
    ]);
    expect(profile.content.links).toEqual(
      FULL_CONTENT.personalInfo.links.map((value, index) => ({
        value,
        sourcePath: `/generatedContent/personalInfo/links/${index}`,
      })),
    );
    expect(profile.content.skills.map(({ value }) => value)).toEqual([
      "Node.js",
      "MongoDB",
      "Node.js",
    ]);
    expect(profile.content.educations[0].startDate).toEqual({
      value: "2014-09-01T00:00:00.000Z",
      sourcePath: "/generatedContent/educations/0/startDate",
    });
    expect(profile.content.educations[1]).toMatchObject({
      sourcePath: "/generatedContent/educations/1",
      institutionName: { value: "Online Bootcamp" },
      degree: null,
      startDate: null,
    });
    expect(
      profile.content.workExperiences.map(({ position }) => position.value),
    ).toEqual(["Senior Backend Engineer", "Backend Engineer"]);
    expect(profile.content.workExperiences[0].freeText.description).toEqual({
      value: "Own the payments API.",
      sourcePath: "/generatedContent/workExperiences/0/description",
    });
    expect(profile.content.workExperiences[1].freeText).toEqual({
      description: null,
      achievements: [],
    });
    expect(
      profile.content.projects[0].technologies.map(({ value }) => value),
    ).toEqual(["Node.js", "Kafka", "Node.js"]);
    expect(profile.content.certifications[0].expirationDate.value).toBe(
      "2025-05-10T00:00:00.000Z",
    );
    expect(profile.content.languages[1].proficiency).toBeNull();
    expect(profile.content.hiddenSections).toEqual([
      { value: "projects", sourcePath: "/generatedContent/hiddenSections/0" },
      {
        value: "certifications",
        sourcePath: "/generatedContent/hiddenSections/1",
      },
    ]);
    expect(profile.content.projects).toHaveLength(1);

    const serialized = JSON.stringify(normalizeGeneratedCvSpy.mock.calls[0][0]);

    for (const contactValue of Object.values(CONTACT)) {
      expect(serialized).not.toContain(contactValue);
      expect(JSON.stringify(result)).not.toContain(contactValue);
    }

    expect(await rawCv(cv._id)).toEqual(before);
  });

  it("returns READY for a sparse DRAFT without completeness, default, or PUBLIC gates", async () => {
    const candidate = await createCandidate();
    const taxonomy = await createTaxonomy();
    const cv = await createGeneratedDraft({
      candidate,
      categoryId: taxonomy.field._id,
    });

    const result = await normalizeOwn(candidate, cv);

    expect(cv.isDefault).toBe(false);
    expect(result.status).toBe("READY");
    expect(result.profile.freeText).toEqual({ professionalSummary: null });
    expect(result.profile.metadata).toMatchObject({
      categoryId: { value: taxonomy.field._id.toString() },
      category: { value: { level: CATEGORY_LEVEL.FIELD, parentCategoryId: null } },
      experienceLevelId: null,
      experienceLevel: null,
      skillTags: [],
      employmentTypes: [],
      workModes: [],
      preferredLocations: [],
    });
    expect(result.profile.content).toEqual({
      skills: [],
      educations: [],
      workExperiences: [],
      projects: [],
      certifications: [],
      languages: [],
      hiddenSections: [],
      links: [],
    });
  });

  describe("taxonomy references", () => {
    it.each([
      [
        "an unknown Category",
        () => ({ categoryId: new mongoose.Types.ObjectId() }),
        undefined,
        "categoryId",
      ],
      [
        "a Category outside FIELD/POSITION",
        ({ field }) => ({ categoryId: field._id }),
        ({ field }) =>
          Category.collection.updateOne(
            { _id: field._id },
            { $set: { level: "INDUSTRY" } },
          ),
        "categoryId",
      ],
      [
        "an unknown ExperienceLevel",
        ({ field }) => ({
          categoryId: field._id,
          experienceLevelId: new mongoose.Types.ObjectId(),
        }),
        undefined,
        "experienceLevelId",
      ],
    ])("refuses %s as an invalid reference without calling AI Kit", async (
      _label,
      buildReferences,
      corruptTaxonomy,
      field,
    ) => {
      const candidate = await createCandidate();
      const taxonomy = await createTaxonomy();
      const cv = await createGeneratedDraft({
        candidate,
        ...buildReferences(taxonomy),
      });
      await corruptTaxonomy?.(taxonomy);

      await expectAppError(normalizeOwn(candidate, cv), 400, { field });
      expect(normalizeGeneratedCvSpy).not.toHaveBeenCalled();
    });
  });

  describe("H3 source dependency boundary", () => {
    it("keeps a missing raw source as Backend not-found rather than dependency failure", async () => {
      const candidate = await createCandidate();
      const taxonomy = await createTaxonomy();
      const cv = await createCompleteDraft(candidate, taxonomy);
      const originalExec = mongoose.Query.prototype.exec;
      vi.spyOn(mongoose.Query.prototype, "exec").mockImplementation(function (...args) {
        if (this.model === CandidateCV && this.op === "findOne" && this.mongooseOptions().lean) {
          return Promise.resolve(null);
        }
        return originalExec.apply(this, args);
      });
      const taxonomySpy = vi.spyOn(Category, "findById");

      await expectAppError(normalizeOwn(candidate, cv), 404);
      expect(taxonomySpy).not.toHaveBeenCalled();
      expect(normalizeGeneratedCvSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it.each([false, true])("returns FAILED for a source DB outage (raw read: %s)", async (rawRead) => {
      const candidate = await createCandidate();
      const taxonomy = await createTaxonomy();
      const source = await createCompleteDraft(candidate, taxonomy);
      const before = await rawCv(source._id);
      const lookupError = new mongoose.mongo.MongoNetworkError(
        "private source diagnostic",
      );
      // Driver diagnostics can contain source data; neither result nor logs may echo it.
      lookupError.source = before;
      const taxonomySpy = vi.spyOn(Category, "findById");
      const originalExec = mongoose.Query.prototype.exec;
      const querySpy = vi.spyOn(mongoose.Query.prototype, "exec").mockImplementation(function (...args) {
        if (
          this.model === CandidateCV &&
          this.op === "findOne" &&
          Boolean(this.mongooseOptions().lean) === rawRead
        ) {
          return Promise.reject(lookupError);
        }
        return originalExec.apply(this, args);
      });

      const result = await normalizeOwn(candidate, source);

      expect(result).toEqual({ status: "FAILED", profile: null });
      expect(Object.keys(result).sort()).toEqual(["profile", "status"]);
      expect(normalizeGeneratedCvSpy).not.toHaveBeenCalled();
      expect(taxonomySpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        "AI-V01 Generated CV source lookup failed; normalization FAILED",
        { candidateCvId: source._id.toString(), errorType: "MongoNetworkError" },
      );
      expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("private source diagnostic");
      querySpy.mockRestore();
      expect(await rawCv(source._id)).toEqual(before);
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
      const candidate = await createCandidate();
      const taxonomy = await createTaxonomy();
      const source = await createCompleteDraft(candidate, taxonomy);
      const error = createError();
      const originalExec = mongoose.Query.prototype.exec;
      vi.spyOn(mongoose.Query.prototype, "exec").mockImplementation(async function (...args) {
        if (this.model === CandidateCV && this.op === "findOne") {
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
        vi.spyOn(Category, "findById").mockRejectedValueOnce(error);
      }

      await expect(normalizeOwn(candidate, source)).rejects.toBe(error);
      expect(normalizeGeneratedCvSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("taxonomy lookup dependency failure", () => {
    it.each([
      ["Category", () => vi.spyOn(Category, "findById")],
      ["ExperienceLevel", () => vi.spyOn(ExperienceLevel, "findById")],
    ])("returns FAILED without a profile when the %s lookup fails", async (
      _label,
      spyLookup,
    ) => {
      const candidate = await createCandidate();
      const taxonomy = await createTaxonomy();
      const cv = await createCompleteDraft(candidate, taxonomy);
      const lookupError = new mongoose.mongo.MongoNetworkError(
        "private driver diagnostic",
      );
      spyLookup().mockRejectedValueOnce(lookupError);

      const result = await normalizeOwn(candidate, cv);

      expect(result).toEqual({ status: "FAILED", profile: null });
      expect(normalizeGeneratedCvSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        "AI-V01 Generated CV taxonomy lookup failed; normalization FAILED",
        { candidateCvId: cv._id.toString(), errorType: "MongoNetworkError" },
      );
    });
  });

  describe("projection", () => {
    it.each([
      [
        "duplicate Province-wide selections",
        [{ provinceCode: "1", districtCode: null }, { provinceCode: "1", districtCode: null }],
        "duplicate selections",
      ],
      [
        "duplicate District selections",
        [{ provinceCode: "1", districtCode: "2" }, { provinceCode: "1", districtCode: "2" }],
        "duplicate selections",
      ],
      [
        "Province-wide then District in the same Province",
        [{ provinceCode: "1", districtCode: null }, { provinceCode: "1", districtCode: "2" }],
        "must not combine",
      ],
      [
        "District then Province-wide in the same Province",
        [{ provinceCode: "1", districtCode: "2" }, { provinceCode: "1", districtCode: null }],
        "must not combine",
      ],
      [
        "FOREIGN mixed with a valid selection",
        [{ provinceCode: "1", districtCode: null }, { provinceCode: "FOREIGN", districtCode: null }],
        "/preferredLocations/1/provinceCode must not be FOREIGN",
      ],
      [
        "FOREIGN with a District",
        [{ provinceCode: "FOREIGN", districtCode: "2" }],
        "/preferredLocations/0/provinceCode must not be FOREIGN",
      ],
    ])("refuses persisted %s before taxonomy or AI Kit without repairing it", async (
      _label,
      preferredLocations,
      issue,
    ) => {
      const candidate = await createCandidate();
      const taxonomy = await createTaxonomy();
      const cv = await createCompleteDraft(candidate, taxonomy);
      await CandidateCV.collection.updateOne({ _id: cv._id }, { $set: { preferredLocations } });
      const before = await rawCv(cv._id);
      const taxonomySpy = vi.spyOn(Category, "findById");

      const error = await expectAppError(normalizeOwn(candidate, cv), 500);

      expect(error.message).toBe("Generated CV cannot be projected to the AI-V01 Generated CV source");
      expect(error.details.issues).toEqual(expect.arrayContaining([expect.stringContaining(issue)]));
      expect(error.cause).toBeUndefined();
      expect(taxonomySpy).not.toHaveBeenCalled();
      expect(normalizeGeneratedCvSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(await rawCv(cv._id)).toEqual(before);
    });

    it.each([
      { preferredLocations: [] },
      { preferredLocations: [{ provinceCode: "1", districtCode: null }] },
      {
        preferredLocations: [
          { provinceCode: "1", districtCode: "3" },
          { provinceCode: "79", districtCode: null },
          { provinceCode: "1", districtCode: "2" },
        ],
      },
    ])("keeps valid persisted preferences $preferredLocations READY with their order and provenance", async ({ preferredLocations }) => {
      const candidate = await createCandidate();
      const taxonomy = await createTaxonomy();
      const cv = await createCompleteDraft(candidate, taxonomy);
      await CandidateCV.collection.updateOne({ _id: cv._id }, { $set: { preferredLocations } });
      const before = await rawCv(cv._id);

      const result = await normalizeOwn(candidate, cv);

      expect(result.status).toBe("READY");
      expect(result.profile.metadata.preferredLocations).toEqual(
        preferredLocations.map((value, index) => ({ value, sourcePath: `/preferredLocations/${index}` })),
      );
      expect(normalizeGeneratedCvSpy.mock.calls[0][0].preferredLocations).toEqual(preferredLocations);
      expect(await rawCv(cv._id)).toEqual(before);
    });

    // Hydration-masked cases are values Mongoose would turn into a valid-looking
    // value (cast failure -> default, or a successful but source-changing cast).
    it.each([
      [
        "a non-canonical hidden section",
        { "generatedContent.hiddenSections": ["photo"] },
        "/generatedContent/hiddenSections/0",
        "AI_KIT",
      ],
      [
        "a whitespace-only professional link",
        { "generatedContent.personalInfo.links": ["   "] },
        "/generatedContent/personalInfo/links/0",
        "AI_KIT",
      ],
      [
        "a non-Date education start date",
        { "generatedContent.educations.0.startDate": "not-a-date" },
        "/generatedContent/educations/0/startDate",
        "BACKEND",
      ],
      [
        "a scalar preferredLocations (hydrated to [])",
        { preferredLocations: "bad" },
        "/preferredLocations",
        "AI_KIT",
      ],
      [
        "an uncastable experienceLevelId (hydrated to null)",
        { experienceLevelId: "bad" },
        "/experienceLevelId",
        "BACKEND",
      ],
      [
        "a string categoryId (cast to ObjectId)",
        { categoryId: "507f1f77bcf86cd799439011" },
        "/categoryId",
        "BACKEND",
      ],
      [
        "an ISO string start date (cast to Date)",
        {
          "generatedContent.workExperiences.0.startDate":
            "2021-03-15T08:30:00.000Z",
        },
        "/generatedContent/workExperiences/0/startDate",
        "BACKEND",
      ],
      [
        "a scalar skillTags (cast to a one-item array)",
        { skillTags: "Node.js" },
        "/skillTags",
        "AI_KIT",
      ],
      [
        "a numeric professional summary (cast to a string)",
        { "generatedContent.professionalSummary": 7 },
        "/generatedContent/professionalSummary",
        "AI_KIT",
      ],
    ])("refuses %s as a projection error instead of repairing it", async (
      _label,
      corruption,
      issuePath,
      refusedBy,
    ) => {
      const candidate = await createCandidate();
      const taxonomy = await createTaxonomy();
      const cv = await createCompleteDraft(candidate, taxonomy);
      await CandidateCV.collection.updateOne({ _id: cv._id }, { $set: corruption });
      const before = await rawCv(cv._id);

      const error = await expectAppError(normalizeOwn(candidate, cv), 500);

      expect(error.message).toBe(
        "Generated CV cannot be projected to the AI-V01 Generated CV source",
      );
      expect(error.details.issues).toEqual(
        expect.arrayContaining([expect.stringContaining(issuePath)]),
      );

      if (refusedBy === "AI_KIT") {
        expect(error.cause).toMatchObject({
          code: "INVALID_GENERATED_CV_INPUT",
        });
      } else {
        expect(error.cause).toBeUndefined();
        expect(normalizeGeneratedCvSpy).not.toHaveBeenCalled();
      }

      expect(warnSpy).not.toHaveBeenCalled();
      expect(await rawCv(cv._id)).toEqual(before);
    });

    it("treats truly absent persisted fields as their schema defaults and stays READY without exposing private contact data", async () => {
      const candidate = await createCandidate();
      const taxonomy = await createTaxonomy();
      const cv = await createCompleteDraft(candidate, taxonomy);
      await CandidateCV.collection.updateOne(
        { _id: cv._id },
        {
          $unset: {
            preferredLocations: "",
            experienceLevelId: "",
            skillTags: "",
            "generatedContent.workExperiences.0.endDate": "",
            "generatedContent.languages": "",
          },
        },
      );
      const before = await rawCv(cv._id);

      const result = await normalizeOwn(candidate, cv);

      expect(result.status).toBe("READY");
      expect(result.profile.metadata).toMatchObject({
        experienceLevelId: null,
        experienceLevel: null,
        skillTags: [],
        preferredLocations: [],
      });
      expect(result.profile.content.languages).toEqual([]);

      const aiKitInput = normalizeGeneratedCvSpy.mock.calls[0][0];
      expect(aiKitInput.generatedContent.workExperiences[0].endDate).toBeNull();
      expect(aiKitInput.generatedContent.personalInfo).toEqual({
        links: FULL_CONTENT.personalInfo.links,
      });
      expect(JSON.stringify(result)).not.toContain(CONTACT.email);
      expect(await rawCv(cv._id)).toEqual(before);
    });

    it("keeps a present BSON Undefined CV date invalid while absent fields receive defaults", () => {
      const BSON = mongoose.mongo.BSON;
      const encoded = Buffer.from(
        BSON.serialize({
          generatedContent: { workExperiences: [{ endDate: null }] },
        }),
      );
      const cstring = (value) =>
        Buffer.concat([Buffer.from(value), Buffer.from([0])]);
      const dateTypeIndex = encoded.indexOf(cstring("endDate")) - 1;

      expect(encoded[dateTypeIndex]).toBe(BSON.BSONType.null);
      encoded[dateTypeIndex] = BSON.BSONType.undefined;

      // This exercises the BSON decoder representation used by the lean raw
      // loader; the driver serializer cannot write JS undefined as BSON type 6.
      const persisted = BSON.deserialize(encoded);
      const source = overlayPersistedValue(persisted, {
        generatedContent: { workExperiences: [{ endDate: null }] },
        absentSkillTags: [],
      });
      const issues = [];
      const date = toPersistedIsoDate(
        source.generatedContent.workExperiences[0].endDate,
        "/generatedContent/workExperiences/0/endDate",
        issues,
      );

      expect(Object.hasOwn(source.generatedContent.workExperiences[0], "endDate")).toBe(true);
      expect(date).toBeUndefined();
      expect(issues).toEqual([
        "/generatedContent/workExperiences/0/endDate must be null or a persisted Date",
      ]);
      expect(source.absentSkillTags).toEqual([]);
    });

    it("refuses a present undefined date from the own active raw CV read", async () => {
      const candidate = await createCandidate();
      const taxonomy = await createTaxonomy();
      const cv = await createCompleteDraft(candidate, taxonomy);
      const before = await rawCv(cv._id);
      const originalExec = mongoose.Query.prototype.exec;
      let rawReadObserved = false;

      vi.spyOn(mongoose.Query.prototype, "exec").mockImplementation(
        async function (...args) {
          const result = await originalExec.apply(this, args);

          if (
            this.model === CandidateCV &&
            this.op === "findOne" &&
            this.mongooseOptions().lean
          ) {
            rawReadObserved = true;
            // Simulate legacy BSON Undefined after decoding. The driver
            // cannot persist BSON type 6 from a new JS undefined write.
            result.generatedContent.workExperiences[0].endDate = undefined;
          }

          return result;
        },
      );

      const error = await expectAppError(normalizeOwn(candidate, cv), 500);

      expect(rawReadObserved).toBe(true);
      expect(error.details.issues).toEqual(
        expect.arrayContaining([
          expect.stringContaining("/generatedContent/workExperiences/0/endDate"),
        ]),
      );
      expect(normalizeGeneratedCvSpy).not.toHaveBeenCalled();
      expect(await rawCv(cv._id)).toEqual(before);
    });
  });

  describe("authorization and source refusal", () => {
    it("reuses own active CV access: other owner, mismatched owner, non-Candidate, archived, unknown, and malformed ids are refused before lookup", async () => {
      const candidate = await createCandidate();
      const other = await createCandidate();
      const recruiter = (
        await createVerifiedUser({
          email: "recruiter.ai-b2@example.com",
          role: USER_ROLE.COMPANY_STAFF,
        })
      ).user;
      const taxonomy = await createTaxonomy();
      const cv = await createCompleteDraft(candidate, taxonomy);
      const archived = await createGeneratedDraft({
        candidate,
        categoryId: taxonomy.field._id,
        archivedAt: new Date("2026-10-01T00:00:00.000Z"),
      });
      const findSpy = vi.spyOn(Category, "findById");
      const cvId = cv._id.toString();

      for (const [actorUser, candidateUserId, id, statusCode] of [
        [other, other._id, cvId, 404],
        [other, candidate._id, cvId, 403],
        [recruiter, recruiter._id, cvId, 403],
        [candidate, candidate._id, archived._id.toString(), 404],
        [candidate, candidate._id, new mongoose.Types.ObjectId().toString(), 404],
        [candidate, candidate._id, "not-an-object-id", 404],
      ]) {
        await expectAppError(
          normalizeOwnGeneratedCandidateCv({
            candidateUserId,
            actorUser,
            candidateCvId: id,
          }),
          statusCode,
        );
      }

      expect(findSpy).not.toHaveBeenCalled();
      expect(normalizeGeneratedCvSpy).not.toHaveBeenCalled();
    });

    it("refuses an own Uploaded CV as an unsupported source", async () => {
      const candidate = await createCandidate();
      const taxonomy = await createTaxonomy();
      const uploaded = await CandidateCV.create({
        candidateUserId: candidate._id,
        name: "Uploaded CV",
        sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
        status: CANDIDATE_CV_STATUS.ACTIVE,
        visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
        categoryId: taxonomy.field._id,
        uploadedFile: {
          storageKey: "jobhub/candidate-cvs/uploaded/ai-b2",
          originalFileName: "cv.pdf",
          mimeType: "application/pdf",
          sizeBytes: 4096,
          pageCount: 1,
          uploadedAt: new Date("2026-01-15T00:00:00.000Z"),
        },
      });
      const findSpy = vi.spyOn(Category, "findById");

      await expectAppError(normalizeOwn(candidate, uploaded), 409, {
        field: "sourceType",
      });
      expect(findSpy).not.toHaveBeenCalled();
      expect(normalizeGeneratedCvSpy).not.toHaveBeenCalled();
    });

    it("keeps getOwnActiveCandidateCv returning the public detail projection", async () => {
      const candidate = await createCandidate();
      const taxonomy = await createTaxonomy();
      const cv = await createCompleteDraft(candidate, taxonomy);

      expect(
        await getOwnActiveCandidateCv({
          candidateUserId: candidate._id,
          actorUser: candidate,
          candidateCvId: cv._id.toString(),
        }),
      ).toEqual(toPublicCandidateCvDetail(await CandidateCV.findById(cv._id)));
    });
  });
});
