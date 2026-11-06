import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import { evaluateGeneratedCvCompleteness } from "../../src/services/candidate-cv.service.js";
import { createVerifiedUser, loginAndGetAccessToken } from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const completeContent = () => ({
  personalInfo: {
    fullName: "  Jane Candidate  ",
    email: " jane@example.com ",
    phone: " +84901234567 ",
  },
  professionalSummary: "  Backend engineer  ",
  educations: [
    { institutionName: "  Example University ", degree: " BSc " },
    { institutionName: "Incomplete School" },
  ],
  skills: [" Node.js "],
  workExperiences: [{ companyName: "Partial Co" }],
  projects: [{ name: "Partial Project" }],
  certifications: [{ name: "AWS Certified" }],
  languages: [{ name: "English", proficiency: "FLUENT" }],
  hiddenSections: ["projects"],
});

describe("V7 extension — Generated CV creation intent", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  const setup = async () => {
    const { user } = await createVerifiedUser({
      email: "cv.creation.intent@example.com",
    });
    const category = await Category.create({
      name: "Software Engineering",
      level: CATEGORY_LEVEL.FIELD,
      parentCategoryId: null,
    });
    const agent = createTestAgent();
    const token = await loginAndGetAccessToken(agent, { email: user.email });
    const metadata = {
      name: "My Generated CV",
      visibility: "PUBLIC",
      categoryId: category._id.toString(),
    };
    const create = (body) => agent
      .post("/api/candidate/cvs")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    return { user, metadata, create };
  };

  it("defaults to SAVE_DRAFT and persists supplied partial content in one Draft insert", async () => {
    const { user, metadata, create } = await setup();
    const insert = vi.spyOn(CandidateCV, "create");
    const response = await create({
      ...metadata,
      generatedContent: {
        personalInfo: { fullName: "  Jane Candidate  " },
        skills: [" Node.js "],
      },
    });

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(response.body.cv).toMatchObject({
      candidateUserId: user._id.toString(),
      sourceType: "GENERATED",
      status: "DRAFT",
      isDefault: false,
      archivedAt: null,
      uploadedFile: null,
      generatedContent: {
        personalInfo: { fullName: "Jane Candidate" },
        skills: ["Node.js"],
      },
    });
    const persisted = await CandidateCV.findById(response.body.cv.id).lean();
    expect(persisted.status).toBe("DRAFT");
    expect(persisted.generatedContent.personalInfo.fullName).toBe("Jane Candidate");
    expect(persisted).not.toHaveProperty("creationIntent");
  });

  it("keeps complete content in DRAFT when SAVE_DRAFT is explicit", async () => {
    const { metadata, create } = await setup();
    const response = await create({
      ...metadata,
      creationIntent: "SAVE_DRAFT",
      generatedContent: completeContent(),
    });

    expect(response.status).toBe(201);
    expect(response.body.cv.status).toBe("DRAFT");
    expect(response.body.cv.isDefault).toBe(false);
  });

  it("creates complete normalized content directly as ACTIVE in one insert", async () => {
    const { user, metadata, create } = await setup();
    const insert = vi.spyOn(CandidateCV, "create");
    const response = await create({
      ...metadata,
      creationIntent: "COMPLETE",
      generatedContent: completeContent(),
    });

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({
      candidateUserId: user._id,
      status: "ACTIVE",
      isDefault: false,
      generatedContent: {
        personalInfo: { fullName: "Jane Candidate", email: "jane@example.com" },
        professionalSummary: "Backend engineer",
        skills: ["Node.js"],
      },
    });
    const persisted = await CandidateCV.findById(response.body.cv.id).lean();
    expect(persisted.status).toBe("ACTIVE");
    expect(persisted.generatedContent.educations).toHaveLength(2);
    expect(persisted.generatedContent.certifications[0].name).toBe("AWS Certified");
    expect(persisted.generatedContent.languages[0].proficiency).toBe("FLUENT");
    expect(persisted).not.toHaveProperty("creationIntent");
  });

  it("uses normalized HTML summary over stale plain text before creating ACTIVE", async () => {
    const { metadata, create } = await setup();
    const insert = vi.spyOn(CandidateCV, "create");
    const response = await create({
      ...metadata,
      creationIntent: "COMPLETE",
      generatedContent: {
        ...completeContent(),
        professionalSummary: "Outdated summary",
        professionalSummaryHtml: "<div><strong>Backend</strong> engineer</div>",
      },
    });

    const normalizedSummary = {
      professionalSummary: "Backend engineer",
      professionalSummaryHtml: "<p><strong>Backend</strong> engineer</p>",
    };
    expect(response.status).toBe(201);
    expect(response.body.cv.status).toBe("ACTIVE");
    expect(response.body.cv.generatedContent).toMatchObject(normalizedSummary);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({
      status: "ACTIVE",
      generatedContent: normalizedSummary,
    });
    const persisted = await CandidateCV.findById(response.body.cv.id).lean();
    expect(persisted.status).toBe("ACTIVE");
    expect(persisted.generatedContent).toMatchObject(normalizedSummary);
  });

  it("rejects COMPLETE when HTML summary is empty despite stale plain text", async () => {
    const { metadata, create } = await setup();
    const insert = vi.spyOn(CandidateCV, "create");
    const response = await create({
      ...metadata,
      creationIntent: "COMPLETE",
      generatedContent: {
        ...completeContent(),
        professionalSummary: "Outdated summary",
        professionalSummaryHtml: "<p><strong> </strong></p>",
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details?.field).toBe("generatedContent");
    expect(response.body.error.details?.unmetRequirements).toEqual([
      "PROFESSIONAL_SUMMARY_REQUIRED",
    ]);
    expect(insert).not.toHaveBeenCalled();
    expect(await CandidateCV.countDocuments()).toBe(0);
  });

  it("returns stable unmet requirements for incomplete COMPLETE content without inserting a CV", async () => {
    const { metadata, create } = await setup();
    const insert = vi.spyOn(CandidateCV, "create");
    const missing = await create({ ...metadata, creationIntent: "COMPLETE" });
    const incompleteCases = [
      [
        { ...completeContent(), personalInfo: { ...completeContent().personalInfo, fullName: " " } },
        ["PERSONAL_INFO_FULL_NAME_REQUIRED"],
      ],
      [
        { ...completeContent(), personalInfo: { ...completeContent().personalInfo, email: null } },
        ["PERSONAL_INFO_EMAIL_REQUIRED"],
      ],
      [
        { ...completeContent(), personalInfo: { ...completeContent().personalInfo, phone: " " } },
        ["PERSONAL_INFO_PHONE_REQUIRED"],
      ],
      [{ ...completeContent(), professionalSummary: null }, ["PROFESSIONAL_SUMMARY_REQUIRED"]],
      [
        { ...completeContent(), educations: [{ institutionName: "School" }] },
        ["VALID_EDUCATION_REQUIRED"],
      ],
      [{ ...completeContent(), skills: [] }, ["SKILL_REQUIRED"]],
      [{ ...completeContent(), certifications: [{}] }, ["CERTIFICATION_NAME_REQUIRED"]],
      [{ ...completeContent(), languages: [{ proficiency: "FLUENT" }] }, ["LANGUAGE_NAME_REQUIRED"]],
      [{ ...completeContent(), languages: [{ name: "English" }] }, ["LANGUAGE_PROFICIENCY_REQUIRED"]],
      [
        { ...completeContent(), skills: [], certifications: [{}] },
        ["SKILL_REQUIRED", "CERTIFICATION_NAME_REQUIRED"],
      ],
    ];
    expect(missing.status).toBe(400);
    expect(missing.body.error.details).toEqual({ field: "generatedContent" });

    for (const [generatedContent, unmetRequirements] of incompleteCases) {
      const response = await create({
        ...metadata,
        creationIntent: "COMPLETE",
        generatedContent,
      });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe(
        "Generated CV must satisfy completeness",
      );
      expect(response.body.error.details).toEqual({
        field: "generatedContent",
        unmetRequirements,
      });
    }

    expect(insert).not.toHaveBeenCalled();
    expect(await CandidateCV.countDocuments()).toBe(0);
  });

  it("keeps evaluator completeness semantics and reports all unmet conditions", () => {
    expect(evaluateGeneratedCvCompleteness(completeContent())).toEqual({
      isComplete: true,
      unmetRequirements: [],
    });
    expect(evaluateGeneratedCvCompleteness({
      certifications: [{}],
      languages: [{}],
    })).toEqual({
      isComplete: false,
      unmetRequirements: [
        "PERSONAL_INFO_FULL_NAME_REQUIRED",
        "PERSONAL_INFO_EMAIL_REQUIRED",
        "PERSONAL_INFO_PHONE_REQUIRED",
        "PROFESSIONAL_SUMMARY_REQUIRED",
        "VALID_EDUCATION_REQUIRED",
        "SKILL_REQUIRED",
        "CERTIFICATION_NAME_REQUIRED",
        "LANGUAGE_NAME_REQUIRED",
        "LANGUAGE_PROFICIENCY_REQUIRED",
      ],
    });
  });

  it("rejects invalid intent, Harvard shape, and lifecycle overrides", async () => {
    const { metadata, create } = await setup();
    const cases = [
      { creationIntent: "ACTIVATE" },
      { creationIntent: "COMPLETE", generatedContent: { unknownSection: "x" } },
      { creationIntent: "SAVE_DRAFT", generatedContent: { hiddenSections: ["custom"] } },
      { creationIntent: "COMPLETE", generatedContent: completeContent(), status: "ACTIVE" },
      { creationIntent: "COMPLETE", generatedContent: completeContent(), isDefault: true },
      { creationIntent: "COMPLETE", generatedContent: completeContent(), candidateUserId: "other" },
    ];

    for (const body of cases) {
      const response = await create({ ...metadata, ...body });
      expect(response.status).toBe(400);
      expect(response.body.error.details).not.toHaveProperty("unmetRequirements");
    }
    expect(await CandidateCV.countDocuments()).toBe(0);
  });
});
