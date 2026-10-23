import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createAiKit } from "../src/index.js";
import { extractPdfTextFromBuffer, PdfTextExtractionError } from "../src/document/pdf-text-extractor.js";
import { assertUploadedCvSource } from "../src/normalization/uploaded-cv-normalization.js";

// A synthetic, contract-valid projection. This smoke tool does not assert
// Backend ownership or authorization for a real CandidateCV.
const SMOKE_CV_SOURCE = Object.freeze({
  candidateCvId: "smoke-uploaded-cv",
  categoryId: "smoke-position",
  experienceLevelId: null,
  skillTags: [],
  employmentTypes: [],
  workModes: [],
  preferredLocations: [],
  taxonomy: {
    category: {
      id: "smoke-position",
      name: "Smoke position",
      level: "POSITION",
      parentCategoryId: "smoke-field",
    },
    experienceLevel: null,
  },
});

const emptyUsage = () => ({
  input_tokens: null,
  output_tokens: null,
  total_tokens: null,
  cached_tokens: null,
});

const tokenCount = (value) => Number.isInteger(value) && value >= 0 ? value : null;
const DEFAULT_OUTPUT_ROOT = fileURLToPath(new URL("../.smoke-output/", import.meta.url));

const extractionArtifact = (outputTexts) => {
  if (outputTexts.length !== 1) return { outputTexts };
  try {
    return JSON.parse(outputTexts[0]);
  } catch {
    return { outputTexts };
  }
};

const summarizeProfile = (profile) => {
  const claimsByGroup = Object.fromEntries(
    Object.entries(profile.pdfContent).map(([group, entries]) => [group, entries.length]),
  );
  const claimCount = Object.values(claimsByGroup).reduce((sum, count) => sum + count, 0);
  const evidenceCount = Object.values(profile.pdfContent)
    .flat()
    .reduce((sum, claim) => sum + claim.evidence.length, 0);

  return { claimCount, claimsByGroup, evidence: { count: evidenceCount, excerpts: "[REDACTED]" } };
};

