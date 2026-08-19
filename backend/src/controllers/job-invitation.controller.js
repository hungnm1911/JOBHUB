import {
  getOwnJobInvitation,
  listOwnJobInvitations,
  sendJobInvitation,
} from "../services/job-invitation.service.js";

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

const listOwnJobInvitationsHandler = async (request, response, next) => {
  try {
    const result = await listOwnJobInvitations({
      candidateUser: request.auth.user,
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const getOwnJobInvitationHandler = async (request, response, next) => {
  try {
    const result = await getOwnJobInvitation({
      candidateUser: request.auth.user,
      invitationId: request.params.invitationId,
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

export {
  getOwnJobInvitationHandler,
  listOwnJobInvitationsHandler,
  sendJobInvitationHandler,
};
