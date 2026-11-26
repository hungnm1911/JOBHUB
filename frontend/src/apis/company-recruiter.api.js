import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const PROTECTED_REQUEST = Object.freeze({
  requiresAuthentication: true,
})

// V3: the Company is resolved from the authenticated Company Manager, never from the client.
async function listCompanyRecruitersApi(params = {}) {
  const response = await apiClient.get('/company/recruiters', { ...PROTECTED_REQUEST, params })
  return response.data
}

// Creating a Recruiter sends the activation email before the response returns.
async function createCompanyRecruiterApi({ fullName, email, employeeCode, jobTitle }) {
  const response = await apiClient.post(
    '/company/recruiters',
    { fullName, email, employeeCode, jobTitle },
    { ...PROTECTED_REQUEST, timeout: API_CONFIG.EMAIL_DELIVERY_TIMEOUT_MS },
  )
  return response.data
}

async function resendRecruiterActivationApi(recruiterId) {
  const response = await apiClient.post(
    `/company/recruiters/${encodeURIComponent(recruiterId)}/resend-activation`,
    undefined,
    { ...PROTECTED_REQUEST, timeout: API_CONFIG.EMAIL_DELIVERY_TIMEOUT_MS },
  )
  return response.data
}

export { createCompanyRecruiterApi, listCompanyRecruitersApi, resendRecruiterActivationApi }
