import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  JOB_NORMALIZATION_ERROR_CODES,
  JOB_NORMALIZATION_STATUS,
  JobNormalizationError,
  normalizeJob,
} from "../src/normalization/job-normalization.js";

const JOB_DESCRIPTION =
  "  Yêu cầu: 3 năm kinh nghiệm Node.js.\nƯu tiên Docker. Làm việc từ xa, hợp đồng thời vụ.  ";

const makeJobSource = (overrides = {}) => ({
  jobId: "job-1",
  title: "Backend Engineer",
  jobDescription: JOB_DESCRIPTION,
  requiredSkills: ["Node.js", "MongoDB"],
  salary: {
    type: "RANGE",
    minAmount: 20000000,
    maxAmount: 30000000,
    period: "MONTH",
    customPeriodLabel: null,
  },
  fieldCategoryIds: ["field-1"],
  positionCategoryIds: ["position-1", "position-2"],
  experienceLevelId: "level-1",
  employmentType: "FULL_TIME",
  workModes: ["ONSITE", "HYBRID"],
  location: { provinceCode: "01", districtCode: "001" },
  taxonomy: {
    categories: [
      {
        id: "position-2",
        name: "DevOps Engineer",
        level: "POSITION",
        parentCategoryId: "field-1",
      },
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

const makeSparseJobSource = () =>
  makeJobSource({
    title: null,
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

const withTaxonomy = (taxonomyOverrides) => {
  const jobSource = makeJobSource();

  return {
    ...jobSource,
    taxonomy: { ...jobSource.taxonomy, ...taxonomyOverrides },
  };
};

const withCategory = (index, categoryOverrides) => {
  const categories = makeJobSource().taxonomy.categories.map((category, i) => {
    return i === index ? { ...category, ...categoryOverrides } : category;
  });

  return withTaxonomy({ categories });
};

const expectInvalidInput = (jobSource, expectedDetail) => {
  let caught;

  try {
    normalizeJob(jobSource);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(JobNormalizationError);
  expect(caught.code).toBe(JOB_NORMALIZATION_ERROR_CODES.INVALID_JOB_INPUT);

  if (expectedDetail) {
    expect(caught.details).toContain(expectedDetail);
  }

  return caught;
};

describe("normalizeJob — READY profile", () => {
  it("preserves complete structured metadata with source paths", () => {
    const result = normalizeJob(makeJobSource());

    expect(result).toEqual({
      status: JOB_NORMALIZATION_STATUS.READY,
      profile: {
        source: { type: "JOB", jobId: "job-1" },
        freeText: {
          title: { value: "Backend Engineer", sourcePath: "/title" },
          jobDescription: {
            value: JOB_DESCRIPTION,
            sourcePath: "/jobDescription",
          },
        },
        metadata: {
          requiredSkills: [
            { value: "Node.js", sourcePath: "/requiredSkills/0" },
            { value: "MongoDB", sourcePath: "/requiredSkills/1" },
          ],
          salary: {
            value: {
              type: "RANGE",
              minAmount: 20000000,
              maxAmount: 30000000,
              period: "MONTH",
              customPeriodLabel: null,
            },
            sourcePath: "/salary",
          },
          employmentType: { value: "FULL_TIME", sourcePath: "/employmentType" },
          workModes: [
            { value: "ONSITE", sourcePath: "/workModes/0" },
            { value: "HYBRID", sourcePath: "/workModes/1" },
          ],
          location: {
            value: { provinceCode: "01", districtCode: "001" },
            sourcePath: "/location",
          },
          fieldCategoryIds: [
            { value: "field-1", sourcePath: "/fieldCategoryIds/0" },
          ],
          positionCategoryIds: [
            { value: "position-1", sourcePath: "/positionCategoryIds/0" },
            { value: "position-2", sourcePath: "/positionCategoryIds/1" },
          ],
          experienceLevelId: {
            value: "level-1",
            sourcePath: "/experienceLevelId",
          },
          fieldCategories: [
            {
              value: {
                id: "field-1",
                name: "Công nghệ thông tin",
                level: "FIELD",
                parentCategoryId: null,
              },
              sourcePath: "/taxonomy/categories/1",
            },
          ],
          positionCategories: [
            {
              value: {
                id: "position-1",
                name: "Backend Developer",
                level: "POSITION",
                parentCategoryId: "field-1",
              },
              sourcePath: "/taxonomy/categories/2",
            },
            {
              value: {
                id: "position-2",
                name: "DevOps Engineer",
                level: "POSITION",
                parentCategoryId: "field-1",
              },
              sourcePath: "/taxonomy/categories/0",
            },
          ],
          experienceLevel: {
            value: { id: "level-1", code: "ONE_TO_THREE_YEARS" },
            sourcePath: "/taxonomy/experienceLevel",
          },
        },
      },
    });
  });

  it("keeps a Position whose parent Field is not selected by the Job", () => {
    const jobSource = makeJobSource({ fieldCategoryIds: [] });
    jobSource.taxonomy.categories.splice(1, 1);

    const result = normalizeJob(jobSource);

    expect(result.status).toBe(JOB_NORMALIZATION_STATUS.READY);
    expect(result.profile.metadata.fieldCategories).toEqual([]);
    expect(
      result.profile.metadata.positionCategories.map(
        ({ value }) => value.parentCategoryId,
      ),
    ).toEqual(["field-1", "field-1"]);
  });

  it("keeps missing metadata empty and stays READY for a sparse Job", () => {
    const result = normalizeJob(makeSparseJobSource());

    expect(result.status).toBe(JOB_NORMALIZATION_STATUS.READY);
    expect(result.profile.freeText).toEqual({
      title: null,
      jobDescription: null,
    });
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

  it("does not fill empty metadata from a description that mentions it", () => {
    const result = normalizeJob(
      makeJobSource({ employmentType: null, workModes: [], salary: null }),
    );

    expect(result.status).toBe(JOB_NORMALIZATION_STATUS.READY);
    expect(result.profile.metadata.employmentType).toBeNull();
    expect(result.profile.metadata.workModes).toEqual([]);
    expect(result.profile.metadata.salary).toBeNull();
    expect(result.profile.freeText.jobDescription.value).toBe(JOB_DESCRIPTION);
  });

  it("keeps both metadata and a differing description without overriding either", () => {
    const result = normalizeJob(makeJobSource());

    expect(result.profile.metadata.workModes.map(({ value }) => value)).toEqual(
      ["ONSITE", "HYBRID"],
    );
    expect(result.profile.metadata.employmentType.value).toBe("FULL_TIME");
    expect(result.profile.freeText.jobDescription.value).toBe(JOB_DESCRIPTION);
  });

  it("assigns no priority and creates no requirement from free text", () => {
    const result = normalizeJob(makeJobSource());
    const serialized = JSON.stringify(result.profile);

    expect(serialized).not.toMatch(/REQUIRED|OPTIONAL|priority/);
    expect(serialized).not.toContain('"Docker"');
    expect(result.profile).not.toHaveProperty("requirements");
  });

  it("keeps structured skills that the description does not mention", () => {
    const result = normalizeJob(
      makeJobSource({ requiredSkills: ["Kubernetes"], jobDescription: null }),
    );

    expect(result.profile.metadata.requiredSkills).toEqual([
      { value: "Kubernetes", sourcePath: "/requiredSkills/0" },
    ]);
  });

  it("keeps duplicated skill tags and description overlap without deduplication", () => {
    const result = normalizeJob(
      makeJobSource({ requiredSkills: ["Node.js", "node.js", "Node.js"] }),
    );

    expect(result.profile.metadata.requiredSkills).toEqual([
      { value: "Node.js", sourcePath: "/requiredSkills/0" },
      { value: "node.js", sourcePath: "/requiredSkills/1" },
      { value: "Node.js", sourcePath: "/requiredSkills/2" },
    ]);
    expect(result.profile.freeText.jobDescription.value).toContain("Node.js");
  });

  it("preserves free text verbatim, including surrounding whitespace", () => {
    const result = normalizeJob(makeJobSource());

    expect(result.profile.freeText.jobDescription.value).toBe(JOB_DESCRIPTION);
  });

  it.each([
    [
      "FIXED",
      {
        type: "FIXED",
        minAmount: 15000000,
        maxAmount: 15000000,
        period: "MONTH",
        customPeriodLabel: null,
      },
    ],
    [
      "FROM",
      {
        type: "FROM",
        minAmount: 50000,
        maxAmount: null,
        period: "HOUR",
        customPeriodLabel: null,
      },
    ],
    [
      "UP_TO",
      {
        type: "UP_TO",
        minAmount: null,
        maxAmount: 500000,
        period: "SHIFT",
        customPeriodLabel: null,
      },
    ],
    [
      "NEGOTIABLE",
      {
        type: "NEGOTIABLE",
        minAmount: null,
        maxAmount: null,
        period: null,
        customPeriodLabel: null,
      },
    ],
    [
      "ETC period",
      {
        type: "RANGE",
        minAmount: 1000000,
        maxAmount: 2000000,
        period: "ETC",
        customPeriodLabel: "dự án",
      },
    ],
  ])("preserves a valid %s Structured Salary unchanged", (_label, salary) => {
    const result = normalizeJob(makeJobSource({ salary }));

    expect(result.status).toBe(JOB_NORMALIZATION_STATUS.READY);
    expect(result.profile.metadata.salary).toEqual({
      value: salary,
      sourcePath: "/salary",
    });
  });

  it("returns the same data for the same input", () => {
    expect(normalizeJob(makeJobSource())).toEqual(normalizeJob(makeJobSource()));
  });

  it("returns a frozen profile and leaves the source untouched", () => {
    const jobSource = makeJobSource();
    const result = normalizeJob(jobSource);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.profile.metadata.salary.value)).toBe(true);
    expect(Object.isFrozen(jobSource.salary)).toBe(false);
    expect(
      Object.isFrozen(result.profile.metadata.positionCategories[0].value),
    ).toBe(true);
    expect(Object.isFrozen(jobSource.taxonomy.categories[2])).toBe(false);

    jobSource.salary.minAmount = 1;
    jobSource.requiredSkills.push("Go");

    expect(result.profile.metadata.salary.value.minAmount).toBe(20000000);
    expect(result.profile.metadata.requiredSkills).toHaveLength(2);
  });
});

describe("normalizeJob — input refusal", () => {
  it.each([
    ["null", null],
    ["an array", []],
    ["a string", "job"],
  ])("refuses %s", (_label, jobSource) => {
    expectInvalidInput(jobSource, "Job source must be a plain object");
  });

  it("refuses fields outside the career-relevant Job projection", () => {
    expectInvalidInput(
      makeJobSource({ companyId: "company-1" }),
      "/companyId is not an allowed field",
    );
  });

  it("refuses a projection that omits a field instead of sending null", () => {
    const jobSource = makeJobSource();
    delete jobSource.salary;

    expectInvalidInput(jobSource, "/salary is required");
  });

  it.each([
    [{ jobId: "" }, "/jobId must be a non-empty string"],
    [{ title: "   " }, "/title must be null or a non-empty string"],
    [{ jobDescription: 42 }, "/jobDescription must be null or a non-empty string"],
    [{ requiredSkills: ["Node.js", ""] }, "/requiredSkills/1 must be a non-empty string"],
    [{ requiredSkills: "Node.js" }, "/requiredSkills must be an array"],
    [{ fieldCategoryIds: ["f", "f"] }, "/fieldCategoryIds must not contain duplicates"],
    [{ positionCategoryIds: [7] }, "/positionCategoryIds/0 must be a non-empty string"],
    [{ experienceLevelId: "" }, "/experienceLevelId must be null or a non-empty string"],
    [
      { employmentType: "full-time" },
      "/employmentType must be null or a canonical EmploymentType value",
    ],
    [{ workModes: ["WFH"] }, "/workModes/0 must be a canonical WorkMode value"],
    [{ workModes: ["REMOTE", "REMOTE"] }, "/workModes must not contain duplicates"],
    [
      { location: { provinceCode: "", districtCode: null } },
      "/location/provinceCode must be a non-empty string",
    ],
    [
      { location: { provinceCode: "01" } },
      "/location/districtCode is required",
    ],
  ])("refuses invalid structured metadata %o", (overrides, expectedDetail) => {
    expectInvalidInput(makeJobSource(overrides), expectedDetail);
  });

  const salary = (overrides) => ({
    type: "RANGE",
    minAmount: 10,
    maxAmount: 20,
    period: "MONTH",
    customPeriodLabel: null,
    ...overrides,
  });

  it.each([
    [salary({ type: "SALARY" }), "/salary/type must be a canonical SalaryType value"],
    [salary({ minAmount: 1.5 }), "/salary/minAmount must be null or an integer VND amount"],
    [salary({ minAmount: 30 }), "/salary amounts do not match salary type RANGE"],
    [salary({ type: "FIXED" }), "/salary amounts do not match salary type FIXED"],
    [salary({ type: "FROM" }), "/salary amounts do not match salary type FROM"],
    [salary({ type: "UP_TO" }), "/salary amounts do not match salary type UP_TO"],
    [
      salary({ type: "NEGOTIABLE" }),
      "/salary NEGOTIABLE must not have amounts, period, or customPeriodLabel",
    ],
    [salary({ period: "YEAR" }), "/salary/period must be a canonical SalaryPeriod value"],
    [salary({ period: null }), "/salary/period must be a canonical SalaryPeriod value"],
    [salary({ period: "ETC" }), "/salary/customPeriodLabel is required for ETC period"],
    [
      salary({ customPeriodLabel: "tháng" }),
      "/salary/customPeriodLabel is only allowed for ETC period",
    ],
    [{ ...salary({}), currency: "VND" }, "/salary/currency is not an allowed field"],
    ["20-30 triệu", "/salary must be null or a Structured Salary object"],
  ])("refuses an invalid Structured Salary (%#)", (invalidSalary, expectedDetail) => {
    expectInvalidInput(makeJobSource({ salary: invalidSalary }), expectedDetail);
  });

  it.each([
    [{ taxonomy: null }, "/taxonomy must be a resolved taxonomy object"],
    [
      { taxonomy: { categories: [] } },
      "/taxonomy/experienceLevel is required",
    ],
  ])("refuses a missing or malformed taxonomy %o", (overrides, expectedDetail) => {
    expectInvalidInput(makeJobSource(overrides), expectedDetail);
  });

  it.each([
    [withCategory(1, { name: "  " }), "/taxonomy/categories/1/name must be a non-empty string"],
    [withCategory(1, { level: "SECTOR" }), "/taxonomy/categories/1/level must be a canonical CategoryLevel value"],
    [withCategory(1, { parentCategoryId: "field-0" }), "/taxonomy/categories/1 FIELD Category must not have a parent"],
    [withCategory(0, { parentCategoryId: null }), "/taxonomy/categories/0 POSITION Category must have a parent"],
    [withCategory(0, { normalizedName: "devops engineer" }), "/taxonomy/categories/0/normalizedName is not an allowed field"],
    [withCategory(0, { id: "field-1" }), "/taxonomy/categories must not contain duplicate ids"],
    [
      withTaxonomy({ experienceLevel: { id: "level-1", code: "SENIOR" } }),
      "/taxonomy/experienceLevel/code must be a canonical ExperienceLevel code",
    ],
  ])("refuses invalid resolved taxonomy metadata (%#)", (jobSource, expectedDetail) => {
    expectInvalidInput(jobSource, expectedDetail);
  });

  it.each([
    [
      makeJobSource({ fieldCategoryIds: ["field-1", "field-2"] }),
      "/fieldCategoryIds/1 has no resolved Category",
    ],
    [
      makeJobSource({ fieldCategoryIds: ["position-1"], positionCategoryIds: ["field-1", "position-2"] }),
      "/fieldCategoryIds/0 must resolve to a FIELD Category",
    ],
    [
      makeJobSource({ positionCategoryIds: ["position-1"] }),
      "/taxonomy/categories/0 is not referenced by the Job",
    ],
    [
      withTaxonomy({ experienceLevel: null }),
      "/taxonomy/experienceLevel must resolve /experienceLevelId",
    ],
    [
      withTaxonomy({ experienceLevel: { id: "level-2", code: "NO_EXPERIENCE" } }),
      "/taxonomy/experienceLevel must resolve /experienceLevelId",
    ],
    [
      makeJobSource({ experienceLevelId: null }),
      "/taxonomy/experienceLevel must be null when /experienceLevelId is null",
    ],
  ])("refuses taxonomy that is missing or inconsistent with source IDs (%#)", (jobSource, expectedDetail) => {
    expectInvalidInput(jobSource, expectedDetail);
  });

  it("does not echo Job content in refusal details", () => {
    const error = expectInvalidInput(
      makeJobSource({ title: "   ", workModes: ["Làm việc từ xa"] }),
    );

    expect(error.message).not.toContain("Làm việc từ xa");
    expect(error.details.join(" ")).not.toContain("Làm việc từ xa");
  });
});

describe("normalizeJob — FAILED result", () => {
  const withDescriptionReads = (readDescription) => {
    const jobSource = makeJobSource();
    let reads = 0;

    Object.defineProperty(jobSource, "jobDescription", {
      enumerable: true,
      get() {
        reads += 1;
        return readDescription(reads);
      },
    });

    return jobSource;
  };

  it("returns FAILED without a profile when normalization cannot complete", () => {
    const jobSource = withDescriptionReads((reads) => {
      if (reads > 1) {
        throw new Error("source unavailable");
      }

      return JOB_DESCRIPTION;
    });

    expect(normalizeJob(jobSource)).toEqual({
      status: JOB_NORMALIZATION_STATUS.FAILED,
      profile: null,
    });
  });

  it("propagates unexpected exceptions in V05 strict mode", () => {
    const failure = new Error("unexpected normalization exception");
    const jobSource = withDescriptionReads((reads) => {
      if (reads > 1) throw failure;
      return JOB_DESCRIPTION;
    });
    expect(() => normalizeJob(jobSource, { strictFailures: true })).toThrow(failure);
  });

  it("does not classify an uncertain profile self-check failure as invalid Job data", () => {
    const jobSource = withDescriptionReads((reads) => `Mô tả phiên bản ${reads}`);
    expect(() => normalizeJob(jobSource, { strictFailures: true })).toThrow();
  });

  it("returns FAILED rather than READY when the profile no longer matches its source", () => {
    const jobSource = withDescriptionReads((reads) => `Mô tả phiên bản ${reads}`);

    expect(normalizeJob(jobSource)).toEqual({
      status: JOB_NORMALIZATION_STATUS.FAILED,
      profile: null,
    });
  });
});

describe("job normalization module boundary", () => {
  it("imports no LLM provider, fallback, contract loader, or contract JSON", async () => {
    const source = await readFile(
      new URL("../src/normalization/job-normalization.js", import.meta.url),
      "utf8",
    );
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map(
      ([, specifier]) => specifier,
    );

    expect(imports).toEqual(["node:util", "./normalization-support.js"]);
  });
});
