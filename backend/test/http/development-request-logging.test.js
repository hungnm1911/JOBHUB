import { EventEmitter } from "node:events";

import express from "express";
import request from "supertest";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../../src/config/index.js", () => ({
  default: { env: "development", fileUpload: { maxFileSizeMB: 10 },
    logging: { level: "debug", format: "pretty" } },
}));

import errorHandler from "../../src/middlewares/error-handler.js";
import requestLogger from "../../src/middlewares/request-logger.js";
import logger from "../../src/utils/logger.js";

afterEach(() => vi.restoreAllMocks());

it("logs the full JSON response and call site for a successful request", async () => {
  const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const app = express();
  app.use(requestLogger);
  app.get("/ok", (_incoming, response) => {
    logger.debug("Backend workflow checkpoint");
    response.json({ message: "complete", nested: { value: 42,
      deep: { level2: { level3: { level4: { level5: { leaf: "visible" } } } } } } });
  });

  const response = await request(app).get("/ok");
  const output = stdoutWrite.mock.calls.map(([chunk]) => String(chunk)).join("");

  expect(response.status).toBe(200);
  expect(output).toContain("HTTP response");
  expect(output).toContain("value: 42");
  expect(output).toContain("leaf: 'visible'");
  expect(output).toMatch(/development-request-logging\.test\.js:\d+:\d+/);
});

it("logs full error stack and response in development", async () => {
  const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const app = express();
  app.use(requestLogger);
  app.get("/fail", () => {
    throw new Error("development failure detail", {
      cause: new Error("root database failure"),
    });
  });
  app.use(errorHandler);

  const response = await request(app).get("/fail");
  const errorOutput = stderrWrite.mock.calls.map(([chunk]) => String(chunk)).join("");
  const responseOutput = stdoutWrite.mock.calls.map(([chunk]) => String(chunk)).join("");

  expect(response.status).toBe(500);
  expect(errorOutput).toContain("development failure detail");
  expect(errorOutput).toContain("root database failure");
  expect(errorOutput).toMatch(/development-request-logging\.test\.js:\d+:\d+/);
  expect(responseOutput).toContain("HTTP response");
  expect(responseOutput).toContain("Internal server error");
});

it("does not claim that a no-content response sent a body", async () => {
  const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const app = express();
  app.use(requestLogger);
  app.get("/empty", (_incoming, response) => response.status(204).json({
    neverSent: "body",
  }));

  const response = await request(app).get("/empty");
  const output = stdoutWrite.mock.calls.map(([chunk]) => String(chunk)).join("");

  expect(response.status).toBe(204);
  expect(output).toContain("HTTP response");
  expect(output).toContain("body: null");
  expect(output).not.toContain("neverSent");
});

it("explains an Express 304 with the response producer and generated representation", async () => {
  const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const app = express();
  app.use(requestLogger);
  app.get("/cache", (_incoming, response) => response.json({ province: "Hanoi" }));

  const first = await request(app).get("/cache");
  stdoutWrite.mockClear();
  const cached = await request(app).get("/cache").set("If-None-Match", first.headers.etag);
  const output = stdoutWrite.mock.calls.map(([chunk]) => String(chunk)).join("");

  expect(first.status).toBe(200);
  expect(cached.status).toBe(304);
  expect(output).toContain("statusCode: 304");
  expect(output).toContain("body: null");
  expect(output).toContain("representationStatusCode: 200");
  expect(output).toContain("representationBody: { province: 'Hanoi' }");
  expect(output).toMatch(/responseProducer: .*development-request-logging\.test\.js:\d+:\d+/);
});

it("reports an AI checkpoint when the client closes without a server exception", () => {
  const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const incoming = { method: "POST", originalUrl: "/api/candidate/job-recommendations",
    get: () => null };
  const response = new EventEmitter();
  response.set = vi.fn();
  response.send = vi.fn();
  response.statusCode = 200;
  response.writableFinished = false;

  requestLogger(incoming, response, () => {
    incoming.aiV05Diagnostic = { currentStage: "batch_inference",
      providerEvents: [{ gate: "request", status: "STARTED", provider: "codex" }] };
  });
  response.emit("close");

  const output = stderrWrite.mock.calls.map(([chunk]) => String(chunk)).join("");
  expect(output).toContain("HTTP request aborted");
  expect(output).toContain("batch_inference");
  expect(output).toContain("codex");
  response.send({ recommendations: ["late result"] });
  const lateOutput = stderrWrite.mock.calls.map(([chunk]) => String(chunk)).join("");
  expect(lateOutput).toContain("HTTP response generated after client disconnect");
  expect(lateOutput).toContain("late result");
});

it("emits complete provider diagnostics through the development-only logger", () => {
  const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  logger.development("AI provider response", { response: { output: "full output" } });

  const output = stdoutWrite.mock.calls.map(([chunk]) => String(chunk)).join("");
  expect(output).toContain("full output");
  expect(output).toContain("AI provider response");
});
