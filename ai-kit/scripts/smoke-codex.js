import { createCodexClient } from "../src/llm/codex-client.js";

const EXPECTED_RESPONSE = "JOBHUB_CODEX_OK";
const SMOKE_PROMPT = `Reply with exactly: ${EXPECTED_RESPONSE}`;

const runCodexSmoke = async ({ apiKey, baseURL, model, logger }) => {
  const client = createCodexClient({ apiKey, baseURL, model, logger });
  const startedAt = performance.now();
  const metadata = { provider: "codex", model: model.trim() };

  logger.info("AI provider smoke started", metadata);

  try {
    const response = await client.createResponse({ input: SMOKE_PROMPT });
    const responseText = typeof response?.output_text === "string"
      ? response.output_text.trim()
      : "";

    if (responseText.length === 0) {
      throw new Error("Codex returned an empty text response");
    }

    if (responseText !== EXPECTED_RESPONSE) {
      throw new Error("Codex returned unexpected text");
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

export { runCodexSmoke };
