import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContentMock, googleGenAIConstructorMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  googleGenAIConstructorMock: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: googleGenAIConstructorMock,
}));

import { GoogleGenAI } from "@google/genai";

import { createGeminiClient } from "../src/llm/gemini-client.js";

const logger = Object.freeze({
  error: vi.fn(),
  info: vi.fn(),
});

describe("Gemini client adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    googleGenAIConstructorMock.mockImplementation(function GoogleGenAIMock() {
      return {
        models: {
          generateContent: generateContentMock,
        },
      };
    });
  });

  it("initializes the SDK with injected config and delegates generation", async () => {
    const response = {
      text: "offline mocked response",
      usageMetadata: {
        promptTokenCount: 11,
        candidatesTokenCount: 7,
        totalTokenCount: 18,
        cachedContentTokenCount: 3,
      },
    };
    const contents = [{ role: "user", parts: [{ text: "test" }] }];
    const config = { temperature: 0.2 };
    generateContentMock.mockResolvedValue(response);

    const client = createGeminiClient({
      apiKey: "test-api-key",
      model: "test-model",
      logger,
    });

    await expect(client.generateContent({ contents, config })).resolves.toBe(
      response,
    );
    expect(GoogleGenAI).toHaveBeenCalledOnce();
    expect(GoogleGenAI).toHaveBeenCalledWith({
      apiKey: "test-api-key",
      httpOptions: { retryOptions: { attempts: 1 } },
    });
    expect(generateContentMock).toHaveBeenCalledOnce();
    expect(generateContentMock).toHaveBeenCalledWith({
      model: "test-model",
      contents,
      config: { ...config, automaticContinuation: false },
    });
    expect(logger.info).toHaveBeenCalledWith("AI provider API usage", {
      provider: "gemini",
      model: "test-model",
      input_tokens: 11,
      output_tokens: 7,
      total_tokens: 18,
      cached_tokens: 3,
    });
  });

  it("logs provider failures without swallowing or replacing them", async () => {
    const providerError = new Error("provider unavailable");
    generateContentMock.mockRejectedValue(providerError);

    const client = createGeminiClient({
      apiKey: "test-api-key",
      model: "test-model",
      logger,
    });

    await expect(client.generateContent({ contents: "test" })).rejects.toBe(
      providerError,
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Gemini generateContent failed",
      {
        error: providerError,
        model: "test-model",
      },
    );
  });

  it("rejects incomplete provider configuration before SDK initialization", () => {
    expect(() => createGeminiClient({
      apiKey: "",
      model: "test-model",
      logger,
    })).toThrow("apiKey must be a non-empty string");

    expect(() => createGeminiClient({
      apiKey: "test-api-key",
      model: "",
      logger,
    })).toThrow("model must be a non-empty string");

    expect(GoogleGenAI).not.toHaveBeenCalled();
  });
});
