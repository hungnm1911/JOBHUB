import { describe, expect, it } from "vitest";

import { LANGUAGE_PROFICIENCIES } from "../src/normalization/cv-normalization.js";
import {
  OPTIMIZATION_RESULT_SCHEMA,
  parseOptimizationResult,
} from "../src/optimization/optimization-result.js";

const emptyResult = () => ({
  professionalSummary: null,
  skills: null,
  workExperiences: null,
  projects: null,
  educations: null,
  certifications: null,
  languages: null,
});
const parse = (value) => parseOptimizationResult(JSON.stringify(value));
const expectInvalid = (value, path) => {
  expect(() => parse(value)).toThrowError(expect.objectContaining({
    code: "INVALID_OPTIMIZATION_RESULT",
    details: expect.arrayContaining([expect.stringContaining(path)]),
  }));
};

describe("AI-V06 Optimization Result contract", () => {
  it("accepts a completed all-null result and preserves null replacement markers", () => {
    expect(parse(emptyResult())).toEqual(emptyResult());
  });

  it("accepts empty replacement lists and full V7 item vocabulary", () => {
    const result = {
      professionalSummary: "Summary",
      skills: ["TypeScript", ""],
      workExperiences: [{ companyName: "Acme", position: null,
        startDate: "2020-01-01", endDate: null, description: "Built a service",
        achievements: ["Shipped it"] }],
      projects: [{ name: "Portal", role: null, technologies: [], description: null,
        projectUrl: null }],
      educations: [{ institutionName: null, degree: "BS", fieldOfStudy: null,
        startDate: null, endDate: "2024-01-01T00:00:00.000Z" }],
      certifications: [{ name: null, issuer: null, issueDate: null,
        expirationDate: null, credentialId: null, credentialUrl: null }],
      languages: [{ name: "Vietnamese", proficiency: null }],
    };
    expect(parse(result)).toEqual(result);
    for (const field of Object.keys(emptyResult()).filter((key) => key !== "professionalSummary")) {
      expect(parse({ ...emptyResult(), [field]: [] })[field]).toEqual([]);
    }
    for (const proficiency of LANGUAGE_PROFICIENCIES) {
      expect(parse({ ...emptyResult(), languages: [{ name: null, proficiency }] })
        .languages[0].proficiency).toBe(proficiency);
    }
  });

  it("rejects malformed JSON, missing and extra sections, and wrong section types", () => {
    expect(() => parseOptimizationResult("{"))
      .toThrowError(expect.objectContaining({ code: "INVALID_OPTIMIZATION_RESULT" }));
    expectInvalid({ ...emptyResult(), personalInfo: {} }, "/personalInfo");
    const missingSkills = emptyResult();
    delete missingSkills.skills;
    expectInvalid(missingSkills, "/skills");
    expectInvalid({ ...emptyResult(), professionalSummary: [] }, "/professionalSummary");
    expectInvalid({ ...emptyResult(), skills: [null] }, "/skills/0");
    expectInvalid({ ...emptyResult(), projects: {} }, "/projects");
    expectInvalid({ ...emptyResult(), educations: [null] }, "/educations/0");
  });

  it("rejects missing and extra item fields, wrong scalar/list types, and unknown enum", () => {
    expectInvalid({ ...emptyResult(), languages: [{ name: "English" }] }, "/languages/0/proficiency");
    expectInvalid({ ...emptyResult(), languages: [{ name: "English", proficiency: "EXPERT" }] },
      "/languages/0/proficiency");
    expectInvalid({ ...emptyResult(), languages: [{ name: "English", proficiency: null, id: 1 }] },
      "/languages/0/id");
    expectInvalid({ ...emptyResult(), workExperiences: [{ companyName: null, position: null,
      startDate: 2020, endDate: null, description: null, achievements: [] }] },
    "/workExperiences/0/startDate");
    expectInvalid({ ...emptyResult(), workExperiences: [{ companyName: null, position: null,
      startDate: "2020-02-30", endDate: null, description: null, achievements: [] }] },
    "/workExperiences/0/startDate");
    expectInvalid({ ...emptyResult(), projects: [{ name: null, role: null,
      technologies: null, description: null, projectUrl: null }] },
    "/projects/0/technologies");
    expectInvalid({ ...emptyResult(), certifications: [{ name: null, issuer: null,
      issueDate: null, expirationDate: null, credentialId: null, credentialUrl: false }] },
    "/certifications/0/credentialUrl");
  });

  it("uses only provider-native strict JSON schema keywords with required fields at every object", () => {
    const visit = (schema) => {
      expect(Object.keys(schema).every((key) => ["type", "properties", "required",
        "additionalProperties", "items", "enum"].includes(key))).toBe(true);
      if (schema.properties) {
        expect(schema.additionalProperties).toBe(false);
        expect(schema.required).toEqual(Object.keys(schema.properties));
        Object.values(schema.properties).forEach(visit);
      }
      if (schema.items) visit(schema.items);
    };
    visit(OPTIMIZATION_RESULT_SCHEMA);
    expect(Object.keys(OPTIMIZATION_RESULT_SCHEMA.properties)).toEqual(Object.keys(emptyResult()));
  });
});
