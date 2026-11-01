import { useEffect } from 'react'

import { useAppSelector } from '@/store/hooks'

import { bootstrapAuthentication, loadCurrentAccountContext } from '../services/authentication.service'
import { AUTHENTICATION_STATUS, selectAuthenticatedUser, selectAuthenticationStatus } from '../slice'

function AuthenticationBootstrap({ children }) {
  const status = useAppSelector(selectAuthenticationStatus)
  const user = useAppSelector(selectAuthenticatedUser)

  useEffect(() => {
    bootstrapAuthentication().catch(() => {
      // Auth state distinguishes invalid credentials from temporary failures.
    })
  }, [])

  useEffect(() => {
    if (status === AUTHENTICATION_STATUS.AUTHENTICATED && user) {
      loadCurrentAccountContext()
    }
  }, [status, user])

  return children
}

export default AuthenticationBootstrap
