import { describe, expect, it, vi } from "vitest";

import { createAiKit } from "@jobhub/ai-kit";

import { normalizeGeneratedCv as internalNormalizeGeneratedCv } from "../src/normalization/cv-normalization.js";
import { normalizeJob as internalNormalizeJob } from "../src/normalization/job-normalization.js";

const JOB_DESCRIPTION = "Yêu cầu: 3 năm kinh nghiệm Node.js.";
const CV_SUMMARY = "Backend developer 5 năm kinh nghiệm Node.js.";

const makeLogger = () => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
});

const makeJobSource = (overrides = {}) => ({
  jobId: "job-1",
  title: "Backend Engineer",
  jobDescription: JOB_DESCRIPTION,
  requiredSkills: ["Node.js"],
  salary: {
    type: "RANGE",
    minAmount: 20000000,
    maxAmount: 30000000,
    period: "MONTH",
    customPeriodLabel: null,
  },
  fieldCategoryIds: ["field-1"],
  positionCategoryIds: ["position-1"],
  experienceLevelId: "level-1",
  employmentType: "FULL_TIME",
  workModes: ["HYBRID"],
  location: { provinceCode: "01", districtCode: "001" },
  taxonomy: {
    categories: [
      {
        id: "field-1",
        name: "Công nghệ thông tin",
        level: "FIELD",
        parentCategoryId: null,
      },
      {
        id: "position-1",
        name: "Backend Developer",
        level: "POSITION",
        parentCategoryId: "field-1",
      },
    ],
    experienceLevel: { id: "level-1", code: "ONE_TO_THREE_YEARS" },
  },
  ...overrides,
});

const makeDraftJobSource = () =>
  makeJobSource({
    title: "Bản nháp",
    jobDescription: null,
    requiredSkills: [],
    salary: null,
    fieldCategoryIds: [],
    positionCategoryIds: [],
    experienceLevelId: null,
    employmentType: null,
    workModes: [],
    location: null,
    taxonomy: { categories: [], experienceLevel: null },
  });

const makeGeneratedContent = (overrides = {}) => ({
  personalInfo: { links: ["https://github.com/nguyenvana"] },
  professionalSummary: CV_SUMMARY,
  educations: [],
  skills: ["Node.js"],
  workExperiences: [
    {
      companyName: "JOBHUB",
      position: "Backend Engineer",
      startDate: "2020-01-01T00:00:00.000Z",
      endDate: null,
      description: "Xây dựng API.",
      achievements: [],
    },
  ],
  projects: [],
  certifications: [],
  languages: [],
  hiddenSections: [],
  ...overrides,
});

const makeCvSource = (overrides = {}) => ({
  candidateCvId: "cv-1",
  categoryId: "position-1",
  experienceLevelId: "level-1",
  skillTags: ["nodejs"],
  employmentTypes: ["FULL_TIME"],
  workModes: ["HYBRID"],
  preferredLocations: [{ provinceCode: "01", districtCode: null }],
  generatedContent: makeGeneratedContent(),
  taxonomy: {
    category: {
      id: "position-1",
      name: "Backend Developer",
      level: "POSITION",
      parentCategoryId: "field-1",
    },
    experienceLevel: { id: "level-1", code: "THREE_TO_FIVE_YEARS" },
  },
  ...overrides,
});

const makeSparseCvSource = () =>
  makeCvSource({
    experienceLevelId: null,
    skillTags: [],
    employmentTypes: [],
    workModes: [],
    preferredLocations: [],
    generatedContent: makeGeneratedContent({
      personalInfo: { links: [] },
      professionalSummary: null,
      skills: [],
      workExperiences: [],
    }),
    taxonomy: {
      category: makeCvSource().taxonomy.category,
      experienceLevel: null,
    },
  });

// A source whose free text changes between reads cannot be normalized into a
// faithful profile, which is the observable FAILED path at this boundary.
const withUnstableField = (source, field) => {
  let reads = 0;

  Object.defineProperty(source, field, {
    enumerable: true,
    get() {
      reads += 1;
      return `Phiên bản ${reads}`;
    },
  });

  return source;
};

const captureError = (action) => {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error("expected the call to throw");
};

describe("AI-V01 public runtime entry", () => {
  it("exposes approved runtime entries on the createAiKit instance only", () => {
    const aiKit = createAiKit({ logger: makeLogger() });

    expect(Object.keys(aiKit)).toEqual([
      "normalizeJob", "buildJobEmbeddingText", "buildCvQueryText",
      "normalizeGeneratedCv", "normalizeUploadedCv", "matchJobCv",
      "assessRecommendationBatch", "evaluateCv",
    ]);
    expect(Object.isFrozen(aiKit)).toBe(true);
    expect(aiKit.normalizeJob).toBeTypeOf("function");
    expect(aiKit.normalizeGeneratedCv).toBeTypeOf("function");
  });

  it("works without any LLM provider configuration and never logs", () => {
    const logger = makeLogger();
    const aiKit = createAiKit({ logger });

    expect(aiKit.normalizeJob(makeJobSource()).status).toBe("READY");
    expect(aiKit.normalizeGeneratedCv(makeCvSource()).status).toBe("READY");
    expect(() => aiKit.normalizeJob({})).toThrow();

    for (const method of Object.values(logger)) {
      expect(method).not.toHaveBeenCalled();
    }
  });
});

