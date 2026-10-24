import { GoogleGenAI } from "@google/genai";

import { logProviderUsage } from "./provider-usage.js";
import { getProviderErrorMetadata } from "./provider-error-metadata.js";

const assertNonEmptyString = (value, fieldName) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
};

function createGeminiClient({ apiKey, model, logger }) {
  assertNonEmptyString(apiKey, "apiKey");
  assertNonEmptyString(model, "model");

  if (!logger || ["error", "info"].some((method) => typeof logger[method] !== "function")) {
    throw new TypeError("logger must provide error and info methods");
  }

  const configuredModel = model.trim();
  // One HTTP attempt per call; provider recovery belongs to llm-fallback.js.
  const sdkClient = new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: { retryOptions: { attempts: 1 } },
  });

  const generateContent = async ({ contents, config } = {}) => {
    try {
      logger.info("AI provider API request started", {
        provider: "gemini",
        model: configuredModel,
        operation: "models.generateContent",
      });

      const response = await sdkClient.models.generateContent({
        model: configuredModel,
        contents,
        config: { ...config, automaticContinuation: false },
      });

      logProviderUsage({
        logger,
        provider: "gemini",
        model: configuredModel,
        usage: {
          inputTokens: response?.usageMetadata?.promptTokenCount,
          outputTokens: response?.usageMetadata?.candidatesTokenCount,
          totalTokens: response?.usageMetadata?.totalTokenCount,
          cachedTokens: response?.usageMetadata?.cachedContentTokenCount,
        },
      });

      return response;
    } catch (error) {
      logger.error("Gemini generateContent failed", {
        provider: "gemini",
        model: configuredModel,
        ...getProviderErrorMetadata(error),
      });

      throw error;
    }
  };

  return Object.freeze({ generateContent });
}

export { createGeminiClient };
