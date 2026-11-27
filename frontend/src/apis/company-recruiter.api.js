import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const PROTECTED_REQUEST = Object.freeze({
  requiresAuthentication: true,
})

// V3: the Company is resolved from the authenticated Company Manager, never from the client.
async function listCompanyRecruitersApi(params = {}) {
  const response = await apiClient.get('/company/recruiters', {
    ...PROTECTED_REQUEST,
    params,
  })
  return response.data
}

// Creating a Recruiter sends the activation email before the response returns.
async function createCompanyRecruiterApi({
  fullName,
  email,
  employeeCode,
  jobTitle,
}) {
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

const recruiterPath = (id) => `/company/recruiters/${encodeURIComponent(id)}`

async function getCompanyRecruiterApi(id) {
  return (await apiClient.get(recruiterPath(id), PROTECTED_REQUEST)).data
}

async function updateCompanyRecruiterApi(id, metadata) {
  return (await apiClient.patch(recruiterPath(id), metadata, PROTECTED_REQUEST))
    .data
}

async function getRecruiterHandoverApi({ recruiterId, query }) {
  return (
    await apiClient.get(`${recruiterPath(recruiterId)}/handover`, {
      ...PROTECTED_REQUEST,
      params: query,
    })
  ).data
}

async function lockCompanyRecruiterApi(id, transfers) {
  return (
    await apiClient.post(
      `${recruiterPath(id)}/lock`,
      { transfers },
      PROTECTED_REQUEST,
    )
  ).data
}

async function terminateCompanyRecruiterApi(id, transfers) {
  return (
    await apiClient.post(
      `${recruiterPath(id)}/terminate`,
      { transfers },
      PROTECTED_REQUEST,
    )
  ).data
}

async function unlockCompanyRecruiterApi(id) {
  return (
    await apiClient.post(
      `${recruiterPath(id)}/unlock`,
      undefined,
      PROTECTED_REQUEST,
    )
  ).data
}

async function resetCompanyRecruiterPasswordApi(id) {
  return (
    await apiClient.post(`${recruiterPath(id)}/password-reset`, undefined, {
      ...PROTECTED_REQUEST,
      timeout: API_CONFIG.EMAIL_DELIVERY_TIMEOUT_MS,
    })
  ).data
}

export {
  createCompanyRecruiterApi,
  getCompanyRecruiterApi,
  getRecruiterHandoverApi,
  listCompanyRecruitersApi,
  lockCompanyRecruiterApi,
  resendRecruiterActivationApi,
  resetCompanyRecruiterPasswordApi,
  terminateCompanyRecruiterApi,
  unlockCompanyRecruiterApi,
  updateCompanyRecruiterApi,
}
