import { describe, expect, it, vi } from "vitest";

const createAiKitSpy = vi.hoisted(() => vi.fn());

vi.mock("@jobhub/ai-kit", async (importOriginal) => {
  const actual = await importOriginal();

  createAiKitSpy.mockImplementation(actual.createAiKit);

  return {
    ...actual,
    createAiKit: createAiKitSpy,
  };
});

import config from "../../src/config/index.js";
import { aiKit } from "../../src/services/ai-kit.service.js";
import logger from "../../src/utils/logger.js";

describe("AI Kit backend integration", () => {
  it("creates the shared instance with normalized config and the canonical logger", () => {
    expect(Object.keys(aiKit)).toEqual(["normalizeJob", "normalizeGeneratedCv"]);
    expect(Object.isFrozen(aiKit)).toBe(true);
    expect(createAiKitSpy).toHaveBeenCalledOnce();
    expect(createAiKitSpy).toHaveBeenCalledWith({
      llm: config.aiKit.llm,
      logger,
    });
    expect(config.aiKit.llm).toEqual({
      codex: {
        apiKey: "test-codex-api-key",
        baseURL: "https://codex.example.test/v1",
        model: "test-codex-model",
      },
      gemini: {
        apiKey: "test-gemini-api-key",
        model: "test-gemini-model",
      },
      groq: {
        apiKey: "test-groq-api-key",
        model: "test-groq-model",
      },
    });
  });
});
