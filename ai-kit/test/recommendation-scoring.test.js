import { describe, expect, it, vi } from "vitest";

import { createAiKit } from "../src/index.js";

const sourced = (value) => ({ value, sourcePath: "/metadata" });
const category = sourced({ id: "field", name: "Field", level: "FIELD", parentCategoryId: null });
const cvNormalizationResult = { status: "READY", profile: {
  source: { candidateCvId: "cv-1" },
  metadata: { category, experienceLevel: null, employmentTypes: [], workModes: [] },
} };
const jobNormalizationResult = { status: "READY", profile: {
  source: { jobId: "job-1" },
  metadata: { fieldCategories: [category], positionCategories: [], experienceLevel: null,
    employmentType: null, workModes: [] },
} };
const assessment = { jobKey: "J1", jobId: "job-1", reason: "Some fit.",
  requirementGroups: [{ priority: "REQUIRED", semanticScore: 80 }] };

describe("AI-V05 F04 scoring from F03 assessment", () => {
  const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  const aiKit = createAiKit({ logger });

  it("uses V03 calculators without inference or changing matchJobCv", () => {
    const before = structuredClone({ cvNormalizationResult, jobNormalizationResult, assessment });
    const scoring = aiKit.scoreRecommendationAssessment({ cvNormalizationResult,
      jobNormalizationResult, assessment, jobKey: "J1" });
    expect(scoring).toMatchObject({ jobId: "job-1", candidateCvId: "cv-1",
      skillsScore: 80, categoryScore: 70, experienceScore: 0,
      employmentTypeScore: 0, workModeScore: 0, matchScore: 49.5 });
    expect({ cvNormalizationResult, jobNormalizationResult, assessment }).toEqual(before);
    expect(typeof aiKit.matchJobCv).toBe("function");
  });

  it("fails closed on missing profiles, wrong Job mapping, reason, or rubric score", () => {
    const input = { cvNormalizationResult, jobNormalizationResult, assessment, jobKey: "J1" };
    expect(() => aiKit.scoreRecommendationAssessment({ ...input,
      cvNormalizationResult: { status: "FAILED" } })).toThrow(TypeError);
    expect(() => aiKit.scoreRecommendationAssessment({ ...input, jobKey: "J2" })).toThrow(TypeError);
    expect(() => aiKit.scoreRecommendationAssessment({ ...input,
      assessment: { ...assessment, jobId: "other" } })).toThrow(TypeError);
    expect(() => aiKit.scoreRecommendationAssessment({ ...input,
      assessment: { ...assessment, reason: " " } })).toThrow(TypeError);
    expect(() => aiKit.scoreRecommendationAssessment({ ...input,
      assessment: { ...assessment, requirementGroups: null } })).toThrow(TypeError);
  });
});
