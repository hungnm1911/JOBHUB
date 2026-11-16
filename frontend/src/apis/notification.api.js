import apiClient from '@/apis/client'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

async function listOwnNotificationsApi() {
  const response = await apiClient.get('/notifications', AUTHENTICATED_REQUEST)
  return response.data
}

async function getOwnUnreadNotificationCountApi() {
  const response = await apiClient.get('/notifications/unread-count', AUTHENTICATED_REQUEST)
  return response.data
}

export { getOwnUnreadNotificationCountApi, listOwnNotificationsApi }
