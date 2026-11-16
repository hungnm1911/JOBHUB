import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function recommendOwnDefaultCvJobsApi() {
  const response = await apiClient.post('/candidate/job-recommendations', null, {
    ...AUTHENTICATED_REQUEST,
    // AI recommendation can exceed the default transport timeout.
    timeout: API_CONFIG.EMAIL_DELIVERY_TIMEOUT_MS,
  })
  return response.data
}

export { recommendOwnDefaultCvJobsApi }
