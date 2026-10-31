import apiClient from '@/apis/client'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function directApplyApi({ jobId, candidateCvId }) {
  const response = await apiClient.post(
    '/candidate/applications',
    { jobId, candidateCvId },
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

export { directApplyApi }
