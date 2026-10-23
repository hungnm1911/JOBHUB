import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { extractPdfTextMock } = vi.hoisted(() => ({ extractPdfTextMock: vi.fn() }));
vi.mock("../src/document/pdf-text-extractor.js", () => ({
  extractPdfTextFromBuffer: extractPdfTextMock,
}));

import { createAiKit } from "@jobhub/ai-kit";
import { UPLOADED_CV_PDF_EXTRACTION_SCHEMA } from "../src/normalization/uploaded-cv-normalization.js";

const TEXT = "Backend Developer";
const EMPTY_EXTRACTION = {
  careerPositioning: [], professionalSummary: [], skills: [], workExperiences: [],
  projects: [], educations: [], certifications: [], languages: [],
  otherCareerClaims: [], unresolvedContent: [],
};
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
  llm: { codex: {
    apiKey: "offline-key", baseURL: "https://codex.example.test/v1", model: "offline-model",
  } },
  logger,
});
const jsonResponse = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});
const providerResponse = (overrides = {}) => ({
  id: "resp_offline", object: "response", model: "offline-model",
  status: "completed", incomplete_details: null, error: null,
  output: [{ type: "message", role: "assistant", status: "completed", content: [
    { type: "output_text", text: JSON.stringify(EMPTY_EXTRACTION), annotations: [] },
  ] }],
  ...overrides,
});

let fetchMock;
beforeEach(() => {
  vi.clearAllMocks();
  extractPdfTextMock.mockResolvedValue(TEXT);
});
afterEach(() => vi.unstubAllGlobals());

describe("AI-V02 Codex Responses SDK HTTP boundary", () => {
  it("serializes the native strict schema and reaches READY after exactly one request", async () => {
    fetchMock = vi.fn(async () => jsonResponse(200, providerResponse()));
    vi.stubGlobal("fetch", fetchMock);

    const result = await aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: Buffer.from("pdf") });

    expect(result.status).toBe("READY");
    expect(result.profile.pdfContent).toEqual(EMPTY_EXTRACTION);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://codex.example.test/v1/responses");
    expect(JSON.parse(options.body)).toEqual({
      model: "offline-model",
      instructions: expect.stringMatching(/verbatim PDF excerpts/),
      input: TEXT,
      text: { format: {
        type: "json_schema", name: "uploaded_cv_pdf_extraction", strict: true,
        schema: UPLOADED_CV_PDF_EXTRACTION_SCHEMA,
      } },
    });
  });

  it("sends all long PDF text to Codex and preserves evidence at the end", async () => {
    const lastClaim = "END-OF-PDF-CAREER-CLAIM";
    const pdfText = `${"Career history. ".repeat(8000)}${lastClaim}`;
    const extraction = {
      ...EMPTY_EXTRACTION,
      otherCareerClaims: [{ value: lastClaim, evidence: [lastClaim] }],
    };
    extractPdfTextMock.mockResolvedValue(pdfText);
    fetchMock = vi.fn(async () => jsonResponse(200, providerResponse({
      output: [{ type: "message", role: "assistant", status: "completed", content: [
        { type: "output_text", text: JSON.stringify(extraction), annotations: [] },
      ] }],
    })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: Buffer.from("pdf") });

    expect(result.status).toBe("READY");
    expect(result.profile.pdfContent.otherCareerClaims).toEqual(extraction.otherCareerClaims);
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.input).toBe(pdfText);
  });

  it("does not retry or fall back after a 429 response", async () => {
    fetchMock = vi.fn(async () => jsonResponse(429, {
      error: { message: "rate limited", type: "rate_limit_error" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: Buffer.from("pdf") }))
      .rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not continue an incomplete response with schema-valid text", async () => {
    fetchMock = vi.fn(async () => jsonResponse(200, providerResponse({
      status: "incomplete", incomplete_details: { reason: "max_output_tokens" },
    })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(aiKit.normalizeUploadedCv({ cvSource: CV_SOURCE, pdfBuffer: Buffer.from("pdf") }))
      .resolves.toEqual({ status: "FAILED", profile: null });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
