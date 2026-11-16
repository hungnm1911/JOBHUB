import apiClient from '@/apis/client'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function listOwnJobInvitationsApi() {
  const response = await apiClient.get('/candidate/invitations', AUTHENTICATED_REQUEST)
  return response.data
}

export { listOwnJobInvitationsApi }
