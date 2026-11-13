import { describe, expect, it } from "vitest";

import { createTestAgent } from "../helpers/database.js";

describe("shared HTTP test agent transport", () => {
  it("connects to the test listener's address family and receives the app's response", async () => {
    const request = createTestAgent()
      .get("/api/")
      .set("X-Request-Id", "test-agent-owned-listener");
    const listenerFamily = request.app.address().family;
    let remoteFamily;

    request.on("request", ({ req }) => {
      req.on("socket", (socket) => {
        socket.once("connect", () => {
          remoteFamily = socket.remoteFamily;
        });
      });
    });

    const response = await request;

    expect(remoteFamily).toBe(listenerFamily);
    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("test-agent-owned-listener");
  });
});
