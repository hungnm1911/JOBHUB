import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runUploadedCvCodexSmoke } from "../scripts/smoke-uploaded-cv-codex.js";

const pdfBuffer = await readFile(new URL("./fixtures/pdf-text-extraction.pdf", import.meta.url));
const codex = { apiKey: "PRIVATE_KEY", baseURL: "https://codex.example.test/v1", model: "offline-model" };
const emptyExtraction = Object.fromEntries(["careerPositioning", "professionalSummary", "skills",
  "workExperiences", "projects", "educations", "certifications", "languages",
  "otherCareerClaims", "unresolvedContent"].map((key) => [key, []]));

const mockResponse = (text, responseStatus = "completed") => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    id: "resp_offline", object: "response", status: responseStatus,
    incomplete_details: responseStatus === "completed" ? null : { reason: "max_output_tokens" },
    error: null, usage: { input_tokens: 45, output_tokens: 20, total_tokens: 65 },
    output: [{ type: "message", role: "assistant", status: "completed",
      content: [{ type: "output_text", text }] }],
  }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => vi.unstubAllGlobals());

describe("F01 full local smoke output", () => {
  it("writes complete extraction, profile, and safe diagnostics after one mocked HTTP request", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "jobhub-smoke-output-"));
    const extraction = { ...emptyExtraction,
      skills: [{ value: "Private skill", evidence: ["Private skill evidence"] }],
      workExperiences: [{ companyName: "Private company", position: "Developer", period: "2022–2024",
        description: "Private work", achievements: ["Private outcome"], evidence: ["Private work evidence"] }],
      unresolvedContent: [{ value: "Private ambiguity", evidence: ["Private ambiguity evidence"] }],
    };
    const fetchMock = mockResponse(JSON.stringify(extraction));
    const records = [];
    try {
      const result = await runUploadedCvCodexSmoke({ pdfBuffer, codex, live: true, debug: true,
        fullOutput: true, outputRoot, correlationId: "offline-trace", report: (record) => records.push(record) });
      expect(result.status).toBe("READY");
      expect(fetchMock).toHaveBeenCalledOnce();
      const storedExtraction = JSON.parse(await readFile(result.outputPaths.extraction, "utf8"));
      const storedProfile = JSON.parse(await readFile(result.outputPaths.profile, "utf8"));
      const summary = JSON.parse(await readFile(result.outputPaths.diagnostic, "utf8"));
      expect(storedExtraction).toEqual(extraction);
      expect(storedProfile.pdfContent).toEqual(extraction);
      expect(storedProfile.source).toEqual({ type: "UPLOADED_CV", candidateCvId: "smoke-uploaded-cv" });
      expect(storedProfile.metadata).toBeDefined();
      expect(summary).toMatchObject({ provider: "codex", model: codex.model, status: "READY",
        httpStatus: 200, requestCount: 1, responseCompletion: "completed",
        usage: { total_tokens: 65 }, source: "synthetic smoke metadata" });
      expect(summary.gates.find((gate) => gate.gate === "composition").status).toBe("PASS");
      expect((await stat(result.outputPaths.extraction)).mode & 0o777).toBe(0o600);
      expect(JSON.stringify(records)).not.toMatch(/PRIVATE_KEY|Private skill|Private work|Private ambiguity/);
      expect(JSON.stringify(summary)).not.toMatch(/PRIVATE_KEY|Private skill|Private work|Private ambiguity/);
      expect(await readFile(result.outputPaths.extraction, "utf8")).not.toContain("Extract only career claims");
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });

  it("retains rejected provider text and a null profile without a second request", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "jobhub-smoke-output-"));
    const raw = "private incomplete JSON {";
    const fetchMock = mockResponse(raw, "incomplete");
    try {
      const result = await runUploadedCvCodexSmoke({ pdfBuffer, codex, live: true, debug: true,
        fullOutput: true, outputRoot, report: () => {} });
      expect(result).toMatchObject({ status: "FAILED", failureKind: "RESPONSE_REJECTED" });
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(JSON.parse(await readFile(result.outputPaths.extraction, "utf8")))
        .toEqual({ outputTexts: [raw] });
      expect(JSON.parse(await readFile(result.outputPaths.profile, "utf8"))).toBeNull();
      const summary = JSON.parse(await readFile(result.outputPaths.diagnostic, "utf8"));
      expect(summary).toMatchObject({ requestCount: 1, responseCompletion: "incomplete" });
      expect(summary.gates.find((gate) => gate.gate === "responses_api").status).toBe("FAIL");
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });

  it("requires an explicit live debug choice before output capture", async () => {
    await expect(runUploadedCvCodexSmoke({ pdfBuffer, codex, fullOutput: true,
      report: () => {} })).rejects.toThrow("fullOutput requires live debug smoke");
  });
});
