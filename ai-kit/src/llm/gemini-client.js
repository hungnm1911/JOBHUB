import { GoogleGenAI } from "@google/genai";

const assertNonEmptyString = (value, fieldName) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
};

function createGeminiClient({ apiKey, model, logger }) {
  assertNonEmptyString(apiKey, "apiKey");
  assertNonEmptyString(model, "model");

  if (!logger || typeof logger.error !== "function") {
    throw new TypeError("logger must provide an error method");
  }

  const configuredModel = model.trim();
  // One HTTP attempt per call; provider recovery belongs to llm-fallback.js.
  const sdkClient = new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: { retryOptions: { attempts: 1 } },
  });

  const generateContent = async ({ contents, config } = {}) => {
    try {
      return await sdkClient.models.generateContent({
        model: configuredModel,
        contents,
        config,
      });
    } catch (error) {
      logger.error("Gemini generateContent failed", {
        error,
        model: configuredModel,
      });

      throw error;
    }
  };

  return Object.freeze({ generateContent });
}

export { createGeminiClient };
