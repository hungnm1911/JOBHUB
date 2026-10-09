import { Server as SocketIOServer } from "socket.io";

import { authenticateAccess } from "../services/authenticate-access.service.js";
import AppError from "../utils/app-error.js";

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

const isRealtimeDistributionAttached = () => ioServer !== null;

const emitRealtimeEventToUser = ({ recipientUserId, eventName, payload }) => {
  if (!ioServer || recipientUserId == null) {
    return;
  }

  ioServer
    .to(getUserRealtimeRoomName(recipientUserId))
    .emit(eventName, payload);
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
  emitRealtimeEventToUser,
  fetchUserRealtimeSockets,
  getUserRealtimeRoomName,
  isRealtimeDistributionAttached,
};
