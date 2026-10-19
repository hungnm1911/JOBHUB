import { describe, expect, it, vi } from "vitest";

import { createJobExtractor } from "../src/normalization/job-extraction.js";

// Expected outcomes are human-labeled for each source Job. The grader compares
// an extraction against those labels only; it never reads the Job description,
// so it measures semantic completeness without re-deriving it from free text.
const EVALUATION_CASES = Object.freeze({
  requiredOptionalResidual: {
    input: {
      jobId: "job-eval-1",
      title: "Backend Developer",
      jobDescription: [
        "Yêu cầu ứng viên:",
        "- Tối thiểu 2 năm kinh nghiệm phát triển backend.",
        "- Thành thạo Node.js.",
        "- Ưu tiên ứng viên biết Docker.",
        "Team đang sử dụng Kubernetes.",
        "Phát triển hệ thống thanh toán cho mảng fintech.",
      ].join("\n"),
      requiredSkills: ["Node.js"],
      fieldCategoryIds: [],
      positionCategoryIds: [],
      experienceLevelId: null,
      employmentType: "FULL_TIME",
      workModes: ["REMOTE"],
      location: null,
    },
    expected: {
      requirements: [
        {
          label: "Node.js",
          anyOf: ["node.js"],
          priority: "REQUIRED",
          references: ["/requiredSkills/0", "/jobDescription"],
        },
        {
          label: "Docker",
          anyOf: ["docker"],
          priority: "OPTIONAL",
          references: ["/jobDescription"],
        },
        {
          label: "2 years backend experience",
          anyOf: ["2 nam kinh nghiem"],
          priority: "REQUIRED",
          references: ["/jobDescription"],
        },
      ],
      minimumExperienceYears: 2,
      conflicts: [],
      uncertainClaims: [],
      residualClaims: [
        { label: "Kubernetes environment", anyOf: ["kubernetes"] },
        { label: "fintech domain", anyOf: ["fintech", "thanh toan"] },
      ],
    },
    reference: {
      requirements: [
        {
          name: "Thành thạo Node.js",
          priority: "REQUIRED",
          references: ["/requiredSkills/0", "/jobDescription"],
        },
        {
          name: "Docker",
          priority: "OPTIONAL",
          references: ["/jobDescription"],
        },
        {
          name: "Tối thiểu 2 năm kinh nghiệm phát triển backend",
          priority: "REQUIRED",
          references: ["/jobDescription"],
        },
      ],
      minimumExperienceYears: { value: 2, references: ["/jobDescription"] },
      employmentType: { value: "FULL_TIME", references: ["/employmentType"] },
      workModes: [{ value: "REMOTE", references: ["/workModes/0"] }],
      residualClaims: [
        { value: "Team đang sử dụng Kubernetes", references: ["/jobDescription"] },
        {
          value: "Phát triển hệ thống thanh toán cho mảng fintech",
          references: ["/jobDescription"],
        },
      ],
      uncertainClaims: [],
      conflictingClaims: [],
    },
  },
  ambiguityAndConflict: {
    input: {
      jobId: "job-eval-2",
      title: "Data Engineer",
      jobDescription: [
        "Công việc: xây dựng API cho hệ thống bán lẻ.",
        "Kỹ năng: SQL.",
        "Có kinh nghiệm làm việc với hệ thống lớn.",
        "Yêu cầu tối thiểu 1 năm kinh nghiệm.",
        "Yêu cầu tối thiểu 3 năm kinh nghiệm.",
      ].join("\n"),
      requiredSkills: [],
      fieldCategoryIds: [],
      positionCategoryIds: [],
      experienceLevelId: null,
      employmentType: null,
      workModes: [],
      location: null,
    },
    expected: {
      requirements: [
        {
          label: "SQL",
          anyOf: ["sql"],
          priority: null,
          references: ["/jobDescription"],
        },
      ],
      minimumExperienceYears: null,
      conflicts: [
        { label: "minimum experience", claims: [["1 nam"], ["3 nam"]] },
      ],
      uncertainClaims: [
        { label: "vague experience", anyOf: ["he thong lon"] },
      ],
      residualClaims: [
        { label: "API responsibility", anyOf: ["api"] },
      ],
    },
    reference: {
      requirements: [
        { name: "SQL", priority: null, references: ["/jobDescription"] },
      ],
      minimumExperienceYears: null,
      employmentType: null,
      workModes: [],
      residualClaims: [
        {
          value: "Xây dựng API cho hệ thống bán lẻ",
          references: ["/jobDescription"],
        },
      ],
      uncertainClaims: [
        {
          value: "Có kinh nghiệm làm việc với hệ thống lớn",
          references: ["/jobDescription"],
        },
      ],
      conflictingClaims: [{
        subject: "minimumExperienceYears",
        claims: [
          { value: "Tối thiểu 1 năm kinh nghiệm", references: ["/jobDescription"] },
          { value: "Tối thiểu 3 năm kinh nghiệm", references: ["/jobDescription"] },
        ],
      }],
    },
  },
});

const normalizeLabelText = (value) => {
  return String(value)
    .normalize("NFKD")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
};

const matchesLabel = (text, anyOf) => {
  const normalized = normalizeLabelText(text);

  return anyOf.some((phrase) => normalized.includes(phrase));
};

const gradeJobExtraction = (extraction, expected) => {
  const issues = [];

  expected.requirements.forEach(({ label, anyOf, priority, references }) => {
    const requirement = extraction.requirements
      .find(({ name }) => matchesLabel(name, anyOf));

    if (!requirement) {
      issues.push(`missing requirement: ${label}`);
      return;
    }

    if (requirement.priority !== priority) {
      issues.push(
        `priority of ${label}: expected ${priority}, got ${requirement.priority}`,
      );
    }

    references
      .filter((pointer) => !requirement.references.includes(pointer))
      .forEach((pointer) => {
        issues.push(`requirement ${label} lost reference ${pointer}`);
      });
  });

  const minimumExperienceYears = extraction.minimumExperienceYears?.value ?? null;

  if (minimumExperienceYears !== expected.minimumExperienceYears) {
    issues.push(
      `minimumExperienceYears: expected ${expected.minimumExperienceYears}, got ${minimumExperienceYears}`,
    );
  }

  expected.conflicts.forEach(({ label, claims }) => {
    const preserved = extraction.conflictingClaims.some((conflict) => {
      return claims.every((anyOf) => {
        return conflict.claims.some(({ value }) => matchesLabel(value, anyOf));
      });
    });

    if (!preserved) {
      issues.push(`missing conflict: ${label}`);
    }
  });

  [
    ["uncertain claim", expected.uncertainClaims, extraction.uncertainClaims],
    ["residual claim", expected.residualClaims, extraction.residualClaims],
  ].forEach(([kind, expectedClaims, actualClaims]) => {
    expectedClaims.forEach(({ label, anyOf }) => {
      if (!actualClaims.some(({ value }) => matchesLabel(value, anyOf))) {
        issues.push(`missing ${kind}: ${label}`);
      }
    });
  });

  return issues;
};

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
    ["the description reference lost when merging a skill tag", "requiredOptionalResidual", (extraction) => {
      extraction.requirements[0].references = ["/requiredSkills/0"];
    }, "requirement Node.js lost reference /jobDescription"],
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
