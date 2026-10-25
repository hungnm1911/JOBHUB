import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/index.js", () => ({
  default: { env: "development" },
}));
vi.mock("../../src/utils/logger.js", () => ({
  default: { error: vi.fn(), debug: vi.fn() },
}));

import errorHandler from "../../src/middlewares/error-handler.js";

describe("AI-V05 development diagnostic boundary", () => {
  it("returns only the bounded diagnostic and omits a private provider stack", () => {
    const marker = "PRIVATE_CV_PROMPT_MARKER";
    const error = new Error(`Provider failure ${marker}`);
    const diagnostic = { retrievalCandidates: 50, batchSize: 12,
      providerEvents: [{ gate: "exception", chain: [{ name: "APIConnectionError",
        message: "Connection error.", networkCode: "ECONNRESET" }] }] };
    const request = { id: "checkpoint", method: "POST",
      originalUrl: "/api/candidate/job-recommendations", aiV05Diagnostic: diagnostic };
    const json = vi.fn();
    const response = { status: vi.fn().mockReturnValue({ json }) };

    errorHandler(error, request, response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: {
      message: "Internal server error", diagnostic,
    } });
    expect(JSON.stringify(json.mock.calls)).not.toContain(marker);
  });
});
