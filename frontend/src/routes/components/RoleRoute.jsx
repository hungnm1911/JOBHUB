import { Navigate, Outlet } from 'react-router-dom'

import {
  selectAuthenticatedUser,
  selectIsAuthenticationResolved,
} from '@/features/authentication/slice'
import { toPostLoginDestination } from '@/features/authentication/utils'
import { useAppSelector } from '@/store/hooks'

function RoleRoute({ allowedRoles, allowedStatuses, redirectTo, fallback = null, children }) {
  const user = useAppSelector(selectAuthenticatedUser)
  const isResolved = useAppSelector(selectIsAuthenticationResolved)

  if (!isResolved) {
    return fallback
  }

  if (
    !allowedRoles.includes(user?.role) ||
    (allowedStatuses && !allowedStatuses.includes(user?.status))
  ) {
    return <Navigate replace to={redirectTo ?? toPostLoginDestination(user)} />
  }

  return children ?? <Outlet />
}

export default RoleRoute
