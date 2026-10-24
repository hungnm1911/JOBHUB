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
    expect(output).not.toContain(marker);
  });

  it("keeps operational errors out of the error log at the test level", async () => {
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const failingApp = createFailingApp(new AppError(409, "Already exists"));

    const response = await request(failingApp).get("/fail");

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe("Already exists");
    expect(stderrWrite).not.toHaveBeenCalled();
  });

  it("preserves the cause of an AppError", () => {
    const rootCause = new Error("provider timeout");
    const error = new AppError(502, "Provider failed", null, { cause: rootCause });

    expect(error.cause).toBe(rootCause);
    expect(new AppError(400, "No cause").cause).toBeUndefined();
  });
});
