import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGeminiClient } from "../src/llm/gemini-client.js";
import { createGroqClient } from "../src/llm/groq-client.js";
import { createJobExtractor } from "../src/normalization/job-extraction.js";

const GEMINI_API_KEY = "secret-gemini-api-key";
const GROQ_API_KEY = "secret-groq-api-key";
const GEMINI_HOST = "generativelanguage.googleapis.com";
const GROQ_HOST = "api.groq.com";

const createLogger = () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
});

const makeJobRawInput = () => ({
  jobId: "job-1",
  title: "Backend Engineer",
  jobDescription: "Yêu cầu: Node.js bắt buộc. Ưu tiên Docker. Làm việc từ xa.",
  requiredSkills: ["Node.js"],
  fieldCategoryIds: ["field-1"],
  positionCategoryIds: ["position-1"],
  experienceLevelId: "level-1",
  employmentType: "FULL_TIME",
  workModes: ["REMOTE"],
  location: { provinceCode: "01", districtCode: null },
});

const makeExtraction = () => ({
  requirements: [
    {
      name: "Node.js",
      priority: "REQUIRED",
      references: ["/requiredSkills/0", "/jobDescription"],
    },
    {
      name: "Docker",
      priority: "OPTIONAL",
      references: ["/jobDescription"],
    },
  ],
  minimumExperienceYears: null,
  employmentType: {
    value: "FULL_TIME",
    references: ["/employmentType"],
  },
  workModes: [
    {
      value: "REMOTE",
      references: ["/workModes/0", "/jobDescription"],
    },
  ],
  residualClaims: [],
  uncertainClaims: [],
  conflictingClaims: [],
});

const jsonResponse = (status, body) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

const geminiError = (status) => jsonResponse(status, {
  error: { code: status, message: `Gemini HTTP ${status}`, status: "UNAVAILABLE" },
});

const groqError = (status) => jsonResponse(status, {
  error: { message: `Groq HTTP ${status}`, type: "server_error" },
});

const groqSuccess = (payload) => jsonResponse(200, {
  id: "chatcmpl-test",
  object: "chat.completion",
  created: 0,
  model: "openai/gpt-oss-120b",
  choices: [{
    index: 0,
    finish_reason: "stop",
    message: { role: "assistant", content: JSON.stringify(payload) },
  }],
});

const connectionFailure = () => {
  return new TypeError("fetch failed", {
    cause: Object.assign(new Error("socket reset"), { code: "ECONNRESET" }),
  });
};

let providerResponses;
let fetchMock;

const countRequests = (host) => {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes(host)).length;
};

const respondWith = ({ gemini, groq }) => {
  providerResponses = { gemini, groq };
};

const createClients = (logger) => ({
  gemini: createGeminiClient({
    apiKey: GEMINI_API_KEY,
    model: "gemini-3.8-flash",
    logger,
  }),
  groq: createGroqClient({
    apiKey: GROQ_API_KEY,
    model: "openai/gpt-oss-120b",
    logger,
  }),
});

const serializeLogCalls = (logger) => {
  const calls = ["error", "info", "warn"].flatMap((method) => logger[method].mock.calls);

  return JSON.stringify(calls, (_key, value) => {
    return value instanceof Error
      ? { ...value, message: value.message, name: value.name }
      : value;
  });
};

