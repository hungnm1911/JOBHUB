import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../src/app.js";

describe("application CORS policy", () => {
  it.each([
    "http://localhost:5173",
    "https://jobhub.example.com",
  ])("allows configured origin %s", async (origin) => {
    const response = await request(app)
      .get("/api/")
      .set("Origin", origin);

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers.vary).toContain("Origin");
  });

  it("handles an allowed preflight request with Authorization", async () => {
    const response = await request(app)
      .options("/api/")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "Authorization");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(response.headers["access-control-allow-headers"]).toBe(
      "Authorization",
    );
  });

  it("rejects an origin outside the whitelist", async () => {
    const response = await request(app)
      .get("/api/")
      .set("Origin", "https://attacker.example.com");

    expect(response.status).toBe(403);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.body.error.message).toBe("Origin is not allowed by CORS");
  });

  it("allows non-browser requests without an Origin header", async () => {
    const response = await request(app).get("/api/");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
