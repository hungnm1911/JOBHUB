import { afterEach, describe, expect, it, vi } from "vitest";

import { runBackendCodexSmoke } from "../../scripts/smoke-codex.js";
import { runBackendGeminiSmoke } from "../../scripts/smoke-gemini.js";
import { runBackendGroqSmoke } from "../../scripts/smoke-groq.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each([
  ["codex", runBackendCodexSmoke, "runCodexSmoke", "codex-model"],
  ["gemini", runBackendGeminiSmoke, "runGeminiSmoke", "gemini-model"],
  ["groq", runBackendGroqSmoke, "runGroqSmoke", "openai/gpt-oss-120b"],
])("%s smoke CLI logging", (provider, runBackendSmoke, harnessName, model) => {
  it("prints lifecycle and token metadata while redacting credentials in info and error logs", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const apiKey = "secret-smoke-api-key";
    const runSmoke = vi.fn(async ({ logger }) => {
      logger.info("AI provider smoke started", { provider, model });
      logger.info("AI provider API usage", {
        provider, model, input_tokens: 13, output_tokens: 5,
        total_tokens: 18, cached_tokens: 4,
      });
      logger.info("Redaction check", { nested: { value: apiKey } });
      logger.error("Provider error", {
        error: Object.assign(new Error(`Unauthorized: ${apiKey}`), { status: 401 }),
        model: apiKey,
      });
      logger.error("AI provider smoke failed", { provider, model, durationMs: 42 });
      return { model, responseText: "OK" };
    });

    await expect(runBackendSmoke({
      config: {
        aiKit: {
          llm: { [provider]: { apiKey, model, baseURL: "https://provider.example.test/v1" } },
        },
      },
      [harnessName]: runSmoke,
    })).resolves.toEqual({ model, responseText: "OK" });

    expect(runSmoke).toHaveBeenCalledOnce();
    const infoOutput = info.mock.calls.flat().join("\n");
    const errorOutput = error.mock.calls.flat().join("\n");
    expect(infoOutput).toContain('"input_tokens":13');
    expect(infoOutput).toContain('"output_tokens":5');
    expect(infoOutput).toContain('"total_tokens":18');
    expect(infoOutput).toContain('"cached_tokens":4');
    expect(infoOutput).toContain("[REDACTED]");
    expect(errorOutput).toContain("status=401");
    expect(errorOutput).toContain("[REDACTED]");
    expect(errorOutput).toContain('"durationMs":42');
    expect(errorOutput).not.toContain("undefined");
    expect(infoOutput + errorOutput).not.toContain(apiKey);
  });
});

it.each([
  [{ model: "openai/gpt-oss-120b" }, "Missing GROQ_API_KEY"],
  [{ apiKey: "test-key" }, "Missing GROQ_MODEL"],
  [{ apiKey: "test-key", model: "wrong-model" }, "GROQ_MODEL must be"],
])("rejects invalid Groq smoke configuration before invoking the harness (%j)", async (groq, message) => {
  const runGroqSmoke = vi.fn();

  await expect(runBackendGroqSmoke({
    config: { aiKit: { llm: { groq } } },
    runGroqSmoke,
  })).rejects.toThrow(message);
  expect(runGroqSmoke).not.toHaveBeenCalled();
});
