import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { extractPdfTextMock } = vi.hoisted(() => ({ extractPdfTextMock: vi.fn() }));
vi.mock("../src/document/pdf-text-extractor.js", () => ({
  extractPdfTextFromBuffer: extractPdfTextMock,
}));

import { createAiKit } from "@jobhub/ai-kit";
import { UPLOADED_CV_PDF_EXTRACTION_SCHEMA } from "../src/normalization/uploaded-cv-normalization.js";

const EXTRACTION = {
  careerPositioning: [], professionalSummary: [], skills: [], workExperiences: [],
  projects: [], educations: [], certifications: [], languages: [],
  otherCareerClaims: [], unresolvedContent: [],
};
const TEXT = JSON.stringify(EXTRACTION);
const CV_SOURCE = {
  candidateCvId: "cv-1", categoryId: "position-1", experienceLevelId: null,
  skillTags: [], employmentTypes: [], workModes: [], preferredLocations: [],
  taxonomy: {
    category: {
      id: "position-1", name: "Backend Developer", level: "POSITION",
      parentCategoryId: "field-1",
    },
    experienceLevel: null,
  },
};
const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
const aiKit = createAiKit({
  llm: {
    gemini: { apiKey: "offline-gemini-key", model: "gemini-model" },
    groq: { apiKey: "offline-groq-key", model: "openai/gpt-oss-120b" },
  },
  logger,
});
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});
const geminiBody = (parts) => ({
  candidates: [{ finishReason: "STOP", content: { role: "model", parts } }],
});
const groqBody = (message) => ({
  id: "chatcmpl-offline", object: "chat.completion", created: 0,
  model: "openai/gpt-oss-120b",
  choices: [{ index: 0, finish_reason: "stop", message }],
});
const normalize = (provider) => aiKit.normalizeUploadedCv({
  cvSource: CV_SOURCE, pdfBuffer: Buffer.from("pdf"), provider,
});

beforeEach(() => {
  vi.clearAllMocks();
  extractPdfTextMock.mockResolvedValue("Backend Developer");
});
afterEach(() => vi.unstubAllGlobals());

