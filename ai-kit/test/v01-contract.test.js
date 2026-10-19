import { access, readFile } from "node:fs/promises";

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const contract = JSON.parse(
  await readFile(new URL("../v01-contract.json", import.meta.url), "utf8"),
);

const ajv = new Ajv2020({ allErrors: true, strict: true });

for (const keyword of [
  "x-version",
  "x-persistence",
  "x-authority",
  "x-stage-contracts",
  "x-semantic-constraints",
]) {
  ajv.addKeyword({ keyword });
}

const compileDefinition = (definitionName) => {
  return ajv.compile({
    $schema: contract.$schema,
    $defs: contract.$defs,
    $ref: `#/$defs/${definitionName}`,
  });
};

const validators = Object.fromEntries(
  [
    "EmploymentType",
    "WorkMode",
    "LanguageProficiency",
    "HiddenSection",
    "EvidenceClaim",
    "References",
    "JobRawInput",
    "CVRawInput",
    "JobExtractionResult",
    "CVExtractionResult",
    "JobMatchProfile",
    "CVMatchProfile",
    "NormalizationResult",
  ].map((definitionName) => [
    definitionName,
    compileDefinition(definitionName),
  ]),
);

const expectValid = (validator, value) => {
  expect(
    validator(value),
    ajv.errorsText(validator.errors, { separator: "\n" }),
  ).toBe(true);
};

const expectInvalid = (validator, value) => {
  expect(validator(value)).toBe(false);
};

const makeJobRawInput = () => ({
  jobId: "job-1",
  title: "Backend Engineer",
  jobDescription: "Node.js is required. Remote is optional.",
  requiredSkills: ["Node.js"],
  fieldCategoryIds: ["field-1"],
  positionCategoryIds: ["position-1"],
  experienceLevelId: null,
  employmentType: "FULL_TIME",
  workModes: ["REMOTE"],
  location: {
    provinceCode: "01",
    districtCode: null,
  },
});

const makeCVRawInput = () => ({
  cvId: "cv-1",
  sourceType: "GENERATED",
  categoryId: "category-1",
  experienceLevelId: null,
  skillTags: ["Node.js"],
  employmentTypes: ["FULL_TIME"],
  workModes: ["REMOTE"],
  preferredLocations: [
    {
      provinceCode: "01",
      districtCode: null,
    },
  ],
  generatedContent: {
    professionalSummary: "Backend engineer.",
    educations: [
      {
        institutionName: "Example University",
        degree: "Bachelor",
        fieldOfStudy: null,
        startDate: null,
        endDate: null,
      },
    ],
    skills: ["Node.js"],
    workExperiences: [
      {
        companyName: "Example Company",
        position: "Engineer",
        startDate: null,
        endDate: null,
        description: "Built APIs.",
        achievements: [],
      },
    ],
    projects: [
      {
        name: "Example Project",
        role: null,
        description: null,
        technologies: ["Node.js"],
        projectUrl: null,
      },
    ],
    certifications: [
      {
        name: "Example Certificate",
        issuer: null,
        issueDate: null,
        expirationDate: null,
        credentialId: null,
        credentialUrl: null,
      },
    ],
    languages: [
      {
        name: "English",
        proficiency: "ADVANCED",
      },
    ],
    hiddenSections: ["projects"],
  },
});

const makeJobExtractionResult = () => ({
  requirements: [
    {
      name: "Node.js",
      priority: "REQUIRED",
      references: ["/jobDescription"],
    },
    {
      name: "Cloud certification",
      priority: null,
      references: ["/jobDescription"],
    },
  ],
  minimumExperienceYears: {
    value: 3,
    references: ["/jobDescription"],
  },
  employmentType: {
    value: "FULL_TIME",
    references: ["/employmentType"],
  },
  workModes: [
    {
      value: "REMOTE",
      references: ["/workModes/0", "/jobDescription"],
    },
  ],
  residualClaims: [
    {
      value: "Team collaboration context",
      references: ["/jobDescription"],
    },
  ],
  uncertainClaims: [
    {
      value: "Occasional office attendance",
      references: ["/jobDescription"],
    },
  ],
  conflictingClaims: [
    {
      subject: "work mode",
      claims: [
        {
          value: "REMOTE",
          references: ["/workModes/0"],
        },
        {
          value: "ONSITE",
          references: ["/jobDescription"],
        },
      ],
    },
  ],
});

