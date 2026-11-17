import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function evaluateOwnCandidateCvForJobApi({ jobId, candidateCvId }) {
  const response = await apiClient.post(
    `/candidate/jobs/${encodeURIComponent(jobId)}/evaluate-cv`,
    { candidateCvId },
    {
      ...AUTHENTICATED_REQUEST,
      // AI evaluation can exceed the default transport timeout.
      timeout: API_CONFIG.EMAIL_DELIVERY_TIMEOUT_MS,
    },
  )
  return response.data
}

export { evaluateOwnCandidateCvForJobApi }
