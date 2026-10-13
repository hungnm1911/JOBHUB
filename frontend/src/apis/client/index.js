import axios from 'axios'

import { API_CONFIG, RUNTIME_ENV } from '@/utils/constant'

import { normalizeApiError } from './api-error'
import { installAuthenticationInterceptors } from './authentication-interceptors'

const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT_MS,
})

function logApiErrorInDevelopment(apiError) {
  const axiosError = apiError.cause

  if (!RUNTIME_ENV.IS_DEVELOPMENT || axios.isCancel(axiosError)) {
    return
  }

  const method = axiosError?.config?.method?.toUpperCase() ?? 'REQUEST'
  const url = axiosError?.config?.url ?? ''

  // Request bodies are omitted because they may carry credentials.
  console.error(
    `[API] ${method} ${url} -> ${apiError.status ?? 'NO RESPONSE'}: ${apiError.message}`,
    {
      status: apiError.status,
      code: apiError.code,
      requestId: apiError.requestId,
      details: apiError.details,
      params: axiosError?.config?.params,
      serverStack: axiosError?.response?.data?.error?.stack,
      cause: axiosError,
    },
  )
}

let authenticationAdapter = {
  getAccessToken: () => null,
  refreshAuthentication: () =>
    Promise.reject(new Error('Authentication lifecycle is not configured.')),
}

function configureHttpAuthentication(adapter) {
  authenticationAdapter = adapter
}

installAuthenticationInterceptors(apiClient, {
  getAccessToken: () => authenticationAdapter.getAccessToken(),
  refreshAuthentication: () => authenticationAdapter.refreshAuthentication(),
  normalizeError: normalizeApiError,
  reportError: logApiErrorInDevelopment,
})

export { ApiError, normalizeApiError } from './api-error'
export { configureHttpAuthentication }
export default apiClient