const makeCVExtractionResult = () => ({
  professionalSummary: {
    value: "Backend engineer",
    references: ["/generatedContent/professionalSummary"],
  },
  skills: [
    {
      value: "Node.js",
      references: ["/generatedContent/skills/0"],
    },
  ],
  declaredExperienceClaims: [
    {
      value: "Three years of backend experience",
      references: ["/generatedContent/workExperiences/0/description"],
    },
  ],
  residualClaims: [
    {
      value: "CEFR B2",
      references: ["/generatedContent/professionalSummary"],
    },
  ],
  uncertainClaims: [
    {
      value: "Several years of Node.js",
      references: ["/generatedContent/professionalSummary"],
    },
  ],
  conflictingClaims: [
    {
      subject: "experience duration",
      claims: [
        {
          value: "Three years",
          references: ["/generatedContent/professionalSummary"],
        },
        {
          value: "Five years",
          references: [
            "/generatedContent/workExperiences/0/description",
          ],
        },
      ],
    },
  ],
});

const makeJobMatchProfile = () => ({
  jobId: "job-1",
  title: "Backend Engineer",
  positioning: {
    fieldCategoryIds: ["field-1"],
    positionCategoryIds: ["position-1"],
    declaredExperienceLevelId: null,
  },
  employmentType: "FULL_TIME",
  workModes: ["REMOTE"],
  location: {
    provinceCode: "01",
    districtCode: null,
  },
  minimumExperienceYears: 3,
  requirements: [
    {
      name: "Node.js",
      priority: "REQUIRED",
      references: ["/requiredSkills/0", "/jobDescription"],
    },
  ],
  residualClaims: [
    {
      value: "Team collaboration context",
      references: ["/jobDescription"],
    },
  ],
  uncertainClaims: [],
  conflictingClaims: [
    {
      subject: "work mode",
      claims: [
        {
          value: "REMOTE",
          references: ["/workModes/0"],
        },
        {
          value: "ONSITE",
          references: ["/jobDescription"],
        },
      ],
    },
  ],
  evidence: [
    {
      claimPath: "/jobId",
      references: ["/jobId"],
    },
    {
      claimPath: "/title",
      references: ["/title"],
    },
  ],
});

const makeSparseJobMatchProfile = () => ({
  jobId: "job-1",
  title: null,
  positioning: {
    fieldCategoryIds: [],
    positionCategoryIds: [],
    declaredExperienceLevelId: null,
  },
  employmentType: null,
  workModes: [],
  location: null,
  minimumExperienceYears: null,
  requirements: [],
  residualClaims: [],
  uncertainClaims: [],
  conflictingClaims: [],
  evidence: [
    {
      claimPath: "/jobId",
      references: ["/jobId"],
    },
  ],
});

