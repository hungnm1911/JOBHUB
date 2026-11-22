import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import app from "../../src/app.js";
import errorHandler from "../../src/middlewares/error-handler.js";
import requestLogger from "../../src/middlewares/request-logger.js";
import AppError from "../../src/utils/app-error.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const createFailingApp = (error) => {
  const failingApp = express();

  failingApp.use(requestLogger);
  failingApp.get("/fail", () => {
    throw error;
  });
  failingApp.use(errorHandler);

  return failingApp;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("request id", () => {
  it("generates a request id and exposes it to browser clients", async () => {
    const response = await request(app)
      .get("/api/route-that-does-not-exist")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(404);
    expect(response.headers["x-request-id"]).toMatch(UUID_PATTERN);
    expect(response.headers["access-control-expose-headers"]).toBe(
      "X-Request-Id",
    );
  });

  it("reuses a safe incoming request id", async () => {
    const response = await request(app)
      .get("/api/route-that-does-not-exist")
      .set("X-Request-Id", "client-trace.42");

    expect(response.headers["x-request-id"]).toBe("client-trace.42");
  });

  it("replaces an unsafe incoming request id", async () => {
    const response = await request(app)
      .get("/api/route-that-does-not-exist")
      .set("X-Request-Id", "bad id\twith spaces");

    expect(response.headers["x-request-id"]).toMatch(UUID_PATTERN);
  });
});

describe("centralized error handling", () => {
  it("records every completed request with its actual status and timing", async () => {
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const response = await request(app).get("/api/route-that-does-not-exist?token=secret");
    const output = stdoutWrite.mock.calls.map(([chunk]) => String(chunk)).join("");

    expect(response.status).toBe(404);
    expect(output).toContain("INFO");
    expect(output).toContain("method: 'GET'");
    expect(output).toContain("path: '/api/route-that-does-not-exist'");
    expect(output).toContain("statusCode: 404");
    expect(output).toMatch(/durationMs: \d/);
    expect(output).not.toContain("token=secret");
  });

  it("records successful requests too", async () => {
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const successfulApp = express();
    successfulApp.use(requestLogger);
    successfulApp.get("/ok", (_request, response) => response.status(204).end());

    const response = await request(successfulApp).get("/ok");
    const output = stdoutWrite.mock.calls.map(([chunk]) => String(chunk)).join("");

    expect(response.status).toBe(204);
    expect(output).toContain("statusCode: 204");
    expect(output).toContain("path: '/ok'");
  });

  it("rejects a malformed JSON body as a client error", async () => {
    const response = await request(app)
      .post("/api/route-that-does-not-exist")
      .set("Content-Type", "application/json")
      .send("{\"broken\":");

    expect(response.status).toBe(400);
    expect(response.body.error.message).not.toBe("Internal server error");
  });

  it("logs safe metadata for unexpected provider errors and preserves HTTP failure", async () => {
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const marker = "PRIVATE_JOB_CV_RESPONSE_MARKER";
    const rootCause = new Error(`provider response ${marker}`);
    const providerError = Object.assign(
      new Error(`Upstream call failed ${marker}`, { cause: rootCause }),
      { status: 503, code: "server_error", response: { body: marker } },
    );
    const failingApp = createFailingApp(providerError);

    const response = await request(failingApp).get("/fail?token=secret");

    expect(response.status).toBe(500);
    expect(response.body.error.message).toBe("Internal server error");

    const output = stderrWrite.mock.calls.map(([chunk]) => String(chunk)).join("");

    expect(output).toContain("ERROR");
    expect(output).toContain(`[${response.headers["x-request-id"]}]`);
    expect(output).toContain("Unhandled server error");
    expect(output).toContain("GET /fail");
    expect(output).not.toContain("token=secret");
    expect(output).toContain("503");
    expect(output).toContain("server_error");
    expect(output).toContain("httpStatus: 500");
    expect(output).toContain("upstreamStatus: 503");
    expect(output).toMatch(/error-logging\.test\.js:\d+:\d+/);
    expect(output).toContain("cause");
    expect(output).not.toContain(marker);
  });

  it("records operational errors with their throw site", async () => {
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const failingApp = createFailingApp(new AppError(409, "Already exists"));

    const response = await request(failingApp).get("/fail");

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe("Already exists");
    const output = stderrWrite.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(output).toContain("WARN");
    expect(output).toContain("httpStatus: 409");
    expect(output).toMatch(/error-logging\.test\.js:\d+:\d+/);
  });

  it("preserves the cause of an AppError", () => {
    const rootCause = new Error("provider timeout");
    const error = new AppError(502, "Provider failed", null, { cause: rootCause });

    expect(error.cause).toBe(rootCause);
    expect(new AppError(400, "No cause").cause).toBeUndefined();
  });

  it("logs a translated infrastructure cause without its private message", async () => {
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const cause = Object.assign(new Error("private database record PRIVATE_MARKER"), {
      code: 11000,
    });
    const failingApp = createFailingApp(
      new AppError(503, "Database unavailable", null, { cause }),
    );

    const response = await request(failingApp).get("/fail");
    const output = stderrWrite.mock.calls.map(([chunk]) => String(chunk)).join("");

    expect(response.status).toBe(503);
    expect(output).toContain("errorCode: '11000'");
    expect(output).toContain("errorType: 'Error'");
    expect(output).toMatch(/error-logging\.test\.js:\d+:\d+/);
    expect(output).not.toContain("PRIVATE_MARKER");
  });
});
