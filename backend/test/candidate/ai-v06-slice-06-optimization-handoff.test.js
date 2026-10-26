import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prepareProfiles, prepareGeneratedBaseline, prepareUploadedBaseline, optimizeCv,
} = vi.hoisted(() => ({
  prepareProfiles: vi.fn(),
  prepareGeneratedBaseline: vi.fn(),
  prepareUploadedBaseline: vi.fn(),
  optimizeCv: vi.fn(),
}));

vi.mock("../../src/services/candidate-job-match.service.js", () => ({
  prepareOwnCandidateCvJobProfiles: prepareProfiles,
}));
vi.mock("../../src/services/candidate-cv-optimization-baseline.service.js", () => ({
  prepareOwnGeneratedCvBaseline: prepareGeneratedBaseline,
  prepareOwnUploadedCvBaseline: prepareUploadedBaseline,
}));
vi.mock("../../src/services/ai-kit.service.js", () => ({ aiKit: { optimizeCv } }));

import { optimizeOwnCandidateCvForJob } from "../../src/services/candidate-cv-optimization.service.js";

const actorUser = { _id: "candidate-1" };
const sourceSnapshot = { _id: { toString: () => "cv-1" },
  candidateUserId: actorUser._id, sourceType: "GENERATED" };
const evaluationResult = {
  jobId: "job-1", candidateCvId: "cv-1", overallSummary: "Review experience",
  fieldReviews: [], cvImprovements: [],
};
const input = { actorUser, jobId: "job-1", candidateCvId: "cv-1", evaluationResult };
const jobMatchProfile = { source: { type: "JOB", jobId: "job-1" } };
const cvMatchProfile = { source: { type: "GENERATED_CV", candidateCvId: "cv-1" } };
const generatedBaseline = {
  metadata: { name: "Source CV" }, generatedContent: { personalInfo: { fullName: "Candidate" } },
  careerSections: { professionalSummary: "Source summary", skills: [],
    workExperiences: [], projects: [], educations: [], certifications: [], languages: [] },
};
const optimizationResult = { professionalSummary: null, skills: null,
  workExperiences: null, projects: null, educations: null, certifications: null,
  languages: null };

const profiles = (cvProfile = cvMatchProfile) => ({
  jobNormalizationResult: { status: "READY", profile: jobMatchProfile },
  cvNormalizationResult: { status: "READY", profile: cvProfile },
});

