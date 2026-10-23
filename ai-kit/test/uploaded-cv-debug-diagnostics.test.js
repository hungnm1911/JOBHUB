import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runUploadedCvCodexSmoke } from "../scripts/smoke-uploaded-cv-codex.js";
import { composeUploadedCvProfile } from "../src/normalization/uploaded-cv-normalization.js";

const pdfBuffer = await readFile(new URL("./fixtures/pdf-text-extraction.pdf", import.meta.url));
const codex = { apiKey: "SECRET_API_KEY", baseURL: "https://codex.example.test/v1", model: "offline-model" };
const emptyExtraction = {
  careerPositioning: [], professionalSummary: [], skills: [], workExperiences: [],
  projects: [], educations: [], certifications: [], languages: [],
  otherCareerClaims: [], unresolvedContent: [],
};
const responseBody = (text, overrides = {}) => ({
  id: "resp_offline", object: "response", status: "completed", incomplete_details: null,
  error: null, usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
  output: [{ type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text }] }], ...overrides,
});
const runHttp = async (body, httpStatus = 200) => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), {
    status: httpStatus, headers: { "content-type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetchMock);
  const records = [];
  const result = await runUploadedCvCodexSmoke({
    pdfBuffer, codex, live: true, debug: true, correlationId: "trace-1",
    report: (record) => records.push(record),
  });
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(records.filter((record) => record.phase === "diagnostic")
    .every((record) => record.correlationId === "trace-1")).toBe(true);
  const output = JSON.stringify(records);
  expect(output).not.toMatch(/SECRET_API_KEY|raw-private-payload|private-claim|private-evidence|private PDF text/);
  return { result, records };
};
const gate = (records, name) => records.find((record) => record.gate === name);

afterEach(() => vi.unstubAllGlobals());

describe("F01 debug diagnostics on the existing smoke path", () => {
  it("reports each gate, HTTP status, usage, and one actual SDK HTTP request", async () => {
    const { result, records } = await runHttp(responseBody(JSON.stringify(emptyExtraction)));
    expect(result.status).toBe("READY");
    expect(gate(records, "http_sdk")).toMatchObject({ status: "PASS", httpStatus: 200, sdkRequestCount: 1 });
    expect(gate(records, "responses_api")).toMatchObject({ status: "PASS", responseStatus: "completed",
      outputCount: 1, outputTypes: ["message"], contentCount: [1], contentTypes: [["output_text"]],
      usage: { total_tokens: 30 } });
    for (const name of ["pdf_extraction", "request", "json_parse", "schema_validation",
      "evidence_validation", "composition"]) {
      expect(gate(records, name).status).toBe("PASS");
    }
  });

  it.each([
    ["JSON_PARSE_FAILED", "json_parse", responseBody("raw-private-payload")],
    ["SCHEMA_INVALID", "schema_validation", responseBody(JSON.stringify({ ...emptyExtraction,
      skills: [{ value: "private-claim", evidence: "private-evidence" }] }))],
    ["EVIDENCE_STRUCTURE_INVALID", "evidence_validation", responseBody(JSON.stringify({ ...emptyExtraction,
      skills: [{ value: "private-claim", evidence: [] }] }))],
  ])("identifies %s without private output", async (code, failedGate, body) => {
    const { result, records } = await runHttp(body);
    expect(result).toMatchObject({ status: "FAILED", failureKind: code });
    expect(gate(records, failedGate)).toMatchObject({ status: "FAIL", code });
    if (code === "SCHEMA_INVALID") {
      expect(gate(records, failedGate).issues[0]).toMatchObject({
        path: "/skills/0/evidence", keyword: "type", index: 0, code: "ARRAY_REQUIRED",
      });
    }
    if (code === "EVIDENCE_STRUCTURE_INVALID") {
      expect(gate(records, failedGate).issues[0]).toMatchObject({
        path: "/skills/0/evidence", keyword: "minItems", code: "EVIDENCE_REQUIRED",
      });
    }
  });

  it("reports an excerpt mismatch as diagnostic while retaining READY", async () => {
    const body = responseBody(JSON.stringify({ ...emptyExtraction,
      skills: [{ value: "private-claim", evidence: ["private-evidence"] }] }));
    const { result, records } = await runHttp(body);
    expect(result.status).toBe("READY");
    expect(gate(records, "evidence_validation")).toMatchObject({ status: "PASS" });
    expect(gate(records, "evidence_excerpt")).toMatchObject({ status: "WARN",
      code: "EXCERPT_NOT_FOUND", mismatchCount: 1,
      issues: [{ path: "/skills/0/evidence/0", index: 0, evidenceIndex: 0 }],
    });
    expect(gate(records, "composition")).toMatchObject({ status: "PASS" });
  });

  it("distinguishes incomplete Responses output and skips downstream validation", async () => {
    const body = responseBody(JSON.stringify(emptyExtraction), {
      status: "incomplete", incomplete_details: { reason: "max_output_tokens" },
    });
    const { result, records } = await runHttp(body);
    expect(result.failureKind).toBe("RESPONSE_REJECTED");
    expect(gate(records, "responses_api")).toMatchObject({ status: "FAIL",
      code: "RESPONSE_NOT_COMPLETED", incompleteReason: "max_output_tokens" });
    expect(gate(records, "json_parse").status).toBe("SKIPPED");
  });

  it("distinguishes refusal and SDK HTTP failure", async () => {
    const refused = await runHttp(responseBody("raw-private-payload", { output: [{ type: "message",
      role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "private-claim" }] }] }));
    expect(gate(refused.records, "responses_api")).toMatchObject({ status: "FAIL",
      code: "RESPONSE_REFUSAL", refusalPresent: true });
    const failed = await runHttp({ error: { message: "raw-private-payload", type: "bad_request" } }, 429);
    expect(failed.result.status).toBe("PROVIDER_ERROR");
    expect(gate(failed.records, "http_sdk")).toMatchObject({ status: "FAIL", httpStatus: 429 });
  });

  it("reports output shape failure with counts and types", async () => {
    const body = responseBody(JSON.stringify(emptyExtraction), { output: [
      { type: "reasoning" },
      { type: "function_call", arguments: "raw-private-payload" },
    ] });
    const { result, records } = await runHttp(body);
    expect(result.failureKind).toBe("RESPONSE_REJECTED");
    expect(gate(records, "responses_api")).toMatchObject({ status: "FAIL", code: "OUTPUT_SHAPE_INVALID",
      outputCount: 2, outputTypes: ["reasoning", "function_call"], contentCount: [null, null] });
  });

  it("keeps unexpected provider field names out of schema diagnostics", async () => {
    const body = responseBody(JSON.stringify({ ...emptyExtraction, "private-claim": "raw-private-payload" }));
    const { records } = await runHttp(body);
    expect(gate(records, "schema_validation")).toMatchObject({ status: "FAIL", code: "SCHEMA_INVALID" });
    expect(gate(records, "schema_validation").issues[0]).toMatchObject({
      path: "/", keyword: "additionalProperties", code: "UNEXPECTED_FIELD",
    });
  });

  it("reports configuration failure and skips the SDK", async () => {
    const records = [];
    const result = await runUploadedCvCodexSmoke({ pdfBuffer, codex: { ...codex, apiKey: "" },
      live: true, debug: true, correlationId: "trace-1", report: (record) => records.push(record) });
    expect(result).toMatchObject({ phase: "preflight", status: "FAILED" });
    expect(gate(records, "configuration")).toMatchObject({ status: "FAIL", code: "CONFIGURATION_INCOMPLETE" });
    expect(gate(records, "http_sdk").status).toBe("SKIPPED");
  });

  it("reports PDF preflight failure and never reaches HTTP", async () => {
    const records = [];
    const result = await runUploadedCvCodexSmoke({ pdfBuffer: Buffer.from("bad pdf"), codex,
      live: true, debug: true, correlationId: "trace-1", report: (record) => records.push(record) });
    expect(result).toMatchObject({ phase: "preflight", reason: "PDF_UNREADABLE" });
    expect(gate(records, "pdf_extraction")).toMatchObject({ status: "FAIL", code: "PDF_UNREADABLE" });
    expect(gate(records, "request")).toMatchObject({ status: "SKIPPED", code: "PREFLIGHT_FAILED" });
  });

  it("lets unexpected composition exceptions propagate from the canonical owner", () => {
    const source = { candidateCvId: "cv", categoryId: "cat", experienceLevelId: null,
      skillTags: [], employmentTypes: [], workModes: [], preferredLocations: [],
      taxonomy: { category: { id: "cat", name: "Category", level: "POSITION", parentCategoryId: "field" },
        experienceLevel: null } };
    const diagnostic = vi.fn();
    const clone = vi.spyOn(globalThis, "structuredClone").mockImplementation(() => {
      throw new Error("private PDF text");
    });
    try {
      expect(() => composeUploadedCvProfile({ cvSource: source, extractedText: "text",
        pdfExtractionOutput: JSON.stringify(emptyExtraction), diagnostic })).toThrow("private PDF text");
      expect(diagnostic.mock.calls.at(-1)[0]).toMatchObject({ gate: "evidence_validation", status: "PASS" });
      expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("private PDF text");
    } finally {
      clone.mockRestore();
    }
  });

  it("classifies an internal composition exception on the smoke path without its message", async () => {
    const originalClone = globalThis.structuredClone;
    const clone = vi.spyOn(globalThis, "structuredClone").mockImplementation((value) => {
      if (value && Object.hasOwn(value, "careerPositioning")) throw new Error("private PDF text");
      return originalClone(value);
    });
    try {
      const { result, records } = await runHttp(responseBody(JSON.stringify(emptyExtraction)));
      expect(result.status).toBe("INTERNAL_ERROR");
      expect(gate(records, "composition")).toMatchObject({ status: "FAIL", code: "INTERNAL_EXCEPTION" });
    } finally {
      clone.mockRestore();
    }
  });
});
