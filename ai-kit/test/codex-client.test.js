import { beforeEach, describe, expect, it, vi } from "vitest";

const { createResponseMock, openAIConstructorMock } = vi.hoisted(() => ({
  createResponseMock: vi.fn(),
  openAIConstructorMock: vi.fn(),
}));

vi.mock("openai", () => ({
  default: openAIConstructorMock,
}));

import OpenAI from "openai";

import { createCodexClient } from "../src/llm/codex-client.js";

const logger = Object.freeze({
  error: vi.fn(),
  info: vi.fn(),
});

describe("Codex client adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openAIConstructorMock.mockImplementation(function OpenAIMock() {
      return {
        responses: {
          create: createResponseMock,
        },
      };
    });
  });

  it("injects compatible API config, disables SDK retries, and logs token usage", async () => {
    const response = {
      output_text: "offline response",
      usage: {
        input_tokens: 17,
        output_tokens: 6,
        total_tokens: 23,
        input_tokens_details: { cached_tokens: 8 },
      },
    };
    createResponseMock.mockResolvedValue(response);
    const client = createCodexClient({
      apiKey: "test-codex-api-key",
      baseURL: "https://codex.example.test/v1",
      model: "test-codex-model",
      logger,
    });

    await expect(client.createResponse({
      input: "test",
      temperature: 0,
    })).resolves.toBe(response);
    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: "test-codex-api-key",
      baseURL: "https://codex.example.test/v1",
      maxRetries: 0,
      timeout: 90_000,
    });
    expect(createResponseMock).toHaveBeenCalledWith({
      model: "test-codex-model",
      input: "test",
      temperature: 0,
    });
    expect(logger.info).toHaveBeenCalledWith("AI provider API usage", {
      provider: "codex",
      model: "test-codex-model",
      input_tokens: 17,
      output_tokens: 6,
      total_tokens: 23,
      cached_tokens: 8,
    });
  });

  it("logs failures without swallowing or replacing them", async () => {
    const marker = "PRIVATE_JOB_CV_RESPONSE_MARKER";
    const providerError = Object.assign(new Error(`provider unavailable ${marker}`), {
      status: 503,
      code: "server_error",
      error: { responseBody: marker },
    });
    createResponseMock.mockRejectedValue(providerError);
    const client = createCodexClient({
      apiKey: "test-codex-api-key",
      baseURL: "https://codex.example.test/v1",
      model: "test-codex-model",
      logger,
    });

    await expect(client.createResponse({ input: "private prompt" }))
      .rejects.toBe(providerError);
    expect(logger.error).toHaveBeenCalledWith("Codex createResponse failed", {
      provider: "codex",
      model: "test-codex-model",
      httpStatus: 503,
      errorCode: "server_error",
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(marker);
  });

  it("rejects incomplete config before SDK initialization", () => {
    const valid = {
      apiKey: "test-codex-api-key",
      baseURL: "https://codex.example.test/v1",
      model: "test-codex-model",
      logger,
    };

    expect(() => createCodexClient({ ...valid, apiKey: "" }))
      .toThrow("apiKey must be a non-empty string");
    expect(() => createCodexClient({ ...valid, baseURL: "" }))
      .toThrow("baseURL must be a non-empty string");
    expect(() => createCodexClient({ ...valid, model: "" }))
      .toThrow("model must be a non-empty string");
    expect(OpenAI).not.toHaveBeenCalled();
  });
});
