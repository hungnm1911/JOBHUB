import { createMatchResultOrchestrator } from "./matching/match-result-orchestration.js";
import { createCvEvaluator } from "./evaluation/cv-evaluation.js";
import { normalizeGeneratedCv } from "./normalization/cv-normalization.js";
import { normalizeJob } from "./normalization/job-normalization.js";
import { buildJobEmbeddingText } from "./recommendation/job-embedding-text.js";
import { createUploadedCvNormalizer } from "./normalization/uploaded-cv-semantic-extraction.js";

const LOGGER_METHODS = Object.freeze(["error", "warn", "info", "debug"]);

const assertLogger = (logger) => {
  const hasLoggerContract = logger
    && LOGGER_METHODS.every((method) => typeof logger[method] === "function");

  if (!hasLoggerContract) {
    throw new TypeError(
      "logger must provide error, warn, info, and debug methods",
    );
  }
};

const assertOptionalNonEmptyString = (value, fieldName) => {
  if (
    value !== undefined
    && (typeof value !== "string" || value.trim().length === 0)
  ) {
    throw new TypeError(`${fieldName} must be a non-empty string when provided`);
  }
};

const assertOptionalProviderConfig = (provider, fieldName) => {
  if (provider === undefined) {
    return;
  }

  if (provider === null || typeof provider !== "object" || Array.isArray(provider)) {
    throw new TypeError(`${fieldName} must be an object when provided`);
  }

  assertOptionalNonEmptyString(provider.apiKey, `${fieldName}.apiKey`);
  assertOptionalNonEmptyString(provider.model, `${fieldName}.model`);
};

const assertOptionalCodexConfig = (codex) => {
  assertOptionalProviderConfig(codex, "llm.codex");

  if (codex !== undefined) {
    assertOptionalNonEmptyString(codex.baseURL, "llm.codex.baseURL");
  }
};

function createAiKit({ llm = {}, logger } = {}) {
  if (llm === null || typeof llm !== "object" || Array.isArray(llm)) {
    throw new TypeError("llm must be an object");
  }

  assertLogger(logger);
  assertOptionalCodexConfig(llm.codex);
  assertOptionalProviderConfig(llm.gemini, "llm.gemini");
  assertOptionalProviderConfig(llm.groq, "llm.groq");

  return Object.freeze({
    normalizeJob,
    buildJobEmbeddingText,
    normalizeGeneratedCv,
    normalizeUploadedCv: createUploadedCvNormalizer({ llm, logger }),
    matchJobCv: createMatchResultOrchestrator({ llm, logger }),
    evaluateCv: createCvEvaluator({ llm, logger }),
  });
}

export { createAiKit };
