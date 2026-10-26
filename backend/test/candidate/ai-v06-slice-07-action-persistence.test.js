import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { prepareProfiles, optimizeCv } = vi.hoisted(() => ({
  prepareProfiles: vi.fn(), optimizeCv: vi.fn(),
}));

vi.mock("../../src/services/candidate-job-match.service.js", () => ({
  prepareOwnCandidateCvJobProfiles: prepareProfiles,
}));
vi.mock("../../src/services/ai-kit.service.js", () => ({ aiKit: { optimizeCv } }));

import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import {
  createGeneratedDraftCandidateCv, loadOwnActiveCandidateCv,
} from "../../src/services/candidate-cv.service.js";
import { createOptimizedCandidateCvDraftForJob } from "../../src/services/candidate-cv-optimization.service.js";
import { createVerifiedUser } from "../helpers/auth-fixtures.js";
import { clearDatabase, connectTestDatabase, disconnectTestDatabase } from "../helpers/database.js";

const jobId = "authorized-job";
const pdfContent = {
  professionalSummary: [{ value: "PDF summary" }],
  skills: [{ value: "PDF skill" }],
  workExperiences: [], projects: [], educations: [], certifications: [], languages: [],
};

const createContext = async (sourceType) => {
  const { user } = await createVerifiedUser({ email: `v06-action-${sourceType}@example.com` });
  const category = await Category.create({ name: "Engineering", level: "FIELD" });
  const metadata = {
    name: "Source CV", visibility: "PRIVATE", categoryId: category._id,
    skillTags: ["Source tag"],
  };
  const source = sourceType === "GENERATED"
    ? await createGeneratedDraftCandidateCv({
      candidateUserId: user._id, actorUser: user, draft: metadata,
      generatedContent: {
        personalInfo: { fullName: "Source name" }, hiddenSections: ["projects"],
        professionalSummary: "Source summary", skills: ["Source skill"],
      },
    })
    : await CandidateCV.create({
      candidateUserId: user._id, ...metadata,
      sourceType: "UPLOADED", status: "ACTIVE", isDefault: false,
      uploadedFile: {
        storageKey: "candidate-cvs/uploaded/source.pdf",
        originalFileName: "source.pdf", mimeType: "application/pdf",
        sizeBytes: 100, pageCount: 1, uploadedAt: new Date(),
      },
    });
  const candidateCvId = source.id ?? source._id.toString();
  const sourceBefore = await CandidateCV.findById(candidateCvId).lean();

  prepareProfiles.mockImplementation(async ({ actorUser, candidateCvId: requestedId,
    onAuthorizedCvSource }) => {
    const authorizedSource = await loadOwnActiveCandidateCv({
      actorUser, candidateUserId: actorUser._id, candidateCvId: requestedId, lean: true,
    });
    onAuthorizedCvSource(authorizedSource);
    return {
      jobNormalizationResult: { status: "READY", profile: { source: { jobId } } },
      cvNormalizationResult: { status: "READY", profile: {
        source: { candidateCvId: requestedId, type: `${sourceType}_CV` },
        ...(sourceType === "UPLOADED" ? { pdfContent } : {}),
      } },
    };
  });

  return {
    user, category, sourceBefore,
    input: {
      actorUser: user, jobId, candidateCvId,
      evaluationResult: { jobId, candidateCvId },
    },
  };
};

describe("AI-V06 Slice 07 action to CandidateCV persistence", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  it("saves merged Generated content in a new non-default Draft without changing its source", async () => {
    const { user, category, sourceBefore, input } = await createContext("GENERATED");
    optimizeCv.mockResolvedValue({
      professionalSummary: null, skills: ["Target skill"],
      workExperiences: null, projects: [], educations: null,
      certifications: null, languages: null,
    });

    const result = await createOptimizedCandidateCvDraftForJob(input);
    const draft = await CandidateCV.findById(result.id).lean();

    expect(optimizeCv).toHaveBeenCalledOnce();
    expect(draft).toMatchObject({
      candidateUserId: user._id, name: "Source CV", categoryId: category._id,
      skillTags: ["Source tag"], sourceType: "GENERATED", status: "DRAFT",
      isDefault: false, archivedAt: null,
      generatedContent: {
        personalInfo: { fullName: "Source name" }, hiddenSections: ["projects"],
        professionalSummary: "Source summary", skills: ["Target skill"], projects: [],
      },
    });
    expect(draft.uploadedFile).toBeUndefined();
    expect(result.generatedContent.skills).toEqual(["Target skill"]);
    expect(await CandidateCV.findById(input.candidateCvId).lean()).toEqual(sourceBefore);
    expect(await CandidateCV.countDocuments()).toBe(2);
  });

  it("saves an Uploaded source as a merged Generated Draft without changing its PDF", async () => {
    const { user, category, sourceBefore, input } = await createContext("UPLOADED");
    optimizeCv.mockResolvedValue({
      professionalSummary: "Targeted summary", skills: null,
      workExperiences: null, projects: null, educations: null,
      certifications: null, languages: null,
    });

    const result = await createOptimizedCandidateCvDraftForJob(input);
    const draft = await CandidateCV.findById(result.id).lean();

    expect(optimizeCv).toHaveBeenCalledOnce();
    expect(draft).toMatchObject({
      candidateUserId: user._id, name: "Source CV", categoryId: category._id,
      skillTags: ["Source tag"], sourceType: "GENERATED", status: "DRAFT",
      isDefault: false, archivedAt: null,
      generatedContent: {
        personalInfo: { fullName: user.fullName, email: user.email },
        professionalSummary: "Targeted summary", skills: ["PDF skill"],
      },
    });
    expect(draft.uploadedFile).toBeUndefined();
    expect(result.generatedContent.skills).toEqual(["PDF skill"]);
    expect(await CandidateCV.findById(input.candidateCvId).lean()).toEqual(sourceBefore);
    expect(await CandidateCV.countDocuments()).toBe(2);
  });

  it.each(["GENERATED", "UPLOADED"])(
    "propagates a %s action write failure and leaves no empty Draft", async (sourceType) => {
      const { sourceBefore, input } = await createContext(sourceType);
      optimizeCv.mockResolvedValue({
        professionalSummary: null, skills: null, workExperiences: null,
        projects: null, educations: null, certifications: null, languages: null,
      });
      const failure = new Error("Draft write failed");
      const create = vi.spyOn(CandidateCV, "create").mockRejectedValueOnce(failure);

      await expect(createOptimizedCandidateCvDraftForJob(input)).rejects.toBe(failure);
      expect(optimizeCv).toHaveBeenCalledOnce();
      expect(create).toHaveBeenCalledOnce();
      expect(await CandidateCV.countDocuments()).toBe(1);
      expect(await CandidateCV.findById(input.candidateCvId).lean()).toEqual(sourceBefore);
    },
  );
});
