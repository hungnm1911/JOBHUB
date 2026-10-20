import { describe, expect, it, vi } from "vitest";

import { createJobExtractor } from "../src/normalization/job-extraction.js";
import {
  EVALUATION_CASES,
  gradeJobExtraction,
} from "./support/job-extraction-evaluation.js";

const extractWithMockedOutput = (input, extraction) => {
  const extractor = createJobExtractor({
    gemini: {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify(extraction),
        candidates: [{ finishReason: "STOP" }],
      }),
    },
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  });

  return extractor.extractJob(input);
};

const cloneReference = (caseKey) => {
  return structuredClone(EVALUATION_CASES[caseKey].reference);
};

describe("Job extraction semantic evaluation ledger", () => {
  it.each(Object.keys(EVALUATION_CASES))(
    "accepts and fully grades the labeled reference extraction for %s",
    async (caseKey) => {
      const { input, expected, reference } = EVALUATION_CASES[caseKey];

      await expect(extractWithMockedOutput(input, reference))
        .resolves.toEqual(reference);
      expect(gradeJobExtraction(reference, expected)).toEqual([]);
    },
  );

  it.each([
    ["a JD-only requirement omitted", "requiredOptionalResidual", (extraction) => {
      extraction.requirements.splice(1, 1);
    }, "missing requirement: Docker"],
    ["an OPTIONAL requirement downgraded to null priority", "requiredOptionalResidual", (extraction) => {
      extraction.requirements[1].priority = null;
    }, "priority of Docker: expected OPTIONAL, got null"],
    ["an ambiguous priority strengthened to REQUIRED", "ambiguityAndConflict", (extraction) => {
      extraction.requirements[0].priority = "REQUIRED";
    }, "priority of SQL: expected null, got REQUIRED"],
    ["a description conflict omitted", "ambiguityAndConflict", (extraction) => {
      extraction.conflictingClaims = [];
    }, "missing conflict: minimum experience"],
    ["a description conflict resolved into one fact", "ambiguityAndConflict", (extraction) => {
      extraction.conflictingClaims = [];
      extraction.minimumExperienceYears = { value: 3, references: ["/jobDescription"] };
    }, "minimumExperienceYears: expected null, got 3"],
    ["a vague statement dropped instead of kept uncertain", "ambiguityAndConflict", (extraction) => {
      extraction.uncertainClaims = [];
    }, "missing uncertain claim: vague experience"],
    ["a residual claim omitted", "requiredOptionalResidual", (extraction) => {
      extraction.residualClaims.splice(1, 1);
    }, "missing residual claim: fintech domain"],
    ["a skill-tag association lost", "requiredOptionalResidual", (extraction) => {
      extraction.requirements[0].references = ["/jobDescription"];
    }, "requirement Node.js lost reference /requiredSkills/0"],
    ["a lexical employment-type false positive", "lexicalTrapsWithoutMetadata", (extraction) => {
      extraction.employmentType = { value: "INTERNSHIP", references: ["/jobDescription"] };
    }, "employmentType: expected null, got INTERNSHIP"],
    ["a lexical work-mode false positive", "lexicalTrapsWithoutMetadata", (extraction) => {
      extraction.workModes = [{ value: "HYBRID", references: ["/jobDescription"] }];
    }, "workModes: expected [], got [HYBRID]"],
    ["a negated work mode mapped as stated", "lexicalTrapsWithStructuredType", (extraction) => {
      extraction.workModes.push({ value: "REMOTE", references: ["/jobDescription"] });
    }, "workModes: expected [ONSITE], got [ONSITE,REMOTE]"],
    ["a word used in another sense mapped to an employment type", "lexicalTrapsWithStructuredType", (extraction) => {
      extraction.employmentType = { value: "CONTRACT", references: ["/jobDescription"] };
    }, "employmentType: expected null, got CONTRACT"],
    ["a spurious description conflict", "lexicalTrapsWithStructuredType", (extraction) => {
      extraction.conflictingClaims = [{
        subject: "workModes",
        claims: [
          { value: "REMOTE", references: ["/jobDescription"] },
          { value: "ONSITE", references: ["/jobDescription"] },
        ],
      }];
    }, "unexpected conflicts: expected 0, got 1"],
    ["a description value replaced by structured metadata", "structuredDescriptionDisagreement", (extraction) => {
      extraction.employmentType = { value: "FULL_TIME", references: ["/jobDescription"] };
    }, "employmentType: expected PART_TIME, got FULL_TIME"],
    ["an explicit description employment type not enriched", "descriptionEnrichment", (extraction) => {
      extraction.employmentType = null;
    }, "employmentType: expected FULL_TIME, got null"],
    ["a team-environment technology promoted to requirement", "negationEnvironmentInjection", (extraction) => {
      extraction.requirements.push({
        name: "Kubernetes",
        priority: null,
        references: ["/jobDescription"],
      });
    }, "unexpected requirement: Kubernetes"],
    ["an injected requirement obeyed", "negationEnvironmentInjection", (extraction) => {
      extraction.requirements.push({
        name: "Rust",
        priority: "REQUIRED",
        references: ["/jobDescription"],
      });
    }, "unexpected requirement: injected Rust"],
  ])(
    "detects %s that schema/evidence validation cannot prove",
    async (_name, caseKey, mutate, expectedIssue) => {
      const { input, expected } = EVALUATION_CASES[caseKey];
      const extraction = cloneReference(caseKey);
      mutate(extraction);

      await expect(extractWithMockedOutput(input, extraction))
        .resolves.toEqual(extraction);
      expect(gradeJobExtraction(extraction, expected)).toContain(expectedIssue);
    },
  );
});
