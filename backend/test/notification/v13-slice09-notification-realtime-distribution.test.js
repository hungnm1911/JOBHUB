import http from "node:http";
import mongoose from "mongoose";
import { io as connectSocketClient } from "socket.io-client";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import config from "../../src/config/index.js";
import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import REALTIME_EVENT from "../../src/constants/realtime-event.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthSession from "../../src/models/auth-session.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import Notification from "../../src/models/notification.model.js";
import {
  createNotificationEvent,
  materializeNotificationEvent,
} from "../../src/services/notification.service.js";
import {
  attachRealtimeDistribution,
  closeRealtimeDistribution,
  fetchUserRealtimeSockets,
  getUserRealtimeRoomName,
} from "../../src/services/realtime-distribution.service.js";
import { generateAuthToken, hashAuthToken } from "../../src/utils/hash-auth-token.js";
import { generateAccessToken } from "../../src/utils/jwt.js";
import { createVerifiedUser } from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const objectId = () => new mongoose.Types.ObjectId();

const FORBIDDEN_REALTIME_PERSISTENCE_NAMES = [
  "socketsession",
  "socketsessions",
  "socketconnection",
  "socketconnections",
  "notificationdelivery",
  "notificationdeliveries",
  "realtimeevent",
  "realtimeevents",
  "messagedelivery",
  "messagedeliveries",
  "messagereadreceipt",
  "messagereadreceipts",
  "onlinepresence",
  "onlinepresences",
];

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

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

const issueAccessToken = async (
  user,
  {
    expiresAt = new Date(Date.now() + config.authSession.expiresInMs),
  } = {},
) => {
  const session = await AuthSession.create({
    userId: user._id,
    refreshTokenHash: hashAuthToken(generateAuthToken()),
    expiresAt,
  });

  return generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
    sessionId: session._id.toString(),
  });
};

const openSocket = ({ port, accessToken, extraHeaders } = {}) => {
  return connectSocketClient(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    auth: accessToken ? { accessToken } : {},
    extraHeaders: extraHeaders ?? {},
  });
};

const waitForConnect = (socket, timeoutMs = 2_000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for socket connect"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    };

    const onConnect = () => {
      cleanup();
      resolve(socket);
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    if (socket.connected) {
      cleanup();
      resolve(socket);

      return;
    }

    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
  });
};

const waitForConnectError = (socket, timeoutMs = 2_000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for socket connect_error"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    };

    const onConnect = () => {
      cleanup();
      reject(new Error("Socket connected when authentication should fail"));
    };

    const onError = (error) => {
      cleanup();
      resolve(error);
    };

    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
  });
};

const waitForNotification = (socket, timeoutMs = 2_000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(REALTIME_EVENT.NOTIFICATION, onEvent);
      reject(new Error("Timed out waiting for notification realtime event"));
    }, timeoutMs);

    const onEvent = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };

    socket.once(REALTIME_EVENT.NOTIFICATION, onEvent);
  });
};

const collectNotifications = async (socket, durationMs = 250) => {
  const received = [];
  const onEvent = (payload) => {
    received.push(payload);
  };

  socket.on(REALTIME_EVENT.NOTIFICATION, onEvent);
  await wait(durationMs);
  socket.off(REALTIME_EVENT.NOTIFICATION, onEvent);

  return received;
};

const createEventForRecipient = async ({
  recipientUserId,
  extraRecipients = [],
  content = "A durable Notification for realtime distribution",
} = {}) => {
  return createNotificationEvent({
    eventKey: `slice09:${objectId()}`,
    type: NOTIFICATION_TYPE.APPLICATION_UNASSIGNED,
    applicationId: objectId(),
    recipients: [
      { recipientUserId, content },
      ...extraRecipients,
    ],
  });
};

