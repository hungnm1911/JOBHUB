import USER_ROLE from "../constants/user-role.js";
import AppError from "../utils/app-error.js";

const authorizeCandidate = (request, _response, next) => {
  if (request.auth?.user?.role !== USER_ROLE.CANDIDATE) {
    return next(new AppError(403, "Candidate access required"));
  }

  return next();
};

export default authorizeCandidate;
