import { beforeEach, describe, expect, it, vi } from "vitest";

const { codexRequest, geminiRequest, groqRequest } = vi.hoisted(() => ({
  codexRequest: vi.fn(),
  geminiRequest: vi.fn(),
  groqRequest: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class {
    responses = { create: codexRequest };
  },
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: geminiRequest };
  },
}));
vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create: groqRequest } };
  },
}));

import { runCodexSmoke } from "../scripts/smoke-codex.js";
import { runGeminiSmoke } from "../scripts/smoke-gemini.js";
import { runGroqSmoke } from "../scripts/smoke-groq.js";

const providers = [
  {
    provider: "codex",
    operation: "responses.create",
    runSmoke: runCodexSmoke,
    request: codexRequest,
    response: (text) => ({
      output_text: text,
      usage: {
        input_tokens: 13,
        output_tokens: 5,
        total_tokens: 18,
        input_tokens_details: { cached_tokens: 4 },
      },
    }),
  },
  {
    provider: "gemini",
    operation: "models.generateContent",
    runSmoke: runGeminiSmoke,
    request: geminiRequest,
    response: (text) => ({
      text,
      usageMetadata: {
        promptTokenCount: 13,
        candidatesTokenCount: 5,
        totalTokenCount: 18,
        cachedContentTokenCount: 4,
      },
    }),
  },
  {
    provider: "groq",
    operation: "chat.completions.create",
    runSmoke: runGroqSmoke,
    request: groqRequest,
    response: (text) => ({
      choices: [{ message: { content: text } }],
      usage: {
        prompt_tokens: 13,
        completion_tokens: 5,
        total_tokens: 18,
        prompt_tokens_details: { cached_tokens: 4 },
      },
    }),
  },
];

describe.each(providers)("$provider smoke logging", ({
  provider, operation, runSmoke, request, response,
}) => {
  let logger;
  const marker = `JOBHUB_${provider.toUpperCase()}_OK`;
  const config = {
    apiKey: "secret-smoke-api-key",
    baseURL: "https://provider.example.test/v1",
    model: " smoke-model ",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    logger = { info: vi.fn(), error: vi.fn() };
  });

  it("logs smoke/request start, normalized token usage, and validated success", async () => {
    request.mockResolvedValue(response(` ${marker} `));

    await expect(runSmoke({ ...config, logger })).resolves.toEqual({
      model: "smoke-model",
      responseText: marker,
    });

    expect(request).toHaveBeenCalledOnce();
    expect(logger.info.mock.calls).toEqual([
      ["AI provider smoke started", { provider, model: "smoke-model" }],
      ["AI provider API request started", {
        provider, model: "smoke-model", operation,
      }],
      ["AI provider API usage", {
        provider,
        model: "smoke-model",
        input_tokens: 13,
        output_tokens: 5,
        total_tokens: 18,
        cached_tokens: 4,
      }],
      ["AI provider smoke passed", {
        provider,
        model: "smoke-model",
        durationMs: expect.any(Number),
      }],
    ]);
    expect(logger.info.mock.calls[3][1].durationMs).toBeGreaterThanOrEqual(0);
    expect(logger.error).not.toHaveBeenCalled();
    const logs = JSON.stringify(logger.info.mock.calls);
    expect(logs).not.toContain(config.apiKey);
    expect(logs).not.toContain(marker);
    expect(logs).not.toContain("Reply with exactly");
  });

  it("identifies the API request before the provider responds", async () => {
    let completeRequest;
    request.mockImplementation(() => {
      expect(logger.info).toHaveBeenLastCalledWith(
        "AI provider API request started",
        { provider, model: "smoke-model", operation },
      );

      return new Promise((resolve) => {
        completeRequest = resolve;
      });
    });

    const pendingSmoke = runSmoke({ ...config, logger });

    expect(request).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).not.toHaveBeenCalledWith(
      "AI provider API usage", expect.anything(),
    );
    completeRequest(response(marker));
    await expect(pendingSmoke).resolves.toEqual({
      model: "smoke-model", responseText: marker,
    });
  });

  it.each(["", "private unexpected provider response"])(
    "logs failure instead of success for an invalid marker (%j)",
    async (text) => {
      request.mockResolvedValue(response(text));

      await expect(runSmoke({ ...config, logger })).rejects.toThrow(
        text ? "returned unexpected text" : "returned an empty text response",
      );

      expect(logger.info).not.toHaveBeenCalledWith(
        "AI provider smoke passed", expect.anything(),
      );
      expect(logger.error).toHaveBeenCalledExactlyOnceWith(
        "AI provider smoke failed",
        {
          error: expect.any(Error),
          provider,
          model: "smoke-model",
          durationMs: expect.any(Number),
        },
      );
      const loggedError = logger.error.mock.calls[0][1].error;
      expect(loggedError.message).not.toContain("private unexpected provider response");
      expect(JSON.stringify(logger.error.mock.calls)).not.toContain(config.apiKey);
    },
  );

  it("logs the failed run and propagates the original provider error without retry", async () => {
    const error = Object.assign(new Error("Provider unavailable"), { status: 503 });
    request.mockRejectedValue(error);

    await expect(runSmoke({ ...config, logger })).rejects.toBe(error);

    expect(request).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenLastCalledWith("AI provider smoke failed", {
      error,
      provider,
      model: "smoke-model",
      durationMs: expect.any(Number),
    });
    expect(logger.info.mock.calls).toEqual([
      ["AI provider smoke started", { provider, model: "smoke-model" }],
      ["AI provider API request started", {
        provider, model: "smoke-model", operation,
      }],
    ]);
  });
});
