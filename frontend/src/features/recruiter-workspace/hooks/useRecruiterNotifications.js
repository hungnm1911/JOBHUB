import { useCallback, useEffect, useState } from 'react'

import { listOwnNotificationsApi, openOwnNotificationApi } from '@/apis/notification.api'
import { normalizeNotification } from '@/features/candidate-notifications/utils'
import { subscribeRealtimeEvent } from '@/socket/realtime-subscriptions'
import { REALTIME_EVENT, SOCKET_LIFECYCLE_EVENT } from '@/utils/constant'

import { NOTIFICATION_PAGE_SIZE } from '../notification-utils'

const KEYWORD_DEBOUNCE_MS = 300

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

function useRecruiterNotifications({ keyword, readState, type, sort, page }) {
  const debouncedKeyword = useDebouncedValue(keyword.trim(), KEYWORD_DEBOUNCE_MS)
  const [reloadKey, setReloadKey] = useState(0)
  const [syncKey, setSyncKey] = useState(0)
  const [view, setView] = useState({
    key: null,
    notifications: [],
    pagination: null,
    error: null,
  })
  // A background resync keeps the current rows; only a new query shows the skeleton.
  const queryKey = JSON.stringify([debouncedKeyword, readState, type, sort, page, reloadKey])

  useEffect(() => {
    let active = true

    listOwnNotificationsApi({
      page,
      limit: NOTIFICATION_PAGE_SIZE,
      sort,
      ...(debouncedKeyword ? { q: debouncedKeyword } : {}),
      ...(readState ? { readState } : {}),
      ...(type ? { type } : {}),
    }).then(
      (data) => {
        if (active) {
          setView({
            key: queryKey,
            notifications: (data.notifications ?? []).map(normalizeNotification).filter(Boolean),
            pagination: data.pagination ?? null,
            error: null,
          })
        }
      },
      (error) => {
        if (active) {
          setView({ key: queryKey, notifications: [], pagination: null, error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [debouncedKeyword, readState, type, sort, page, queryKey, syncKey])

  // V13 F09/F10: events and reconnects only trigger a fresh HTTP read.
  useEffect(() => {
    const resync = () => setSyncKey((current) => current + 1)
    const unsubscribeNotification = subscribeRealtimeEvent(REALTIME_EVENT.NOTIFICATION, resync)
    const unsubscribeConnect = subscribeRealtimeEvent(SOCKET_LIFECYCLE_EVENT.CONNECT, resync)
    return () => {
      unsubscribeNotification()
      unsubscribeConnect()
    }
  }, [])

  const reload = useCallback(() => setReloadKey((current) => current + 1), [])

  const markOpened = useCallback(async (notificationId) => {
    const response = await openOwnNotificationApi(notificationId)
    const opened = normalizeNotification(response.notification)
    if (opened) {
      setView((current) => ({
        ...current,
        notifications: current.notifications.map((item) =>
          item.id === opened.id ? { ...item, ...opened } : item,
        ),
      }))
    }
  }, [])

  return {
    loading: view.key !== queryKey,
    notifications: view.notifications,
    pagination: view.pagination,
    error: view.error,
    reload,
    markOpened,
  }
}

export default useRecruiterNotifications
