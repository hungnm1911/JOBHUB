import { describe, expect, it, vi } from "vitest";

import { parseSmokeArgs, runBackendUploadedCvCodexSmoke } from "../../scripts/smoke-uploaded-cv-codex.js";

const config = { aiKit: { llm: { codex: {
  apiKey: "private-key", baseURL: "https://codex.example.test/v1", model: "codex-model",
} } } };

describe("Uploaded CV Codex smoke launcher", () => {
  it("requires --pdf and explicit --live", () => {
    expect(parseSmokeArgs(["--pdf", "fixture/example.pdf"])).toEqual({ pdfPath: "fixture/example.pdf", live: false });
    expect(parseSmokeArgs(["--pdf", "fixture/example.pdf", "--live"]).live).toBe(true);
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
});
