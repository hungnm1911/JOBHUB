import { describe, beforeEach, expect, it, vi } from "vitest";

const {
  extractPdfTextMock,
  codexRequestMock,
  geminiRequestMock,
  groqRequestMock,
} = vi.hoisted(() => ({
  extractPdfTextMock: vi.fn(),
  codexRequestMock: vi.fn(),
  geminiRequestMock: vi.fn(),
  groqRequestMock: vi.fn(),
}));

vi.mock("../src/document/pdf-text-extractor.js", () => ({
  extractPdfTextFromBuffer: extractPdfTextMock,
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: geminiRequestMock };
  },
}));
vi.mock("openai", () => ({
  default: class {
    responses = { create: codexRequestMock };
  },
}));
vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create: groqRequestMock } };
  },
}));

import { createAiKit } from "@jobhub/ai-kit";
import { UPLOADED_CV_PDF_EXTRACTION_SCHEMA } from "../src/normalization/uploaded-cv-normalization.js";

const TEXT = "Backend Developer. Skills: Node.js. Python 3 years. Python 5 years.";
const PDF = Buffer.from("mocked PDF bytes");
const EMPTY_EXTRACTION = Object.freeze({
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
const EXTRACTION_JSON = JSON.stringify(EMPTY_EXTRACTION);
const geminiResponse = (text, overrides = {}) => ({
  candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text }] } }],
  ...overrides,
});
const groqResponse = (content, overrides = {}) => ({
  choices: [{ finish_reason: "stop", message: { role: "assistant", content } }],
  ...overrides,
});
const CV_SOURCE = Object.freeze({
  candidateCvId: "cv-1",
  categoryId: "position-1",
  experienceLevelId: null,
  skillTags: ["Java"],
  employmentTypes: [],
  workModes: [],
  preferredLocations: [],
  taxonomy: {
    category: {
      id: "position-1",
      name: "Backend Developer",
      level: "POSITION",
      parentCategoryId: "field-1",
    },
    experienceLevel: null,
  },
});
const logger = Object.freeze({
  error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(),
});
const aiKit = createAiKit({
  llm: {
    codex: { apiKey: "offline-codex-key", baseURL: "https://codex.example.test/v1", model: "codex-model" },
    gemini: { apiKey: "offline-gemini-key", model: "gemini-model" },
    groq: { apiKey: "offline-groq-key", model: "openai/gpt-oss-120b" },
  },
  logger,
});

