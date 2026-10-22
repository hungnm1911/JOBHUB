import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createResponse } = vi.hoisted(() => ({ createResponse: vi.fn() }));
vi.mock("openai", () => ({ default: class {
  responses = { create: createResponse };
} }));

import { runUploadedCvCodexSmoke } from "../scripts/smoke-uploaded-cv-codex.js";

const pdfBuffer = await readFile(new URL("./fixtures/pdf-text-extraction.pdf", import.meta.url));
const codex = {
  apiKey: "private-smoke-key",
  baseURL: "https://codex.example.test/v1",
  model: "codex-test-model",
};
const emptyExtraction = {
  careerPositioning: [], professionalSummary: [], skills: [],
  workExperiences: [], projects: [], educations: [], certifications: [],
  languages: [], otherCareerClaims: [], unresolvedContent: [],
};
const completedResponse = (text) => ({
  status: "completed", incomplete_details: null, error: null,
  usage: { input_tokens: 30, output_tokens: 10, total_tokens: 40,
    input_tokens_details: { cached_tokens: 2 } },
  output: [{ type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text }] }],
});

beforeEach(() => { createResponse.mockReset(); });

describe("AI-V02 Codex smoke harness", () => {
  it("preflights a real text PDF and valid synthetic source without an SDK request by default", async () => {
    const report = vi.fn();
    const result = await runUploadedCvCodexSmoke({ pdfBuffer, codex, report });

    expect(result).toEqual({ phase: "dry-run", status: "READY", providerCalls: 0 });
    expect(createResponse).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledOnce();
    expect(report.mock.calls[0][0]).toMatchObject({
      phase: "preflight", status: "READY", source: "synthetic",
      configuration: { provider: "codex", structuredOutput: "json_schema.strict", maxRetries: 0 },
    });
  });

  it("makes one F01 request and reports only counts and redacted evidence", async () => {
    createResponse.mockImplementation(async (request) => {
      const evidence = request.input.trim().slice(0, 16).trim();
      return completedResponse(JSON.stringify({
        ...emptyExtraction, skills: [{ value: evidence, evidence: [evidence] }],
      }));
    });
    const report = vi.fn();
    const result = await runUploadedCvCodexSmoke({ pdfBuffer, codex, live: true, report });

    expect(createResponse).toHaveBeenCalledOnce();
    expect(createResponse.mock.calls[0][0]).toMatchObject({
      model: codex.model,
      text: { format: { type: "json_schema", strict: true } },
    });
    expect(result).toMatchObject({
      phase: "live", status: "READY", completion: "response_received",
      requestStarted: true, claimCount: 1,
      evidence: { count: 1, excerpts: "[REDACTED]" },
      usage: { input_tokens: 30, output_tokens: 10, total_tokens: 40, cached_tokens: 2 },
    });
    expect(JSON.stringify(report.mock.calls)).not.toContain(codex.apiKey);
    expect(JSON.stringify(report.mock.calls)).not.toContain(createResponse.mock.calls[0][0].input);
  });

  it("distinguishes validation FAILED from a thrown provider error without echoing either payload", async () => {
    const report = vi.fn();
    createResponse.mockResolvedValueOnce(completedResponse("invalid raw CV response"));
    const failed = await runUploadedCvCodexSmoke({ pdfBuffer, codex, live: true, report });
    expect(failed).toMatchObject({ status: "FAILED", completion: "response_received", claimCount: 0 });

    createResponse.mockRejectedValueOnce(new Error(`provider payload ${codex.apiKey}`));
    const providerError = await runUploadedCvCodexSmoke({ pdfBuffer, codex, live: true, report });
    expect(providerError).toMatchObject({ status: "PROVIDER_ERROR", completion: "not_received" });
    expect(createResponse).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(report.mock.calls)).not.toMatch(/private-smoke-key|invalid raw CV response|provider payload/);
  });

  it("rejects unreadable PDF bytes before any provider request", async () => {
    const report = vi.fn();
    const result = await runUploadedCvCodexSmoke({ pdfBuffer: Buffer.from("bad pdf"), codex, live: true, report });
    expect(result).toMatchObject({ phase: "preflight", status: "FAILED", reason: "PDF_UNREADABLE" });
    expect(createResponse).not.toHaveBeenCalled();
  });
});
