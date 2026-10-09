import { io } from 'socket.io-client'

export { default as REALTIME_EVENT } from './realtime-event'

const realtimeSocket = io(
  import.meta.env.VITE_SOCKET_URL || window.location.origin,
  { autoConnect: false },
)

export function connectRealtimeSocket(accessToken) {
  if (typeof accessToken !== 'string' || accessToken.trim() === '') {
    throw new TypeError('An access token is required to connect realtime.')
  }

  realtimeSocket.auth = { accessToken }

  if (!realtimeSocket.connected) {
    realtimeSocket.connect()
  }

  return realtimeSocket
}

export function disconnectRealtimeSocket() {
  realtimeSocket.disconnect()
  realtimeSocket.auth = {}
}

export { realtimeSocket }