describe("V13 Slice 09 Notification realtime distribution", () => {
  let httpServer = null;
  let realtimePort = null;
  const openSockets = [];

  const startRealtimeTestServer = async () => {
    httpServer = http.createServer();
    const attachedIo = attachRealtimeDistribution(httpServer);
    realtimePort = await listenHttpServer(httpServer);

    return { io: attachedIo, port: realtimePort };
  };

  const trackSocket = (socket) => {
    openSockets.push(socket);

    return socket;
  };

  const disconnectTrackedSockets = async () => {
    await Promise.all(
      openSockets.splice(0).map(async (socket) => {
        if (socket.connected) {
          socket.disconnect();
        } else {
          socket.close();
        }
      }),
    );
  };

  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await disconnectTrackedSockets();
    await closeRealtimeDistribution();
    await closeListeningHttpServer(httpServer);
    httpServer = null;
    realtimePort = null;
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("rejects unauthenticated and invalid-session handshakes without an authenticated connection", async () => {
    const { user } = await createVerifiedUser({
      email: "realtime-invalid@example.com",
    });
    const expiredToken = await issueAccessToken(user, {
      expiresAt: new Date(Date.now() - 60_000),
    });
    const pendingUser = await createVerifiedUser({
      email: "realtime-pending@example.com",
      status: USER_STATUS.PENDING_ACTIVATION,
    });
    const pendingToken = await issueAccessToken(pendingUser.user);
    await startRealtimeTestServer();

    const unauthenticated = trackSocket(openSocket({ port: realtimePort }));
    const expired = trackSocket(openSocket({
      port: realtimePort,
      accessToken: expiredToken,
    }));
    const pending = trackSocket(openSocket({
      port: realtimePort,
      accessToken: pendingToken,
    }));

    const unauthenticatedError = await waitForConnectError(unauthenticated);
    const expiredError = await waitForConnectError(expired);
    const pendingError = await waitForConnectError(pending);

    expect(unauthenticated.connected).toBe(false);
    expect(expired.connected).toBe(false);
    expect(pending.connected).toBe(false);
    expect(unauthenticatedError).toBeInstanceOf(Error);
    expect(expiredError).toBeInstanceOf(Error);
    expect(pendingError).toBeInstanceOf(Error);
    expect(await fetchUserRealtimeSockets(user._id)).toHaveLength(0);
    expect(await fetchUserRealtimeSockets(pendingUser.user._id)).toHaveLength(0);
  });

  it("delivers one Notification to every active socket of the recipient and never to another User", async () => {
    const recipient = await createVerifiedUser({
      email: "realtime-recipient@example.com",
    });
    const other = await createVerifiedUser({
      email: "realtime-other@example.com",
    });
    const recipientToken = await issueAccessToken(recipient.user);
    const otherToken = await issueAccessToken(other.user);
    await startRealtimeTestServer();

    const firstSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: recipientToken,
    }));
    const secondSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: recipientToken,
    }));
    const otherSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: otherToken,
    }));

    await Promise.all([
      waitForConnect(firstSocket),
      waitForConnect(secondSocket),
      waitForConnect(otherSocket),
    ]);

    const firstNotification = waitForNotification(firstSocket);
    const secondNotification = waitForNotification(secondSocket);
    const otherNotifications = collectNotifications(otherSocket);
    const { event } = await createEventForRecipient({
      recipientUserId: recipient.user._id,
      content: "Recipient-only realtime Notification",
    });

    await materializeNotificationEvent({ eventId: event._id });

    const [firstPayload, secondPayload, leaked] = await Promise.all([
      firstNotification,
      secondNotification,
      otherNotifications,
    ]);
    const durable = await Notification.findOne({
      eventId: event._id,
      recipientUserId: recipient.user._id,
    });

    expect(durable).not.toBeNull();
    expect(await Notification.countDocuments({ eventId: event._id })).toBe(1);
    expect(firstPayload.notification._id).toBe(durable._id.toString());
    expect(secondPayload.notification._id).toBe(durable._id.toString());
    expect(firstPayload.notification.recipientUserId).toBe(
      recipient.user._id.toString(),
    );
    expect(secondPayload.notification.content).toBe(
      "Recipient-only realtime Notification",
    );
    expect(firstPayload.notification.readAt).toBeNull();
    expect(durable.readAt).toBeNull();
    expect(leaked).toHaveLength(0);
    expect(await Notification.countDocuments({
      recipientUserId: other.user._id,
    })).toBe(0);
  });

  it("emits only after the durable Notification exists and never emits a ghost on materialization failure", async () => {
    const recipient = await createVerifiedUser({
      email: "realtime-ghost@example.com",
    });
    const other = await createVerifiedUser({
      email: "realtime-ghost-other@example.com",
    });
    const recipientToken = await issueAccessToken(recipient.user);
    const otherToken = await issueAccessToken(other.user);
    await startRealtimeTestServer();

    const recipientSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: recipientToken,
    }));
    const otherSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: otherToken,
    }));
    await Promise.all([
      waitForConnect(recipientSocket),
      waitForConnect(otherSocket),
    ]);

    const originalUpdateOne = Notification.updateOne.bind(Notification);
    vi.spyOn(Notification, "updateOne").mockRejectedValueOnce(
      new Error("materialization write failure"),
    );

    const { event: failedEvent } = await createEventForRecipient({
      recipientUserId: recipient.user._id,
    });
    const failedRecipientEvents = collectNotifications(recipientSocket);
    const failedOtherEvents = collectNotifications(otherSocket);

    await expect(
      materializeNotificationEvent({ eventId: failedEvent._id }),
    ).rejects.toThrow("materialization write failure");

    expect(await failedRecipientEvents).toHaveLength(0);
    expect(await failedOtherEvents).toHaveLength(0);
    expect(await Notification.countDocuments({ eventId: failedEvent._id })).toBe(0);
    expect((await NotificationEvent.findById(failedEvent._id)).materializedAt).toBeNull();

    vi.mocked(Notification.updateOne).mockImplementation((...arguments_) => {
      return originalUpdateOne(...arguments_);
    });

    const received = waitForNotification(recipientSocket);
    const stillQuiet = collectNotifications(otherSocket);
    const { event } = await createEventForRecipient({
      recipientUserId: recipient.user._id,
      content: "Persisted then emitted",
    });
    const payload = await (async () => {
      const pending = received;
      await materializeNotificationEvent({ eventId: event._id });

      return pending;
    })();
    const durable = await Notification.findOne({
      eventId: event._id,
      recipientUserId: recipient.user._id,
    });

    expect(durable).not.toBeNull();
    expect(payload.notification._id).toBe(durable._id.toString());
    expect(await stillQuiet).toHaveLength(0);
  });

  it("does not roll back durable Notification state when Socket emit or disconnect fails", async () => {
    const recipient = await createVerifiedUser({
      email: "realtime-socket-failure@example.com",
    });
    const accessToken = await issueAccessToken(recipient.user);
    const { io: attachedIo } = await startRealtimeTestServer();
    const socket = trackSocket(openSocket({
      port: realtimePort,
      accessToken,
    }));
    await waitForConnect(socket);

    vi.spyOn(attachedIo, "to").mockImplementation(() => {
      throw new Error("socket adapter failure");
    });

    const { event } = await createEventForRecipient({
      recipientUserId: recipient.user._id,
    });

    await expect(
      materializeNotificationEvent({ eventId: event._id }),
    ).resolves.toMatchObject({
      materializedAt: expect.any(Date),
    });

    const durable = await Notification.findOne({
      eventId: event._id,
      recipientUserId: recipient.user._id,
    });
    const persistedEvent = await NotificationEvent.findById(event._id);

    expect(durable).not.toBeNull();
    expect(durable.readAt).toBeNull();
    expect(persistedEvent.materializedAt).toBeInstanceOf(Date);

    vi.mocked(attachedIo.to).mockRestore();
    socket.disconnect();
    await wait(50);

    expect(await Notification.findById(durable._id)).not.toBeNull();
    expect(
      (await NotificationEvent.findById(event._id)).materializedAt,
    ).toBeInstanceOf(Date);
    expect((await Notification.findById(durable._id)).readAt).toBeNull();
  });

  it("keeps in-memory user room membership across connect and disconnect without Socket replay", async () => {
    const recipient = await createVerifiedUser({
      email: "realtime-membership@example.com",
    });
    const accessToken = await issueAccessToken(recipient.user);
    await startRealtimeTestServer();

    const firstSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken,
    }));
    await waitForConnect(firstSocket);

    expect(getUserRealtimeRoomName(recipient.user._id)).toBe(
      `user:${recipient.user._id}`,
    );
    expect(await fetchUserRealtimeSockets(recipient.user._id)).toHaveLength(1);

    const secondSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken,
    }));
    await waitForConnect(secondSocket);
    expect(await fetchUserRealtimeSockets(recipient.user._id)).toHaveLength(2);

    const { event } = await createEventForRecipient({
      recipientUserId: recipient.user._id,
      content: "Live sockets receive once",
    });
    const livePayloads = Promise.all([
      waitForNotification(firstSocket),
      waitForNotification(secondSocket),
    ]);
    await materializeNotificationEvent({ eventId: event._id });
    await livePayloads;

    firstSocket.disconnect();
    await wait(50);
    expect(await fetchUserRealtimeSockets(recipient.user._id)).toHaveLength(1);

    secondSocket.disconnect();
    await wait(50);
    expect(await fetchUserRealtimeSockets(recipient.user._id)).toHaveLength(0);

    const reconnected = trackSocket(openSocket({
      port: realtimePort,
      accessToken,
    }));
    await waitForConnect(reconnected);
    expect(await fetchUserRealtimeSockets(recipient.user._id)).toHaveLength(1);
    expect(await collectNotifications(reconnected)).toHaveLength(0);
    expect(await Notification.countDocuments({
      eventId: event._id,
      recipientUserId: recipient.user._id,
    })).toBe(1);
  });

  it("does not persist realtime session, delivery, or presence state outside the canonical Notification contract", async () => {
    const recipient = await createVerifiedUser({
      email: "realtime-persistence@example.com",
    });
    const accessToken = await issueAccessToken(recipient.user);
    await startRealtimeTestServer();
    const socket = trackSocket(openSocket({
      port: realtimePort,
      accessToken,
    }));
    await waitForConnect(socket);

    const { event } = await createEventForRecipient({
      recipientUserId: recipient.user._id,
    });
    const received = waitForNotification(socket);
    await materializeNotificationEvent({ eventId: event._id });
    await received;

    const modelNames = mongoose.modelNames().map((name) => name.toLowerCase());
    const collectionNames = Object.keys(mongoose.connection.collections).map(
      (name) => name.toLowerCase(),
    );
    const durable = await Notification.findOne({ eventId: event._id });

    for (const name of FORBIDDEN_REALTIME_PERSISTENCE_NAMES) {
      expect(modelNames).not.toContain(name);
      expect(collectionNames).not.toContain(name);
    }
    expect(Notification.schema.path("socketId")).toBeUndefined();
    expect(Notification.schema.path("deliveredAt")).toBeUndefined();
    expect(Notification.schema.path("deliveryStatus")).toBeUndefined();
    expect(Notification.schema.path("roomId")).toBeUndefined();
    expect(durable.readAt).toBeNull();
  });
});
