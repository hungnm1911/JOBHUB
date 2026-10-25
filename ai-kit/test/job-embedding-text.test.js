import { describe, expect, it } from "vitest";

import { normalizeJob } from "../src/normalization/job-normalization.js";
import { buildJobEmbeddingText } from "../src/recommendation/job-embedding-text.js";

const source = () => ({
  jobId: "job-1",
  title: "  Backend Engineer  ",
  jobDescription: "Build  APIs.\nWork with teams.",
  requiredSkills: ["Node.js", "MongoDB", "node.js"],
  salary: null,
  fieldCategoryIds: ["field-1"],
  positionCategoryIds: ["position-1"],
  experienceLevelId: "level-1",
  employmentType: "FULL_TIME",
  workModes: ["REMOTE"],
  location: null,
  taxonomy: {
    categories: [
      { id: "position-1", name: "Backend Developer", level: "POSITION", parentCategoryId: "field-1" },
      { id: "field-1", name: "Technology", level: "FIELD", parentCategoryId: null },
    ],
    experienceLevel: { id: "level-1", code: "ONE_TO_THREE_YEARS" },
  },
});

describe("AI-V05 Job embedding text", () => {
  it("formats only approved semantic values from a READY profile in stable order", () => {
    const result = normalizeJob(source());
    const text = buildJobEmbeddingText(result);

    expect(text).toBe([
      "Job Title: Backend Engineer",
      "Career Fields: Technology",
      "Career Positions: Backend Developer",
      "Required Skills: Node.js, MongoDB",
      "Job Description: Build APIs. Work with teams.",
      "Experience Level: 1 to 3 years of experience",
    ].join("\n"));
    expect(text).not.toMatch(/job-1|field-1|level-1|FULL_TIME|REMOTE|sourcePath/);
    expect(buildJobEmbeddingText(result)).toBe(text);
  });

  it("omits absent values and rejects non-READY normalization", () => {
    const sparse = source();
    Object.assign(sparse, {
      title: null,
      jobDescription: null,
      requiredSkills: [],
      fieldCategoryIds: [],
      positionCategoryIds: [],
      experienceLevelId: null,
      taxonomy: { categories: [], experienceLevel: null },
    });

    expect(buildJobEmbeddingText(normalizeJob(sparse))).toBe("");
    expect(() => buildJobEmbeddingText({ status: "FAILED", profile: null })).toThrow(TypeError);
  });
});
