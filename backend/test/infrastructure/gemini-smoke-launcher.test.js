import { describe, expect, it, vi } from "vitest";

const toolingRunGeminiSmoke = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("Offline test must not reach the AI Kit Gemini harness");
  }),
);

vi.mock("@jobhub/ai-kit/tooling/smoke-gemini", () => ({
  runGeminiSmoke: toolingRunGeminiSmoke,
}));

import { runBackendGeminiSmoke } from "../../scripts/smoke-gemini.js";

const createConfig = (gemini) => ({
  aiKit: {
    llm: {
      apiKey: "wrong-llm-level-api-key",
      model: "wrong-llm-level-model",
      gemini,
      groq: {
        apiKey: "wrong-groq-api-key",
        model: "wrong-groq-model",
      },
    },
  },
});

describe("Backend Gemini smoke config handoff", () => {
  it("passes config.aiKit.llm.gemini credentials to the AI Kit harness", async () => {
    const harnessResult = { model: "gemini-model", responseText: "OK" };
    const runGeminiSmoke = vi.fn().mockResolvedValue(harnessResult);

    const result = await runBackendGeminiSmoke({
      config: createConfig({
        apiKey: "gemini-api-key",
        model: "gemini-model",
      }),
      runGeminiSmoke,
    });

    expect(result).toBe(harnessResult);
    expect(runGeminiSmoke).toHaveBeenCalledOnce();
    expect(runGeminiSmoke).toHaveBeenCalledWith({
      apiKey: "gemini-api-key",
      model: "gemini-model",
      logger: expect.objectContaining({ error: expect.any(Function) }),
    });
    expect(toolingRunGeminiSmoke).not.toHaveBeenCalled();
  });

  it.each([
    ["apiKey", { model: "gemini-model" }, "Missing GEMINI_API_KEY"],
    ["model", { apiKey: "gemini-api-key" }, "Missing GEMINI_MODEL"],
  ])(
    "does not fall back to llm.%s when the Gemini value is missing",
    async (_field, gemini, message) => {
      const runGeminiSmoke = vi.fn();

      await expect(
        runBackendGeminiSmoke({
          config: createConfig(gemini),
          runGeminiSmoke,
        }),
      ).rejects.toThrow(message);
      expect(runGeminiSmoke).not.toHaveBeenCalled();
      expect(toolingRunGeminiSmoke).not.toHaveBeenCalled();
    },
  );
});
