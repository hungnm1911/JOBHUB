import axios from 'axios'

import { API_CONFIG, RUNTIME_ENV } from '@/utils/constant'

import { normalizeApiError } from './api-error'

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

apiClient.interceptors.request.use((config) => {
  config.headers.set('Accept', 'application/json')
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = normalizeApiError(error)

    logApiErrorInDevelopment(apiError)

    return Promise.reject(apiError)
  },
)

export { ApiError, normalizeApiError } from './api-error'
export default apiClient
