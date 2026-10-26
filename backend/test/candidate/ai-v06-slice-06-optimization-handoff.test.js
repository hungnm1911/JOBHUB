import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prepareProfiles, prepareGeneratedBaseline, prepareUploadedBaseline, optimizeCv,
  createGeneratedDraftCandidateCv,
} = vi.hoisted(() => ({
  prepareProfiles: vi.fn(),
  prepareGeneratedBaseline: vi.fn(),
  prepareUploadedBaseline: vi.fn(),
  optimizeCv: vi.fn(),
  createGeneratedDraftCandidateCv: vi.fn(),
}));

vi.mock("../../src/services/candidate-job-match.service.js", () => ({
  prepareOwnCandidateCvJobProfiles: prepareProfiles,
}));
vi.mock("../../src/services/candidate-cv-optimization-baseline.service.js", () => ({
  prepareOwnGeneratedCvBaseline: prepareGeneratedBaseline,
  prepareOwnUploadedCvBaseline: prepareUploadedBaseline,
}));
vi.mock("../../src/services/ai-kit.service.js", () => ({ aiKit: { optimizeCv } }));
vi.mock("../../src/services/candidate-cv.service.js", () => ({ createGeneratedDraftCandidateCv }));

import {
  createOptimizedCandidateCvDraftForJob,
  optimizeOwnCandidateCvForJob,
} from "../../src/services/candidate-cv-optimization.service.js";

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
  metadata: { name: "Source CV" }, generatedContent: {
    personalInfo: { fullName: "Candidate" }, hiddenSections: ["projects"],
    professionalSummary: "Source summary", skills: ["Original"],
    workExperiences: [{ companyName: "Source employer" }], projects: [{ name: "Source project" }],
    educations: [], certifications: [], languages: [],
  },
  careerSections: { professionalSummary: "Source summary", skills: ["Original"],
    workExperiences: [{ companyName: "Source employer" }],
    projects: [{ name: "Source project" }], educations: [], certifications: [], languages: [] },
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
    createGeneratedDraftCandidateCv.mockResolvedValue({ id: "new-draft", status: "DRAFT" });
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

describe("AI-V06 Slice 07 merge and Draft persistence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prepareProfiles.mockImplementation(async ({ onAuthorizedCvSource }) => {
      onAuthorizedCvSource(sourceSnapshot);
      return profiles();
    });
    prepareGeneratedBaseline.mockResolvedValue(generatedBaseline);
    optimizeCv.mockResolvedValue(optimizationResult);
    createGeneratedDraftCandidateCv.mockResolvedValue({ id: "new-draft", status: "DRAFT" });
  });

  it("retains all-null baseline sections and fixed fields in one new Draft", async () => {
    const original = structuredClone(generatedBaseline);

    await expect(createOptimizedCandidateCvDraftForJob(input))
      .resolves.toEqual({ id: "new-draft", status: "DRAFT" });
    expect(createGeneratedDraftCandidateCv).toHaveBeenCalledExactlyOnceWith({
      candidateUserId: actorUser._id, actorUser, draft: generatedBaseline.metadata,
      generatedContent: generatedBaseline.generatedContent,
    });
    expect(generatedBaseline).toEqual(original);
    expect(createGeneratedDraftCandidateCv.mock.calls[0][0].generatedContent)
      .not.toBe(generatedBaseline.generatedContent);
  });

  it("replaces whole arrays in AI order and honors empty arrays without changing source", async () => {
    const replacements = [
      { companyName: "Second employer" }, { companyName: "First employer" },
    ];
    optimizeCv.mockResolvedValue({ ...optimizationResult,
      professionalSummary: "Targeted summary", skills: [],
      workExperiences: replacements, projects: [],
      personalInfo: { fullName: "AI override" }, hiddenSections: [], name: "AI title",
    });
    const original = structuredClone(generatedBaseline);

    await createOptimizedCandidateCvDraftForJob(input);

    const { generatedContent } = createGeneratedDraftCandidateCv.mock.calls[0][0];
    expect(generatedContent).toMatchObject({
      professionalSummary: "Targeted summary", skills: [],
      workExperiences: replacements, projects: [],
      personalInfo: original.generatedContent.personalInfo,
      hiddenSections: original.generatedContent.hiddenSections,
    });
    expect(generatedContent.workExperiences).not.toBe(replacements);
    expect(generatedBaseline).toEqual(original);
  });

  it("does not start persistence after optimization failure", async () => {
    const failure = new Error("Provider failure");
    optimizeCv.mockRejectedValue(failure);

    await expect(createOptimizedCandidateCvDraftForJob(input)).rejects.toBe(failure);
    expect(createGeneratedDraftCandidateCv).not.toHaveBeenCalled();
  });

  it("propagates persistence failure without reporting a Draft", async () => {
    const failure = new Error("Create failed");
    createGeneratedDraftCandidateCv.mockRejectedValue(failure);

    await expect(createOptimizedCandidateCvDraftForJob(input)).rejects.toBe(failure);
    expect(createGeneratedDraftCandidateCv).toHaveBeenCalledOnce();
  });
});
