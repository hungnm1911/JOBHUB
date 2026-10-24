import { describe, expect, it } from "vitest";

import { calculateWeightedMatchScore } from "../src/matching/weighted-match-scoring.js";

const fields = {
  categoryScore: 70,
  experienceScore: 75,
  employmentTypeScore: 0,
  workModeScore: 100,
};

const group = (priority, semanticScore, evidence = []) => ({
  priority,
  semanticScore,
  evidence,
});

const calculate = (requirementGroups, fieldScores = fields) => (
  calculateWeightedMatchScore({ requirementGroups }, fieldScores)
);

describe("AI-V03 F04 skills aggregation and weighted Match Score", () => {
  it("averages each priority group once, then applies the fixed 80/20 and 40/25/25/5/5 weights", () => {
    const assessment = {
      requirementGroups: [
        group("REQUIRED", 100, ["CV skill", "CV project"]),
        group("REQUIRED", 0),
        group("PREFERRED", 100),
        group("UNSPECIFIED", 100),
      ],
    };
    const before = structuredClone(assessment);

    expect(calculateWeightedMatchScore(assessment, fields)).toEqual({
      matchScore: 65.25,
      skillsScore: 60,
      ...fields,
      weights: {
        skills: 0.4,
        category: 0.25,
        experience: 0.25,
        employmentType: 0.05,
        workMode: 0.05,
      },
      contributions: {
        skills: 24,
        category: 17.5,
        experience: 18.75,
        employmentType: 0,
        workMode: 5,
      },
    });
    expect(assessment).toEqual(before);
  });

  it.each([
    [[group("REQUIRED", 100), group("REQUIRED", 0)], 50],
    [[group("PREFERRED", 100), group("UNSPECIFIED", 0)], 50],
    [[], 0],
  ])("assigns the full Skills weight to the only populated group, or zero to none", (
    requirementGroups, skillsScore,
  ) => {
    const result = calculate(requirementGroups);

    expect(result.skillsScore).toBe(skillsScore);
    expect(result.contributions.skills).toBe(skillsScore * 0.4);
    expect(result.matchScore).toBe(skillsScore * 0.4 + 41.25);
  });

  it("counts one requirement once despite repeated evidence", () => {
    const oneEvidence = calculate([group("REQUIRED", 80, ["one"])]);
    const repeatedEvidence = calculate([group("REQUIRED", 80, ["one", "two", "three"])]);

    expect(repeatedEvidence).toEqual(oneEvidence);
  });

  it("does not let additional lower-priority requirements raise that group's 20% weight", () => {
    const result = calculate([
      group("REQUIRED", 100),
      group("PREFERRED", 0),
      group("UNSPECIFIED", 0),
      group("PREFERRED", 0),
    ]);

    expect(result.skillsScore).toBe(80);
  });

  it("keeps all field weights when a field score is zero", () => {
    expect(calculate([], {
      categoryScore: 0,
      experienceScore: 0,
      employmentTypeScore: 0,
      workModeScore: 0,
    }).matchScore).toBe(0);
    expect(calculate([], fields).matchScore).toBe(41.25);
  });

  it.each([
    [null, fields],
    [[group("REQUIRED", 35)], fields],
    [[group("UNKNOWN", 80)], fields],
    [[], { ...fields, categoryScore: undefined }],
  ])("rejects incomplete scoring inputs instead of returning a Match Score", (
    requirementGroups, fieldScores,
  ) => {
    expect(() => calculate(requirementGroups, fieldScores)).toThrow(TypeError);
  });
});
