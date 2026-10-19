import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const PUBLIC_AUTH_REQUEST = Object.freeze({
  requiresAuthentication: false,
})

const PUBLIC_EMAIL_DELIVERY_REQUEST = Object.freeze({
  ...PUBLIC_AUTH_REQUEST,
  timeout: API_CONFIG.EMAIL_DELIVERY_TIMEOUT_MS,
})

async function registerCandidateApi({ fullName, email, password }) {
  const response = await apiClient.post(
    '/auth/register/candidate',
    { fullName, email, password },
    PUBLIC_EMAIL_DELIVERY_REQUEST,
  )
  return response.data
}

async function registerCompanyManagerApi({ fullName, email, password }) {
  const response = await apiClient.post(
    '/auth/register/company-manager',
    { fullName, email, password },
    PUBLIC_AUTH_REQUEST,
  )
  return response.data
}

async function verifyEmailApi({ token }) {
  const response = await apiClient.post(
    '/auth/verify-email',
    { token },
    PUBLIC_AUTH_REQUEST,
  )
  return response.data
}

async function forgotPasswordApi({ email }) {
  const response = await apiClient.post(
    '/auth/forgot-password',
    { email },
    PUBLIC_EMAIL_DELIVERY_REQUEST,
  )
  return response.data
}

async function resetPasswordApi({ token, password }) {
  const response = await apiClient.post(
    '/auth/reset-password',
    { token, password },
    PUBLIC_AUTH_REQUEST,
  )
  return response.data
}

async function loginApi(credentials) {
  const response = await apiClient.post(
    '/auth/login',
    credentials,
    PUBLIC_AUTH_REQUEST,
  )
  return response.data
}

async function refreshAccessApi(refreshToken) {
  const response = await apiClient.post(
    '/auth/refresh',
    { refreshToken },
    PUBLIC_AUTH_REQUEST,
  )
  return response.data
}

async function confirmCompanyApprovalApi({ token }) {
  const response = await apiClient.post(
    '/auth/confirm-company-approval',
    { token },
    PUBLIC_AUTH_REQUEST,
  )
  return response.data
}

async function logoutApi() {
  const response = await apiClient.post('/auth/logout', undefined, {
    requiresAuthentication: true,
  })
  return response.data
}

export {
  confirmCompanyApprovalApi,
  forgotPasswordApi,
  loginApi,
  logoutApi,
  refreshAccessApi,
  registerCandidateApi,
  registerCompanyManagerApi,
  resetPasswordApi,
  verifyEmailApi,
}
