import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCompletionMock, groqConstructorMock } = vi.hoisted(() => ({
  createCompletionMock: vi.fn(),
  groqConstructorMock: vi.fn(),
}));

vi.mock("groq-sdk", () => ({
  default: groqConstructorMock,
}));

import Groq from "groq-sdk";

import { createGroqClient } from "../src/llm/groq-client.js";

const logger = Object.freeze({
  error: vi.fn(),
});

describe("Groq client adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groqConstructorMock.mockImplementation(function GroqMock() {
      return {
        chat: {
          completions: {
            create: createCompletionMock,
          },
        },
      };
    });
  });

  it("injects provider config and forwards messages and options", async () => {
    const response = { choices: [{ message: { content: "offline response" } }] };
    const messages = [{ role: "user", content: "test" }];
    createCompletionMock.mockResolvedValue(response);

    const client = createGroqClient({
      apiKey: "test-groq-api-key",
      model: "openai/gpt-oss-120b",
      logger,
    });

    await expect(client.createChatCompletion({
      messages,
      temperature: 0.2,
      max_completion_tokens: 128,
    })).resolves.toBe(response);
    expect(Groq).toHaveBeenCalledOnce();
    expect(Groq).toHaveBeenCalledWith({ apiKey: "test-groq-api-key" });
    expect(createCompletionMock).toHaveBeenCalledOnce();
    expect(createCompletionMock).toHaveBeenCalledWith({
      model: "openai/gpt-oss-120b",
      messages,
      temperature: 0.2,
      max_completion_tokens: 128,
    });
  });

  it("logs minimal metadata and propagates provider failures", async () => {
    const apiKey = "secret-groq-api-key";
    const providerError = new Error("provider unavailable");
    createCompletionMock.mockRejectedValue(providerError);

    const client = createGroqClient({
      apiKey,
      model: "openai/gpt-oss-120b",
      logger,
    });

    await expect(client.createChatCompletion({
      messages: [{ role: "user", content: "private prompt" }],
    })).rejects.toBe(providerError);
    expect(logger.error).toHaveBeenCalledWith(
      "Groq createChatCompletion failed",
      {
        error: providerError,
        model: "openai/gpt-oss-120b",
      },
    );
    expect(logger.error.mock.calls.flat().join(" ")).not.toContain(apiKey);
    expect(logger.error.mock.calls.flat().join(" ")).not.toContain(
      "private prompt",
    );
  });

  it("rejects incomplete provider configuration before SDK initialization", () => {
    expect(() => createGroqClient({
      apiKey: "",
      model: "openai/gpt-oss-120b",
      logger,
    })).toThrow("apiKey must be a non-empty string");

    expect(() => createGroqClient({
      apiKey: "test-groq-api-key",
      model: "",
      logger,
    })).toThrow("model must be a non-empty string");

    expect(Groq).not.toHaveBeenCalled();
  });
});
