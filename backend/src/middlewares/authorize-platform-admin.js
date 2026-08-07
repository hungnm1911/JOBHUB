import USER_ROLE from "../constants/user-role.js";
import AppError from "../utils/app-error.js";

const authorizePlatformAdmin = (request, _response, next) => {
  if (request.auth?.user?.role !== USER_ROLE.PLATFORM_ADMIN) {
    return next(new AppError(403, "Platform Admin access required"));
  }

  return next();
};

export default authorizePlatformAdmin;
