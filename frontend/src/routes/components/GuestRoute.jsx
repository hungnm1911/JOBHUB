import { Navigate, Outlet, useLocation } from 'react-router-dom'

import {
  ACCOUNT_CONTEXT_STATUS,
  selectAccountContextStatus,
  selectMembership,
  selectAuthenticatedUser,
  selectIsAuthenticated,
  selectIsAuthenticationResolved,
} from '@/features/authentication/slice'
import { toPostLoginLocation } from '@/features/authentication/utils'
import { useAppSelector } from '@/store/hooks'
import { USER_ROLE, USER_STATUS } from '@/utils/constant'

import RouteAccessState from './RouteAccessState'

function GuestRoute({ redirectTo, fallback = null, children }) {
  const location = useLocation()
  const membership = useAppSelector(selectMembership)
  const accountContextStatus = useAppSelector(selectAccountContextStatus)
  const user = useAppSelector(selectAuthenticatedUser)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const isResolved = useAppSelector(selectIsAuthenticationResolved)

  if (!isResolved) {
    return fallback
  }

  if (isAuthenticated) {
    if (user?.role === USER_ROLE.COMPANY_STAFF && user.status === USER_STATUS.ACTIVE) {
      if ([ACCOUNT_CONTEXT_STATUS.UNRESOLVED, ACCOUNT_CONTEXT_STATUS.LOADING].includes(accountContextStatus)) {
        return <RouteAccessState loading title="Đang xác định quyền trong doanh nghiệp" />
      }
      if (accountContextStatus === ACCOUNT_CONTEXT_STATUS.UNAVAILABLE) {
        return <RouteAccessState description="Không thể xác định vai trò trong doanh nghiệp. Vui lòng thử lại." retry title="Chưa tải được quyền truy cập" />
      }
    }
    const next = toPostLoginLocation(user, location.state, membership)
    return <Navigate replace state={next.state} to={redirectTo ?? next} />
  }

  return children ?? <Outlet />
}

export default GuestRoute
