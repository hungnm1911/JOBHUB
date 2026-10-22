import { describe, expect, it } from "vitest";

import { normalizeGeneratedCv } from "../src/normalization/cv-normalization.js";
import {
  UPLOADED_CV_NORMALIZATION_ERROR_CODES,
  UPLOADED_CV_PDF_EXTRACTION_SCHEMA,
  UploadedCvNormalizationError,
  composeUploadedCvProfile,
} from "../src/normalization/uploaded-cv-normalization.js";

const EXTRACTED_TEXT = [
  "Nguyễn Văn A",
  "Backend Developer",
  "Kinh nghiệm",
  "JOBHUB — Senior Backend Engineer (2020 – nay)",
  "Xây dựng API bằng Node.js và Docker.",
  "Dự án Job Matching: dùng Node.js, MongoDB.",
  "Kỹ năng: Node.js, Python",
  "Tôi có 3 năm kinh nghiệm Python.",
  "Tôi có 5 năm kinh nghiệm Python.",
  "Tiếng Anh: giao tiếp tốt",
  "Sở thích: cờ vua, đọc sách về hệ thống phân tán",
].join("\n");

const emptyExtraction = () => ({
  careerPositioning: [],
  professionalSummary: [],
  skills: [],
  workExperiences: [],
  projects: [],
  educations: [],
  certifications: [],
  languages: [],
  otherCareerClaims: [],
  unresolvedContent: [],
});

const makeExtraction = (overrides = {}) => ({
  ...emptyExtraction(),
  careerPositioning: [{ value: "Backend Developer", evidence: ["Backend Developer"] }],
  skills: [
    { value: "Node.js", evidence: ["Kỹ năng: Node.js, Python"] },
    { value: "Python", evidence: ["Kỹ năng: Node.js, Python"] },
  ],
  workExperiences: [
    {
      companyName: "JOBHUB",
      position: "Senior Backend Engineer",
      period: "2020 – nay",
      description: "Xây dựng API bằng Node.js và Docker.",
      achievements: [],
      // Evidence spanning a line break matches across whitespace differences.
      evidence: [
        "JOBHUB — Senior Backend Engineer (2020 – nay) Xây dựng API bằng Node.js và Docker.",
      ],
    },
  ],
  projects: [
    {
      name: "Job Matching",
      role: null,
      period: null,
      technologies: ["Node.js", "MongoDB"],
      description: null,
      evidence: ["Dự án Job Matching: dùng Node.js, MongoDB."],
    },
  ],
  languages: [
    {
      name: "Tiếng Anh",
      statedProficiency: "giao tiếp tốt",
      evidence: ["Tiếng Anh: giao tiếp tốt"],
    },
  ],
  otherCareerClaims: [
    { value: "3 năm kinh nghiệm Python", evidence: ["Tôi có 3 năm kinh nghiệm Python."] },
    { value: "5 năm kinh nghiệm Python", evidence: ["Tôi có 5 năm kinh nghiệm Python."] },
  ],
  unresolvedContent: [
    {
      value: "Sở thích có thể liên quan đến hệ thống phân tán",
      evidence: ["đọc sách về hệ thống phân tán"],
    },
  ],
  ...overrides,
});

const makeCvSource = (overrides = {}) => ({
  candidateCvId: "cv-upload-1",
  categoryId: "position-1",
  experienceLevelId: "level-1",
  skillTags: ["nodejs", "java"],
  employmentTypes: ["FULL_TIME"],
  workModes: ["REMOTE"],
  preferredLocations: [{ provinceCode: "79", districtCode: null }],
  taxonomy: {
    category: {
      id: "position-1",
      name: "Backend Developer",
      level: "POSITION",
      parentCategoryId: "field-1",
    },
    experienceLevel: { id: "level-1", code: "ONE_TO_THREE_YEARS" },
  },
  ...overrides,
});

const compose = ({
  cvSource = makeCvSource(),
  extractedText = EXTRACTED_TEXT,
  extraction = makeExtraction(),
  pdfExtractionOutput = JSON.stringify(extraction),
} = {}) => composeUploadedCvProfile({ cvSource, extractedText, pdfExtractionOutput });

const expectInvalidInput = (input, detail) => {
  try {
    composeUploadedCvProfile(input);
  } catch (error) {
    expect(error).toBeInstanceOf(UploadedCvNormalizationError);
    expect(error.code).toBe(UPLOADED_CV_NORMALIZATION_ERROR_CODES.INVALID_UPLOADED_CV_INPUT);
    expect(error.details).toContain(detail);
    return;
  }

  throw new Error("expected UploadedCvNormalizationError");
};

