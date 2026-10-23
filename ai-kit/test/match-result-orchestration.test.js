import { beforeEach, describe, expect, it, vi } from "vitest";

const { codexCall, geminiCall } = vi.hoisted(() => ({
  codexCall: vi.fn(), geminiCall: vi.fn(),
}));
vi.mock("../src/llm/codex-client.js", () => ({
  createCodexClient: () => ({ createResponse: codexCall }),
}));
vi.mock("../src/llm/gemini-client.js", () => ({
  createGeminiClient: () => ({ generateContent: geminiCall }),
}));

import { createAiKit } from "@jobhub/ai-kit";

const sourced = (value) => ({ value, sourcePath: "/metadata" });
const position = sourced({ id: "backend", level: "POSITION", parentCategoryId: "engineering" });
const jobMatchProfile = {
  source: { type: "JOB", jobId: "job-1" },
  metadata: {
    requiredSkills: [sourced("Node.js")],
    fieldCategories: [], positionCategories: [position],
    experienceLevel: sourced({ code: "ONE_TO_THREE_YEARS" }),
    employmentType: sourced("FULL_TIME"), workModes: [sourced("HYBRID")],
  },
  freeText: { jobDescription: sourced("React preferred") },
};
const cvMetadata = {
  category: position,
  experienceLevel: sourced({ code: "ONE_TO_THREE_YEARS" }),
  employmentTypes: [sourced("FULL_TIME")], workModes: [sourced("HYBRID")],
  skillTags: [sourced("Node.js"), sourced("React")],
};
const emptyPdfContent = () => Object.fromEntries([
  "careerPositioning", "professionalSummary", "skills", "workExperiences", "projects",
  "educations", "certifications", "languages", "otherCareerClaims", "unresolvedContent",
].map((group) => [group, []]));
const generatedCv = {
  source: { type: "GENERATED_CV", candidateCvId: "cv-generated" },
  metadata: cvMetadata,
  freeText: { professionalSummary: null },
  content: { skills: [], workExperiences: [], projects: [], educations: [],
    certifications: [], languages: [] },
};
const uploadedCv = {
  source: { type: "UPLOADED_CV", candidateCvId: "cv-uploaded" },
  metadata: cvMetadata,
  pdfContent: emptyPdfContent(),
};
const response = (requirementGroups) => ({
  status: "completed", incomplete_details: null, error: null,
  output: [{ type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: JSON.stringify({ requirementGroups }) }] }],
});
const assessment = [
  { requirement: "Node.js", priority: "REQUIRED", semanticScore: 80,
    evidenceState: "SUPPORTED", jobSourceIds: ["J0"], cvSourceIds: ["C0"] },
  { requirement: "React", priority: "PREFERRED", semanticScore: 100,
    evidenceState: "SUPPORTED", jobSourceIds: ["JD"], cvSourceIds: ["C1"] },
];
const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
const ready = (profile) => ({ status: "READY", profile });
const aiKit = createAiKit({
  llm: {
    codex: { apiKey: "offline", baseURL: "https://example.test", model: "model" },
    gemini: { apiKey: "offline", model: "model" },
  },
  logger,
});

