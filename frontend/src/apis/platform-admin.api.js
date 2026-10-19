import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const PROTECTED_REQUEST = Object.freeze({
  requiresAuthentication: true,
})

const COMPANY_REGISTRATIONS_PATH = '/platform-admin/company-registrations'

async function listCompanyRegistrationsApi() {
  const response = await apiClient.get(COMPANY_REGISTRATIONS_PATH, PROTECTED_REQUEST)
  return response.data
}

async function getCompanyRegistrationApi(companyId) {
  const response = await apiClient.get(
    `${COMPANY_REGISTRATIONS_PATH}/${encodeURIComponent(companyId)}`,
    PROTECTED_REQUEST,
  )
  return response.data
}

async function approveCompanyRegistrationApi(companyId) {
  const response = await apiClient.post(
    `${COMPANY_REGISTRATIONS_PATH}/${encodeURIComponent(companyId)}/approve`,
    undefined,
    { ...PROTECTED_REQUEST, timeout: API_CONFIG.EMAIL_DELIVERY_TIMEOUT_MS },
  )
  return response.data
}

async function rejectCompanyRegistrationApi(companyId) {
  const response = await apiClient.post(
    `${COMPANY_REGISTRATIONS_PATH}/${encodeURIComponent(companyId)}/reject`,
    undefined,
    PROTECTED_REQUEST,
  )
  return response.data
}

export {
  approveCompanyRegistrationApi,
  getCompanyRegistrationApi,
  listCompanyRegistrationsApi,
  rejectCompanyRegistrationApi,
}