const makeCVMatchProfile = () => ({
  cvId: "cv-1",
  positioning: {
    categoryId: "category-1",
    declaredExperienceLevelId: null,
  },
  professionalSummary: "Backend engineer.",
  qualifications: {
    skills: [
      {
        name: "Node.js",
        references: [
          "/skillTags/0",
          "/generatedContent/skills/0",
        ],
      },
    ],
    educations: [
      {
        institutionName: "Example University",
        degree: "Bachelor",
        fieldOfStudy: null,
        startDate: null,
        endDate: null,
        references: ["/generatedContent/educations/0"],
      },
    ],
    certifications: [
      {
        name: "Example Certificate",
        issuer: null,
        issueDate: null,
        expirationDate: null,
        credentialId: null,
        credentialUrl: null,
        references: ["/generatedContent/certifications/0"],
      },
    ],
    languages: [
      {
        name: "English",
        proficiency: null,
        rawProficiency: "CEFR B2",
        references: ["/generatedContent/professionalSummary"],
      },
    ],
  },
  workExperiences: [
    {
      companyName: "Example Company",
      position: "Engineer",
      startDate: null,
      endDate: null,
      description: "Built APIs.",
      achievements: [],
      references: ["/generatedContent/workExperiences/0"],
    },
  ],
  projects: [
    {
      name: "Example Project",
      role: null,
      description: null,
      technologies: ["Node.js"],
      projectUrl: null,
      references: ["/generatedContent/projects/0"],
    },
  ],
  declaredExperienceClaims: [
    {
      value: "Three years of backend experience",
      references: ["/generatedContent/workExperiences/0/description"],
    },
  ],
  preferences: {
    preferredLocations: [
      {
        provinceCode: "01",
        districtCode: null,
      },
    ],
    employmentTypes: ["FULL_TIME"],
    workModes: ["REMOTE"],
  },
  hiddenSections: ["projects"],
  residualClaims: [
    {
      value: "Unmapped career claim",
      references: ["/generatedContent/professionalSummary"],
    },
  ],
  uncertainClaims: [
    {
      value: "Several years of Node.js",
      references: ["/generatedContent/professionalSummary"],
    },
  ],
  conflictingClaims: [
    {
      subject: "experience duration",
      claims: [
        {
          value: "Three years",
          references: ["/generatedContent/professionalSummary"],
        },
        {
          value: "Five years",
          references: [
            "/generatedContent/workExperiences/0/description",
          ],
        },
      ],
    },
  ],
  evidence: [
    {
      claimPath: "/cvId",
      references: ["/cvId"],
    },
    {
      claimPath: "/positioning/categoryId",
      references: ["/categoryId"],
    },
  ],
});

const STRUCTURALLY_VERIFIED_SEMANTIC_CONSTRAINTS = [
  "Missing data remains null or an empty array and does not by itself prevent READY.",
  "Conflicting and uncertain claims remain represented with source references and do not by themselves prevent READY.",
  "Only GENERATED Candidate CV input is allowed. Uploaded CV/PDF processing and matching/scoring are outside this contract.",
  "The only normalization result statuses are READY and FAILED.",
];

const DEFERRED_RUNTIME_SEMANTIC_CONSTRAINTS = [
  "Every populated normalized claim must resolve to at least one valid source pointer, either through its embedded references or a profile evidence association.",
  "References are JSON Pointer paths into the corresponding JobRawInput or CVRawInput; JSON Schema validates pointer shape but runtime consolidation must validate that each pointer resolves.",
  "Structured metadata is preserved. Job description extraction may fill an empty employmentType or workModes value when evidence and canonical mapping exist, but conflicting source claims must not silently overwrite structured metadata.",
  "Equivalent claims may be consolidated only when all supporting references are retained.",
  "The same Job requirement must resolve to REQUIRED when valid evidence classifies it as both REQUIRED and OPTIONAL; unresolved priority remains null.",
  "Candidate experience remains declared and must not be upgraded to independently verified experience or inferred from skill presence alone.",
  "hiddenSections preserves presentation state and must not be interpreted as absence of the corresponding qualification.",
];

