import {
  createRecruiter,
  getRecruiterDetail,
  listRecruiters,
} from "../services/recruiter.service.js";

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
    const recruiters = await listRecruiters({
      managerUser: request.auth.user,
      clientCompanyId: readClientCompanyId(request),
    });

    return response.status(200).json({
      message: "Recruiters retrieved.",
      recruiters,
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

export {
  createRecruiterHandler,
  getRecruiterDetailHandler,
  listRecruitersHandler,
};