const runUploadedCvCodexSmoke = async ({ pdfBuffer, codex, live = false, debug = false,
  fullOutput = false, outputRoot = DEFAULT_OUTPUT_ROOT, correlationId, report }) => {
  if (fullOutput && (!live || !debug)) throw new TypeError("fullOutput requires live debug smoke");
  let failedGate;
  const seenGates = new Set();
  const diagnostics = [{ gate: "pdf_read", status: "PASS", code: "PDF_READ" }];
  const diagnostic = debug ? (event) => {
    if (event.status === "FAIL") failedGate ??= event.gate;
    seenGates.add(event.gate);
    diagnostics.push(event);
    report({ phase: "diagnostic", correlationId, ...event });
  } : undefined;
  const reportSkipped = (code) => {
    for (const gate of ["source_input", "configuration", "pdf_extraction", "request", "http_sdk",
      "responses_api", "json_parse", "schema_validation", "evidence_validation", "composition"]) {
      if (!seenGates.has(gate)) diagnostic?.({ gate, status: "SKIPPED", code });
    }
  };
  const configuration = {
    provider: "codex",
    model: codex?.model?.trim() || null,
    operation: "responses.create",
    structuredOutput: "json_schema.strict",
    maxRetries: 0,
    timeoutMs: 90_000,
    baseURLConfigured: Boolean(codex?.baseURL),
    credentialsConfigured: Boolean(codex?.apiKey),
  };

  try {
    assertUploadedCvSource(SMOKE_CV_SOURCE);
    diagnostic?.({ gate: "source_input", stage: "preflight", status: "PASS", code: "SOURCE_VALID" });
    if (!codex?.apiKey || !codex?.baseURL || !codex?.model) {
      throw new TypeError("Codex configuration is incomplete");
    }
    diagnostic?.({ gate: "configuration", stage: "preflight", status: "PASS", code: "CONFIG_VALID" });
    const text = await extractPdfTextFromBuffer(pdfBuffer);
    diagnostic?.({ gate: "pdf_extraction", stage: "preflight", status: "PASS", code: "PDF_TEXT_EXTRACTED", textLength: text.length });
  } catch (error) {
    const reason = error instanceof PdfTextExtractionError ? error.code : "CONFIGURATION_OR_INPUT";
    diagnostic?.({ gate: error instanceof PdfTextExtractionError ? "pdf_extraction" :
      error?.code === "INVALID_UPLOADED_CV_INPUT" ? "source_input" : "configuration",
    stage: "preflight", status: "FAIL", code: error instanceof PdfTextExtractionError ? reason :
      error?.code === "INVALID_UPLOADED_CV_INPUT" ? "SOURCE_INVALID" : "CONFIGURATION_INCOMPLETE" });
    reportSkipped("PREFLIGHT_FAILED");
    const result = { phase: "preflight", status: "FAILED", reason, configuration };
    report(result);
    return result;
  }

  report({ phase: "preflight", status: "READY", mode: live ? "live" : "dry-run", configuration,
    pdfBytes: pdfBuffer.byteLength, source: "synthetic", providerCalls: 0 });
  if (!live) {
    diagnostic?.({ gate: "request", status: "SKIPPED", code: "DRY_RUN" });
    reportSkipped("DRY_RUN");
    return { phase: "dry-run", status: "READY", providerCalls: 0 };
  }

  let artifactDir;
  if (fullOutput) {
    try {
      await mkdir(outputRoot, { recursive: true, mode: 0o700 });
      artifactDir = await mkdtemp(join(outputRoot, "run-"));
    } catch {
      const result = { phase: "preflight", status: "FAILED", reason: "OUTPUT_DIRECTORY_ERROR" };
      report(result);
      return result;
    }
  }

  let usage = emptyUsage();
  let outputTexts = [];
  let requestStarted = false;
  let responseReceived = false;
  const logger = Object.freeze({
    info: (message, metadata = {}) => {
      if (message === "AI provider API request started") {
        requestStarted = true;
        diagnostic?.({ gate: "request", status: "PASS", code: "REQUEST_STARTED", sdkRequestCount: 1 });
      } else if (message === "AI provider API usage") {
        responseReceived = true;
        usage = Object.fromEntries(
          Object.keys(usage).map((key) => [key, tokenCount(metadata[key])]),
        );
      }
    },
    error: () => {},
    warn: () => {},
    debug: () => {},
  });
  const startedAt = performance.now();
  const saveArtifacts = async (summary, profile) => {
    if (!artifactDir) return summary;
    const paths = {
      extraction: join(artifactDir, "llm-extraction.json"),
      profile: join(artifactDir, "cv-match-profile.json"),
      diagnostic: join(artifactDir, "diagnostic-summary.json"),
    };
    const writeJson = (path, value) => {
      const contents = `${JSON.stringify(value, null, 2)}\n`;
      if (codex.apiKey && contents.includes(codex.apiKey)) throw new Error("SECRET_IN_OUTPUT");
      return writeFile(path, contents, { flag: "wx", mode: 0o600 });
    };
    try {
      await writeJson(paths.extraction, extractionArtifact(outputTexts));
      await writeJson(paths.profile, profile ?? null);
      await writeJson(paths.diagnostic, {
        provider: "codex", model: configuration.model, status: summary.status,
        httpStatus: diagnostics.find((event) => event.gate === "http_sdk")?.httpStatus ?? null,
        requestCount: diagnostics.find((event) => event.gate === "http_sdk")?.sdkRequestCount ??
          Number(requestStarted),
        responseCompletion: diagnostics.find((event) => event.gate === "responses_api")?.responseStatus ?? null,
        completion: summary.completion, usage: summary.usage, durationMs: summary.durationMs,
        source: "synthetic smoke metadata", correlationId, gates: diagnostics,
      });
      return { ...summary, outputPaths: paths };
    } catch {
      diagnostic?.({ gate: "artifact_write", status: "FAIL", code: "OUTPUT_WRITE_FAILED" });
      return { ...summary, status: "FAILED", failureKind: "OUTPUT_WRITE_FAILED", outputPaths: paths };
    }
  };

  try {
    const result = await createAiKit({ llm: { codex }, logger })
      .normalizeUploadedCv({ cvSource: SMOKE_CV_SOURCE, pdfBuffer,
        ...(fullOutput ? { captureOutput: (texts) => { outputTexts = texts; } } : {}),
        diagnostic: debug ? (event) => {
        if (event.gate === "request") return;
        if (["source_input", "configuration", "pdf_extraction"].includes(event.gate)) {
          event = { ...event, stage: "execution" };
        }
        if (event.gate === "responses_api" && event.usage) {
          event = { ...event, usage: Object.fromEntries(Object.entries(event.usage)
            .map(([key, value]) => [key, tokenCount(value)])) };
        }
        diagnostic(event);
      } : undefined });
    const summary = {
      phase: "live",
      status: result.status,
      completion: responseReceived ? "response_received" : "unknown",
      requestStarted,
      usage,
      durationMs: Math.round(performance.now() - startedAt),
      ...(result.status === "READY" ? summarizeProfile(result.profile) : {
        failureKind: debug ? failedGate === "responses_api" ? "RESPONSE_REJECTED" :
          failedGate === "json_parse" ? "JSON_PARSE_FAILED" :
            failedGate === "schema_validation" ? "SCHEMA_INVALID" :
              failedGate === "evidence_validation" ? "EVIDENCE_STRUCTURE_INVALID" : "INVALID_OR_INCOMPLETE_OUTPUT"
          : "INVALID_OR_INCOMPLETE_OUTPUT",
        claimCount: 0,
        evidence: { count: 0, excerpts: "[REDACTED]" },
      }),
    };
    reportSkipped("UPSTREAM_FAILED");
    const saved = await saveArtifacts(summary, result.profile);
    report(saved);
    return saved;
  } catch (error) {
    const providerFailure = failedGate === "http_sdk" || (!debug && requestStarted && !responseReceived);
    if (!providerFailure && !(error instanceof PdfTextExtractionError)) {
      diagnostic?.({ gate: "composition", status: "FAIL", code: "INTERNAL_EXCEPTION" });
    }
    reportSkipped("UPSTREAM_FAILED");
    const summary = {
      phase: "live",
      status: error instanceof PdfTextExtractionError ? "FAILED" : providerFailure ? "PROVIDER_ERROR" : "INTERNAL_ERROR",
      completion: responseReceived ? "response_received" : "not_received",
      requestStarted,
      usage,
      durationMs: Math.round(performance.now() - startedAt),
      ...(error instanceof PdfTextExtractionError ? { failureKind: "PDF_EXTRACTION_ERROR" } : {}),
    };
    const saved = await saveArtifacts(summary, null);
    report(saved);
    return saved;
  }
};

export { runUploadedCvCodexSmoke };
