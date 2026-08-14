import { resolveRecruiterChatHistoryContext } from "../services/company.service.js";

const readClientCompanyId = (request) => {
  return (
    request.body?.companyId ??
    request.params?.companyId ??
    request.query?.companyId ??
    null
  );
};

// V11 Slice 05: Recruiter Conversation history may remain readable when Company
// is LOCKED. Does not grant Company Manager Chat authority.
const authorizeRecruiterChatHistoryAccess = async (
  request,
  _response,
  next,
) => {
  try {
    const context = await resolveRecruiterChatHistoryContext({
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

export default authorizeRecruiterChatHistoryAccess;
