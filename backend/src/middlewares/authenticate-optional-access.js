import { authenticateAccess } from "../services/authenticate-access.service.js";
import AppError from "../utils/app-error.js";

const extractBearerToken = (authorizationHeader) => {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

const authenticateOptionalAccess = async (request, _response, next) => {
  try {
    const authorizationHeader = request.headers.authorization;

    if (authorizationHeader == null) {
      return next();
    }

    const accessToken = extractBearerToken(authorizationHeader);

    if (!accessToken) {
      throw new AppError(401, "Invalid or expired access token");
    }

    const { user, session } = await authenticateAccess({ accessToken });

    request.auth = {
      user,
      session,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

export default authenticateOptionalAccess;
