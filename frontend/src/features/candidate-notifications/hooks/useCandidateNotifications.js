import { useCallback, useEffect, useState } from 'react'

import {
  listOwnNotificationsApi,
  openOwnNotificationApi,
} from '@/apis/notification.api'
import { subscribeRealtimeEvent } from '@/socket/realtime-subscriptions'
import { REALTIME_EVENT } from '@/utils/constant'

import { normalizeNotification, upsertNotification } from '../utils'

function useCandidateNotifications() {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({
    key: null,
    notifications: [],
    unreadCount: 0,
    error: null,
  })

  useEffect(() => {
    let active = true
    const key = String(loadAttempt)

    listOwnNotificationsApi().then(
      (response) => {
        if (!active) {
          return
        }
        const notifications = (response.notifications ?? [])
          .map(normalizeNotification)
          .filter(Boolean)
        setView({
          key,
          notifications,
          unreadCount: response.unreadCount ?? notifications.filter((item) => !item.readAt).length,
          error: null,
        })
      },
      (error) => {
        if (!active) {
          return
        }
        setView({ key, notifications: [], unreadCount: 0, error })
      },
    )

    return () => {
      active = false
    }
  }, [loadAttempt])

  useEffect(() => {
    return subscribeRealtimeEvent(REALTIME_EVENT.NOTIFICATION, (payload) => {
      const incoming = payload?.notification
      if (!incoming) {
        return
      }
      setView((current) => {
        const notifications = upsertNotification(current.notifications, incoming)
        return {
          ...current,
          notifications,
          unreadCount: notifications.filter((item) => !item.readAt).length,
        }
      })
    })
  }, [])

  const reload = useCallback(() => {
    setLoadAttempt((current) => current + 1)
  }, [])

  const markOpened = useCallback(async (notificationId) => {
    if (!notificationId) {
      return null
    }

    const response = await openOwnNotificationApi(notificationId)
    const opened = normalizeNotification(response.notification)
    if (!opened) {
      return null
    }

    setView((current) => {
      const notifications = current.notifications.map((item) =>
        item.id === opened.id ? { ...item, ...opened } : item,
      )
      return {
        ...current,
        notifications,
        unreadCount: notifications.filter((item) => !item.readAt).length,
      }
    })

    return opened
  }, [])

  return {
    loading: view.key !== String(loadAttempt),
    notifications: view.notifications,
    unreadCount: view.unreadCount,
    error: view.error,
    reload,
    markOpened,
  }
}

export default useCandidateNotifications
