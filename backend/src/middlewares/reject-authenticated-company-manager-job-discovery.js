import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
import USER_ROLE from "../constants/user-role.js";
import CompanyMember from "../models/company-member.model.js";
import AppError from "../utils/app-error.js";

const rejectAuthenticatedCompanyManagerJobDiscovery = async (
  request,
  _response,
  next,
) => {
  try {
    const user = request.auth?.user;

    if (!user) {
      return next();
    }

    if (user.role !== USER_ROLE.COMPANY_STAFF) {
      return next();
    }

    const membership = await CompanyMember.findOne({ userId: user._id })
      .select("role")
      .lean();

    if (membership?.role === COMPANY_MEMBER_ROLE.COMPANY_MANAGER) {
      throw new AppError(403, "Company Manager is not a Job Discovery actor", {
        field: "role",
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

export default rejectAuthenticatedCompanyManagerJobDiscovery;
