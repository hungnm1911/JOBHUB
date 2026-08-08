import { resolveCompanyManagerRecruiterManagementContext } from "../services/company.service.js";

const readClientCompanyId = (request) => {
  return (
    request.body?.companyId ??
    request.params?.companyId ??
    request.query?.companyId ??
    null
  );
};

const authorizeCompanyManagerBusinessAccess = async (
  request,
  _response,
  next,
) => {
  try {
    const context = await resolveCompanyManagerRecruiterManagementContext({
      user: request.auth?.user,
      clientCompanyId: readClientCompanyId(request),
    });

    request.companyStaff = {
      membership: context.membership,
      company: context.company,
      companyId: context.companyId,
      companyRole: context.companyRole,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

export default authorizeCompanyManagerBusinessAccess;
