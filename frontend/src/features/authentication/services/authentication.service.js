import * as authenticationApi from '@/apis/authentication.api'
import { configureHttpAuthentication } from '@/apis/client'
import {
  connectRealtimeSocket,
  disconnectRealtimeSocket,
  updateRealtimeSocketAccessToken,
} from '@/socket'
import { store } from '@/store/store'

import {
  accessRefreshed,
  authenticated,
  authenticationUnavailable,
  restorationStarted,
  unauthenticated,
} from '../slice'
import { createAuthenticationManager } from './authentication-manager'
import authenticationStorage from './authentication-storage'

const authenticationManager = createAuthenticationManager({
  api: authenticationApi,
  storage: authenticationStorage,
  dispatch: store.dispatch,
  actions: {
    accessRefreshed,
    authenticated,
    authenticationUnavailable,
    restorationStarted,
    unauthenticated,
  },
  socket: {
    connect: connectRealtimeSocket,
    disconnect: disconnectRealtimeSocket,
    updateAccessToken: updateRealtimeSocketAccessToken,
  },
})

configureHttpAuthentication({
  getAccessToken: authenticationStorage.getAccessToken,
  refreshAuthentication: authenticationManager.refreshAuthentication,
})

export const {
  bootstrap: bootstrapAuthentication,
  login,
  logout,
  retryBootstrap: retryAuthenticationBootstrap,
} = authenticationManager
