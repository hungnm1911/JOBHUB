import USER_STATUS from "../constants/user-status.js";
import AuthSession from "../models/auth-session.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/app-error.js";
import { verifyAccessToken } from "../utils/jwt.js";

const unauthorized = (message = "Authentication required") => {
  return new AppError(401, message);
};

const authenticateAccess = async ({ accessToken }) => {
  if (typeof accessToken !== "string" || accessToken.trim() === "") {
    throw unauthorized();
  }

  let payload;

  try {
    payload = verifyAccessToken(accessToken);
  } catch {
    throw unauthorized("Invalid or expired access token");
  }

  const { userId, sessionId } = payload ?? {};

  if (
    typeof userId !== "string" ||
    userId.trim() === "" ||
    typeof sessionId !== "string" ||
    sessionId.trim() === ""
  ) {
    throw unauthorized("Invalid or expired access token");
  }

  const session = await AuthSession.findById(sessionId);

  if (!session) {
    throw unauthorized("Invalid or expired access token");
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    throw unauthorized("Invalid or expired access token");
  }

  if (session.userId.toString() !== userId) {
    throw unauthorized("Invalid or expired access token");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw unauthorized("Invalid or expired access token");
  }

  if (user.status === USER_STATUS.LOCKED) {
    throw new AppError(403, "Account is locked", {
      field: "status",
    });
  }

  if (user.status === USER_STATUS.TERMINATED) {
    throw new AppError(403, "Account is terminated", {
      field: "status",
    });
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, "Account is not active", {
      field: "status",
    });
  }

  return {
    session,
    user,
  };
};

export { authenticateAccess };
