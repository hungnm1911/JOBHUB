import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeWithLlmFallback } from "../src/llm/llm-fallback.js";

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
      "Primary LLM provider failed",
      { status: null },
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
      "LLM fallback succeeded",
      { status: 503 },
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
      "LLM fallback failed",
      { fallbackStatus: 500, status: 429 },
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
