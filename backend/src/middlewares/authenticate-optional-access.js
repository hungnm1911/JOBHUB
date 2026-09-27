import { authenticateAccess } from "../services/authenticate-access.service.js";

const extractBearerToken = (authorizationHeader) => {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

const authenticateOptionalAccess = async (request, _response, next) => {
  try {
    const accessToken = extractBearerToken(request.headers.authorization);

    if (!accessToken) {
      request.auth = null;
      return next();
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