const collectSchemaKeywords = (schema, keywords = new Set()) => {
  if (Array.isArray(schema)) {
    schema.forEach((item) => collectSchemaKeywords(item, keywords));
  } else if (schema !== null && typeof schema === "object") {
    Object.entries(schema).forEach(([key, value]) => {
      keywords.add(key);
      collectSchemaKeywords(key === "properties" ? Object.values(value) : value, keywords);
    });
  }

  return keywords;
};

const collectObjectSchemas = (schema, objects = []) => {
  if (schema?.type === "object") {
    objects.push(schema);
    Object.values(schema.properties).forEach((child) => collectObjectSchemas(child, objects));
  } else if (schema?.type === "array") {
    collectObjectSchemas(schema.items, objects);
  }

  return objects;
};

describe("UPLOADED_CV_PDF_EXTRACTION_SCHEMA", () => {
  it("is a frozen strict schema: every object closed with all properties required", () => {
    const objects = collectObjectSchemas(UPLOADED_CV_PDF_EXTRACTION_SCHEMA);

    expect(Object.isFrozen(UPLOADED_CV_PDF_EXTRACTION_SCHEMA)).toBe(true);
    expect(objects.length).toBeGreaterThan(1);
    for (const object of objects) {
      expect(object.additionalProperties).toBe(false);
      expect(object.required).toEqual(Object.keys(object.properties));
    }
  });

  it("uses only keywords accepted by provider strict structured-output modes", () => {
    const keywords = collectSchemaKeywords(UPLOADED_CV_PDF_EXTRACTION_SCHEMA);

    expect([...keywords].sort()).toEqual(
      ["additionalProperties", "items", "properties", "required", "type"].sort(),
    );
  });

  it("covers the canonical career groups plus unresolved content, without Backend metadata", () => {
    expect(UPLOADED_CV_PDF_EXTRACTION_SCHEMA.required).toEqual([
      "careerPositioning",
      "professionalSummary",
      "skills",
      "workExperiences",
      "projects",
      "educations",
      "certifications",
      "languages",
      "otherCareerClaims",
      "unresolvedContent",
    ]);
  });
});

describe("composeUploadedCvProfile — READY", () => {
  it("composes Backend metadata and PDF claims into an UPLOADED_CV CVMatchProfile with separate provenance", () => {
    const extraction = makeExtraction();
    const result = compose({ extraction });

    expect(result.status).toBe("READY");
    expect(result.profile.source).toEqual({ type: "UPLOADED_CV", candidateCvId: "cv-upload-1" });
    expect(Object.keys(result.profile)).toEqual(["source", "metadata", "pdfContent"]);
    expect(result.profile.metadata.skillTags).toEqual([
      { value: "nodejs", sourcePath: "/skillTags/0" },
      { value: "java", sourcePath: "/skillTags/1" },
    ]);
    expect(result.profile.metadata.experienceLevel).toEqual({
      value: { id: "level-1", code: "ONE_TO_THREE_YEARS" },
      sourcePath: "/taxonomy/experienceLevel",
    });
    expect(result.profile.pdfContent).toEqual(extraction);
    expect(Object.isFrozen(result.profile.pdfContent.skills[0])).toBe(true);
  });

  it("shares the metadata representation with the Generated CV variant", () => {
    const uploadedSource = makeCvSource();
    const generated = normalizeGeneratedCv({
      ...uploadedSource,
      generatedContent: {
        personalInfo: { links: [] },
        professionalSummary: null,
        educations: [],
        skills: [],
        workExperiences: [],
        projects: [],
        certifications: [],
        languages: [],
        hiddenSections: [],
      },
    });

    expect(generated.status).toBe("READY");
    expect(compose({ cvSource: uploadedSource }).profile.metadata).toEqual(
      generated.profile.metadata,
    );
  });

  it("keeps metadata and differing PDF claims side by side without override or merge", () => {
    const { profile } = compose();

    expect(profile.metadata.skillTags.map(({ value }) => value)).toEqual(["nodejs", "java"]);
    expect(profile.pdfContent.skills.map(({ value }) => value)).toEqual(["Node.js", "Python"]);
    expect(profile.metadata.experienceLevel.value.code).toBe("ONE_TO_THREE_YEARS");
    expect(profile.pdfContent.otherCareerClaims.map(({ value }) => value)).toEqual([
      "3 năm kinh nghiệm Python",
      "5 năm kinh nghiệm Python",
    ]);
  });

  it("returns READY for a sparse extraction with no PDF career claims (D2)", () => {
    const result = compose({ extraction: emptyExtraction() });

    expect(result.status).toBe("READY");
    expect(result.profile.pdfContent).toEqual(emptyExtraction());
  });

  it("does not mutate the caller's source", () => {
    const cvSource = makeCvSource();
    const snapshot = structuredClone(cvSource);

    compose({ cvSource });

    expect(cvSource).toEqual(snapshot);
  });
});