describe("F01 normalizeJob through the public entry", () => {
  const aiKit = createAiKit({ logger: makeLogger() });

  it("returns the same frozen READY JobMatchProfile result as the F01 owner", () => {
    const result = aiKit.normalizeJob(makeJobSource());

    expect(result).toEqual(internalNormalizeJob(makeJobSource()));
    expect(result.status).toBe("READY");
    expect(result.profile.source.jobId).toBe("job-1");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.profile)).toBe(true);
  });

  it("accepts a DRAFT-like Job with missing metadata as READY with empty fields", () => {
    const result = aiKit.normalizeJob(makeDraftJobSource());

    expect(result).toEqual(internalNormalizeJob(makeDraftJobSource()));
    expect(result.status).toBe("READY");
  });

  it.each([
    null,
    { provinceCode: "1", districtCode: null },
    { provinceCode: "1", districtCode: "2" },
  ])("preserves valid Location %j and provenance through the public Job boundary", (location) => {
    const source = makeJobSource({ location });
    const before = structuredClone(source);

    const result = aiKit.normalizeJob(source);

    expect(result.status).toBe("READY");
    expect(result.profile.metadata.location).toEqual(
      location === null ? null : { value: location, sourcePath: "/location" },
    );
    expect(source).toEqual(before);
  });

  it.each([
    { districtCode: "2" },
    { provinceCode: "1", districtCode: 2 },
  ])("refuses malformed Location %j at the public projection-shape gate without repair", (location) => {
    const source = makeJobSource({ location });
    const before = structuredClone(source);

    const error = captureError(() => aiKit.normalizeJob(source));

    expect(error.code).toBe("INVALID_JOB_INPUT");
    expect(error.details).toEqual(expect.arrayContaining([expect.stringContaining("/location/")]));
    expect(source).toEqual(before);
  });

  it.each([
    [
      "an ID without a resolved Category",
      makeJobSource({ positionCategoryIds: ["position-1", "position-9"] }),
      "/positionCategoryIds/1 has no resolved Category",
    ],
    [
      "a Category at the wrong level",
      makeJobSource({ fieldCategoryIds: ["position-1"], positionCategoryIds: ["field-1"] }),
      "/fieldCategoryIds/0 must resolve to a FIELD Category",
    ],
    [
      "an experience level that does not resolve the Job reference",
      makeJobSource({ experienceLevelId: "level-2" }),
      "/taxonomy/experienceLevel must resolve /experienceLevelId",
    ],
  ])("refuses %s with the coded INVALID_JOB_INPUT error", (_case, jobSource, detail) => {
    const error = captureError(() => aiKit.normalizeJob(jobSource));

    expect(error.name).toBe("JobNormalizationError");
    expect(error.code).toBe("INVALID_JOB_INPUT");
    expect(error.details).toContain(detail);
    expect(JSON.stringify([error.message, error.details])).not.toContain(
      JOB_DESCRIPTION,
    );
  });

  it("returns FAILED without a profile when normalization cannot complete", () => {
    const result = aiKit.normalizeJob(
      withUnstableField(makeJobSource(), "jobDescription"),
    );

    expect(result).toEqual({ status: "FAILED", profile: null });
  });
});

describe("F02 normalizeGeneratedCv through the public entry", () => {
  const aiKit = createAiKit({ logger: makeLogger() });

  it("returns the same frozen READY CVMatchProfile result as the F02 owner", () => {
    const result = aiKit.normalizeGeneratedCv(makeCvSource());

    expect(result).toEqual(internalNormalizeGeneratedCv(makeCvSource()));
    expect(result.status).toBe("READY");
    expect(result.profile.source.candidateCvId).toBe("cv-1");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.profile)).toBe(true);
  });

  it("accepts a near-empty Generated CV as READY with empty fields", () => {
    const result = aiKit.normalizeGeneratedCv(makeSparseCvSource());

    expect(result).toEqual(internalNormalizeGeneratedCv(makeSparseCvSource()));
    expect(result.status).toBe("READY");
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
  ])("preserves valid preferences $preferredLocations and provenance through the public CV boundary", ({ preferredLocations }) => {
    const source = makeCvSource({ preferredLocations });
    const before = structuredClone(source);

    const result = aiKit.normalizeGeneratedCv(source);

    expect(result.status).toBe("READY");
    expect(result.profile.metadata.preferredLocations).toEqual(
      preferredLocations.map((value, index) => ({ value, sourcePath: `/preferredLocations/${index}` })),
    );
    expect(source).toEqual(before);
  });

  it.each([
    { preferredLocations: null },
    { preferredLocations: [{ provinceCode: "1", districtCode: 2 }] },
  ])("refuses malformed preferences $preferredLocations at the public projection-shape gate without repair", ({ preferredLocations }) => {
    const source = makeCvSource({ preferredLocations });
    const before = structuredClone(source);

    const error = captureError(() => aiKit.normalizeGeneratedCv(source));

    expect(error.code).toBe("INVALID_GENERATED_CV_INPUT");
    expect(error.details).toEqual(expect.arrayContaining([expect.stringContaining("/preferredLocations")]));
    expect(source).toEqual(before);
  });

  it("refuses a taxonomy that does not resolve the CV references with INVALID_GENERATED_CV_INPUT", () => {
    const error = captureError(() =>
      aiKit.normalizeGeneratedCv(makeCvSource({ categoryId: "position-9" })),
    );

    expect(error.name).toBe("CvNormalizationError");
    expect(error.code).toBe("INVALID_GENERATED_CV_INPUT");
    expect(error.details).toContain("/taxonomy/category must resolve /categoryId");
    expect(JSON.stringify([error.message, error.details])).not.toContain(
      CV_SUMMARY,
    );
  });

  it("returns FAILED without a profile when normalization cannot complete", () => {
    const cvSource = makeCvSource();
    cvSource.generatedContent = withUnstableField(
      makeGeneratedContent(),
      "professionalSummary",
    );

    expect(aiKit.normalizeGeneratedCv(cvSource)).toEqual({
      status: "FAILED",
      profile: null,
    });
  });
});
