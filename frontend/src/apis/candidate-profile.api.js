import apiClient from '@/apis/client'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function getOwnCandidateProfileApi() {
  const response = await apiClient.get('/candidate/profile', AUTHENTICATED_REQUEST)
  return response.data
}

async function updateOwnCandidateProfileApi(profile) {
  const response = await apiClient.patch('/candidate/profile', profile, AUTHENTICATED_REQUEST)
  return response.data
}

export { getOwnCandidateProfileApi, updateOwnCandidateProfileApi }
