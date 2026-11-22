import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function evaluateOwnCandidateCvForJobApi({ jobId, candidateCvId }) {
  const response = await apiClient.post(
    `/candidate/jobs/${encodeURIComponent(jobId)}/evaluate-cv`,
    { candidateCvId },
    {
      ...AUTHENTICATED_REQUEST,
      timeout: API_CONFIG.AI_CV_EVALUATION_TIMEOUT_MS,
    },
  )
  return response.data
}

export { evaluateOwnCandidateCvForJobApi }