describe("composeUploadedCvProfile — FAILED on invalid PDF interpretation output", () => {
  const withSkill = (skill) => makeExtraction({ skills: [skill] });

  it.each([
    ["non-string output", { pdfExtractionOutput: { ...makeExtraction() } }],
    ["malformed JSON", { pdfExtractionOutput: "{\"skills\": [" }],
    ["JSON null", { pdfExtractionOutput: "null" }],
    ["a JSON array", { pdfExtractionOutput: "[]" }],
    ["a missing group", { extraction: (({ languages: _l, ...rest }) => rest)(makeExtraction()) }],
    ["an extra group", { extraction: makeExtraction({ matchScore: [] }) }],
    [
      "Backend metadata claimed by the PDF interpretation",
      { extraction: makeExtraction({ categoryId: [] }) },
    ],
    ["an extra claim field", { extraction: withSkill({ value: "Node.js", evidence: ["Node.js"], confidence: "high" }) }],
    ["a blank claim value", { extraction: withSkill({ value: "  ", evidence: ["Node.js"] }) }],
    ["a null claim value", { extraction: withSkill({ value: null, evidence: ["Node.js"] }) }],
    ["a claim without evidence", { extraction: withSkill({ value: "Node.js", evidence: [] }) }],
    ["a blank evidence excerpt", { extraction: withSkill({ value: "Node.js", evidence: [" "] }) }],
    [
      "evidence that is not in the extracted text",
      { extraction: withSkill({ value: "AWS", evidence: ["Kỹ năng: AWS"] }) },
    ],
    [
      "an item that states no value",
      {
        extraction: makeExtraction({
          educations: [
            {
              institutionName: null,
              degree: null,
              fieldOfStudy: null,
              period: null,
              evidence: ["Nguyễn Văn A"],
            },
          ],
        }),
      },
    ],
    [
      "an item field of the wrong type",
      {
        extraction: makeExtraction({
          languages: [{ name: "Tiếng Anh", statedProficiency: 4, evidence: ["Tiếng Anh: giao tiếp tốt"] }],
        }),
      },
    ],
    ["a __proto__ key", { pdfExtractionOutput: JSON.stringify(makeExtraction()).replace("{", "{\"__proto__\":{},") }],
  ])("returns FAILED with no profile for %s", (_label, input) => {
    expect(compose(input)).toEqual({ status: "FAILED", profile: null });
  });
});

describe("composeUploadedCvProfile — invalid input is refused, not FAILED", () => {
  it.each([
    [{ cvSource: makeCvSource({ candidateCvId: "" }) }, "/candidateCvId must be a non-empty string"],
    [{ cvSource: makeCvSource({ name: "My CV" }) }, "/name is not an allowed field"],
    [{ cvSource: makeCvSource({ uploadedFile: {} }) }, "/uploadedFile is not an allowed field"],
    [{ cvSource: makeCvSource({ categoryId: "other" }) }, "/taxonomy/category must resolve /categoryId"],
    [{ cvSource: makeCvSource({ workModes: ["MOON"] }) }, "/workModes/0 must be a canonical WorkMode value"],
    [{ extractedText: "   " }, "extractedText must be non-empty extracted PDF text"],
  ])("throws INVALID_UPLOADED_CV_INPUT (%#)", (overrides, detail) => {
    expectInvalidInput(
      {
        cvSource: makeCvSource(),
        extractedText: EXTRACTED_TEXT,
        pdfExtractionOutput: JSON.stringify(makeExtraction()),
        ...overrides,
      },
      detail,
    );
  });

  it("throws when called without arguments", () => {
    expect(() => composeUploadedCvProfile()).toThrow(UploadedCvNormalizationError);
  });
});
