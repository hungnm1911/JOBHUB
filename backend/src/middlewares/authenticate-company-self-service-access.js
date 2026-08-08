import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
import USER_ROLE from "../constants/user-role.js";
import {
  authenticateAccess,
  authenticateOnboardingAccess,
} from "../services/authenticate-access.service.js";
import { resolveCompanyStaffMembership } from "../services/company.service.js";
import AppError from "../utils/app-error.js";

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

const assertActiveCompanyManager = async (user) => {
  if (user.role !== USER_ROLE.COMPANY_STAFF) {
    throw new AppError(403, "Company Manager access required", {
      field: "role",
    });
  }

  const membership = await resolveCompanyStaffMembership({ userId: user._id });

  if (membership.role !== COMPANY_MEMBER_ROLE.COMPANY_MANAGER) {
    throw new AppError(403, "Company Manager access required", {
      field: "role",
    });
  }
};

const authenticateCompanySelfServiceAccess = async (
  request,
  _response,
  next,
) => {
  try {
    const accessToken = extractBearerToken(request.headers.authorization);

    if (!accessToken) {
      throw new AppError(401, "Authentication required");
    }

    try {
      const { user, session } = await authenticateAccess({ accessToken });

      await assertActiveCompanyManager(user);

      request.auth = {
        user,
        session,
      };
      request.companySelfServiceMode = "active";

      return next();
    } catch (activeError) {
      if (
        activeError instanceof AppError &&
        activeError.statusCode === 401
      ) {
        throw activeError;
      }

      if (
        !(activeError instanceof AppError) ||
        activeError.statusCode !== 403 ||
        activeError.message !== "Account is not active"
      ) {
        throw activeError;
      }
    }

    const { user, session } = await authenticateOnboardingAccess({
      accessToken,
    });

    request.auth = {
      user,
      session,
    };
    request.companySelfServiceMode = "onboarding";

    return next();
  } catch (error) {
    return next(error);
  }
};

export default authenticateCompanySelfServiceAccess;
