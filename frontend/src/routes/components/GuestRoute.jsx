import { Navigate, Outlet } from 'react-router-dom'

import {
  selectAuthenticatedUser,
  selectIsAuthenticated,
  selectIsAuthenticationResolved,
} from '@/features/authentication/slice'
import { toPostLoginDestination } from '@/features/authentication/utils'
import { useAppSelector } from '@/store/hooks'

function GuestRoute({ redirectTo, fallback = null, children }) {
  const user = useAppSelector(selectAuthenticatedUser)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const isResolved = useAppSelector(selectIsAuthenticationResolved)

  if (!isResolved) {
    return fallback
  }

  if (isAuthenticated) {
    return <Navigate replace to={redirectTo ?? toPostLoginDestination(user)} />
  }

  return children ?? <Outlet />
}

export default GuestRoute
