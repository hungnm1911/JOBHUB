import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const PROTECTED_REQUEST = Object.freeze({
  requiresAuthentication: true,
})

const COMPANY_REGISTRATIONS_PATH = '/platform-admin/company-registrations'

async function listCompanyRegistrationsApi(params) {
  const response = await apiClient.get(COMPANY_REGISTRATIONS_PATH, {
    ...PROTECTED_REQUEST,
    params,
  })
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

const adminGet = async (path, params) =>
  (
    await apiClient.get(`/platform-admin/${path}`, {
      ...PROTECTED_REQUEST,
      params,
    })
  ).data
const adminPost = async (path, body) =>
  (await apiClient.post(`/platform-admin/${path}`, body, PROTECTED_REQUEST))
    .data
const listAdminAccountsApi = (params) => adminGet('accounts', params)
const getAdminAccountApi = (id) =>
  adminGet(`accounts/${encodeURIComponent(id)}`)
const lockAdminAccountApi = (id) =>
  adminPost(`accounts/${encodeURIComponent(id)}/lock`)
const terminateAdminAccountApi = (id) =>
  adminPost(`accounts/${encodeURIComponent(id)}/terminate`)
const listAdminCompaniesApi = (params) => adminGet('companies', params)
const getAdminCompanyApi = (id) =>
  adminGet(`companies/${encodeURIComponent(id)}`)
const lockAdminCompanyApi = (id) =>
  adminPost(`companies/${encodeURIComponent(id)}/lock`)
const listAdminRecruitersApi = ({ companyId, ...params }) =>
  adminGet(`companies/${encodeURIComponent(companyId)}/recruiters`, params)
const getRegistrationSummaryApi = () =>
  adminGet('company-registrations/summary')
const getPlatformStatisticsApi = () => adminGet('statistics')
const listAnnouncementsApi = (params) => adminGet('announcements', params)
const getAnnouncementApi = (id) =>
  adminGet(`announcements/${encodeURIComponent(id)}`)
const publishAnnouncementApi = (body) => adminPost('announcements', body)
const createAdminFieldApi = (body) => adminPost('categories/fields', body)
const createAdminPositionApi = ({ fieldId, name }) =>
  adminPost(`categories/fields/${encodeURIComponent(fieldId)}/positions`, {
    name,
  })
export {
  listAdminAccountsApi,
  getAdminAccountApi,
  lockAdminAccountApi,
  terminateAdminAccountApi,
  listAdminCompaniesApi,
  getAdminCompanyApi,
  lockAdminCompanyApi,
  listAdminRecruitersApi,
  getRegistrationSummaryApi,
  getPlatformStatisticsApi,
  listAnnouncementsApi,
  getAnnouncementApi,
  publishAnnouncementApi,
  createAdminFieldApi,
  createAdminPositionApi,
}
