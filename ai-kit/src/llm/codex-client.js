import OpenAI from "openai";

import { logProviderUsage } from "./provider-usage.js";
import { getProviderErrorMetadata } from "./provider-error-metadata.js";

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
  const createResponse = async ({ input, diagnostic, ...options } = {}) => {
    try {
      logger.info("AI provider API request started", {
        provider: "codex",
        model: configuredModel,
        operation: "responses.create",
      });

      const request = sdkClient.responses.create({
        ...options,
        model: configuredModel,
        input,
      });
      // withResponse resolves the same SDK promise and exposes its HTTP response.
      const { data: response, response: httpResponse } = diagnostic
        ? await request.withResponse()
        : { data: await request };
      diagnostic?.({ gate: "http_sdk", status: "PASS", code: "HTTP_RESPONSE",
        httpStatus: httpResponse.status, sdkRequestCount: 1 });

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
      diagnostic?.({ gate: "http_sdk", status: "FAIL", code: "SDK_REQUEST_FAILED",
        httpStatus: Number.isInteger(error?.status) ? error.status : null,
        sdkRequestCount: 1 });
      logger.error("Codex createResponse failed", {
        provider: "codex",
        model: configuredModel,
        ...getProviderErrorMetadata(error),
      });

      throw error;
    }
  };

  return Object.freeze({ createResponse });
}

export { createCodexClient };