describe("AI-V02 Gemini and Groq SDK response boundaries", () => {
  it.each([
    ["gemini", geminiBody([{ text: TEXT }])],
    ["groq", groqBody({ role: "assistant", content: TEXT })],
  ])("accepts the native %s response shape", async (provider, body) => {
    const fetchMock = vi.fn(async () => jsonResponse(body));
    vi.stubGlobal("fetch", fetchMock);

    const result = await aiKit.normalizeUploadedCv({
      cvSource: CV_SOURCE, pdfBuffer: Buffer.from("pdf"), provider,
    });

    expect(result.status).toBe("READY");
    expect(result.profile.pdfContent).toEqual(EXTRACTION);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ["gemini", geminiBody([
      { text: TEXT }, { functionCall: { name: "unexpected", args: {} } },
    ])],
    ["groq", groqBody({
      role: "assistant", content: TEXT,
      tool_calls: [{ id: "call-1", type: "function", function: { name: "unexpected", arguments: "{}" } }],
    })],
  ])("rejects schema-valid JSON with extra %s content from the real SDK", async (provider, body) => {
    const fetchMock = vi.fn(async () => jsonResponse(body));
    vi.stubGlobal("fetch", fetchMock);

    await expect(aiKit.normalizeUploadedCv({
      cvSource: CV_SOURCE, pdfBuffer: Buffer.from("pdf"), provider,
    })).resolves.toEqual({ status: "FAILED", profile: null });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(["gemini", "groq"])("sends all long PDF text to %s without local truncation", async (provider) => {
    const lastClaim = "END-OF-PDF-CAREER-CLAIM";
    const pdfText = `${"Career history. ".repeat(8000)}${lastClaim}`;
    const extraction = {
      ...EXTRACTION,
      otherCareerClaims: [{ value: lastClaim, evidence: [lastClaim] }],
    };
    extractPdfTextMock.mockResolvedValue(pdfText);
    const fetchMock = vi.fn(async () => jsonResponse(provider === "gemini"
      ? geminiBody([{ text: JSON.stringify(extraction) }])
      : groqBody({ role: "assistant", content: JSON.stringify(extraction) })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await normalize(provider);

    expect(result.status).toBe("READY");
    expect(result.profile.pdfContent.otherCareerClaims).toEqual(extraction.otherCareerClaims);
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    if (provider === "gemini") {
      expect(request.contents).toEqual([{ role: "user", parts: [{ text: pdfText }] }]);
      expect(request.generationConfig).toMatchObject({
        responseMimeType: "application/json",
        responseJsonSchema: UPLOADED_CV_PDF_EXTRACTION_SCHEMA,
      });
    } else {
      expect(request.messages[1]).toEqual({ role: "user", content: pdfText });
      expect(request.response_format).toEqual({
        type: "json_schema",
        json_schema: {
          name: "uploaded_cv_pdf_extraction", strict: true,
          schema: UPLOADED_CV_PDF_EXTRACTION_SCHEMA,
        },
      });
    }
  });

  it.each(["gemini", "groq"])("uses only the first %s candidate or choice from SDK HTTP", async (provider) => {
    const valid = provider === "gemini"
      ? geminiBody([{ text: TEXT }]).candidates[0]
      : groqBody({ role: "assistant", content: TEXT }).choices[0];
    const unfinished = provider === "gemini"
      ? { ...valid, finishReason: "MAX_TOKENS" }
      : { ...valid, finish_reason: "length" };
    const body = provider === "gemini"
      ? { candidates: [unfinished, valid] }
      : { ...groqBody(valid.message), choices: [unfinished, valid] };
    const fetchMock = vi.fn(async () => jsonResponse(body));
    vi.stubGlobal("fetch", fetchMock);

    await expect(normalize(provider)).resolves.toEqual({ status: "FAILED", profile: null });
    expect(fetchMock).toHaveBeenCalledOnce();

    fetchMock.mockResolvedValueOnce(jsonResponse(provider === "gemini"
      ? { candidates: [valid, unfinished] }
      : { ...groqBody(valid.message), choices: [valid, unfinished] }));
    await expect(normalize(provider)).resolves.toMatchObject({ status: "READY" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["gemini", { candidates: [{ finishReason: "MAX_TOKENS", content: { role: "model", parts: [{ text: TEXT }] } }] }],
    ["gemini", { candidates: [{ finishReason: "STOP", continuationToken: "next", content: { role: "model", parts: [{ text: TEXT }] } }] }],
    ["groq", { ...groqBody({ role: "assistant", content: TEXT }), choices: [{
      index: 0, finish_reason: "length", message: { role: "assistant", content: TEXT },
    }] }],
  ])("rejects %s incomplete output despite schema-valid JSON from SDK HTTP", async (provider, body) => {
    const fetchMock = vi.fn(async () => jsonResponse(body));
    vi.stubGlobal("fetch", fetchMock);

    await expect(normalize(provider)).resolves.toEqual({ status: "FAILED", profile: null });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ["gemini", 400, { error: { code: 400, message: "context limit", status: "INVALID_ARGUMENT" } }],
    ["gemini", 429, { error: { code: 429, message: "resource exhausted", status: "RESOURCE_EXHAUSTED" } }],
    ["groq", 400, { error: { message: "context limit", type: "invalid_request_error" } }],
    ["groq", 429, { error: { message: "rate limit", type: "rate_limit_error" } }],
  ])("propagates %s HTTP %i without retry or fallback", async (provider, status, body) => {
    const fetchMock = vi.fn(async () => jsonResponse(body, status));
    vi.stubGlobal("fetch", fetchMock);

    await expect(normalize(provider)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
