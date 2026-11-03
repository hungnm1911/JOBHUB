import { createSlice } from '@reduxjs/toolkit'

const AUTHENTICATION_STATUS = Object.freeze({
  IDLE: 'idle',
  RESTORING: 'restoring',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
  TEMPORARILY_UNAVAILABLE: 'temporarilyUnavailable',
})

const ACCOUNT_CONTEXT_STATUS = Object.freeze({
  UNRESOLVED: 'unresolved',
  LOADING: 'loading',
  RESOLVED: 'resolved',
  UNAVAILABLE: 'unavailable',
})

const initialState = {
  status: AUTHENTICATION_STATUS.IDLE,
  user: null,
  membership: null,
  accountContextStatus: ACCOUNT_CONTEXT_STATUS.UNRESOLVED,
  session: null,
  restorationError: null,
}

const authenticationSlice = createSlice({
  name: 'authentication',
  initialState,
  reducers: {
    restorationStarted(state) {
      state.status = AUTHENTICATION_STATUS.RESTORING
      state.restorationError = null
    },
    authenticated(state, action) {
      state.status = AUTHENTICATION_STATUS.AUTHENTICATED
      state.user = action.payload.user
      state.membership = null
      state.accountContextStatus = ACCOUNT_CONTEXT_STATUS.LOADING
      state.session = action.payload.session ?? null
      state.restorationError = null
    },
    accessRefreshed(state, action) {
      state.session = action.payload.session ?? state.session
    },
    authenticationUnavailable(state, action) {
      state.status = AUTHENTICATION_STATUS.TEMPORARILY_UNAVAILABLE
      state.user = action.payload.user ?? null
      state.membership = null
      state.accountContextStatus = ACCOUNT_CONTEXT_STATUS.UNRESOLVED
      state.session = action.payload.session ?? null
      state.restorationError = action.payload.error
    },
    unauthenticated(state) {
      state.status = AUTHENTICATION_STATUS.UNAUTHENTICATED
      state.user = null
      state.membership = null
      state.accountContextStatus = ACCOUNT_CONTEXT_STATUS.UNRESOLVED
      state.session = null
      state.restorationError = null
    },
    accountContextLoading(state) {
      state.membership = null
      state.accountContextStatus = ACCOUNT_CONTEXT_STATUS.LOADING
    },
    accountContextResolved(state, action) {
      state.membership = action.payload.membership ?? null
      state.accountContextStatus = ACCOUNT_CONTEXT_STATUS.RESOLVED
    },
    accountContextUnavailable(state) {
      state.membership = null
      state.accountContextStatus = ACCOUNT_CONTEXT_STATUS.UNAVAILABLE
    },
  },
})

const selectAuthentication = (state) => state.authentication
const selectAuthenticationStatus = (state) => selectAuthentication(state).status
const selectAuthenticatedUser = (state) => selectAuthentication(state).user
const selectMembership = (state) => selectAuthentication(state).membership
const selectAccountContextStatus = (state) => selectAuthentication(state).accountContextStatus
const selectIsAuthenticated = (state) => selectAuthenticationStatus(state) === AUTHENTICATION_STATUS.AUTHENTICATED
const selectIsAuthenticationResolved = (state) => {
  const status = selectAuthenticationStatus(state)
  return (
    status === AUTHENTICATION_STATUS.AUTHENTICATED ||
    status === AUTHENTICATION_STATUS.UNAUTHENTICATED
  )
}

export const {
  accountContextLoading,
  accountContextResolved,
  accountContextUnavailable,
  accessRefreshed,
  authenticated,
  authenticationUnavailable,
  restorationStarted,
  unauthenticated,
} = authenticationSlice.actions

export {
  ACCOUNT_CONTEXT_STATUS,
  AUTHENTICATION_STATUS,
  selectAuthenticatedUser,
  selectMembership,
  selectAccountContextStatus,
  selectAuthentication,
  selectAuthenticationStatus,
  selectIsAuthenticated,
  selectIsAuthenticationResolved,
}

export default authenticationSlice.reducer
