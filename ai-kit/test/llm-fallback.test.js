import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  executeWithLlmFallback,
  executeWithLlmProviderChain,
} from "../src/llm/llm-fallback.js";

const createHttpError = (status, message = "provider request failed") => {
  return Object.assign(new Error(message), { status });
};

const logger = Object.freeze({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
});

describe("LLM fallback orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the primary result without calling the fallback", async () => {
    const primaryResult = { text: "Gemini result" };
    const primary = vi.fn().mockResolvedValue(primaryResult);
    const fallback = vi.fn();

    await expect(executeWithLlmFallback({
      primary,
      fallback,
      logger,
    })).resolves.toBe(primaryResult);

    expect(primary).toHaveBeenCalledOnce();
    expect(fallback).not.toHaveBeenCalled();
  });

  it.each([429, 500, 502, 503, 504])(
    "calls the fallback for primary HTTP status %i",
    async (status) => {
      const fallbackResult = { choices: [] };
      const primary = vi.fn().mockRejectedValue(createHttpError(status));
      const fallback = vi.fn().mockResolvedValue(fallbackResult);

      await expect(executeWithLlmFallback({
        primary,
        fallback,
        logger,
      })).resolves.toBe(fallbackResult);

      expect(primary).toHaveBeenCalledOnce();
      expect(fallback).toHaveBeenCalledOnce();
    },
  );

  it("calls the fallback for a structured connection error without a response", async () => {
    const connectionCause = Object.assign(new Error("socket closed"), {
      code: "ECONNRESET",
    });
    const primaryError = new Error("request failed", { cause: connectionCause });
    const fallbackResult = { choices: [{ message: { content: "Groq result" } }] };
    const primary = vi.fn().mockRejectedValue(primaryError);
    const fallback = vi.fn().mockResolvedValue(fallbackResult);

    await expect(executeWithLlmFallback({
      primary,
      fallback,
      logger,
    })).resolves.toBe(fallbackResult);

    expect(primary).toHaveBeenCalledOnce();
    expect(fallback).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      "LLM provider attempt failed",
      { provider: "primary", attempt: 1, status: null },
    );
  });

  it.each([400, 401, 403, 404])(
    "propagates primary HTTP status %i without fallback",
    async (status) => {
      const primaryError = createHttpError(status);
      const primary = vi.fn().mockRejectedValue(primaryError);
      const fallback = vi.fn();

      await expect(executeWithLlmFallback({
        primary,
        fallback,
        logger,
      })).rejects.toBe(primaryError);

      expect(primary).toHaveBeenCalledOnce();
      expect(fallback).not.toHaveBeenCalled();
    },
  );

  it("returns the fallback provider result unchanged", async () => {
    const fallbackResult = { choices: [{ id: "fallback-result" }] };
    const primary = vi.fn().mockRejectedValue(createHttpError(503));
    const fallback = vi.fn().mockResolvedValue(fallbackResult);

    const result = await executeWithLlmFallback({ primary, fallback, logger });

    expect(result).toBe(fallbackResult);
    expect(logger.info).toHaveBeenCalledWith(
      "LLM provider fallback succeeded",
      { provider: "fallback", attempt: 1 },
    );
  });

  it("propagates the fallback provider failure unchanged", async () => {
    const fallbackError = createHttpError(500, "fallback secret response");
    const primary = vi.fn().mockRejectedValue(createHttpError(429));
    const fallback = vi.fn().mockRejectedValue(fallbackError);

    await expect(executeWithLlmFallback({
      primary,
      fallback,
      logger,
    })).rejects.toBe(fallbackError);

    expect(logger.error).toHaveBeenCalledWith(
      "LLM provider chain failed",
      { provider: "fallback", attempt: 1, status: 500 },
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      "fallback secret response",
    );
  });

  it("does not retry either provider", async () => {
    const primary = vi.fn().mockRejectedValue(createHttpError(504));
    const fallback = vi.fn().mockRejectedValue(new Error("fallback failed"));

    await expect(executeWithLlmFallback({
      primary,
      fallback,
      logger,
    })).rejects.toThrow("fallback failed");

    expect(primary).toHaveBeenCalledOnce();
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("does not infer fallback eligibility from provider error text", async () => {
    const primaryError = createHttpError(
      400,
      "This model is currently experiencing high demand",
    );
    const primary = vi.fn().mockRejectedValue(primaryError);
    const fallback = vi.fn();

    await expect(executeWithLlmFallback({
      primary,
      fallback,
      logger,
    })).rejects.toBe(primaryError);

    expect(fallback).not.toHaveBeenCalled();
  });

  it("does not fallback for validation or programming errors", async () => {
    const primaryError = new TypeError("invalid request shape");
    const primary = vi.fn().mockRejectedValue(primaryError);
    const fallback = vi.fn();

    await expect(executeWithLlmFallback({
      primary,
      fallback,
      logger,
    })).rejects.toBe(primaryError);

    expect(fallback).not.toHaveBeenCalled();
  });

  it("does not treat a network code as response-free when a response exists", async () => {
    const primaryError = Object.assign(new Error("request failed"), {
      code: "ECONNRESET",
      response: { headers: {} },
    });
    const primary = vi.fn().mockRejectedValue(primaryError);
    const fallback = vi.fn();

    await expect(executeWithLlmFallback({
      primary,
      fallback,
      logger,
    })).rejects.toBe(primaryError);

    expect(fallback).not.toHaveBeenCalled();
  });
});

