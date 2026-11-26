import { useCallback, useEffect, useState } from 'react'

import { getOwnUnreadNotificationCountApi } from '@/apis/notification.api'
import { subscribeRealtimeEvent } from '@/socket/realtime-subscriptions'
import { REALTIME_EVENT, SOCKET_LIFECYCLE_EVENT } from '@/utils/constant'

// V13 F01/F09/F10: the unread total always comes from HTTP; a realtime event or a
// reconnect only tells the client to read it again. null while unknown.
function useUnreadNotificationCount() {
  const [count, setCount] = useState(null)
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((current) => current + 1), [])

  useEffect(() => {
    let active = true
    getOwnUnreadNotificationCountApi().then(
      (data) => active && setCount(Number.isInteger(data.unreadCount) ? data.unreadCount : null),
      () => active && setCount(null),
    )

    return () => {
      active = false
    }
  }, [version])

  useEffect(() => {
    const unsubscribeNotification = subscribeRealtimeEvent(REALTIME_EVENT.NOTIFICATION, refresh)
    const unsubscribeConnect = subscribeRealtimeEvent(SOCKET_LIFECYCLE_EVENT.CONNECT, refresh)
    return () => {
      unsubscribeNotification()
      unsubscribeConnect()
    }
  }, [refresh])

  return { count, refresh }
}

export default useUnreadNotificationCount
