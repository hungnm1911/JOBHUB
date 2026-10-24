import Groq from "groq-sdk";

import { logProviderUsage } from "./provider-usage.js";
import { getProviderErrorMetadata } from "./provider-error-metadata.js";

const assertNonEmptyString = (value, fieldName) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
};

function createGroqClient({ apiKey, model, logger }) {
  assertNonEmptyString(apiKey, "apiKey");
  assertNonEmptyString(model, "model");

  if (!logger || ["error", "info"].some((method) => typeof logger[method] !== "function")) {
    throw new TypeError("logger must provide error and info methods");
  }

  const configuredModel = model.trim();
  // One HTTP attempt per call; provider recovery belongs to llm-fallback.js.
  const sdkClient = new Groq({ apiKey: apiKey.trim(), maxRetries: 0 });

  const createChatCompletion = async ({ messages, ...options } = {}) => {
    try {
      logger.info("AI provider API request started", {
        provider: "groq",
        model: configuredModel,
        operation: "chat.completions.create",
      });

      const response = await sdkClient.chat.completions.create({
        ...options,
        model: configuredModel,
        messages,
      });

      logProviderUsage({
        logger,
        provider: "groq",
        model: configuredModel,
        usage: {
          inputTokens: response?.usage?.prompt_tokens,
          outputTokens: response?.usage?.completion_tokens,
          totalTokens: response?.usage?.total_tokens,
          cachedTokens: response?.usage?.prompt_tokens_details?.cached_tokens,
        },
      });

      return response;
    } catch (error) {
      logger.error("Groq createChatCompletion failed", {
        provider: "groq",
        model: configuredModel,
        ...getProviderErrorMetadata(error),
      });

      throw error;
    }
  };

  return Object.freeze({ createChatCompletion });
}

export { createGroqClient };
