import http from "node:http";
import { io as connectSocketClient } from "socket.io-client";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  attachRealtimeDistribution,
  closeRealtimeDistribution,
} from "../../src/sockets/index.js";

const POLLING_HANDSHAKE_PATH = "/socket.io/?EIO=4&transport=polling";

const listenHttpServer = (server) => {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error) => {
      if (error) {
        reject(error);

        return;
      }

      resolve(server.address().port);
    });
  });
};

const closeListeningHttpServer = (server) => {
  return new Promise((resolve, reject) => {
    if (!server?.listening) {
      resolve();

      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);

        return;
      }

      resolve();
    });
  });
};

const waitForConnectError = (socket, timeoutMs = 2_000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("connect_error", onError);
      reject(new Error("Timed out waiting for socket connect_error"));
    }, timeoutMs);

    const onError = (error) => {
      clearTimeout(timer);
      resolve(error);
    };

    socket.once("connect_error", onError);
  });
};

describe("realtime CORS policy", () => {
  let httpServer = null;
  let baseUrl = null;
  const openSockets = [];

  const openWebSocket = (origin) => {
    const socket = connectSocketClient(baseUrl, {
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
      extraHeaders: { Origin: origin },
    });

    openSockets.push(socket);

    return socket;
  };

  beforeEach(async () => {
    httpServer = http.createServer();
    attachRealtimeDistribution(httpServer);
    const port = await listenHttpServer(httpServer);
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    openSockets.splice(0).forEach((socket) => socket.close());
    await closeRealtimeDistribution();
    await closeListeningHttpServer(httpServer);
    httpServer = null;
    baseUrl = null;
  });

  it.each([
    "http://localhost:5173",
    "https://jobhub.example.com",
  ])("allows the polling handshake from configured origin %s", async (origin) => {
    const response = await request(baseUrl)
      .get(POLLING_HANDSHAKE_PATH)
      .set("Origin", origin);

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
  });

  it("handles an allowed polling preflight request", async () => {
    const response = await request(baseUrl)
      .options(POLLING_HANDSHAKE_PATH)
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("rejects a polling handshake from an origin outside the whitelist", async () => {
    const response = await request(baseUrl)
      .get(POLLING_HANDSHAKE_PATH)
      .set("Origin", "https://attacker.example.com");

    expect(response.status).toBe(403);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows non-browser polling handshakes without an Origin header", async () => {
    const response = await request(baseUrl).get(POLLING_HANDSHAKE_PATH);

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("lets an allowed-origin WebSocket handshake reach realtime authentication", async () => {
    const socket = openWebSocket("http://localhost:5173");

    const error = await waitForConnectError(socket);

    expect(error.message).toBe("Authentication required");
  });

  it("rejects a WebSocket handshake from an origin outside the whitelist", async () => {
    const socket = openWebSocket("https://attacker.example.com");

    const error = await waitForConnectError(socket);

    expect(error.message).not.toBe("Authentication required");
  });
});
