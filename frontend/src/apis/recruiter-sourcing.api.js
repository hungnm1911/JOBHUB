import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const PROTECTED_REQUEST = Object.freeze({
  requiresAuthentication: true,
})

const id = encodeURIComponent

// V14: `params` is a URLSearchParams so repeated filter keys are sent as the backend expects.
async function listSearchCandidateCvsApi(params) {
  const response = await apiClient.get('/jobs/candidate-search/cvs', {
    ...PROTECTED_REQUEST,
    params,
  })
  return response.data
}

function previewSearchCandidateCvApi(cvId) {
  return apiClient.get(`/jobs/candidate-search/cvs/${id(cvId)}/preview`, {
    ...PROTECTED_REQUEST,
    responseType: 'blob',
    timeout: API_CONFIG.FILE_UPLOAD_TIMEOUT_MS,
  })
}

// V15 Job Invitations.
async function listJobInvitationsApi(jobId, params) {
  const response = await apiClient.get(`/jobs/${id(jobId)}/invitations`, {
    ...PROTECTED_REQUEST,
    params,
  })
  return response.data
}

async function sendJobInvitationApi(jobId, body) {
  const response = await apiClient.post(`/jobs/${id(jobId)}/invitations`, body, PROTECTED_REQUEST)
  return response.data
}

async function revokeJobInvitationApi(jobId, invitationId) {
  const response = await apiClient.post(
    `/jobs/${id(jobId)}/invitations/${id(invitationId)}/revoke`,
    undefined,
    PROTECTED_REQUEST,
  )
  return response.data
}

export {
  listJobInvitationsApi,
  listSearchCandidateCvsApi,
  previewSearchCandidateCvApi,
  revokeJobInvitationApi,
  sendJobInvitationApi,
}
