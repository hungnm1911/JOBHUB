import { Navigate, Outlet } from 'react-router-dom'

import {
  selectAuthenticatedUser,
  selectIsAuthenticationResolved,
} from '@/features/authentication/slice'
import { useAppSelector } from '@/store/hooks'

function RoleRoute({ allowedRoles, redirectTo, fallback = null, children }) {
  const currentRole = useAppSelector(selectAuthenticatedUser)?.role
  const isResolved = useAppSelector(selectIsAuthenticationResolved)

  if (!isResolved) {
    return fallback
  }

  if (!allowedRoles.includes(currentRole)) {
    return <Navigate replace to={redirectTo} />
  }

  return children ?? <Outlet />
}

export default RoleRoute
