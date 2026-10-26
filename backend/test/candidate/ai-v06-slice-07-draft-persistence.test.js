import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import { createGeneratedDraftCandidateCv } from "../../src/services/candidate-cv.service.js";
import { createVerifiedUser } from "../helpers/auth-fixtures.js";
import { clearDatabase, connectTestDatabase, disconnectTestDatabase } from "../helpers/database.js";

describe("AI-V06 Slice 07 canonical Draft persistence", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  const context = async () => {
    const { user } = await createVerifiedUser({ email: "ai-v06-draft@example.com" });
    const category = await Category.create({
      name: "Engineering", level: CATEGORY_LEVEL.FIELD, parentCategoryId: null,
    });
    return {
      candidateUserId: user._id,
      actorUser: user,
      draft: { name: "Optimized", visibility: "PRIVATE", categoryId: category._id },
    };
  };

  it("stores sparse merged content atomically as a non-default Generated Draft", async () => {
    const input = await context();
    const source = await createGeneratedDraftCandidateCv({
      ...input,
      draft: { ...input.draft, name: "Source" },
      generatedContent: { professionalSummary: "Original summary", skills: ["Original"] },
    });
    const sourceBefore = await CandidateCV.findById(source.id).lean();
    const generatedContent = {
      personalInfo: { fullName: "Candidate", email: null, links: [] },
      professionalSummary: null,
      skills: [], workExperiences: [], projects: [], educations: [],
      certifications: [], languages: [], hiddenSections: ["projects"],
    };

    const created = await createGeneratedDraftCandidateCv({ ...input, generatedContent });
    const persisted = await CandidateCV.findById(created.id).lean();

    expect(persisted).toMatchObject({
      candidateUserId: input.candidateUserId,
      sourceType: "GENERATED", status: "DRAFT", isDefault: false,
      archivedAt: null, generatedContent: {
        personalInfo: { fullName: "Candidate" },
        professionalSummary: null, skills: [], hiddenSections: ["projects"],
      },
    });
    expect(persisted.uploadedFile).toBeUndefined();
    expect(await CandidateCV.findById(source.id).lean()).toEqual(sourceBefore);
    expect(generatedContent).toEqual({
      personalInfo: { fullName: "Candidate", email: null, links: [] },
      professionalSummary: null,
      skills: [], workExperiences: [], projects: [], educations: [],
      certifications: [], languages: [], hiddenSections: ["projects"],
    });
  });

  it("leaves no Draft when the single create operation fails", async () => {
    const input = await context();
    const failure = new Error("Persistence unavailable");
    const create = vi.spyOn(CandidateCV, "create").mockRejectedValueOnce(failure);

    await expect(createGeneratedDraftCandidateCv({
      ...input, generatedContent: { skills: ["Node.js"] },
    })).rejects.toBe(failure);
    expect(create).toHaveBeenCalledOnce();
    expect(await CandidateCV.countDocuments()).toBe(0);
  });
});
