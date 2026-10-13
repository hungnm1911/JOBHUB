import { Navigate, Outlet } from 'react-router-dom'

import {
  selectIsAuthenticated,
  selectIsAuthenticationResolved,
} from '@/features/authentication/slice'
import { useAppSelector } from '@/store/hooks'

function ProtectedRoute({ redirectTo, fallback = null, children }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const isResolved = useAppSelector(selectIsAuthenticationResolved)

  if (!isResolved) {
    return fallback
  }

  if (!isAuthenticated) {
    return <Navigate replace to={redirectTo} />
  }

  return children ?? <Outlet />
}

export default ProtectedRoute
