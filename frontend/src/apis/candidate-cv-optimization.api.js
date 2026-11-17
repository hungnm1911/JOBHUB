import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function createOptimizedCandidateCvDraftForJobApi({
  jobId,
  candidateCvId,
  evaluationResult,
}) {
  const response = await apiClient.post(
    `/candidate/jobs/${encodeURIComponent(jobId)}/optimize-cv`,
    {
      candidateCvId,
      evaluationResult,
    },
    {
      ...AUTHENTICATED_REQUEST,
      // AI optimization can exceed the default transport timeout.
      timeout: API_CONFIG.EMAIL_DELIVERY_TIMEOUT_MS,
    },
  )
  return response.data
}

export { createOptimizedCandidateCvDraftForJobApi }