const REQUIREMENT_COVERAGE = Object.freeze({
  F01: {
    level: "PARTIAL",
    verified: "Job raw/extraction/profile/result shapes",
    deferred: "Job normalization and consolidation behavior",
  },
  F02: {
    level: "PARTIAL",
    verified: "Generated CV raw/extraction/profile/result shapes",
    deferred: "Generated CV normalization and consolidation behavior",
  },
  "BR-AI-01": {
    level: "PARTIAL",
    verified: "Non-empty syntactic evidence references",
    deferred: "Reference resolution and evidence sufficiency",
  },
  "BR-AI-02": {
    level: "DEFERRED_RUNTIME",
    verified: "AI extraction remains a separate runtime shape",
    deferred: "Approved consolidation before canonical output",
  },
  "BR-AI-03": {
    level: "STRUCTURAL",
    verified: "Sparse null/empty profile remains READY",
    deferred: null,
  },
  "BR-AI-04": {
    level: "STRUCTURAL",
    verified: "Matching/scoring fields are rejected",
    deferred: null,
  },
  "BR-AI-05": {
    level: "PARTIAL",
    verified: "Candidate claims require evidence-bearing shapes",
    deferred: "Detection of fabricated Candidate facts",
  },
  "BR-AI-06": {
    level: "DEFERRED_DOMAIN",
    verified: "No authorization shape or capability is introduced",
    deferred: "Backend authorization, ownership, visibility, and tenancy",
  },
  "BR-AI-07": {
    level: "PARTIAL",
    verified: "Residual claim representation",
    deferred: "Runtime detection and preservation of all relevant information",
  },
  "BR-AI-08": {
    level: "DEFERRED_RUNTIME",
    verified: "Structured and extracted Job inputs remain distinct shapes",
    deferred: "Metadata preservation, enrichment, and conflict handling",
  },
  "BR-AI-09": {
    level: "PARTIAL",
    verified: "REQUIRED, OPTIONAL, and null priority vocabulary",
    deferred: "REQUIRED-over-OPTIONAL consolidation",
  },
  "BR-AI-10": {
    level: "PARTIAL",
    verified: "Multiple distinct references can accompany one claim",
    deferred: "Evidence-preserving equivalence consolidation",
  },
  "BR-AI-11": {
    level: "PARTIAL",
    verified: "Declared claims exist and verified-experience fields are rejected",
    deferred: "Prevention of experience inference or verification upgrades",
  },
  "BR-AI-12": {
    level: "PARTIAL",
    verified: "Residual claims, raw proficiency, and hidden sections",
    deferred: "Preservation and interpretation behavior",
  },
  "BR-AI-13": {
    level: "PARTIAL",
    verified: "A conflict contains at least two evidence-bearing claims",
    deferred: "Conflict detection and preservation during consolidation",
  },
  "BR-AI-14": {
    level: "STRUCTURAL",
    verified: "READY/FAILED discriminated result shapes and no BLOCKED",
    deferred: null,
  },
});

describe("AI-V01 contract authority and schema integrity", () => {
  it("compiles as Draft 2020-12 and compiles every stage contract", () => {
    expect(() => ajv.compile(contract)).not.toThrow();

    for (const stage of Object.values(contract["x-stage-contracts"])) {
      for (const definitionReference of Object.values(stage)) {
        const definitionName = definitionReference.replace("#/$defs/", "");

        expect(contract.$defs).toHaveProperty(definitionName);
        expect(() => compileDefinition(definitionName)).not.toThrow();
      }
    }
  });

  it("pins the approved version, runtime-only boundary, Fxx, and BR set", () => {
    expect(contract["x-version"]).toBe("AI-V01");
    expect(contract["x-persistence"]).toBe("RUNTIME_ONLY");
    expect(contract["x-authority"].functionalRequirements).toEqual([
      "F01",
      "F02",
    ]);
    expect(contract["x-authority"].businessRules).toEqual(
      Array.from({ length: 14 }, (_value, index) => {
        return `BR-AI-${String(index + 1).padStart(2, "0")}`;
      }),
    );
  });

  it("resolves the canonical Product/Data authority files", async () => {
    const repositoryRoot = new URL("../../", import.meta.url);

    await Promise.all([
      access(new URL(contract["x-authority"].product, repositoryRoot)),
      access(new URL(contract["x-authority"].data, repositoryRoot)),
    ]);
  });

  it("keeps canonical enum vocabularies exact", () => {
    expect(contract.$defs.EmploymentType.enum).toEqual([
      "FULL_TIME",
      "PART_TIME",
      "INTERNSHIP",
      "CONTRACT",
      "TEMPORARY",
      "FREELANCE",
      "SEASONAL",
      "APPRENTICESHIP",
    ]);
    expect(contract.$defs.WorkMode.enum).toEqual([
      "ONSITE",
      "HYBRID",
      "REMOTE",
    ]);
    expect(contract.$defs.LanguageProficiency.enum).toEqual([
      "BEGINNER",
      "INTERMEDIATE",
      "ADVANCED",
      "FLUENT",
      "NATIVE",
    ]);
    expect(contract.$defs.HiddenSection.enum).toEqual([
      "professionalSummary",
      "educations",
      "skills",
      "workExperiences",
      "projects",
      "certifications",
      "languages",
    ]);
  });

  it("classifies every semantic constraint without claiming runtime coverage", () => {
    expect([
      ...STRUCTURALLY_VERIFIED_SEMANTIC_CONSTRAINTS,
      ...DEFERRED_RUNTIME_SEMANTIC_CONSTRAINTS,
    ].sort()).toEqual([...contract["x-semantic-constraints"]].sort());
    expect(STRUCTURALLY_VERIFIED_SEMANTIC_CONSTRAINTS).toHaveLength(4);
    expect(DEFERRED_RUNTIME_SEMANTIC_CONSTRAINTS).toHaveLength(7);
  });

  it("records Fxx/BR coverage and every implementation-time deferral", () => {
    expect(Object.keys(REQUIREMENT_COVERAGE)).toEqual([
      "F01",
      "F02",
      ...Array.from({ length: 14 }, (_value, index) => {
        return `BR-AI-${String(index + 1).padStart(2, "0")}`;
      }),
    ]);
    expect(REQUIREMENT_COVERAGE.F01.deferred).not.toBeNull();
    expect(REQUIREMENT_COVERAGE.F02.deferred).not.toBeNull();
    expect(REQUIREMENT_COVERAGE["BR-AI-06"].level).toBe("DEFERRED_DOMAIN");
    expect(REQUIREMENT_COVERAGE["BR-AI-14"]).toEqual({
      level: "STRUCTURAL",
      verified: "READY/FAILED discriminated result shapes and no BLOCKED",
      deferred: null,
    });
  });
});

