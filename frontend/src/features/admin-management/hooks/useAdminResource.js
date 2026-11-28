import { useEffect } from 'react'
import { useResource } from '@/features/recruiter-workspace/public'
import { subscribeRealtimeEvent } from '@/socket/realtime-subscriptions'
import {
  REALTIME_EVENT,
  SOCKET_LIFECYCLE_EVENT,
  NOTIFICATION_READ_EVENT,
} from '@/utils/constant'

function useAdminResource(load, params) {
  const resource = useResource(load, params)
  const { reload } = resource
  useEffect(() => {
    window.addEventListener('focus', reload)
    window.addEventListener(NOTIFICATION_READ_EVENT, reload)
    const remove = [
      SOCKET_LIFECYCLE_EVENT.CONNECT,
      REALTIME_EVENT.NOTIFICATION,
      REALTIME_EVENT.SUPPORT_MESSAGE,
    ].map((event) => subscribeRealtimeEvent(event, reload))
    return () => {
      window.removeEventListener('focus', reload)
      window.removeEventListener(NOTIFICATION_READ_EVENT, reload)
      remove.forEach((off) => off())
    }
  }, [reload])
  return resource
}
export default useAdminResource
