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

const runUploadedCvCodexSmoke = async ({ pdfBuffer, codex, live = false, report }) => {
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
    if (!codex?.apiKey || !codex?.baseURL || !codex?.model) {
      throw new TypeError("Codex configuration is incomplete");
    }
    await extractPdfTextFromBuffer(pdfBuffer);
  } catch (error) {
    const reason = error instanceof PdfTextExtractionError ? error.code : "CONFIGURATION_OR_INPUT";
    const result = { phase: "preflight", status: "FAILED", reason, configuration };
    report(result);
    return result;
  }

  report({ phase: "preflight", status: "READY", mode: live ? "live" : "dry-run", configuration,
    pdfBytes: pdfBuffer.byteLength, source: "synthetic", providerCalls: 0 });
  if (!live) {
    return { phase: "dry-run", status: "READY", providerCalls: 0 };
  }

  let usage = emptyUsage();
  let requestStarted = false;
  let responseReceived = false;
  const logger = Object.freeze({
    info: (message, metadata = {}) => {
      if (message === "AI provider API request started") {
        requestStarted = true;
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

  try {
    const result = await createAiKit({ llm: { codex }, logger })
      .normalizeUploadedCv({ cvSource: SMOKE_CV_SOURCE, pdfBuffer });
    const summary = {
      phase: "live",
      status: result.status,
      completion: responseReceived ? "response_received" : "unknown",
      requestStarted,
      usage,
      durationMs: Math.round(performance.now() - startedAt),
      ...(result.status === "READY" ? summarizeProfile(result.profile) : {
        failureKind: "INVALID_OR_INCOMPLETE_OUTPUT",
        claimCount: 0,
        evidence: { count: 0, excerpts: "[REDACTED]" },
      }),
    };
    report(summary);
    return summary;
  } catch (error) {
    const summary = {
      phase: "live",
      status: error instanceof PdfTextExtractionError ? "FAILED" : "PROVIDER_ERROR",
      completion: responseReceived ? "response_received" : "not_received",
      requestStarted,
      usage,
      durationMs: Math.round(performance.now() - startedAt),
      ...(error instanceof PdfTextExtractionError ? { failureKind: "PDF_EXTRACTION_ERROR" } : {}),
    };
    report(summary);
    return summary;
  }
};

export { runUploadedCvCodexSmoke };