describe("AI-V01 raw input contracts", () => {
  it("accepts a structurally complete Job source with canonical metadata", () => {
    expectValid(validators.JobRawInput, makeJobRawInput());
  });

  it.each([
    ["missing required source field", (input) => delete input.title],
    ["non-canonical employment type", (input) => {
      input.employmentType = "PERMANENT";
    }],
    ["duplicate work mode", (input) => {
      input.workModes = ["REMOTE", "REMOTE"];
    }],
    ["malformed location", (input) => {
      input.location = { provinceCode: "01" };
    }],
    ["persistence/versioning field", (input) => {
      input.profileVersion = 1;
    }],
  ])("rejects Job input with %s", (_caseName, mutate) => {
    const input = makeJobRawInput();
    mutate(input);

    expectInvalid(validators.JobRawInput, input);
  });

  it("accepts a Generated CV source using canonical embedded shapes", () => {
    expectValid(validators.CVRawInput, makeCVRawInput());
  });

  it.each([
    ["Uploaded source", (input) => {
      input.sourceType = "UPLOADED";
    }],
    ["embedded work-experience id", (input) => {
      input.generatedContent.workExperiences[0].id = "not-canonical";
    }],
    ["unknown hidden section", (input) => {
      input.generatedContent.hiddenSections = ["personalInfo"];
    }],
    ["non-canonical language proficiency", (input) => {
      input.generatedContent.languages[0].proficiency = "B2";
    }],
    ["missing generated-content collection", (input) => {
      delete input.generatedContent.projects;
    }],
    ["Candidate account field outside minimized input", (input) => {
      input.candidateUserId = "candidate-1";
    }],
  ])("rejects CV input with %s", (_caseName, mutate) => {
    const input = makeCVRawInput();
    mutate(input);

    expectInvalid(validators.CVRawInput, input);
  });
});

describe("AI-V01 LLM extraction contracts", () => {
  it("accepts evidence-bearing Job extraction with ambiguity and conflict", () => {
    expectValid(validators.JobExtractionResult, makeJobExtractionResult());
  });

  it.each([
    ["missing evidence", (result) => {
      result.requirements[0].references = [];
    }],
    ["non-pointer evidence", (result) => {
      result.requirements[0].references = ["jobDescription"];
    }],
    ["negative experience", (result) => {
      result.minimumExperienceYears.value = -1;
    }],
    ["invalid extracted employment type", (result) => {
      result.employmentType.value = "PERMANENT";
    }],
    ["single-claim conflict", (result) => {
      result.conflictingClaims[0].claims = [
        result.conflictingClaims[0].claims[0],
      ];
    }],
  ])("rejects Job extraction with %s", (_caseName, mutate) => {
    const result = makeJobExtractionResult();
    mutate(result);

    expectInvalid(validators.JobExtractionResult, result);
  });

  it("accepts evidence-bearing CV extraction with residual and uncertain claims", () => {
    expectValid(validators.CVExtractionResult, makeCVExtractionResult());
  });

  it.each([
    ["missing professional-summary evidence", (result) => {
      result.professionalSummary.references = [];
    }],
    ["missing required claim collection", (result) => {
      delete result.uncertainClaims;
    }],
    ["unexpected verified-experience field", (result) => {
      result.verifiedExperienceClaims = [];
    }],
  ])("rejects CV extraction with %s", (_caseName, mutate) => {
    const result = makeCVExtractionResult();
    mutate(result);

    expectInvalid(validators.CVExtractionResult, result);
  });
});

