import apiClient from '@/apis/client'
import { API_CONFIG } from '@/utils/constant'

const PROTECTED_REQUEST = Object.freeze({
  requiresAuthentication: true,
})

async function getOwnedCompanyApi() {
  const response = await apiClient.get('/company', PROTECTED_REQUEST)
  return response.data
}

async function updateOwnedCompanyApi(profile) {
  const response = await apiClient.patch('/company', profile, PROTECTED_REQUEST)
  return response.data
}

async function submitOwnedCompanyApi() {
  const response = await apiClient.post('/company/submit', undefined, PROTECTED_REQUEST)
  return response.data
}

async function resendApprovalConfirmationApi() {
  const response = await apiClient.post('/company/resend-approval-confirmation', undefined, {
    ...PROTECTED_REQUEST,
    timeout: API_CONFIG.EMAIL_DELIVERY_TIMEOUT_MS,
  })
  return response.data
}

async function uploadOwnedCompanyImageApi({ kind, file }) {
  const body = new FormData()
  body.append('file', file)

  const response = await apiClient.post(`/company/images/${encodeURIComponent(kind)}`, body, {
    ...PROTECTED_REQUEST,
    timeout: API_CONFIG.FILE_UPLOAD_TIMEOUT_MS,
  })
  return response.data
}

export {
  getOwnedCompanyApi,
  resendApprovalConfirmationApi,
  submitOwnedCompanyApi,
  updateOwnedCompanyApi,
  uploadOwnedCompanyImageApi,
}
