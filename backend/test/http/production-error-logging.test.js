import express from "express";
import request from "supertest";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../../src/config/index.js", () => ({
  default: {
    env: "production",
    fileUpload: { maxFileSizeMB: 10 },
    logging: { level: "info", format: "json", timeZone: "Asia/Bangkok" },
  },
}));

import errorHandler from "../../src/middlewares/error-handler.js";
import requestLogger from "../../src/middlewares/request-logger.js";
import config from "../../src/config/index.js";
import logger from "../../src/utils/logger.js";

afterEach(() => vi.restoreAllMocks());

it("includes the local date and time to the second in JSON logs", () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-11-23T20:30:53.914Z"));
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    logger.info("Timestamp check");

    expect(JSON.parse(stdoutWrite.mock.calls[0][0]).timestamp)
      .toBe("2026-11-24 03:30:53");
  } finally {
    vi.useRealTimers();
  }
});

it("emits correlated JSON access and exception records at production defaults", async () => {
  const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const app = express();
  app.use(requestLogger);
  app.get("/fail", () => {
    throw Object.assign(new Error("private provider output PRIVATE_MARKER"), {
      status: 503, code: "provider_failure",
    });
  });
  app.use(errorHandler);

  const response = await request(app).get("/fail?token=secret");
  const access = JSON.parse(stdoutWrite.mock.calls[0][0]);
  const failure = JSON.parse(stderrWrite.mock.calls[0][0]);

  expect(response.status).toBe(500);
  expect(response.body.error).toEqual({ message: "Internal server error" });
  expect(access).toMatchObject({
    level: "info", requestId: response.headers["x-request-id"],
    method: "GET", path: "/fail", statusCode: 500,
  });
  expect(failure).toMatchObject({
    level: "error", requestId: access.requestId, httpStatus: 500,
    upstreamStatus: 503, errorCode: "provider_failure", errorType: "Error",
  });
  expect(failure.stack[0]).toMatch(/production-error-logging\.test\.js:\d+:\d+/);
  expect(JSON.stringify([access, failure])).not.toMatch(/PRIVATE_MARKER|token=secret/);
});

it("correlates concurrent asynchronous AI Kit logs with their HTTP requests", async () => {
  const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const app = express();
  app.use(requestLogger);
  app.get("/provider/:delay", async (incoming, response) => {
    await new Promise((resolve) => setTimeout(resolve, Number(incoming.params.delay)));
    logger.info("AI provider API request started", { provider: "codex" });
    response.status(204).end();
  });

  const [first, second] = await Promise.all([
    request(app).get("/provider/15").set("X-Request-Id", "first-request"),
    request(app).get("/provider/1").set("X-Request-Id", "second-request"),
  ]);
  const records = stdoutWrite.mock.calls.map(([chunk]) => JSON.parse(chunk));
  const providerRecords = records.filter(({ message }) => message === "AI provider API request started");

  expect(first.status).toBe(204);
  expect(second.status).toBe(204);
  expect(providerRecords).toHaveLength(2);
  expect(providerRecords.map(({ requestId }) => requestId).sort()).toEqual([
    "first-request", "second-request",
  ]);
});

it("logs a rejected 4xx request at production defaults", async () => {
  const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const app = express();
  app.use(requestLogger);
  app.get("/reject", () => {
    throw Object.assign(new Error("private validation value PRIVATE_MARKER"), {
      expose: true, status: 422,
    });
  });
  app.use(errorHandler);

  const response = await request(app).get("/reject");
  const failure = JSON.parse(stderrWrite.mock.calls[0][0]);

  expect(response.status).toBe(422);
  expect(failure).toMatchObject({
    level: "warn", requestId: response.headers["x-request-id"],
    httpStatus: 422, errorType: "Error",
  });
  expect(failure.stack[0]).toMatch(/production-error-logging\.test\.js:\d+:\d+/);
  expect(JSON.stringify(failure)).not.toContain("PRIVATE_MARKER");
});

it("never emits development-only payloads in production", () => {
  const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  config.logging.level = "debug";
  try {
    logger.development("AI provider response", { response: "PRIVATE_MARKER" });
  } finally {
    config.logging.level = "info";
  }

  expect(stdoutWrite).not.toHaveBeenCalled();
  expect(stderrWrite).not.toHaveBeenCalled();
});

it("keeps spaced Unicode source locations while excluding messages, function labels and query-bearing frames", async () => {
  const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const error = new Error("PRIVATE_MARKER");
  error.stack = [
    "Error: PRIVATE_MARKER",
    "    at PRIVATE_FUNCTION (/srv/Đồ án (demo)/handler.js:12:34)",
    "    at /srv/Đồ án/handler.js:56:7",
    "    at file:///srv/encoded%20path/handler.js:8:9",
    "    at /srv/handler.js?token=PRIVATE_MARKER:1:2",
    "    at node:internal/process/task_queues:1:2",
  ].join("\n");
  const app = express();
  app.get("/fail", () => { throw error; });
  app.use(errorHandler);
  await request(app).get("/fail");
  const output = JSON.parse(stderrWrite.mock.calls[0][0]);
  expect(output.stack).toEqual([
    "/srv/Đồ án (demo)/handler.js:12:34",
    "/srv/Đồ án/handler.js:56:7",
    "file:///srv/encoded%20path/handler.js:8:9",
    "node:internal/process/task_queues:1:2",
  ]);
  expect(JSON.stringify(output)).not.toMatch(/PRIVATE_MARKER|PRIVATE_FUNCTION/);
});