describe("AI-V02 one-pass PDF semantic extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractPdfTextMock.mockResolvedValue(TEXT);
  });

  const codexResponse = (text, overrides = {}) => ({
    status: "completed",
    incomplete_details: null,
    error: null,
    output: [{ type: "message", role: "assistant", status: "completed", content: [
      { type: "output_text", text },
    ] }],
    ...overrides,
  });

  it("uses Codex as primary with Responses strict JSON Schema and shared composition", async () => {
    const extraction = {
      ...EMPTY_EXTRACTION,
      skills: [{ value: "Node.js", evidence: ["Node.js"] }],
    };
    codexRequestMock.mockResolvedValue(codexResponse(JSON.stringify(extraction)));

    const result = await aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF });

    expect(extractPdfTextMock).toHaveBeenCalledOnce();
    expect(codexRequestMock).toHaveBeenCalledOnce();
    expect(geminiRequestMock).not.toHaveBeenCalled();
    expect(groqRequestMock).not.toHaveBeenCalled();
    const request = codexRequestMock.mock.calls[0][0];
    expect(request).toEqual({
      model: "codex-model",
      instructions: expect.stringMatching(/verbatim PDF excerpts/),
      input: TEXT,
      text: { format: {
        type: "json_schema",
        name: "uploaded_cv_pdf_extraction",
        strict: true,
        schema: UPLOADED_CV_PDF_EXTRACTION_SCHEMA,
      } },
    });
    expect(JSON.stringify(request)).not.toContain("cv-1");
    expect(JSON.stringify(request)).not.toContain("Java");
    expect(result.status).toBe("READY");
    expect(result.profile.metadata.skillTags[0].value).toBe("Java");
    expect(result.profile.pdfContent).toEqual(extraction);
  });

  it.each([
    { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } },
    { incomplete_details: { reason: "max_output_tokens" } },
    { status: "failed", error: { code: "server_error" } },
    { error: { code: "server_error" } },
    { incomplete_details: undefined },
    { error: undefined },
  ])("returns FAILED for an unsuccessful Codex response %#", async (fields) => {
    codexRequestMock.mockResolvedValue(codexResponse(JSON.stringify(EMPTY_EXTRACTION), fields));

    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF }))
      .resolves.toEqual({ status: "FAILED", profile: null });
    expect(codexRequestMock).toHaveBeenCalledOnce();
    expect(geminiRequestMock).not.toHaveBeenCalled();
    expect(groqRequestMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ type: "message", role: "assistant", status: "completed", content: [
      { type: "refusal", refusal: "Cannot comply" },
      { type: "output_text", text: JSON.stringify(EMPTY_EXTRACTION) },
    ] }],
    [{ type: "message", role: "assistant", status: "incomplete", content: [
      { type: "output_text", text: JSON.stringify(EMPTY_EXTRACTION) },
    ] }],
    [{ type: "function_call", name: "unexpected" }],
    [{ type: "message", role: "assistant", status: "completed", content: [
      { type: "output_text", text: JSON.stringify(EMPTY_EXTRACTION) },
    ] }, { type: "message", role: "assistant", status: "completed", content: [
      { type: "output_text", text: JSON.stringify(EMPTY_EXTRACTION) },
    ] }],
    [],
  ])("returns FAILED for a refused or malformed Codex output %#", async (output) => {
    codexRequestMock.mockResolvedValue(codexResponse(JSON.stringify(EMPTY_EXTRACTION), { output }));

    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF }))
      .resolves.toEqual({ status: "FAILED", profile: null });
    expect(codexRequestMock).toHaveBeenCalledOnce();
  });

  it("returns FAILED for malformed Codex JSON and propagates provider errors", async () => {
    codexRequestMock.mockResolvedValueOnce(codexResponse("{not-json}"));
    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF }))
      .resolves.toEqual({ status: "FAILED", profile: null });
    const failure = new Error("strict mode rejected");
    codexRequestMock.mockRejectedValueOnce(failure);
    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF }))
      .rejects.toBe(failure);
    expect(codexRequestMock).toHaveBeenCalledTimes(2);
    expect(geminiRequestMock).not.toHaveBeenCalled();
    expect(groqRequestMock).not.toHaveBeenCalled();
  });

  it("requires Codex configuration before PDF extraction or a provider request", async () => {
    const unconfigured = createAiKit({ llm: {}, logger });

    await expect(unconfigured.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF }))
      .rejects.toThrow("codex requires an apiKey, model, and baseURL");
    expect(extractPdfTextMock).not.toHaveBeenCalled();
    expect(codexRequestMock).not.toHaveBeenCalled();
    expect(geminiRequestMock).not.toHaveBeenCalled();
    expect(groqRequestMock).not.toHaveBeenCalled();
  });

  it("uses Gemini native schema mode, only PDF text, and composes backed claims", async () => {
    const extraction = {
      ...EMPTY_EXTRACTION,
      careerPositioning: [{ value: "Backend Developer", evidence: ["Backend Developer"] }],
      otherCareerClaims: [
        { value: "Python 3 years", evidence: ["Python 3 years"] },
        { value: "Python 5 years", evidence: ["Python 5 years"] },
      ],
    };
    geminiRequestMock.mockResolvedValue(geminiResponse(JSON.stringify(extraction)));

    const result = await aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF, provider: "gemini" });

    expect(extractPdfTextMock).toHaveBeenCalledOnce();
    expect(extractPdfTextMock).toHaveBeenCalledWith(PDF);
    expect(geminiRequestMock).toHaveBeenCalledOnce();
    expect(groqRequestMock).not.toHaveBeenCalled();
    const request = geminiRequestMock.mock.calls[0][0];
    expect(request).toMatchObject({
      model: "gemini-model",
      contents: [{ role: "user", parts: [{ text: TEXT }] }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: UPLOADED_CV_PDF_EXTRACTION_SCHEMA,
      },
    });
    expect(Object.keys(request.config).sort()).toEqual([
      "automaticContinuation", "responseJsonSchema", "responseMimeType", "systemInstruction",
    ]);
    expect(request.config.automaticContinuation).toBe(false);
    expect(request.config.systemInstruction).toMatch(/explicitly stated/);
    expect(request.config.systemInstruction).toMatch(/verbatim PDF excerpts/);
    expect(request.config.systemInstruction).toMatch(/conflicting claims separate/);
    expect(request.config.systemInstruction).toMatch(/Do not infer qualifications/);
    expect(JSON.stringify(request)).not.toContain("cv-1");
    expect(JSON.stringify(request)).not.toContain("Java");
    expect(result.status).toBe("READY");
    expect(result.profile.source).toEqual({ type: "UPLOADED_CV", candidateCvId: "cv-1" });
    expect(result.profile.metadata.skillTags.map((item) => item.value)).toEqual(["Java"]);
    expect(result.profile.pdfContent).toEqual(extraction);
  });

  it("uses Groq strict JSON Schema mode with one request and sparse READY", async () => {
    groqRequestMock.mockResolvedValue(groqResponse(EXTRACTION_JSON));

    const result = await aiKit.normalizeUploadedCv({
      cvSource: CV_SOURCE, pdfBuffer: PDF, provider: "groq",
    });

    expect(groqRequestMock).toHaveBeenCalledOnce();
    expect(geminiRequestMock).not.toHaveBeenCalled();
    const request = groqRequestMock.mock.calls[0][0];
    expect(request).toMatchObject({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: expect.stringMatching(/explicitly stated/) },
        { role: "user", content: TEXT },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "uploaded_cv_pdf_extraction",
          strict: true,
          schema: UPLOADED_CV_PDF_EXTRACTION_SCHEMA,
        },
      },
    });
    expect(result.status).toBe("READY");
    expect(result.profile.pdfContent).toEqual(EMPTY_EXTRACTION);
  });

  it.each(["gemini", "groq"])("returns FAILED for invalid %s output", async (provider) => {
    const invalid = JSON.stringify({
      ...EMPTY_EXTRACTION,
      skills: [{ value: "Kubernetes", evidence: ["not in PDF"] }],
    });
    geminiRequestMock.mockResolvedValue(geminiResponse(invalid));
    groqRequestMock.mockResolvedValue(groqResponse(invalid));

    await expect(aiKit.normalizeUploadedCv({
      cvSource: CV_SOURCE, pdfBuffer: PDF, provider,
    })).resolves.toEqual({ status: "FAILED", profile: null });
    expect(geminiRequestMock.mock.calls.length + groqRequestMock.mock.calls.length).toBe(1);
  });

  it.each([
    { finishReason: "CONTINUATION", continuationToken: "offline-continuation-token" },
    { continuationToken: "offline-continuation-token" },
  ])("returns FAILED for an unfinished Gemini continuation response %#", async (candidate) => {
    geminiRequestMock.mockResolvedValue({
      candidates: [{ ...geminiResponse(EXTRACTION_JSON).candidates[0], ...candidate }],
    });

    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF, provider: "gemini" }))
      .resolves.toEqual({ status: "FAILED", profile: null });
    expect(geminiRequestMock).toHaveBeenCalledOnce();
    expect(groqRequestMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ finishReason: "MAX_TOKENS" }],
    [{ finishReason: "SAFETY" }],
    [{ finishReason: "RECITATION" }],
    [{ finishReason: "OTHER" }],
    [{ finishReason: "STOP", continuationToken: "offline-continuation-token" }],
    [{}],
    [],
  ])("returns FAILED for a non-successful Gemini response %# despite valid JSON", async (candidates) => {
    geminiRequestMock.mockResolvedValue(geminiResponse(EXTRACTION_JSON, { candidates }));

    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF, provider: "gemini" }))
      .resolves.toEqual({ status: "FAILED", profile: null });
    expect(geminiRequestMock).toHaveBeenCalledOnce();
    expect(groqRequestMock).not.toHaveBeenCalled();
  });

  it.each([
    ["text-only mock", { text: EXTRACTION_JSON, candidates: [{ finishReason: "STOP" }] }],
    ["missing content role", geminiResponse(EXTRACTION_JSON, {
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: EXTRACTION_JSON }] } }],
    })],
    ["unexpected content role", geminiResponse(EXTRACTION_JSON, {
      candidates: [{ finishReason: "STOP", content: { role: "user", parts: [{ text: EXTRACTION_JSON }] } }],
    })],
    ["function call beside JSON", geminiResponse(EXTRACTION_JSON, {
      candidates: [{ finishReason: "STOP", content: { role: "model", parts: [
        { text: EXTRACTION_JSON }, { functionCall: { name: "unexpected", args: {} } },
      ] } }],
    })],
    ["inline data beside JSON", geminiResponse(EXTRACTION_JSON, {
      candidates: [{ finishReason: "STOP", content: { role: "model", parts: [
        { text: EXTRACTION_JSON, inlineData: { mimeType: "text/plain", data: "extra" } },
      ] } }],
    })],
    ["thought beside JSON", geminiResponse(EXTRACTION_JSON, {
      candidates: [{ finishReason: "STOP", content: { role: "model", parts: [
        { text: "hidden", thought: true }, { text: EXTRACTION_JSON },
      ] } }],
    })],
    ["multiple text parts", geminiResponse(EXTRACTION_JSON, {
      candidates: [{ finishReason: "STOP", content: { role: "model", parts: [
        { text: EXTRACTION_JSON }, { text: "extra" },
      ] } }],
    })],
    ["automatic function history", {
      ...geminiResponse(EXTRACTION_JSON),
      automaticFunctionCallingHistory: [{ role: "model", parts: [{ functionCall: { name: "unexpected" } }] }],
    }],
    ["blocked prompt", { ...geminiResponse(EXTRACTION_JSON), promptFeedback: { blockReason: "SAFETY" } }],
  ])("returns FAILED for malformed or mixed Gemini %s", async (_case, response) => {
    // The installed SDK's text getter can still expose valid JSON from these
    // candidates while hiding their other parts or malformed content envelope.
    geminiRequestMock.mockResolvedValue({ ...response, text: EXTRACTION_JSON });

    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF, provider: "gemini" }))
      .resolves.toEqual({ status: "FAILED", profile: null });
    expect(geminiRequestMock).toHaveBeenCalledOnce();
    expect(groqRequestMock).not.toHaveBeenCalled();
  });

  it("uses only the first Gemini candidate even when another is valid", async () => {
    const valid = geminiResponse(EXTRACTION_JSON).candidates[0];
    geminiRequestMock.mockResolvedValueOnce({ candidates: [{ ...valid, finishReason: "SAFETY" }, valid] });
    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF, provider: "gemini" }))
      .resolves.toEqual({ status: "FAILED", profile: null });
    geminiRequestMock.mockResolvedValueOnce({ candidates: [valid, { ...valid, finishReason: "SAFETY" }] });
    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF, provider: "gemini" }))
      .resolves.toMatchObject({ status: "READY" });
  });

  it.each([
    { finish_reason: "length" },
    { finish_reason: "tool_calls" },
    { finish_reason: "function_call" },
    {},
    { finish_reason: "stop", message: { refusal: "Safety refusal" } },
  ])("returns FAILED for a non-successful Groq choice %# despite valid JSON", async (choice) => {
    groqRequestMock.mockResolvedValue({
      choices: [{
        finish_reason: choice.finish_reason,
        message: { role: "assistant", content: EXTRACTION_JSON, ...choice.message },
      }],
    });

    await expect(aiKit.normalizeUploadedCv({
      cvSource: CV_SOURCE, pdfBuffer: PDF, provider: "groq",
    })).resolves.toEqual({ status: "FAILED", profile: null });
    expect(groqRequestMock).toHaveBeenCalledOnce();
    expect(geminiRequestMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing role", { role: undefined }],
    ["unexpected role", { role: "user" }],
    ["tool calls", { tool_calls: [{ id: "call-1", type: "function", function: { name: "unexpected", arguments: "{}" } }] }],
    ["legacy function call", { function_call: { name: "unexpected", arguments: "{}" } }],
    ["executed tools", { executed_tools: [{ type: "function" }] }],
    ["extra reasoning", { reasoning: "extra" }],
    ["annotations", { annotations: [{ type: "document_citation" }] }],
    ["null content", { content: null }],
  ])("returns FAILED for malformed or mixed Groq %s", async (_case, message) => {
    groqRequestMock.mockResolvedValue(groqResponse(EXTRACTION_JSON, {
      choices: [{ finish_reason: "stop", message: { role: "assistant", content: EXTRACTION_JSON, ...message } }],
    }));

    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF, provider: "groq" }))
      .resolves.toEqual({ status: "FAILED", profile: null });
    expect(groqRequestMock).toHaveBeenCalledOnce();
    expect(geminiRequestMock).not.toHaveBeenCalled();
  });

  it("uses only the first Groq choice even when another is valid", async () => {
    const valid = groqResponse(EXTRACTION_JSON).choices[0];
    groqRequestMock.mockResolvedValueOnce({ choices: [{ ...valid, message: { ...valid.message, role: "user" } }, valid] });
    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF, provider: "groq" }))
      .resolves.toEqual({ status: "FAILED", profile: null });
    groqRequestMock.mockResolvedValueOnce({ choices: [valid, { ...valid, message: { ...valid.message, role: "user" } }] });
    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF, provider: "groq" }))
      .resolves.toMatchObject({ status: "READY" });
  });

  it.each(["gemini", "groq"])("propagates %s provider failure without another call", async (provider) => {
    const failure = new Error("strict mode rejected");
    geminiRequestMock.mockRejectedValue(failure);
    groqRequestMock.mockRejectedValue(failure);

    await expect(aiKit.normalizeUploadedCv({
      cvSource: CV_SOURCE, pdfBuffer: PDF, provider,
    })).rejects.toBe(failure);
    expect(geminiRequestMock.mock.calls.length + groqRequestMock.mock.calls.length).toBe(1);
  });

  it("rejects invalid source, provider, or PDF before any provider call", async () => {
    await expect(aiKit.normalizeUploadedCv({ cvSource: {}, pdfBuffer: PDF }))
      .rejects.toMatchObject({ code: "INVALID_UPLOADED_CV_INPUT" });
    await expect(aiKit.normalizeUploadedCv({
      cvSource: CV_SOURCE, pdfBuffer: PDF, provider: "unsupported",
    })).rejects.toThrow("provider must be codex, gemini, or groq");
    extractPdfTextMock.mockRejectedValueOnce(new Error("PDF unreadable"));
    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: PDF, provider: "gemini" }))
      .rejects.toThrow("PDF unreadable");
    expect(geminiRequestMock).not.toHaveBeenCalled();
    expect(groqRequestMock).not.toHaveBeenCalled();
  });
});
