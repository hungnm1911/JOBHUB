import apiClient from '@/apis/client'

const PUBLIC_AUTH_REQUEST = Object.freeze({
  requiresAuthentication: false,
})

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

async function logoutApi() {
  const response = await apiClient.post('/auth/logout', undefined, {
    requiresAuthentication: true,
  })
  return response.data
}

export { loginApi, logoutApi, refreshAccessApi }
