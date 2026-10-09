import { io } from 'socket.io-client'

import { SOCKET_CONFIG } from '@/utils/constant'

const realtimeSocket = io(SOCKET_CONFIG.URL, { autoConnect: false })

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
