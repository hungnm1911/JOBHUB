import { resolveRecruiterBusinessContext } from "../services/company.service.js";
import { assertRecruiterCandidateSearchJobMembership } from "../services/job.service.js";

const readClientCompanyId = (request) => {
  return (
    request.body?.companyId ??
    request.params?.companyId ??
    request.query?.companyId ??
    null
  );
};

const authorizeRecruiterBusinessAccess = async (
  request,
  _response,
  next,
) => {
  try {
    const context = await resolveRecruiterBusinessContext({
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

const authorizeRecruiterCandidateSearchAccess = async (
  request,
  _response,
  next,
) => {
  try {
    const context = await resolveRecruiterBusinessContext({
      user: request.auth?.user,
      clientCompanyId: readClientCompanyId(request),
    });
    const proofJob = await assertRecruiterCandidateSearchJobMembership({
      companyId: context.companyId,
      recruiterCompanyMemberId: context.membership._id,
    });

    request.companyStaff = {
      membership: context.membership,
      company: context.company,
      companyId: context.companyId,
      companyRole: context.companyRole,
    };
    request.recruiterCandidateSearch = {
      proofJobId: proofJob._id.toString(),
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

export default authorizeRecruiterBusinessAccess;
export { authorizeRecruiterCandidateSearchAccess };
