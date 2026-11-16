import apiClient from '@/apis/client'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function listOwnJobInvitationsApi() {
  const response = await apiClient.get('/candidate/invitations', AUTHENTICATED_REQUEST)
  return response.data
}

async function getOwnJobInvitationApi(invitationId) {
  const response = await apiClient.get(
    `/candidate/invitations/${encodeURIComponent(invitationId)}`,
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function acceptOwnJobInvitationApi(invitationId) {
  const response = await apiClient.post(
    `/candidate/invitations/${encodeURIComponent(invitationId)}/accept`,
    {},
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function rejectOwnJobInvitationApi(invitationId) {
  const response = await apiClient.post(
    `/candidate/invitations/${encodeURIComponent(invitationId)}/reject`,
    {},
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

export {
  acceptOwnJobInvitationApi,
  getOwnJobInvitationApi,
  listOwnJobInvitationsApi,
  rejectOwnJobInvitationApi,
}
