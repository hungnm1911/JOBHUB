import {
  acceptOwnJobInvitation,
  getOwnJobInvitation,
  getPrimaryJobInvitation,
  listOwnJobInvitations,
  listPrimaryJobInvitations,
  rejectOwnJobInvitation,
  revokePrimaryJobInvitation,
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

const rejectOwnJobInvitationHandler = async (request, response, next) => {
  try {
    const result = await rejectOwnJobInvitation({
      candidateUser: request.auth.user,
      invitationId: request.params.invitationId,
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const acceptOwnJobInvitationHandler = async (request, response, next) => {
  try {
    const result = await acceptOwnJobInvitation({
      candidateUser: request.auth.user,
      invitationId: request.params.invitationId,
    });

    return response.status(200).json({
      invitation: result.invitation,
    });
  } catch (error) {
    return next(error);
  }
};

const listPrimaryJobInvitationsHandler = async (request, response, next) => {
  try {
    const result = await listPrimaryJobInvitations({
      recruiterUser: request.auth.user,
      clientCompanyId: readClientCompanyId(request),
      jobId: request.params.jobId,
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const getPrimaryJobInvitationHandler = async (request, response, next) => {
  try {
    const result = await getPrimaryJobInvitation({
      recruiterUser: request.auth.user,
      clientCompanyId: readClientCompanyId(request),
      jobId: request.params.jobId,
      invitationId: request.params.invitationId,
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const revokePrimaryJobInvitationHandler = async (request, response, next) => {
  try {
    const result = await revokePrimaryJobInvitation({
      recruiterUser: request.auth.user,
      clientCompanyId: readClientCompanyId(request),
      jobId: request.params.jobId,
      invitationId: request.params.invitationId,
    });

    return response.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

export {
  acceptOwnJobInvitationHandler,
  getOwnJobInvitationHandler,
  getPrimaryJobInvitationHandler,
  listOwnJobInvitationsHandler,
  listPrimaryJobInvitationsHandler,
  rejectOwnJobInvitationHandler,
  revokePrimaryJobInvitationHandler,
  sendJobInvitationHandler,
};