describe("AI-V03 F01 Match Result orchestration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a FAILED Job normalization result before inference", async () => {
    codexCall.mockResolvedValue(response(assessment));

    await expect(aiKit.matchJobCv({
      jobNormalizationResult: { status: "FAILED", profile: jobMatchProfile },
      cvNormalizationResult: { status: "READY", profile: generatedCv },
    })).rejects.toThrow("Job and CV normalization results must both be READY");
    expect(codexCall).not.toHaveBeenCalled();
  });

  it.each([
    ["FAILED CV", ready(jobMatchProfile), { status: "FAILED", profile: null }],
    ["missing Job status", { profile: jobMatchProfile }, ready(generatedCv)],
    ["missing CV status", ready(jobMatchProfile), { profile: generatedCv }],
    ["READY without a profile", ready(jobMatchProfile), ready(null)],
  ])("rejects %s without a provider request or Match Result", async (
    _case, jobNormalizationResult, cvNormalizationResult,
  ) => {
    await expect(aiKit.matchJobCv({ jobNormalizationResult, cvNormalizationResult }))
      .rejects.toThrow("Job and CV normalization results must both be READY");
    expect(codexCall).not.toHaveBeenCalled();
    expect(geminiCall).not.toHaveBeenCalled();
  });

  it("rejects profile-only public input without a provider request", async () => {
    await expect(aiKit.matchJobCv({ jobMatchProfile, cvMatchProfile: generatedCv }))
      .rejects.toThrow("Job and CV normalization results must both be READY");
    expect(codexCall).not.toHaveBeenCalled();
  });

  it.each([
    ["Generated", generatedCv, "cv-generated"],
    ["Uploaded", uploadedCv, "cv-uploaded"],
  ])("returns a complete %s CV Match Result from one semantic inference", async (
    _kind, cvMatchProfile, candidateCvId,
  ) => {
    codexCall.mockResolvedValue(response(assessment));
    const beforeJob = structuredClone(jobMatchProfile);
    const beforeCv = structuredClone(cvMatchProfile);

    const result = await aiKit.matchJobCv({
      jobNormalizationResult: ready(jobMatchProfile),
      cvNormalizationResult: ready(cvMatchProfile),
    });

    expect(codexCall).toHaveBeenCalledOnce();
    expect(geminiCall).not.toHaveBeenCalled();
    expect(result).toEqual({
      jobId: "job-1", candidateCvId,
      matchScore: 93.6, skillsScore: 84, categoryScore: 100, experienceScore: 100,
      employmentTypeScore: 100, workModeScore: 100,
      weights: { skills: 0.4, category: 0.25, experience: 0.25,
        employmentType: 0.05, workMode: 0.05 },
      contributions: { skills: 33.6, category: 25, experience: 25,
        employmentType: 5, workMode: 5 },
    });
    expect(jobMatchProfile).toEqual(beforeJob);
    expect(cvMatchProfile).toEqual(beforeCv);
  });

  it("accepts sparse READY profiles without redistributing missing field weights", async () => {
    codexCall.mockResolvedValue(response([]));
    const sparseJob = { ...jobMatchProfile,
      metadata: { ...jobMatchProfile.metadata, requiredSkills: [],
        fieldCategories: [], positionCategories: [], experienceLevel: null,
        employmentType: null, workModes: [] },
      freeText: { jobDescription: null } };
    const sparseCv = { ...generatedCv,
      metadata: { ...cvMetadata, experienceLevel: null,
        employmentTypes: [], workModes: [], skillTags: [] } };

    const result = await aiKit.matchJobCv({
      jobNormalizationResult: ready(sparseJob),
      cvNormalizationResult: ready(sparseCv),
    });

    expect(codexCall).toHaveBeenCalledOnce();
    expect(result.matchScore).toBe(0);
    expect([result.skillsScore, result.categoryScore, result.experienceScore,
      result.employmentTypeScore, result.workModeScore]).toEqual([0, 0, 0, 0, 0]);
    expect(result.weights.skills).toBe(0.4);
  });

  it("honors one explicitly selected provider", async () => {
    geminiCall.mockResolvedValue({ candidates: [{ finishReason: "STOP",
      content: { role: "model", parts: [{ text: JSON.stringify({ requirementGroups: assessment }) }] } }] });

    const result = await aiKit.matchJobCv({
      jobNormalizationResult: ready(jobMatchProfile),
      cvNormalizationResult: ready(generatedCv), provider: "gemini",
    });

    expect(geminiCall).toHaveBeenCalledOnce();
    expect(codexCall).not.toHaveBeenCalled();
    expect(result.matchScore).toBe(93.6);
  });

  it("propagates provider failure without returning a zero Match Score", async () => {
    const failure = new Error("provider unavailable");
    codexCall.mockRejectedValue(failure);

    await expect(aiKit.matchJobCv({
      jobNormalizationResult: ready(jobMatchProfile),
      cvNormalizationResult: ready(generatedCv),
    })).rejects.toBe(failure);
    expect(codexCall).toHaveBeenCalledOnce();
  });

  it("rejects an invalid semantic completion rather than treating it as zero", async () => {
    codexCall.mockResolvedValue({ ...response([]), status: "incomplete" });

    await expect(aiKit.matchJobCv({
      jobNormalizationResult: ready(jobMatchProfile),
      cvNormalizationResult: ready(generatedCv),
    })).rejects.toMatchObject({
      code: "INVALID_SEMANTIC_SKILLS_ASSESSMENT",
    });
    expect(codexCall).toHaveBeenCalledOnce();
  });

  it("rejects malformed metadata before a provider request", async () => {
    await expect(aiKit.matchJobCv({
      jobNormalizationResult: ready({ ...jobMatchProfile, metadata: null }),
      cvNormalizationResult: ready(generatedCv),
    })).rejects.toThrow(TypeError);
    expect(codexCall).not.toHaveBeenCalled();
  });
});
