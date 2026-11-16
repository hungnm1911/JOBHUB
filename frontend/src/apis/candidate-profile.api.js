import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function getOwnCandidateProfileApi() {
  const response = await apiClient.get('/candidate/profile', AUTHENTICATED_REQUEST)
  return response.data
}

async function updateOwnCandidateProfileApi(profile) {
  const response = await apiClient.patch('/candidate/profile', profile, AUTHENTICATED_REQUEST)
  return response.data
}

async function uploadOwnCandidateAvatarApi(file) {
  const body = new FormData()
  body.append('file', file)

  const response = await apiClient.post('/candidate/profile/avatar', body, {
    ...AUTHENTICATED_REQUEST,
    timeout: API_CONFIG.FILE_UPLOAD_TIMEOUT_MS,
  })
  return response.data
}

export {
  getOwnCandidateProfileApi,
  updateOwnCandidateProfileApi,
  uploadOwnCandidateAvatarApi,
}