describe("AI-V06 Slice 06 authorized optimization handoff", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prepareProfiles.mockImplementation(async ({ onAuthorizedCvSource }) => {
      onAuthorizedCvSource(sourceSnapshot);
      return profiles();
    });
    prepareGeneratedBaseline.mockResolvedValue(generatedBaseline);
    prepareUploadedBaseline.mockResolvedValue(generatedBaseline);
    optimizeCv.mockResolvedValue(optimizationResult);
  });

  it("hands one authorized Generated Job/CV pair, baseline, and V04 advice to AI Kit", async () => {
    const result = await optimizeOwnCandidateCvForJob({
      ...input,
      jobMatchProfile: { source: { jobId: "client-job" } },
      cvMatchProfile: { source: { candidateCvId: "client-cv" } },
      generatedBaseline: { careerSections: { skills: ["Invented skill"] } },
    });

    expect(prepareProfiles).toHaveBeenCalledExactlyOnceWith({
      actorUser, jobId: "job-1", candidateCvId: "cv-1",
      onAuthorizedCvSource: expect.any(Function),
    });
    expect(prepareGeneratedBaseline).toHaveBeenCalledExactlyOnceWith({
      actorUser, candidateUserId: actorUser._id, candidateCvId: "cv-1",
      sourceSnapshot,
    });
    expect(prepareUploadedBaseline).not.toHaveBeenCalled();
    expect(optimizeCv).toHaveBeenCalledExactlyOnceWith({
      jobMatchProfile, cvMatchProfile,
      generatedBaseline: generatedBaseline.careerSections, evaluationResult,
    });
    expect(result).toEqual({ jobId: "job-1", candidateCvId: "cv-1",
      generatedBaseline, optimizationResult });
  });

  it("normalizes the current Uploaded PDF once and hands its READY profile to the baseline", async () => {
    const uploadedProfile = { source: { type: "UPLOADED_CV", candidateCvId: "cv-1" } };
    const readyProfiles = profiles(uploadedProfile);
    prepareProfiles.mockImplementation(async ({ onAuthorizedCvSource }) => {
      onAuthorizedCvSource(sourceSnapshot);
      return readyProfiles;
    });

    await optimizeOwnCandidateCvForJob(input);

    expect(prepareGeneratedBaseline).not.toHaveBeenCalled();
    expect(prepareUploadedBaseline).toHaveBeenCalledExactlyOnceWith({
      actorUser, candidateUserId: actorUser._id, candidateCvId: "cv-1",
      sourceSnapshot,
      normalizationResult: readyProfiles.cvNormalizationResult,
    });
    expect(optimizeCv).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      jobMatchProfile, cvMatchProfile: uploadedProfile,
      generatedBaseline: generatedBaseline.careerSections,
    }));
  });

  it("stops when canonical CV or Job authorization fails", async () => {
    const denial = new Error("Forbidden source");
    prepareProfiles.mockRejectedValue(denial);

    await expect(optimizeOwnCandidateCvForJob(input)).rejects.toBe(denial);
    expect(prepareGeneratedBaseline).not.toHaveBeenCalled();
    expect(prepareUploadedBaseline).not.toHaveBeenCalled();
    expect(optimizeCv).not.toHaveBeenCalled();
  });

  it.each([
    ["Job profile", { jobNormalizationResult: { status: "READY",
      profile: { source: { type: "JOB", jobId: "other-job" } } } }],
    ["CV profile", { cvNormalizationResult: { status: "READY",
      profile: { source: { type: "GENERATED_CV", candidateCvId: "other-cv" } } } }],
  ])("refuses a mismatched %s source identity", async (_label, replacement) => {
    prepareProfiles.mockImplementation(async ({ onAuthorizedCvSource }) => {
      onAuthorizedCvSource(sourceSnapshot);
      return { ...profiles(), ...replacement };
    });

    await expect(optimizeOwnCandidateCvForJob(input)).rejects.toMatchObject({ statusCode: 500 });
    expect(prepareGeneratedBaseline).not.toHaveBeenCalled();
    expect(optimizeCv).not.toHaveBeenCalled();
  });

  it.each([
    ["Job", { ...evaluationResult, jobId: "other-job" }],
    ["CV", { ...evaluationResult, candidateCvId: "other-cv" }],
    ["missing", undefined],
  ])("refuses V04 advice for another %s pair", async (_label, advice) => {
    await expect(optimizeOwnCandidateCvForJob({ ...input, evaluationResult: advice }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(prepareGeneratedBaseline).not.toHaveBeenCalled();
    expect(optimizeCv).not.toHaveBeenCalled();
  });

  it("propagates unavailable normalization without a synthetic optimization result", async () => {
    const failure = new Error("Matching input is unavailable");
    prepareProfiles.mockRejectedValue(failure);

    await expect(optimizeOwnCandidateCvForJob(input)).rejects.toBe(failure);
    expect(optimizeCv).not.toHaveBeenCalled();
  });

  it("propagates baseline and AI processing failures without returning success", async () => {
    const baselineFailure = new Error("Source unavailable");
    prepareGeneratedBaseline.mockRejectedValueOnce(baselineFailure);
    await expect(optimizeOwnCandidateCvForJob(input)).rejects.toBe(baselineFailure);
    expect(optimizeCv).not.toHaveBeenCalled();

    const inferenceFailure = new Error("All providers failed");
    optimizeCv.mockRejectedValueOnce(inferenceFailure);
    await expect(optimizeOwnCandidateCvForJob(input)).rejects.toBe(inferenceFailure);
  });
});
