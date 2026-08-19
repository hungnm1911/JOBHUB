import { sendJobInvitation } from "../services/job-invitation.service.js";

const readClientCompanyId = (request) => {
  return (
    request.body?.companyId ??
    request.params?.companyId ??
    request.query?.companyId ??
    null
  );
};

const sendJobInvitationHandler = async (request, response, next) => {
  try {
    const invitation = await sendJobInvitation({
      recruiterUser: request.auth.user,
      clientCompanyId: readClientCompanyId(request),
      jobId: request.params.jobId,
      candidateCvId: request.body.candidateCvId,
      greetingMessage: request.body.greetingMessage,
    });

    return response.status(201).json({
      invitation,
    });
  } catch (error) {
    return next(error);
  }
};

export { sendJobInvitationHandler };
