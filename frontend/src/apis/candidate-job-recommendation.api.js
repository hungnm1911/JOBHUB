import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function recommendOwnDefaultCvJobsApi() {
  const response = await apiClient.post('/candidate/job-recommendations', null, {
    ...AUTHENTICATED_REQUEST,
    timeout: API_CONFIG.AI_RECOMMENDATION_TIMEOUT_MS,
  })
  return response.data
}

export { recommendOwnDefaultCvJobsApi }
