import Groq from "groq-sdk";

const assertNonEmptyString = (value, fieldName) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
};

function createGroqClient({ apiKey, model, logger }) {
  assertNonEmptyString(apiKey, "apiKey");
  assertNonEmptyString(model, "model");

  if (!logger || typeof logger.error !== "function") {
    throw new TypeError("logger must provide an error method");
  }

  const configuredModel = model.trim();
  // One HTTP attempt per call; provider recovery belongs to llm-fallback.js.
  const sdkClient = new Groq({ apiKey: apiKey.trim(), maxRetries: 0 });

  const createChatCompletion = async ({ messages, ...options } = {}) => {
    try {
      return await sdkClient.chat.completions.create({
        ...options,
        model: configuredModel,
        messages,
      });
    } catch (error) {
      logger.error("Groq createChatCompletion failed", {
        error,
        model: configuredModel,
      });

      throw error;
    }
  };

  return Object.freeze({ createChatCompletion });
}

export { createGroqClient };
