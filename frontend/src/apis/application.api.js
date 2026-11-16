import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function directApplyApi({ jobId, candidateCvId }) {
  const response = await apiClient.post(
    '/candidate/applications',
    { jobId, candidateCvId },
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function listOwnApplicationsApi({ status, q } = {}) {
  const response = await apiClient.get('/candidate/applications', {
    ...AUTHENTICATED_REQUEST,
    params: { status, q },
  })
  return response.data
}

async function getOwnApplicationApi(applicationId) {
  const response = await apiClient.get(
    `/candidate/applications/${encodeURIComponent(applicationId)}`,
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function withdrawOwnApplicationApi(applicationId, { expectedVersion, withdrawReason }) {
  const response = await apiClient.post(
    `/candidate/applications/${encodeURIComponent(applicationId)}/withdraw`,
    { expectedVersion, withdrawReason: withdrawReason || null },
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function replaceOwnApplicationSubmittedCvApi(
  applicationId,
  { candidateCvId, expectedVersion },
) {
  const response = await apiClient.put(
    `/candidate/applications/${encodeURIComponent(applicationId)}/submitted-cv`,
    { candidateCvId, expectedVersion },
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function previewOwnApplicationSubmittedCvApi(applicationId) {
  const response = await apiClient.get(
    `/candidate/applications/${encodeURIComponent(applicationId)}/submitted-cv/preview`,
    {
      ...AUTHENTICATED_REQUEST,
      responseType: 'blob',
      timeout: API_CONFIG.FILE_UPLOAD_TIMEOUT_MS,
    },
  )
  return response
}

async function downloadOwnApplicationSubmittedCvApi(applicationId) {
  const response = await apiClient.get(
    `/candidate/applications/${encodeURIComponent(applicationId)}/submitted-cv/download`,
    {
      ...AUTHENTICATED_REQUEST,
      responseType: 'blob',
      timeout: API_CONFIG.FILE_UPLOAD_TIMEOUT_MS,
    },
  )
  return response
}

async function confirmOwnInterviewProposalApi(applicationId, interviewScheduleId) {
  const response = await apiClient.post(
    `/candidate/applications/${encodeURIComponent(applicationId)}/interview-proposals/${encodeURIComponent(interviewScheduleId)}/confirm`,
    {},
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function declineOwnInterviewProposalApi(applicationId, interviewScheduleId) {
  const response = await apiClient.post(
    `/candidate/applications/${encodeURIComponent(applicationId)}/interview-proposals/${encodeURIComponent(interviewScheduleId)}/decline`,
    {},
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function getOwnApplicationConversationApi(applicationId) {
  const response = await apiClient.get(
    `/candidate/applications/${encodeURIComponent(applicationId)}/conversation`,
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function sendOwnApplicationConversationMessageApi(applicationId, content) {
  const response = await apiClient.post(
    `/candidate/applications/${encodeURIComponent(applicationId)}/conversation/messages`,
    { content },
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function submitOwnApplicationAvailabilityApi(applicationId, { timezone, slots }) {
  const response = await apiClient.post(
    `/candidate/applications/${encodeURIComponent(applicationId)}/availability`,
    { timezone, slots },
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function editOwnApplicationAvailabilityApi(
  applicationId,
  { timezone, slots, expectedRevision },
) {
  const response = await apiClient.put(
    `/candidate/applications/${encodeURIComponent(applicationId)}/availability`,
    { timezone, slots, expectedRevision },
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

export {
  confirmOwnInterviewProposalApi,
  declineOwnInterviewProposalApi,
  directApplyApi,
  downloadOwnApplicationSubmittedCvApi,
  editOwnApplicationAvailabilityApi,
  getOwnApplicationApi,
  getOwnApplicationConversationApi,
  listOwnApplicationsApi,
  previewOwnApplicationSubmittedCvApi,
  replaceOwnApplicationSubmittedCvApi,
  sendOwnApplicationConversationMessageApi,
  submitOwnApplicationAvailabilityApi,
  withdrawOwnApplicationApi,
}
