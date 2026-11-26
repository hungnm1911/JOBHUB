import apiClient from '@/apis/client'

const AUTHENTICATED_REQUEST = Object.freeze({ requiresAuthentication: true })

// Without params the backend returns the full list; any control turns pagination on.
async function listOwnNotificationsApi(params) {
  const response = await apiClient.get('/notifications', {
    ...AUTHENTICATED_REQUEST,
    params,
  })
  return response.data
}

async function getOwnUnreadNotificationCountApi() {
  const response = await apiClient.get('/notifications/unread-count', AUTHENTICATED_REQUEST)
  return response.data
}

async function openOwnNotificationApi(notificationId) {
  const response = await apiClient.post(
    `/notifications/${encodeURIComponent(notificationId)}/open`,
    null,
    AUTHENTICATED_REQUEST,
  )
  return response.data
}

export {
  getOwnUnreadNotificationCountApi,
  listOwnNotificationsApi,
  openOwnNotificationApi,
}
