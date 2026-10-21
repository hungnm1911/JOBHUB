import { parseListQuery } from "../utils/list-query.js";
import USER_ROLE from "../constants/user-role.js";
import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
import USER_STATUS from "../constants/user-status.js";
import COMPANY_APPROVAL_STATUS from "../constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../constants/company-operational-status.js";

import {
  listAccounts, getAccount, listCompanies, getCompany,
  approveCompanyRegistration,
  getCompanyRegistration,
  listCompanyRegistrations,
  lockAccount,
  lockCompany,
  rejectCompanyRegistration,
  terminateAccount,
} from "../services/platform-admin.service.js";

const companyListOptions = (query, registration = false) => {
  const options = parseListQuery(query, {
    filters: { approvalStatus: Object.values(COMPANY_APPROVAL_STATUS), operationalStatus: Object.values(COMPANY_OPERATIONAL_STATUS) },
    sorts: ["createdAt", "updatedAt", "name", "submittedAt"],
  });
  if (registration && Object.hasOwn(options.sort, "name")) {
    options.sort = { "reviewSnapshot.name": options.sort.name, _id: options.sort._id };
  }
  return options;
};
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
    const result = await listCompanyRegistrations(companyListOptions(request.query, true));
    return response.status(200).json(result);
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

export const listAccountsHandler = async (request, response, next) => {
  try {
    const options = parseListQuery(request.query, {
      filters: { actorType: [USER_ROLE.CANDIDATE, ...Object.values(COMPANY_MEMBER_ROLE), USER_ROLE.PLATFORM_ADMIN],
        userStatus: Object.values(USER_STATUS), companyId: null },
      sorts: ["createdAt", "updatedAt", "fullName", "email"],
    });
    return response.json(await listAccounts(options));
  } catch (error) { next(error); }
};
export const getAccountHandler = async (request, response, next) => {
  try { return response.json({ account: await getAccount({ userId: request.params.userId }) }); }
  catch (error) { next(error); }
};
export const listCompaniesHandler = async (request, response, next) => {
  try { return response.json(await listCompanies(companyListOptions(request.query))); }
  catch (error) { next(error); }
};
export const getCompanyHandler = async (request, response, next) => {
  try { return response.json(await getCompany({ companyId: request.params.companyId })); }
  catch (error) { next(error); }
};
