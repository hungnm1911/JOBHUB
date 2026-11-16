import { realtimeSocket } from '@/socket/index'

function subscribeRealtimeEvent(eventName, handler) {
  if (typeof eventName !== 'string' || eventName.trim() === '') {
    throw new TypeError('A realtime event name is required.')
  }
  if (typeof handler !== 'function') {
    throw new TypeError('A realtime event handler is required.')
  }

  realtimeSocket.on(eventName, handler)
  return () => {
    realtimeSocket.off(eventName, handler)
  }
}

export { subscribeRealtimeEvent }