beforeEach(() => {
  providerResponses = {};
  fetchMock = vi.fn(async (url) => {
    const target = String(url);
    const factory = target.includes(GEMINI_HOST)
      ? providerResponses.gemini
      : target.includes(GROQ_HOST) ? providerResponses.groq : undefined;

    if (!factory) {
      throw new Error(`Unexpected request to ${target}`);
    }

    const result = factory();

    if (result instanceof Error) {
      throw result;
    }

    return result;
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Job extraction fail-fast fallback HTTP attempts", () => {
  it.each([503, 429])(
    "falls back to Groq immediately after one Gemini HTTP %i attempt",
    async (status) => {
      respondWith({
        gemini: () => geminiError(status),
        groq: () => groqSuccess(makeExtraction()),
      });
      const logger = createLogger();
      const extractor = createJobExtractor({ ...createClients(logger), logger });

      await expect(extractor.extractJob(makeJobRawInput()))
        .resolves.toEqual(makeExtraction());
      expect(countRequests(GEMINI_HOST)).toBe(1);
      expect(countRequests(GROQ_HOST)).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith("LLM fallback succeeded", { status });
    },
  );

  it.each([503, 429])(
    "propagates the Groq HTTP %i error after one attempt per provider",
    async (status) => {
      respondWith({
        gemini: () => geminiError(503),
        groq: () => groqError(status),
      });
      const logger = createLogger();
      const extractor = createJobExtractor({ ...createClients(logger), logger });

      const error = await extractor.extractJob(makeJobRawInput())
        .catch((caught) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error.status).toBe(status);
      expect(countRequests(GEMINI_HOST)).toBe(1);
      expect(countRequests(GROQ_HOST)).toBe(1);
      expect(logger.error).toHaveBeenCalledWith("LLM fallback failed", {
        fallbackStatus: status,
        status: 503,
      });
      expect(serializeLogCalls(logger)).not.toContain(GEMINI_API_KEY);
      expect(serializeLogCalls(logger)).not.toContain(GROQ_API_KEY);
    },
  );

  it.each([400, 401, 403])(
    "does not fall back or retry after an ineligible Gemini HTTP %i",
    async (status) => {
      respondWith({
        gemini: () => geminiError(status),
        groq: () => groqSuccess(makeExtraction()),
      });
      const logger = createLogger();
      const extractor = createJobExtractor({ ...createClients(logger), logger });

      const error = await extractor.extractJob(makeJobRawInput())
        .catch((caught) => caught);

      expect(error.status).toBe(status);
      expect(countRequests(GEMINI_HOST)).toBe(1);
      expect(countRequests(GROQ_HOST)).toBe(0);
      expect(logger.info).not.toHaveBeenCalledWith(
        "LLM fallback attempted",
        expect.anything(),
      );
    },
  );
});

describe("Provider adapters perform no hidden SDK retries", () => {
  it.each([408, 429, 500, 503, 504])(
    "sends one Gemini HTTP attempt for status %i",
    async (status) => {
      respondWith({ gemini: () => geminiError(status) });
      const logger = createLogger();
      const extractor = createJobExtractor({
        gemini: createClients(logger).gemini,
        logger,
      });

      const error = await extractor.extractJob(makeJobRawInput())
        .catch((caught) => caught);

      expect(error.status).toBe(status);
      expect(countRequests(GEMINI_HOST)).toBe(1);
    },
  );

  it.each([408, 409, 429, 500, 503, 504])(
    "sends one Groq HTTP attempt for status %i",
    async (status) => {
      respondWith({ groq: () => groqError(status) });
      const logger = createLogger();
      const extractor = createJobExtractor({
        groq: createClients(logger).groq,
        logger,
      });

      const error = await extractor.extractJob(makeJobRawInput())
        .catch((caught) => caught);

      expect(error.status).toBe(status);
      expect(countRequests(GROQ_HOST)).toBe(1);
    },
  );

  it("sends one attempt per provider when connections fail", async () => {
    respondWith({
      gemini: connectionFailure,
      groq: connectionFailure,
    });
    const logger = createLogger();
    const extractor = createJobExtractor({ ...createClients(logger), logger });

    const error = await extractor.extractJob(makeJobRawInput())
      .catch((caught) => caught);

    expect(error.constructor.name).toBe("APIConnectionError");
    expect(countRequests(GEMINI_HOST)).toBe(1);
    expect(countRequests(GROQ_HOST)).toBe(1);
  });
});
