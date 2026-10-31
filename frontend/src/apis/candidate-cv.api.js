import apiClient from '@/apis/client'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function listOwnCandidateCvsApi() {
  const response = await apiClient.get('/candidate/cvs', AUTHENTICATED_REQUEST)
  return response.data
}

export { listOwnCandidateCvsApi }
