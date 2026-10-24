import { expect, it, vi } from "vitest";

const { createAiKit, logger } = vi.hoisted(() => ({
  createAiKit: vi.fn(() => ({})),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@jobhub/ai-kit", () => ({ createAiKit }));
vi.mock("../../src/config/index.js", () => ({ default: {
  aiKit: { semanticSkillsDebug: true, llm: { codex: { apiKey: "offline" } } },
} }));
vi.mock("../../src/utils/logger.js", () => ({ default: logger }));

it("does not install a semantic payload logger in runtime AI Kit composition", async () => {
  await import("../../src/services/ai-kit.service.js");

  expect(createAiKit).toHaveBeenCalledOnce();
  expect(createAiKit.mock.calls[0][0]).toEqual({
    llm: { codex: { apiKey: "offline" } }, logger,
  });
  expect(logger.debug).not.toHaveBeenCalled();
});
