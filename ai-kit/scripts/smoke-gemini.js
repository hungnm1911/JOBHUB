import { createGeminiClient } from "../src/llm/gemini-client.js";

const EXPECTED_RESPONSE = "JOBHUB_GEMINI_OK";
const SMOKE_PROMPT = `Reply with exactly: ${EXPECTED_RESPONSE}`;

const runGeminiSmoke = async ({ apiKey, model, logger }) => {
  const client = createGeminiClient({ apiKey, model, logger });
  const startedAt = performance.now();
  const metadata = { provider: "gemini", model: model.trim() };

  logger.info("AI provider smoke started", metadata);

  try {
    const response = await client.generateContent({
      contents: SMOKE_PROMPT,
    });
    const responseText = typeof response?.text === "string"
      ? response.text.trim()
      : "";

    if (responseText.length === 0) {
      throw new Error("Gemini returned an empty text response");
    }

    if (responseText !== EXPECTED_RESPONSE) {
      throw new Error("Gemini returned unexpected text");
    }

    logger.info("AI provider smoke passed", {
      ...metadata,
      durationMs: Math.round(performance.now() - startedAt),
    });

    return Object.freeze({
      model: model.trim(),
      responseText,
    });
  } catch (error) {
    logger.error("AI provider smoke failed", {
      error,
      ...metadata,
      durationMs: Math.round(performance.now() - startedAt),
    });

    throw error;
  }
};

export { runGeminiSmoke };
