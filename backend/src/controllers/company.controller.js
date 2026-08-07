import {
  getOwnedActiveCompany,
  getOwnedCompany,
  resendApprovalConfirmation,
  submitOwnedCompany,
  updateOwnedCompanyActiveProfile,
  updateOwnedCompanyDraft,
} from "../services/company.service.js";

const getOwnedCompanyHandler = async (request, response, next) => {
  try {
    const company =
      request.companySelfServiceMode === "active"
        ? await getOwnedActiveCompany({
            managerUserId: request.auth.user._id,
          })
        : await getOwnedCompany({
            managerUserId: request.auth.user._id,
          });

    return response.status(200).json({
      company,
    });
  } catch (error) {
    return next(error);
  }
};

const updateOwnedCompanyHandler = async (request, response, next) => {
  try {
    const company =
      request.companySelfServiceMode === "active"
        ? await updateOwnedCompanyActiveProfile({
            managerUserId: request.auth.user._id,
            profile: request.body,
          })
        : await updateOwnedCompanyDraft({
            managerUserId: request.auth.user._id,
            profile: request.body,
          });

    return response.status(200).json({
      message: "Company profile updated.",
      company,
    });
  } catch (error) {
    return next(error);
  }
};

const submitOwnedCompanyHandler = async (request, response, next) => {
  try {
    const company = await submitOwnedCompany({
      managerUserId: request.auth.user._id,
    });

    return response.status(200).json({
      message: "Company submitted for review.",
      company,
    });
  } catch (error) {
    return next(error);
  }
};

const resendApprovalConfirmationHandler = async (request, response, next) => {
  try {
    const company = await resendApprovalConfirmation({
      managerUserId: request.auth.user._id,
    });

    return response.status(200).json({
      message: "Approval confirmation resent.",
      company,
    });
  } catch (error) {
    return next(error);
  }
};

export {
  getOwnedCompanyHandler,
  resendApprovalConfirmationHandler,
  submitOwnedCompanyHandler,
  updateOwnedCompanyHandler,
};
