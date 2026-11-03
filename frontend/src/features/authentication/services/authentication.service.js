import {
  getCurrentAccountApi,
  loginApi,
  logoutApi,
  refreshAccessApi,
  registerCompanyManagerApi,
} from '@/apis/authentication.api'
import { configureHttpAuthentication } from '@/apis/client'
import {
  connectRealtimeSocket,
  disconnectRealtimeSocket,
  updateRealtimeSocketAccessToken,
} from '@/socket'
import { store } from '@/store/store'
import { AUTH_STORAGE_KEY, USER_ROLE } from '@/utils/constant'

import {
  accountContextLoading,
  accountContextResolved,
  accountContextUnavailable,
  accessRefreshed,
  AUTHENTICATION_STATUS,
  authenticated,
  authenticationUnavailable,
  restorationStarted,
  selectAuthenticatedUser,
  unauthenticated,
} from '../slice'
import { createAuthenticationManager } from './authentication-manager'
import { createAccountContextLoader } from './account-context-loader'
import authenticationStorage from './authentication-storage'

const authenticationManager = createAuthenticationManager({
  api: {
    login: loginApi,
    logout: logoutApi,
    refreshAccess: refreshAccessApi,
    registerCompanyManager: registerCompanyManagerApi,
  },
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

const accountContextLoader = createAccountContextLoader({
  getCurrentAccount: getCurrentAccountApi,
  getState: store.getState,
  dispatch: store.dispatch,
  actions: { accountContextLoading, accountContextResolved, accountContextUnavailable },
  authenticatedStatus: AUTHENTICATION_STATUS.AUTHENTICATED,
  companyStaffRole: USER_ROLE.COMPANY_STAFF,
})

export const loadCurrentAccountContext = accountContextLoader.load

globalThis.addEventListener?.('storage', (event) => {
  if (event.key === AUTH_STORAGE_KEY || event.key === null) {
    authenticationManager.synchronizeExternalChange()
  }
})

export const {
  bootstrap: bootstrapAuthentication,
  login,
  logout,
  registerCompanyManager,
  retryBootstrap: retryAuthenticationBootstrap,
} = authenticationManager

// V02 F07 activates a PENDING_ACTIVATION Company Manager whose onboarding
// session in this browser still carries the pre-activation user; it is ended
// so the next login starts a normal ACTIVE session. Other users' sessions stay.
export async function endSessionOfActivatedUser(activatedUserId) {
  if (!activatedUserId || selectAuthenticatedUser(store.getState())?.id !== activatedUserId) {
    return false
  }

  try {
    await authenticationManager.logout()
  } catch {
    // Logout always clears local authentication even when the backend call fails.
  }

  return true
}

// A successful password reset sends this browser to the guest-only login
// screen. End any local session first so a stale authenticated state cannot
// redirect the user away from that screen.
export async function endSessionAfterPasswordReset() {
  if (!selectAuthenticatedUser(store.getState())) {
    return
  }

  try {
    await authenticationManager.logout()
  } catch {
    // Logout clears local authentication even if the reset revoked its session.
  }
}
