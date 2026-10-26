import { beforeEach, describe, expect, it, vi } from "vitest";

const { codexCall, geminiCall, groqCall } = vi.hoisted(() => ({
  codexCall: vi.fn(), geminiCall: vi.fn(), groqCall: vi.fn(),
}));
vi.mock("../src/llm/codex-client.js", () => ({
  createCodexClient: () => ({ createResponse: codexCall }),
}));
vi.mock("../src/llm/gemini-client.js", () => ({
  createGeminiClient: () => ({ generateContent: geminiCall }),
}));
vi.mock("../src/llm/groq-client.js", () => ({
  createGroqClient: () => ({ createChatCompletion: groqCall }),
}));

import { buildOptimizationContext, createCvOptimizer } from "../src/optimization/cv-optimization.js";
import { OPTIMIZATION_RESULT_SCHEMA } from "../src/optimization/optimization-result.js";

const sourced = (value, sourcePath = "/source") => ({ value, sourcePath });
const jobMatchProfile = {
  source: { type: "JOB", jobId: "job-1" },
  freeText: { title: sourced("Backend Engineer"),
    jobDescription: sourced("Node.js required", "/jobDescription") },
  metadata: { requiredSkills: [sourced("Node.js", "/requiredSkills/0")],
    experienceLevel: sourced({ code: "ONE_TO_THREE_YEARS" }),
    employmentType: sourced("FULL_TIME"), workModes: [sourced("REMOTE")] },
};
const generatedCv = {
  source: { type: "GENERATED_CV", candidateCvId: "cv-1" },
  metadata: { skillTags: [sourced("Node.js", "/skillTags/0")] },
  freeText: { professionalSummary: sourced("Backend developer", "/generatedContent/professionalSummary") },
  content: {
    skills: [sourced("Node.js", "/generatedContent/skills/0")],
    workExperiences: [{ sourcePath: "/generatedContent/workExperiences/0",
      freeText: { description: sourced("Built APIs", "/generatedContent/workExperiences/0/description") } }],
    projects: [], educations: [], certifications: [], languages: [],
  },
};
const uploadedCv = {
  source: { type: "UPLOADED_CV", candidateCvId: "cv-1" },
  metadata: { skillTags: [] },
  pdfContent: {
    careerPositioning: [], professionalSummary: [], skills: [], workExperiences: [],
    projects: [{ name: "Search", role: null, period: "2023", technologies: ["Node.js"],
      description: "Built search", projectUrl: null, evidence: ["Built search"] }],
    educations: [], certifications: [], languages: [],
    otherCareerClaims: [{ value: "Mentored teammates", evidence: ["Mentored teammates"] }],
    unresolvedContent: [],
  },
};
const evaluationResult = {
  jobId: "job-1", candidateCvId: "cv-1", matchScore: 40,
  overallSummary: "Show relevant work",
  fieldReviews: [{ criterion: "skills", score: 40, review: "Node.js is relevant" }],
  cvImprovements: [{ section: "workExperiences",
    sourceReference: { sourcePath: "/generatedContent/workExperiences/0" },
    comment: "Clarify the work", suggestion: "Describe APIs", rewrite: "Invented revenue result" }],
};
const allNull = {
  professionalSummary: null, skills: null, workExperiences: null, projects: null,
  educations: null, certifications: null, languages: null,
};
const generatedBaseline = {
  professionalSummary: "Converted baseline summary", skills: ["Mapped search skill"],
  workExperiences: [], projects: [{ name: "Converted search project" }],
  educations: [], certifications: [], languages: [],
  personalInfo: { email: "private@example.test" }, hiddenSections: ["PROJECTS"],
  name: "Private CV name", status: "DRAFT",
};
const codexResponse = (output) => ({ status: "completed", incomplete_details: null,
  error: null, output: [{ type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: JSON.stringify(output) }] }] });
const geminiResponse = (output) => ({ candidates: [{ finishReason: "STOP",
  content: { role: "model", parts: [{ text: JSON.stringify(output) }] } }] });
const groqResponse = (output) => ({ choices: [{ finish_reason: "stop",
  message: { role: "assistant", content: JSON.stringify(output) } }] });
const llm = {
  codex: { apiKey: "offline", baseURL: "https://example.test", model: "model" },
  gemini: { apiKey: "offline", model: "model" },
  groq: { apiKey: "offline", model: "model" },
};
const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
const optimizeCv = createCvOptimizer({ llm, logger });
const input = (cvMatchProfile = generatedCv) => ({
  jobMatchProfile, cvMatchProfile, generatedBaseline, evaluationResult,
});

