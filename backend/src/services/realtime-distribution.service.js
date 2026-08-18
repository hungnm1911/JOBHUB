import { Server as SocketIOServer } from "socket.io";

import REALTIME_EVENT from "../constants/realtime-event.js";
import AppError from "../utils/app-error.js";
import { authenticateAccess } from "./authenticate-access.service.js";

let ioServer = null;

const getUserRealtimeRoomName = (userId) => `user:${String(userId)}`;

const extractHandshakeAccessToken = (handshake) => {
  const auth = handshake?.auth ?? {};

  if (typeof auth.accessToken === "string" && auth.accessToken.trim() !== "") {
    return auth.accessToken;
  }

  if (typeof auth.token === "string" && auth.token.trim() !== "") {
    return auth.token;
  }

  const authorization = handshake?.headers?.authorization;

  if (typeof authorization !== "string") {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

const authenticateRealtimeConnection = async (socket, next) => {
  try {
    const accessToken = extractHandshakeAccessToken(socket.handshake);

    if (!accessToken) {
      throw new AppError(401, "Authentication required");
    }

    const { user } = await authenticateAccess({ accessToken });

    socket.data.userId = user._id.toString();

    return next();
  } catch (error) {
    return next(error);
  }
};

const toPlainNotification = (notification) => {
  if (notification && typeof notification.toJSON === "function") {
    return notification.toJSON();
  }

  return notification;
};

const attachRealtimeDistribution = (httpServer) => {
  if (ioServer) {
    throw new Error("Realtime distribution is already attached");
  }

  ioServer = new SocketIOServer(httpServer, {
    serveClient: false,
  });

  ioServer.use(authenticateRealtimeConnection);

  ioServer.on("connection", (socket) => {
    socket.join(getUserRealtimeRoomName(socket.data.userId));
  });

  return ioServer;
};

const closeRealtimeDistribution = async () => {
  if (!ioServer) {
    return;
  }

  const server = ioServer;
  ioServer = null;

  server.disconnectSockets(true);

  if (typeof server.engine?.close === "function") {
    server.engine.close();
  }
};

const emitNotificationToRecipient = ({
  recipientUserId,
  notification,
}) => {
  if (!ioServer || recipientUserId == null || notification == null) {
    return;
  }

  const recipientId = String(recipientUserId);
  const notificationRecipientId = notification.recipientUserId == null
    ? null
    : String(notification.recipientUserId);

  if (notificationRecipientId !== recipientId) {
    return;
  }

  try {
    ioServer
      .to(getUserRealtimeRoomName(recipientId))
      .emit(REALTIME_EVENT.NOTIFICATION, {
        notification: toPlainNotification(notification),
      });
  } catch {
    // Socket fan-out is best-effort and must not fail the caller.
  }
};

const fetchUserRealtimeSockets = async (userId) => {
  if (!ioServer || userId == null) {
    return [];
  }

  return ioServer.in(getUserRealtimeRoomName(userId)).fetchSockets();
};

export {
  attachRealtimeDistribution,
  closeRealtimeDistribution,
  emitNotificationToRecipient,
  fetchUserRealtimeSockets,
  getUserRealtimeRoomName,
};