describe("LLM provider priority chain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries Codex once before falling back to Gemini and leaves Groq unused", async () => {
    const codex = vi.fn()
      .mockRejectedValueOnce(createHttpError(503))
      .mockRejectedValueOnce(createHttpError(503));
    const geminiResult = { text: "Gemini result" };
    const gemini = vi.fn().mockResolvedValue(geminiResult);
    const groq = vi.fn();

    await expect(executeWithLlmProviderChain({
      providers: [
        { name: "codex", execute: codex, maxAttempts: 2 },
        { name: "gemini", execute: gemini, maxAttempts: 1 },
        { name: "groq", execute: groq, maxAttempts: 1 },
      ],
      logger,
    })).resolves.toBe(geminiResult);

    expect(codex).toHaveBeenCalledTimes(2);
    expect(gemini).toHaveBeenCalledOnce();
    expect(groq).not.toHaveBeenCalled();
  });

  it("falls through Codex and Gemini to Groq in priority order", async () => {
    const order = [];
    const createFailure = (provider) => vi.fn(async () => {
      order.push(provider);
      throw createHttpError(503);
    });
    const codex = createFailure("codex");
    const gemini = createFailure("gemini");
    const groq = vi.fn(async () => {
      order.push("groq");
      return { choices: [] };
    });

    await executeWithLlmProviderChain({
      providers: [
        { name: "codex", execute: codex, maxAttempts: 2 },
        { name: "gemini", execute: gemini, maxAttempts: 1 },
        { name: "groq", execute: groq, maxAttempts: 1 },
      ],
      logger,
    });

    expect(order).toEqual(["codex", "codex", "gemini", "groq"]);
  });

  it("propagates a non-transient Codex failure without retry or fallback", async () => {
    const providerError = createHttpError(400);
    const codex = vi.fn().mockRejectedValue(providerError);
    const gemini = vi.fn();

    await expect(executeWithLlmProviderChain({
      providers: [
        { name: "codex", execute: codex, maxAttempts: 2 },
        { name: "gemini", execute: gemini, maxAttempts: 1 },
      ],
      logger,
    })).rejects.toBe(providerError);

    expect(codex).toHaveBeenCalledOnce();
    expect(gemini).not.toHaveBeenCalled();
  });

  it("propagates the final Groq failure after bounded attempts", async () => {
    const finalError = createHttpError(503);
    const codex = vi.fn().mockRejectedValue(createHttpError(503));
    const gemini = vi.fn().mockRejectedValue(createHttpError(503));
    const groq = vi.fn().mockRejectedValue(finalError);

    await expect(executeWithLlmProviderChain({
      providers: [
        { name: "codex", execute: codex, maxAttempts: 2 },
        { name: "gemini", execute: gemini, maxAttempts: 1 },
        { name: "groq", execute: groq, maxAttempts: 1 },
      ],
      logger,
    })).rejects.toBe(finalError);

    expect(codex).toHaveBeenCalledTimes(2);
    expect(gemini).toHaveBeenCalledOnce();
    expect(groq).toHaveBeenCalledOnce();
  });
});