describe("AI-V01 normalized profile contracts", () => {
  it("accepts a Job profile with consolidated evidence and preserved conflict", () => {
    expectValid(validators.JobMatchProfile, makeJobMatchProfile());
  });

  it("accepts REQUIRED, OPTIONAL, and unresolved requirement priorities", () => {
    for (const priority of ["REQUIRED", "OPTIONAL", null]) {
      const profile = makeJobMatchProfile();
      profile.requirements[0].priority = priority;

      expectValid(validators.JobMatchProfile, profile);
    }
  });

  it.each([
    ["no profile evidence", (profile) => {
      profile.evidence = [];
    }],
    ["duplicate work modes", (profile) => {
      profile.workModes = ["REMOTE", "REMOTE"];
    }],
    ["negative minimum experience", (profile) => {
      profile.minimumExperienceYears = -1;
    }],
    ["match score outside V01", (profile) => {
      profile.matchScore = 0.9;
    }],
    ["profile version outside V01", (profile) => {
      profile.profileVersion = 1;
    }],
  ])("rejects Job profile with %s", (_caseName, mutate) => {
    const profile = makeJobMatchProfile();
    mutate(profile);

    expectInvalid(validators.JobMatchProfile, profile);
  });

  it("accepts a CV profile with declared claims and unmapped B2 proficiency", () => {
    expectValid(validators.CVMatchProfile, makeCVMatchProfile());
  });

  it.each([
    ["missing work-experience evidence", (profile) => {
      profile.workExperiences[0].references = [];
    }],
    ["canonical B2 proficiency invention", (profile) => {
      profile.qualifications.languages[0].proficiency = "B2";
    }],
    ["unknown hidden section", (profile) => {
      profile.hiddenSections = ["personalInfo"];
    }],
    ["independent-verification field", (profile) => {
      profile.verifiedExperience = [];
    }],
    ["persistence history field", (profile) => {
      profile.history = [];
    }],
  ])("rejects CV profile with %s", (_caseName, mutate) => {
    const profile = makeCVMatchProfile();
    mutate(profile);

    expectInvalid(validators.CVMatchProfile, profile);
  });

  it("requires non-empty, distinct source references", () => {
    expectValid(validators.References, ["/skillTags/0", "/generatedContent/skills/0"]);
    expectInvalid(validators.References, []);
    expectInvalid(validators.References, ["/skillTags/0", "/skillTags/0"]);
  });
});

describe("AI-V01 READY/FAILED result contract", () => {
  it("accepts sparse READY output without a completeness threshold", () => {
    expectValid(validators.NormalizationResult, {
      status: "READY",
      profile: makeSparseJobMatchProfile(),
      error: null,
    });
  });

  it("accepts READY output containing uncertainty and conflicting claims", () => {
    expectValid(validators.NormalizationResult, {
      status: "READY",
      profile: makeCVMatchProfile(),
      error: null,
    });
  });

  it("accepts FAILED only with a null profile and string error", () => {
    expectValid(validators.NormalizationResult, {
      status: "FAILED",
      profile: null,
      error: "provider unavailable",
    });
  });

  it.each([
    ["BLOCKED", {
      status: "BLOCKED",
      profile: null,
      error: null,
    }],
    ["READY without profile", {
      status: "READY",
      profile: null,
      error: null,
    }],
    ["READY with error", {
      status: "READY",
      profile: makeSparseJobMatchProfile(),
      error: "unexpected",
    }],
    ["FAILED with profile", {
      status: "FAILED",
      profile: makeSparseJobMatchProfile(),
      error: "unexpected",
    }],
    ["FAILED without error string", {
      status: "FAILED",
      profile: null,
      error: null,
    }],
  ])("rejects %s result", (_caseName, result) => {
    expectInvalid(validators.NormalizationResult, result);
  });
});
