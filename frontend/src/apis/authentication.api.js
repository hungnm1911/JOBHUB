import apiClient from '@/apis/client'

const PUBLIC_AUTH_REQUEST = Object.freeze({
  requiresAuthentication: false,
})

async function login(credentials) {
  const response = await apiClient.post(
    '/auth/login',
    credentials,
    PUBLIC_AUTH_REQUEST,
  )
  return response.data
}

async function refreshAccess(refreshToken) {
  const response = await apiClient.post(
    '/auth/refresh',
    { refreshToken },
    PUBLIC_AUTH_REQUEST,
  )
  return response.data
}

async function logout() {
  const response = await apiClient.post('/auth/logout', undefined, {
    requiresAuthentication: true,
  })
  return response.data
}

export { login, logout, refreshAccess }
