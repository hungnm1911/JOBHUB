import apiClient from '@/apis/client'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function saveJobApi(jobId) {
  const response = await apiClient.put(
    `/candidate/saved-jobs/${encodeURIComponent(jobId)}`,
    null,
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

async function unsaveJobApi(jobId) {
  const response = await apiClient.delete(
    `/candidate/saved-jobs/${encodeURIComponent(jobId)}`,
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

export { saveJobApi, unsaveJobApi }
