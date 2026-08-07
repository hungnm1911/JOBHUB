import {
  approveCompanyRegistration,
  getCompanyRegistration,
  listCompanyRegistrations,
  lockAccount,
  lockCompany,
  rejectCompanyRegistration,
  terminateAccount,
} from "../services/platform-admin.service.js";

const lockAccountHandler = async (request, response, next) => {
  try {
    const user = await lockAccount({
      targetUserId: request.params.userId,
      actorUserId: request.auth.user._id,
    });

    return response.status(200).json({
      message: "Account locked successfully.",
      user,
    });
  } catch (error) {
    next(error);
  }
};

const terminateAccountHandler = async (request, response, next) => {
  try {
    const user = await terminateAccount({
      targetUserId: request.params.userId,
      actorUserId: request.auth.user._id,
    });

    return response.status(200).json({
      message: "Account terminated successfully.",
      user,
    });
  } catch (error) {
    next(error);
  }
};

const listCompanyRegistrationsHandler = async (request, response, next) => {
  try {
    const companyRegistrations = await listCompanyRegistrations();

    return response.status(200).json({
      companyRegistrations,
    });
  } catch (error) {
    next(error);
  }
};

const getCompanyRegistrationHandler = async (request, response, next) => {
  try {
    const companyRegistration = await getCompanyRegistration({
      companyId: request.params.companyId,
    });

    return response.status(200).json({
      companyRegistration,
    });
  } catch (error) {
    next(error);
  }
};

const rejectCompanyRegistrationHandler = async (request, response, next) => {
  try {
    const companyRegistration = await rejectCompanyRegistration({
      companyId: request.params.companyId,
      actorUserId: request.auth.user._id,
    });

    return response.status(200).json({
      message: "Company registration rejected.",
      companyRegistration,
    });
  } catch (error) {
    next(error);
  }
};

const approveCompanyRegistrationHandler = async (request, response, next) => {
  try {
    const companyRegistration = await approveCompanyRegistration({
      companyId: request.params.companyId,
      actorUserId: request.auth.user._id,
    });

    return response.status(200).json({
      message: "Company registration approved.",
      companyRegistration,
    });
  } catch (error) {
    next(error);
  }
};

const lockCompanyHandler = async (request, response, next) => {
  try {
    const { company, manager } = await lockCompany({
      companyId: request.params.companyId,
    });

    return response.status(200).json({
      message: "Company locked successfully.",
      company,
      manager,
    });
  } catch (error) {
    next(error);
  }
};

export {
  approveCompanyRegistrationHandler,
  getCompanyRegistrationHandler,
  listCompanyRegistrationsHandler,
  lockAccountHandler,
  lockCompanyHandler,
  rejectCompanyRegistrationHandler,
  terminateAccountHandler,
};
