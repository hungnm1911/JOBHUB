import { describe, expect, it, vi } from "vitest";

import { runBackendCodexSmoke } from "../../scripts/smoke-codex.js";

const createConfig = (codex) => ({
  aiKit: {
    llm: { codex },
  },
});

describe("Backend Codex smoke config handoff", () => {
  it("passes config.aiKit.llm.codex to the opt-in AI Kit harness", async () => {
    const harnessResult = { model: "codex-model", responseText: "OK" };
    const runCodexSmoke = vi.fn().mockResolvedValue(harnessResult);
    const codex = {
      apiKey: "codex-api-key",
      baseURL: "https://codex.example.test/v1",
      model: "codex-model",
    };

    await expect(runBackendCodexSmoke({
      config: createConfig(codex),
      runCodexSmoke,
    })).resolves.toBe(harnessResult);
    expect(runCodexSmoke).toHaveBeenCalledOnce();
    expect(runCodexSmoke).toHaveBeenCalledWith({
      ...codex,
      logger: expect.objectContaining({
        error: expect.any(Function),
        info: expect.any(Function),
      }),
    });
  });

  it.each([
    ["apiKey", { baseURL: "https://codex.example.test/v1", model: "codex-model" }, "Missing CCPRO_API_KEY"],
    ["baseURL", { apiKey: "codex-api-key", model: "codex-model" }, "Missing CCPRO_BASE_URL"],
    ["model", { apiKey: "codex-api-key", baseURL: "https://codex.example.test/v1" }, "Missing CCPRO_MODEL"],
  ])("fails without Codex %s and never calls the live harness", async (
    _field,
    codex,
    message,
  ) => {
    const runCodexSmoke = vi.fn();

    await expect(runBackendCodexSmoke({
      config: createConfig(codex),
      runCodexSmoke,
    })).rejects.toThrow(message);
    expect(runCodexSmoke).not.toHaveBeenCalled();
  });
});
