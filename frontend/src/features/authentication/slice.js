import { createSlice } from '@reduxjs/toolkit'

const AUTHENTICATION_STATUS = Object.freeze({
  IDLE: 'idle',
  RESTORING: 'restoring',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
  TEMPORARILY_UNAVAILABLE: 'temporarilyUnavailable',
})

const initialState = {
  status: AUTHENTICATION_STATUS.IDLE,
  user: null,
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
      state.session = action.payload.session ?? null
      state.restorationError = null
    },
    accessRefreshed(state, action) {
      state.session = action.payload.session ?? state.session
    },
    authenticationUnavailable(state, action) {
      state.status = AUTHENTICATION_STATUS.TEMPORARILY_UNAVAILABLE
      state.user = action.payload.user ?? null
      state.session = action.payload.session ?? null
      state.restorationError = action.payload.error
    },
    unauthenticated(state) {
      state.status = AUTHENTICATION_STATUS.UNAUTHENTICATED
      state.user = null
      state.session = null
      state.restorationError = null
    },
  },
})

const selectAuthentication = (state) => state.authentication
const selectAuthenticationStatus = (state) => selectAuthentication(state).status
const selectAuthenticatedUser = (state) => selectAuthentication(state).user
const selectIsAuthenticated = (state) => selectAuthenticationStatus(state) === AUTHENTICATION_STATUS.AUTHENTICATED
const selectIsAuthenticationResolved = (state) => {
  const status = selectAuthenticationStatus(state)
  return (
    status === AUTHENTICATION_STATUS.AUTHENTICATED ||
    status === AUTHENTICATION_STATUS.UNAUTHENTICATED
  )
}

export const {
  accessRefreshed,
  authenticated,
  authenticationUnavailable,
  restorationStarted,
  unauthenticated,
} = authenticationSlice.actions

export {
  AUTHENTICATION_STATUS,
  selectAuthenticatedUser,
  selectAuthentication,
  selectAuthenticationStatus,
  selectIsAuthenticated,
  selectIsAuthenticationResolved,
}

export default authenticationSlice.reducer
