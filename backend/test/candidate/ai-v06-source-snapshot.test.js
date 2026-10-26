import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const { prepareProfiles, loadCv, getProfile, optimizeCv } = vi.hoisted(() => ({
  prepareProfiles: vi.fn(), loadCv: vi.fn(), getProfile: vi.fn(), optimizeCv: vi.fn(),
}));

vi.mock("../../src/services/candidate-job-match.service.js", () => ({
  prepareOwnCandidateCvJobProfiles: prepareProfiles,
}));
vi.mock("../../src/services/candidate-cv.service.js", () => ({
  loadOwnActiveCandidateCv: loadCv,
}));
vi.mock("../../src/services/candidate-profile.service.js", () => ({
  getOwnCandidateProfile: getProfile,
}));
vi.mock("../../src/services/ai-kit.service.js", () => ({ aiKit: { optimizeCv } }));

import { optimizeOwnCandidateCvForJob } from "../../src/services/candidate-cv-optimization.service.js";

const cvId = new mongoose.Types.ObjectId();
const actorUser = { _id: new mongoose.Types.ObjectId() };
const input = {
  actorUser, jobId: "job-1", candidateCvId: cvId.toString(),
  evaluationResult: { jobId: "job-1", candidateCvId: cvId.toString() },
};
const metadata = { name: "Original", visibility: "PRIVATE", skillTags: ["Node.js"] };
const generatedContent = {
  personalInfo: { fullName: "Original Candidate" },
  professionalSummary: "Original summary", skills: ["Node.js"],
};
const pdfContent = {
  professionalSummary: [{ value: "Original PDF summary" }],
  skills: [{ value: "Node.js" }], workExperiences: [], projects: [],
  educations: [], certifications: [], languages: [],
};

describe("AI-V06 request source consistency", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getProfile.mockResolvedValue({ fullName: "Candidate", email: "candidate@example.com" });
    optimizeCv.mockResolvedValue({ professionalSummary: null });
  });

  it("uses the Generated content authorized for normalization if content changes before baseline", async () => {
    const original = {
      _id: cvId, candidateUserId: actorUser._id, archivedAt: null,
      sourceType: "GENERATED", status: "DRAFT", ...metadata,
      generatedContent: structuredClone(generatedContent),
    };
    const changed = {
      ...original, name: "Changed", generatedContent: {
        ...generatedContent, professionalSummary: "Changed summary", skills: ["Python"],
      },
    };
    prepareProfiles.mockImplementation(async ({ onAuthorizedCvSource }) => {
      onAuthorizedCvSource(original);
      loadCv.mockResolvedValue(changed);
      return {
        jobNormalizationResult: { status: "READY", profile: { source: { jobId: "job-1" } } },
        cvNormalizationResult: { status: "READY", profile: {
          source: { candidateCvId: cvId.toString(), type: "GENERATED_CV" },
        } },
      };
    });

    const result = await optimizeOwnCandidateCvForJob(input);

    expect(loadCv).not.toHaveBeenCalled();
    expect(result.generatedBaseline.metadata.name).toBe("Original");
    expect(result.generatedBaseline.generatedContent).toEqual(generatedContent);
    expect(optimizeCv).toHaveBeenCalledWith(expect.objectContaining({
      generatedBaseline: expect.objectContaining({ professionalSummary: "Original summary" }),
    }));
  });

  it("uses the PDF-bound Uploaded source if the PDF is replaced before baseline", async () => {
    const original = {
      _id: cvId, candidateUserId: actorUser._id, archivedAt: null,
      sourceType: "UPLOADED", status: "ACTIVE", ...metadata,
      uploadedFile: { storageKey: "original.pdf", uploadedAt: new Date("2026-01-01") },
    };
    const changed = {
      ...original, name: "Changed", uploadedFile: {
        storageKey: "replacement.pdf", uploadedAt: new Date("2026-01-02"),
      },
    };
    prepareProfiles.mockImplementation(async ({ onAuthorizedCvSource }) => {
      onAuthorizedCvSource(original);
      loadCv.mockResolvedValue(changed);
      return {
        jobNormalizationResult: { status: "READY", profile: { source: { jobId: "job-1" } } },
        cvNormalizationResult: { status: "READY", profile: {
          source: { candidateCvId: cvId.toString(), type: "UPLOADED_CV" }, pdfContent,
        } },
      };
    });

    const result = await optimizeOwnCandidateCvForJob(input);

    expect(loadCv).not.toHaveBeenCalled();
    expect(result.generatedBaseline.metadata.name).toBe("Original");
    expect(result.generatedBaseline.careerSections.professionalSummary).toBe("Original PDF summary");
    expect(optimizeCv).toHaveBeenCalledWith(expect.objectContaining({
      generatedBaseline: expect.objectContaining({ professionalSummary: "Original PDF summary" }),
    }));
  });

  it("fails before optimization when the authorized source snapshot is missing", async () => {
    prepareProfiles.mockResolvedValue({
      jobNormalizationResult: { status: "READY", profile: { source: { jobId: "job-1" } } },
      cvNormalizationResult: { status: "READY", profile: {
        source: { candidateCvId: cvId.toString(), type: "GENERATED_CV" },
      } },
    });

    await expect(optimizeOwnCandidateCvForJob(input)).rejects.toMatchObject({ statusCode: 500 });
    expect(optimizeCv).not.toHaveBeenCalled();
  });
});
