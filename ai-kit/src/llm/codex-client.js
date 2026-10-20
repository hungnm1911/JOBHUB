import OpenAI from "openai";

import { logProviderUsage } from "./provider-usage.js";

const assertNonEmptyString = (value, fieldName) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
};

function createCodexClient({ apiKey, baseURL, model, logger }) {
  assertNonEmptyString(apiKey, "apiKey");
  assertNonEmptyString(baseURL, "baseURL");
  assertNonEmptyString(model, "model");

  if (!logger || ["error", "info"].some((method) => typeof logger[method] !== "function")) {
    throw new TypeError("logger must provide error and info methods");
  }

  const configuredModel = model.trim();

  const sdkClient = new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: baseURL.trim(),
    maxRetries: 0,
    timeout: 90_000,
  });

  // Retries and provider recovery belong to llm-fallback.js.
  const createResponse = async ({ input, ...options } = {}) => {
    try {
      logger.info("AI provider API request started", {
        provider: "codex",
        model: configuredModel,
        operation: "responses.create",
      });

      const response = await sdkClient.responses.create({
        ...options,
        model: configuredModel,
        input,
      });

      logProviderUsage({
        logger,
        provider: "codex",
        model: configuredModel,
        usage: {
          inputTokens: response?.usage?.input_tokens,
          outputTokens: response?.usage?.output_tokens,
          totalTokens: response?.usage?.total_tokens,
          cachedTokens: response?.usage?.input_tokens_details?.cached_tokens,
        },
      });

      return response;
    } catch (error) {
      logger.error("Codex createResponse failed", {
        error,
        model: configuredModel,
      });

      throw error;
    }
  };

  return Object.freeze({ createResponse });
}

export { createCodexClient };