describe("AI-V06 optimization and provider fallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps compact Job/CV source claims separate from V04 advisory feedback", () => {
    const context = buildOptimizationContext(input());
    expect(context.targetJob.title).toBe("Backend Engineer");
    expect(context.targetJob.requirements).toEqual([
      { kind: "requiredSkill", value: "Node.js" },
      { kind: "jobDescription", value: "Node.js required" },
    ]);
    expect(context.cvSource.claims).toContainEqual(expect.objectContaining({
      group: "workExperiences", sourcePath: "/generatedContent/workExperiences/0",
      value: expect.objectContaining({ description: "Built APIs" }),
    }));
    expect(context.evaluationAdvice.cvImprovements[0].rewrite).toBe("Invented revenue result");
    expect(JSON.stringify(context)).not.toMatch(/matchScore|personalInfo|hiddenSections|candidateCvId|jobId/);
    expect(context.evaluationAdvice.fieldReviews).toEqual([
      { criterion: "skills", review: "Node.js is relevant" },
    ]);
  });

  it("uses Uploaded CV evidence without promoting V04 advice to source claims", () => {
    const context = buildOptimizationContext({ ...input(uploadedCv), evaluationResult: {
      ...evaluationResult, cvImprovements: [{ ...evaluationResult.cvImprovements[0],
        sourceReference: { sourcePath: null, evidence: ["Built search"] } }],
    } });
    expect(context.cvSource.type).toBe("UPLOADED_CV");
    expect(context.cvSource.claims).toContainEqual(expect.objectContaining({
      group: "projects", evidence: ["Built search"],
      value: expect.objectContaining({ period: "2023" }),
    }));
    expect(context.cvSource.claims.some(({ value }) => JSON.stringify(value)
      .includes("Invented revenue result"))).toBe(false);
    expect(context.cvSource.claims.some(({ group }) => group === "otherCareerClaims")).toBe(true);
    expect(context.evaluationAdvice.cvImprovements[0].sourceEvidence).toEqual(["Built search"]);
  });

  it("passes a distinct Uploaded-derived baseline as seven career sections only", async () => {
    codexCall.mockResolvedValue(codexResponse(allNull));
    await expect(optimizeCv(input(uploadedCv))).resolves.toEqual(allNull);
    const context = JSON.parse(codexCall.mock.calls[0][0].input);
    expect(context.generatedBaseline).toEqual({
      professionalSummary: "Converted baseline summary", skills: ["Mapped search skill"],
      workExperiences: [], projects: [{ name: "Converted search project" }],
      educations: [], certifications: [], languages: [],
    });
    expect(context.cvSource.claims.some(({ value }) => JSON.stringify(value)
      .includes("Converted search project"))).toBe(false);
    expect(context.cvSource.claims.some(({ value }) => JSON.stringify(value)
      .includes("Built search"))).toBe(true);
    expect(JSON.stringify(context)).not.toMatch(/personalInfo|private@example|hiddenSections|Private CV name|status/);
    expect(codexCall.mock.calls[0][0].instructions).toMatch(/baseline.*CV source.*advisory/i);
  });

  it("keeps resolved career category names for a sparse Job", () => {
    const context = buildOptimizationContext({ ...input(), jobMatchProfile: {
      ...jobMatchProfile,
      freeText: { title: null, jobDescription: null },
      metadata: { ...jobMatchProfile.metadata, requiredSkills: [],
        fieldCategories: [sourced({ id: "field-1", name: "Engineering" })],
        positionCategories: [sourced({ id: "position-1", name: "Backend Developer" })] },
    } });
    expect(context.targetJob.title).toBeNull();
    expect(context.targetJob.requirements).toEqual([]);
    expect(context.targetJob.fieldCategories).toEqual(["Engineering"]);
    expect(context.targetJob.positionCategories).toEqual(["Backend Developer"]);
    expect(JSON.stringify(context.targetJob)).not.toMatch(/field-1|position-1|sourcePath/);
  });

  it("rejects a missing baseline before contacting the provider", async () => {
    await expect(optimizeCv({ ...input(), generatedBaseline: undefined }))
      .rejects.toThrow("Generated baseline must contain all seven career sections");
    expect(codexCall).not.toHaveBeenCalled();
  });

  it("binds the evaluation to the selected Job and CV before inference", async () => {
    await expect(optimizeCv({ ...input(), evaluationResult: { ...evaluationResult,
      jobId: "another-job" } })).rejects.toThrow(TypeError);
    expect(codexCall).not.toHaveBeenCalled();
  });

  it.each([
    ["codex", codexCall, codexResponse, 0],
    ["gemini", geminiCall, geminiResponse, 1],
    ["groq", groqCall, groqResponse, 2],
  ])("requests native structured %s response and accepts all-null", async (
    provider, call, response, precedingFailures,
  ) => {
    if (precedingFailures > 0) codexCall.mockRejectedValue(Object.assign(new Error("busy"), { status: 503 }));
    if (precedingFailures > 1) geminiCall.mockRejectedValue(Object.assign(new Error("busy"), { status: 503 }));
    call.mockResolvedValue(response(allNull));
    await expect(optimizeCv(input())).resolves.toEqual(allNull);
    expect(call).toHaveBeenCalledOnce();
    expect([codexCall, geminiCall, groqCall].map((mock) => mock.mock.calls.length))
      .toEqual([0, 1, 2].map((index) => Number(index <= precedingFailures)));
    const request = call.mock.calls[0][0];
    if (provider === "codex") {
      expect(request.text.format).toEqual({ type: "json_schema", name: "cv_optimization_result",
        strict: true, schema: OPTIMIZATION_RESULT_SCHEMA });
      expect(request.instructions).toMatch(/advisory feedback, not independent evidence/);
      expect(request.instructions).toMatch(/Do not invent skills/);
      expect(request.input).toContain("evaluationAdvice");
    } else if (provider === "gemini") {
      expect(request.config).toEqual(expect.objectContaining({ responseMimeType: "application/json",
        responseJsonSchema: OPTIMIZATION_RESULT_SCHEMA, automaticContinuation: false }));
    } else {
      expect(request.response_format.json_schema).toEqual({ name: "cv_optimization_result",
        strict: true, schema: OPTIMIZATION_RESULT_SCHEMA });
    }
  });

  it("accepts any completed valid replacement without a semantic or score gate", async () => {
    const replacement = { ...allNull, skills: [] };
    codexCall.mockResolvedValue(codexResponse(replacement));
    await expect(optimizeCv(input())).resolves.toEqual(replacement);
  });

  it("falls back through incomplete, invalid JSON, and invalid contract responses", async () => {
    codexCall.mockResolvedValue({ ...codexResponse(allNull), status: "incomplete" });
    geminiCall.mockResolvedValue(geminiResponse({ ...allNull, skills: [null] }));
    groqCall.mockResolvedValue(groqResponse(allNull));
    await expect(optimizeCv(input())).resolves.toEqual(allNull);
    expect(codexCall).toHaveBeenCalledOnce();
    expect(geminiCall).toHaveBeenCalledOnce();
    expect(groqCall).toHaveBeenCalledOnce();
  });

  it("falls back from malformed JSON and stops on a valid Gemini result", async () => {
    codexCall.mockResolvedValue({ ...codexResponse(allNull), output: [{ type: "message",
      role: "assistant", status: "completed",
      content: [{ type: "output_text", text: "{" }] }] });
    geminiCall.mockResolvedValue(geminiResponse({ ...allNull, skills: [] }));
    await expect(optimizeCv(input())).resolves.toEqual({ ...allNull, skills: [] });
    expect(groqCall).not.toHaveBeenCalled();
  });

  it("advances after a response-free timeout", async () => {
    codexCall.mockRejectedValue(Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }));
    geminiCall.mockResolvedValue(geminiResponse(allNull));
    await expect(optimizeCv(input())).resolves.toEqual(allNull);
    expect(geminiCall).toHaveBeenCalledOnce();
    expect(groqCall).not.toHaveBeenCalled();
  });

  it("advances after Codex HTTP 408 with one attempt per provider", async () => {
    codexCall.mockRejectedValue(Object.assign(new Error("request timed out"), { status: 408 }));
    geminiCall.mockResolvedValue(geminiResponse(allNull));
    await expect(optimizeCv(input())).resolves.toEqual(allNull);
    expect(codexCall).toHaveBeenCalledOnce();
    expect(geminiCall).toHaveBeenCalledOnce();
    expect(groqCall).not.toHaveBeenCalled();
  });

  it("reports technical failure when all providers return invalid output", async () => {
    codexCall.mockResolvedValue({ ...codexResponse(allNull), status: "incomplete" });
    geminiCall.mockResolvedValue({ ...geminiResponse(allNull), candidates: [{
      ...geminiResponse(allNull).candidates[0], finishReason: "MAX_TOKENS" }] });
    groqCall.mockResolvedValue(groqResponse({ ...allNull, skills: [null] }));
    await expect(optimizeCv(input())).rejects.toMatchObject({
      code: "INVALID_OPTIMIZATION_RESULT",
      details: expect.arrayContaining([expect.stringContaining("/skills/0")]),
    });
    expect([codexCall, geminiCall, groqCall].map((mock) => mock.mock.calls.length))
      .toEqual([1, 1, 1]);
  });

  it("propagates the final provider failure after eligible earlier failures", async () => {
    const finalFailure = Object.assign(new Error("provider unavailable"), { status: 503 });
    codexCall.mockRejectedValue(Object.assign(new Error("busy"), { status: 429 }));
    geminiCall.mockResolvedValue({ ...geminiResponse(allNull), candidates: [{
      ...geminiResponse(allNull).candidates[0], finishReason: "MAX_TOKENS" }] });
    groqCall.mockRejectedValue(finalFailure);
    await expect(optimizeCv(input())).rejects.toBe(finalFailure);
    expect([codexCall, geminiCall, groqCall].map((mock) => mock.mock.calls.length))
      .toEqual([1, 1, 1]);
  });

  it.each([400, 401, 403])("stops on non-fallback Codex HTTP %i", async (status) => {
    const failure = Object.assign(new Error("request rejected"), { status });
    codexCall.mockRejectedValue(failure);
    await expect(optimizeCv(input())).rejects.toBe(failure);
    expect(geminiCall).not.toHaveBeenCalled();
    expect(groqCall).not.toHaveBeenCalled();
  });

  it("does not fallback on a provider programming error", async () => {
    const failure = new TypeError("invalid request construction");
    codexCall.mockRejectedValue(failure);
    await expect(optimizeCv(input())).rejects.toBe(failure);
    expect(geminiCall).not.toHaveBeenCalled();
  });

  it("rejects incomplete local provider configuration before any request", async () => {
    const optimizer = createCvOptimizer({ llm: { ...llm, gemini: { apiKey: "offline" } }, logger });
    await expect(optimizer(input())).rejects.toThrow("gemini provider configuration is incomplete");
    expect(codexCall).not.toHaveBeenCalled();
  });

  it("reports malformed credentialless config instead of silently skipping it", async () => {
    const optimizer = createCvOptimizer({ llm: {
      codex: llm.codex, gemini: { apiKey: undefined, model: 42 },
    }, logger });
    await expect(optimizer(input())).rejects.toThrow("gemini provider configuration is incomplete");
    expect(codexCall).not.toHaveBeenCalled();
  });

  it("uses the Backend config shape when only Codex has credentials", async () => {
    const backendLlm = {
      codex: llm.codex,
      gemini: { apiKey: undefined, model: undefined },
      groq: { apiKey: undefined, model: "openai/gpt-oss-120b" },
    };
    const optimizer = createCvOptimizer({ llm: backendLlm, logger });
    codexCall.mockResolvedValue(codexResponse(allNull));
    await expect(optimizer(input())).resolves.toEqual(allNull);
    expect(codexCall).toHaveBeenCalledOnce();
    expect(geminiCall).not.toHaveBeenCalled();
    expect(groqCall).not.toHaveBeenCalled();
  });

  it("falls back only to credentialed providers in priority order", async () => {
    const optimizer = createCvOptimizer({ llm: {
      codex: { apiKey: undefined, baseURL: undefined, model: undefined },
      gemini: llm.gemini,
      groq: llm.groq,
    }, logger });
    geminiCall.mockRejectedValue(Object.assign(new Error("busy"), { status: 503 }));
    groqCall.mockResolvedValue(groqResponse(allNull));
    await expect(optimizer(input())).resolves.toEqual(allNull);
    expect(codexCall).not.toHaveBeenCalled();
    expect(geminiCall).toHaveBeenCalledOnce();
    expect(groqCall).toHaveBeenCalledOnce();
  });

  it("rejects Backend config with no credentialed provider before inference", async () => {
    const optimizer = createCvOptimizer({ llm: {
      codex: { apiKey: undefined, baseURL: undefined, model: undefined },
      gemini: { apiKey: undefined, model: undefined },
      groq: { apiKey: undefined, model: "openai/gpt-oss-120b" },
    }, logger });
    await expect(optimizer(input())).rejects.toThrow("At least one AI-V06 provider must be configured");
    expect([codexCall, geminiCall, groqCall].every((mock) => mock.mock.calls.length === 0))
      .toBe(true);
  });

  it("uses only configured providers in priority order", async () => {
    const optimizer = createCvOptimizer({ llm: { gemini: llm.gemini, groq: llm.groq }, logger });
    geminiCall.mockRejectedValue(Object.assign(new Error("busy"), { status: 503 }));
    groqCall.mockResolvedValue(groqResponse(allNull));
    await expect(optimizer(input())).resolves.toEqual(allNull);
    expect(codexCall).not.toHaveBeenCalled();
    expect(geminiCall).toHaveBeenCalledOnce();
    expect(groqCall).toHaveBeenCalledOnce();
  });

  it("rejects an empty provider configuration before inference", async () => {
    const optimizer = createCvOptimizer({ llm: {}, logger });
    await expect(optimizer(input())).rejects.toThrow("At least one AI-V06 provider must be configured");
    expect([codexCall, geminiCall, groqCall].every((mock) => mock.mock.calls.length === 0))
      .toBe(true);
  });
});
