import { describe, expect, it } from "vitest";

import { scoreDeterministicFields } from "../src/matching/deterministic-field-scoring.js";

const sourced = (value) => ({ value, sourcePath: "/metadata" });
const field = (id) => sourced({ id, name: id, level: "FIELD", parentCategoryId: null });
const position = (id, parentCategoryId) => sourced({
  id,
  name: id,
  level: "POSITION",
  parentCategoryId,
});
const experience = (code) => code === null ? null : sourced({ id: code, code });

const jobProfile = (overrides = {}) => ({
  source: { type: "JOB", jobId: "job-1" },
  metadata: {
    fieldCategories: [field("engineering")],
    positionCategories: [position("backend", "engineering")],
    experienceLevel: experience("ONE_TO_THREE_YEARS"),
    employmentType: sourced("FULL_TIME"),
    workModes: [sourced("ONSITE"), sourced("HYBRID")],
    ...overrides,
  },
});

const cvProfile = (overrides = {}, type = "GENERATED_CV") => ({
  source: { type, candidateCvId: "cv-1" },
  metadata: {
    category: position("backend", "engineering"),
    experienceLevel: experience("ONE_TO_THREE_YEARS"),
    employmentTypes: [sourced("FULL_TIME")],
    workModes: [sourced("HYBRID")],
    ...overrides,
  },
});

const score = (job = jobProfile(), cv = cvProfile()) => (
  scoreDeterministicFields(job, cv)
);

describe("AI-V03 F03 deterministic field scoring", () => {
  it("scores an exact position and matching metadata at 100 without changing profiles", () => {
    const job = jobProfile();
    const cv = cvProfile();
    const jobBefore = structuredClone(job);
    const cvBefore = structuredClone(cv);

    expect(score(job, cv)).toEqual({
      categoryScore: 100,
      experienceScore: 100,
      employmentTypeScore: 100,
      workModeScore: 100,
    });
    expect(job).toEqual(jobBefore);
    expect(cv).toEqual(cvBefore);
  });

  it.each(["GENERATED_CV", "UPLOADED_CV"])(
    "uses only declared metadata for %s profiles",
    (type) => {
      const cv = cvProfile({
        experienceLevel: null,
        employmentTypes: [],
        workModes: [],
      }, type);
      cv.pdfContent = { careerPositioning: ["FULL_TIME, HYBRID, 10 years"] };

      expect(score(jobProfile(), cv)).toEqual({
        categoryScore: 100,
        experienceScore: 0,
        employmentTypeScore: 0,
        workModeScore: 0,
      });
    },
  );

  it.each([
    [field("engineering"), 70],
    [position("devops", "engineering"), 50],
    [field("healthcare"), 0],
    [position("nurse", "healthcare"), 0],
  ])("scores CV category %o by canonical FIELD and POSITION relations", (category, expected) => {
    expect(score(jobProfile(), cvProfile({ category })).categoryScore).toBe(expected);
  });

  it("chooses the highest relation across multiple Job categories without adding scores", () => {
    const job = jobProfile({
      fieldCategories: [field("engineering"), field("healthcare")],
      positionCategories: [
        position("backend", "engineering"),
        position("nurse", "healthcare"),
      ],
    });

    expect(score(job, cvProfile({ category: position("nurse", "healthcare") })).categoryScore)
      .toBe(100);
    expect(score(job, cvProfile({ category: position("doctor", "healthcare") })).categoryScore)
      .toBe(50);
  });

  it("scores a CV FIELD against a Job POSITION's parent FIELD", () => {
    const job = jobProfile({ fieldCategories: [] });

    expect(score(job, cvProfile({ category: field("engineering") })).categoryScore).toBe(70);
  });

  it("scores a CV POSITION within a Job FIELD when no Job POSITION is declared", () => {
    const job = jobProfile({ positionCategories: [] });

    expect(score(job, cvProfile({ category: position("devops", "engineering") })).categoryScore)
      .toBe(50);
  });

  it("scores a sparse Job's missing category and experience at zero", () => {
    const job = jobProfile({
      fieldCategories: [],
      positionCategories: [],
      experienceLevel: null,
      employmentType: null,
      workModes: [],
    });

    expect(score(job)).toEqual({
      categoryScore: 0,
      experienceScore: 0,
      employmentTypeScore: 0,
      workModeScore: 0,
    });
  });

  it.each([
    ["NO_EXPERIENCE", 0],
    ["UNDER_1_YEAR", 0],
    ["ONE_TO_THREE_YEARS", 100],
    ["THREE_TO_FIVE_YEARS", 75],
    ["FIVE_TO_TEN_YEARS", 40],
    ["OVER_TEN_YEARS", 15],
  ])("scores CV experience %s against the Job's canonical level", (code, expected) => {
    expect(score(jobProfile(), cvProfile({ experienceLevel: experience(code) })).experienceScore)
      .toBe(expected);
  });

  it("scores four or more levels above Job at zero and missing CV level at zero", () => {
    const job = jobProfile({ experienceLevel: experience("NO_EXPERIENCE") });

    expect(score(job, cvProfile({ experienceLevel: experience("FIVE_TO_TEN_YEARS") }))
      .experienceScore).toBe(0);
    expect(score(job, cvProfile({ experienceLevel: null })).experienceScore).toBe(0);
  });

  it("uses exact employment membership and any shared Work Mode", () => {
    expect(score(jobProfile(), cvProfile({
      employmentTypes: [sourced("CONTRACT"), sourced("FULL_TIME")],
      workModes: [sourced("REMOTE"), sourced("ONSITE")],
    }))).toMatchObject({ employmentTypeScore: 100, workModeScore: 100 });

    expect(score(jobProfile(), cvProfile({
      employmentTypes: [sourced("PART_TIME")],
      workModes: [sourced("REMOTE")],
    }))).toMatchObject({ employmentTypeScore: 0, workModeScore: 0 });
  });
});
