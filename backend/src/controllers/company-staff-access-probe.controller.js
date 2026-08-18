const toProbeAuthz = (request) => {
  return {
    userId: request.auth.user._id.toString(),
    sessionId: request.auth.session._id.toString(),
    platformRole: request.auth.user.role,
    companyId: request.companyStaff.companyId.toString(),
    companyRole: request.companyStaff.companyRole,
    membershipStatus: request.companyStaff.membership.status,
    companyApprovalStatus: request.companyStaff.company.approvalStatus,
    companyOperationalStatus: request.companyStaff.company.operationalStatus,
  };
};

const getCompanyStaffBusinessAccessProbe = (request, response) => {
  return response.status(200).json({
    message: "Company Staff business access granted",
    authz: toProbeAuthz(request),
  });
};

const getCompanyManagerRecruiterManagementProbe = (request, response) => {
  return response.status(200).json({
    message: "Company Manager recruiter-management access granted",
    authz: toProbeAuthz(request),
  });
};

const getRecruiterCandidateSearchAccessProbe = (request, response) => {
  return response.status(200).json({
    message: "Recruiter Candidate Search access granted",
    authz: {
      ...toProbeAuthz(request),
      proofJobId: request.recruiterCandidateSearch.proofJobId,
    },
  });
};

export {
  getCompanyManagerRecruiterManagementProbe,
  getRecruiterCandidateSearchAccessProbe,
  getCompanyStaffBusinessAccessProbe,
};
