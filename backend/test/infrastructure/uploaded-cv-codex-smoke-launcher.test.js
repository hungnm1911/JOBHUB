import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import { runUploadedCvCodexSmoke } from "@jobhub/ai-kit/tooling/smoke-uploaded-cv-codex";
import { parseSmokeArgs, runBackendUploadedCvCodexSmoke } from "../../scripts/smoke-uploaded-cv-codex.js";

const config = { aiKit: { llm: { codex: {
  apiKey: "private-key", baseURL: "https://codex.example.test/v1", model: "codex-model",
} } } };

describe("Uploaded CV Codex smoke launcher", () => {
  it("requires --pdf and explicit --live", () => {
    expect(parseSmokeArgs(["--pdf", "fixture/example.pdf"])).toEqual({ pdfPath: "fixture/example.pdf", live: false, debug: false, fullOutput: false });
    expect(parseSmokeArgs(["--pdf", "fixture/example.pdf", "--live"]).live).toBe(true);
    expect(parseSmokeArgs(["--pdf", "fixture/example.pdf", "--live", "--debug"]).debug).toBe(true);
    expect(parseSmokeArgs(["--pdf", "fixture/example.pdf", "--live", "--debug", "--full-output"]).fullOutput).toBe(true);
    expect(() => parseSmokeArgs(["--pdf", "a.pdf", "--full-output"])).toThrow("CLI_USAGE");
    expect(() => parseSmokeArgs(["--pdf", "a.pdf", "--live", "--full-output"])).toThrow("CLI_USAGE");
    expect(() => parseSmokeArgs(["--live"])).toThrow("CLI_USAGE");
    expect(() => parseSmokeArgs(["--pdf", "a.pdf", "--unexpected"])).toThrow("CLI_USAGE");
  });

  it("passes only the existing Codex config and PDF bytes, and redacts output", async () => {
    const emit = vi.fn();
    const readPdf = vi.fn().mockResolvedValue(Buffer.from("pdf bytes"));
    const runSmoke = vi.fn(async ({ report }) => {
      report({ status: "READY", model: "private-key" });
      return { status: "READY" };
    });
    await runBackendUploadedCvCodexSmoke({
      args: ["--pdf", "fixture/example.pdf", "--live"], config, readPdf, runSmoke, emit,
    });
    expect(runSmoke).toHaveBeenCalledOnce();
    expect(runSmoke.mock.calls[0][0]).toMatchObject({
      pdfBuffer: Buffer.from("pdf bytes"), codex: config.aiKit.llm.codex, live: true,
    });
    expect(emit.mock.calls[0][0]).toContain("[REDACTED]");
    expect(emit.mock.calls[0][0]).not.toContain("private-key");
  });

  it("reports unreadable files without exposing their path or invoking F01", async () => {
    const emit = vi.fn();
    const runSmoke = vi.fn();
    const result = await runBackendUploadedCvCodexSmoke({
      args: ["--pdf", "private-name.pdf"], config, runSmoke,
      readPdf: vi.fn().mockRejectedValue(new Error("private-name.pdf")), emit,
    });
    expect(result).toEqual({ phase: "preflight", status: "FAILED", reason: "PDF_READ_ERROR" });
    expect(runSmoke).not.toHaveBeenCalled();
    expect(emit.mock.calls[0][0]).not.toContain("private-name.pdf");
  });

  it("threads one debug correlation ID through PDF read and the existing smoke runner", async () => {
    const emit = vi.fn();
    const runSmoke = vi.fn(async ({ correlationId, report }) => {
      report({ phase: "diagnostic", correlationId, gate: "http_sdk", status: "PASS", code: "HTTP_RESPONSE" });
      return { status: "READY" };
    });
    await runBackendUploadedCvCodexSmoke({ args: ["--pdf", "private-name.pdf", "--live", "--debug"],
      config, runSmoke, readPdf: vi.fn().mockResolvedValue(Buffer.from("private PDF text")), emit });
    const records = emit.mock.calls.map(([line]) => JSON.parse(line));
    expect(records[0]).toMatchObject({ gate: "pdf_read", status: "PASS" });
    expect(records[1]).toMatchObject({ gate: "http_sdk", correlationId: records[0].correlationId });
    expect(records[0].correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(records)).not.toMatch(/private-name|private PDF text|private-key/);
    expect(runSmoke.mock.calls[0][0]).toMatchObject({ debug: true, correlationId: records[0].correlationId });
  });

  it("reports PDF read failure under a debug correlation ID without the private path", async () => {
    const emit = vi.fn();
    await runBackendUploadedCvCodexSmoke({ args: ["--pdf", "private-name.pdf", "--debug"],
      config, runSmoke: vi.fn(), readPdf: vi.fn().mockRejectedValue(new Error("private-name.pdf")), emit });
    expect(JSON.parse(emit.mock.calls[0][0])).toMatchObject({ gate: "pdf_read", status: "FAIL",
      code: "PDF_READ_ERROR" });
    expect(JSON.stringify(emit.mock.calls)).not.toContain("private-name.pdf");
  });

  it("runs the CLI debug path through the real SDK with one mocked HTTP request", async () => {
    const pdf = await readFile(new URL("../../../ai-kit/test/fixtures/pdf-text-extraction.pdf", import.meta.url));
    const extraction = Object.fromEntries(["careerPositioning", "professionalSummary", "skills",
      "workExperiences", "projects", "educations", "certifications", "languages",
      "otherCareerClaims", "unresolvedContent"].map((key) => [key, []]));
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: "resp_mock", object: "response", status: "completed", incomplete_details: null,
      error: null, usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
      output: [{ type: "message", role: "assistant", status: "completed",
        content: [{ type: "output_text", text: JSON.stringify(extraction) }] }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const emit = vi.fn();
    try {
      const result = await runBackendUploadedCvCodexSmoke({
        args: ["--pdf", "private-name.pdf", "--live", "--debug"], config,
        runSmoke: runUploadedCvCodexSmoke, readPdf: vi.fn().mockResolvedValue(pdf), emit,
      });
      expect(result.status).toBe("READY");
      expect(fetchMock).toHaveBeenCalledOnce();
      const records = emit.mock.calls.map(([line]) => JSON.parse(line));
      const diagnostics = records.filter((record) => record.phase === "diagnostic");
      expect(diagnostics.map((record) => record.gate)).toEqual(expect.arrayContaining([
        "pdf_read", "pdf_extraction", "request", "http_sdk", "responses_api",
        "json_parse", "schema_validation", "evidence_validation", "composition",
      ]));
      expect(diagnostics.every((record) => record.correlationId === diagnostics[0].correlationId)).toBe(true);
      expect(diagnostics.find((record) => record.gate === "http_sdk"))
        .toMatchObject({ httpStatus: 200, sdkRequestCount: 1 });
      expect(JSON.stringify(records)).not.toMatch(/private-name|private-key|Backend Developer/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
