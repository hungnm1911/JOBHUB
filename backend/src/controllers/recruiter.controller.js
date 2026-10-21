import { parseListQuery } from "../utils/list-query.js";
import COMPANY_MEMBER_STATUS from "../constants/company-member-status.js";
import USER_STATUS from "../constants/user-status.js";

import {
  listRecruitersByCompany, updateRecruiter, resendRecruiterActivation,
  createRecruiter,
  getRecruiterDetail,
  initiateRecruiterPasswordReset,
  listRecruiters,
  lockRecruiter,
  terminateRecruiter,
  unlockRecruiter,
} from "../services/recruiter.service.js";

const recruiterListOptions = (query) => parseListQuery(query, {
  filters: { membershipStatus: Object.values(COMPANY_MEMBER_STATUS), userStatus: Object.values(USER_STATUS), companyId: null },
  sorts: ["createdAt", "updatedAt", "fullName", "email", "employeeCode", "jobTitle"], defaultSort: "createdAt",
});
const readClientCompanyId = (request) => {
  return (
    request.body?.companyId ??
    request.params?.companyId ??
    request.query?.companyId ??
    null
  );
};

const createRecruiterHandler = async (request, response, next) => {
  try {
    const recruiter = await createRecruiter({
      managerUser: request.auth.user,
      fullName: request.body.fullName,
      email: request.body.email,
      employeeCode: request.body.employeeCode,
      jobTitle: request.body.jobTitle,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(201).json({
      message: "Recruiter created.",
      recruiter,
    });
  } catch (error) {
    return next(error);
  }
};

const listRecruitersHandler = async (request, response, next) => {
  try {
    const result = await listRecruiters({
      managerUser: request.auth.user,
      clientCompanyId: readClientCompanyId(request),
      options: recruiterListOptions(request.query),
    });

    return response.status(200).json({
      message: "Recruiters retrieved.",
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

const getRecruiterDetailHandler = async (request, response, next) => {
  try {
    const recruiter = await getRecruiterDetail({
      managerUser: request.auth.user,
      recruiterId: request.params.recruiterId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json({
      message: "Recruiter retrieved.",
      recruiter,
    });
  } catch (error) {
    return next(error);
  }
};

const initiateRecruiterPasswordResetHandler = async (
  request,
  response,
  next,
) => {
  try {
    const result = await initiateRecruiterPasswordReset({
      managerUser: request.auth.user,
      recruiterId: request.params.recruiterId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json({
      message: result.message,
      recruiter: result.recruiter,
    });
  } catch (error) {
    return next(error);
  }
};

const lockRecruiterHandler = async (request, response, next) => {
  try {
    const recruiter = await lockRecruiter({
      managerUser: request.auth.user,
      recruiterId: request.params.recruiterId,
      clientCompanyId: readClientCompanyId(request),
      transfers: request.body?.transfers,
    });

    return response.status(200).json({
      message: "Recruiter locked.",
      recruiter,
    });
  } catch (error) {
    return next(error);
  }
};

const unlockRecruiterHandler = async (request, response, next) => {
  try {
    const recruiter = await unlockRecruiter({
      managerUser: request.auth.user,
      recruiterId: request.params.recruiterId,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json({
      message: "Recruiter unlocked.",
      recruiter,
    });
  } catch (error) {
    return next(error);
  }
};

const terminateRecruiterHandler = async (request, response, next) => {
  try {
    const recruiter = await terminateRecruiter({
      managerUser: request.auth.user,
      recruiterId: request.params.recruiterId,
      clientCompanyId: readClientCompanyId(request),
      transfers: request.body?.transfers,
    });

    return response.status(200).json({
      message: "Recruiter terminated.",
      recruiter,
    });
  } catch (error) {
    return next(error);
  }
};

export {
  createRecruiterHandler,
  getRecruiterDetailHandler,
  initiateRecruiterPasswordResetHandler,
  listRecruitersHandler,
  lockRecruiterHandler,
  terminateRecruiterHandler,
  unlockRecruiterHandler,
};

export const listCompanyRecruitersHandler = async (request, response, next) => {
  try { return response.json(await listRecruitersByCompany({ companyId: request.params.companyId, options: recruiterListOptions(request.query) })); }
  catch (error) { next(error); }
};
export const updateRecruiterHandler = async (request, response, next) => {
  try { return response.json({ message: "Recruiter updated.", recruiter: await updateRecruiter({
    managerUser: request.auth.user, recruiterId: request.params.recruiterId, updates: request.body,
  }) }); } catch (error) { next(error); }
};
export const resendRecruiterActivationHandler = async (request, response, next) => {
  try { return response.json(await resendRecruiterActivation({ managerUser: request.auth.user,
    recruiterId: request.params.recruiterId, clientCompanyId: readClientCompanyId(request) })); }
  catch (error) { next(error); }
};
