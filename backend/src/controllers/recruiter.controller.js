import { createRecruiter } from "../services/recruiter.service.js";

const createRecruiterHandler = async (request, response, next) => {
  try {
    const recruiter = await createRecruiter({
      managerUser: request.auth.user,
      fullName: request.body.fullName,
      email: request.body.email,
      employeeCode: request.body.employeeCode,
      jobTitle: request.body.jobTitle,
      clientCompanyId:
        request.body.companyId ??
        request.params.companyId ??
        request.query.companyId ??
        null,
    });

    return response.status(201).json({
      message: "Recruiter created.",
      recruiter,
    });
  } catch (error) {
    return next(error);
  }
};

export { createRecruiterHandler };
