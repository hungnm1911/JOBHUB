import { describe, expect, it } from "vitest";

import * as aiKit from "@jobhub/ai-kit";

const logger = Object.freeze({
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
});

describe("AI Kit public entrypoint", () => {
  it("exports createAiKit from the package root", () => {
    expect(Object.keys(aiKit)).toEqual(["createAiKit"]);
    expect(aiKit.createAiKit).toBeTypeOf("function");
  });

  it.each([
    ["neither provider", {}],
    ["Gemini only", {
      gemini: { apiKey: "gemini-key", model: "gemini-model" },
    }],
    ["Groq only", {
      groq: { apiKey: "groq-key", model: "groq-model" },
    }],
    ["both providers", {
      gemini: { apiKey: "gemini-key", model: "gemini-model" },
      groq: { apiKey: "groq-key", model: "groq-model" },
    }],
  ])("accepts injected config with %s", (_caseName, llm) => {
    const instance = aiKit.createAiKit({ llm, logger });

    expect(instance).toEqual({});
    expect(Object.isFrozen(instance)).toBe(true);
  });

  it("requires the injected logger contract", () => {
    expect(() => aiKit.createAiKit()).toThrow(TypeError);
    expect(() => aiKit.createAiKit({ logger: {} })).toThrow(
      "logger must provide error, warn, info, and debug methods",
    );
  });

  it("validates optional LLM configuration values", () => {
    expect(() => aiKit.createAiKit({
      llm: { groq: { apiKey: "" } },
      logger,
    })).toThrow("llm.groq.apiKey must be a non-empty string when provided");

    expect(() => aiKit.createAiKit({
      llm: { gemini: { model: 42 } },
      logger,
    })).toThrow("llm.gemini.model must be a non-empty string when provided");

    expect(() => aiKit.createAiKit({
      llm: { groq: null },
      logger,
    })).toThrow("llm.groq must be an object when provided");
  });
});
