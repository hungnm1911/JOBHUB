import axios from 'axios'

import { normalizeApiError } from './api-error'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15_000,
})

apiClient.interceptors.request.use((config) => {
  config.headers.set('Accept', 'application/json')
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeApiError(error)),
)

export { ApiError, normalizeApiError } from './api-error'
export default apiClient
