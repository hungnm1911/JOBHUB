import { Navigate, Outlet } from 'react-router-dom'

import {
  ACCOUNT_CONTEXT_STATUS,
  AUTHENTICATION_STATUS,
  selectAccountContextStatus,
  selectAuthenticatedUser,
  selectAuthenticationStatus,
} from '@/features/authentication/slice'
import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
import { useAppSelector } from '@/store/hooks'
import { API_ERROR_MESSAGE, USER_ROLE, USER_STATUS } from '@/utils/constant'

import RouteAccessState from './RouteAccessState'

function JobDiscoveryRoute() {
  const status = useAppSelector(selectAuthenticationStatus)
  const user = useAppSelector(selectAuthenticatedUser)
  const accountContextStatus = useAppSelector(selectAccountContextStatus)
  const viewer = useSessionViewer()

  if (status === AUTHENTICATION_STATUS.IDLE || status === AUTHENTICATION_STATUS.RESTORING) {
    return <RouteAccessState loading title="Đang xác định phiên truy cập" />
  }

  if (status === AUTHENTICATION_STATUS.TEMPORARILY_UNAVAILABLE) {
    return <RouteAccessState description="Không thể xác định phiên truy cập. Vui lòng thử lại." retry title="Chưa tải được quyền truy cập" />
  }

  if (status === AUTHENTICATION_STATUS.UNAUTHENTICATED) {
    return <Outlet />
  }

  if (user?.status === USER_STATUS.PENDING_ACTIVATION) {
    return <Navigate replace to="/onboarding/company" />
  }

  if (user?.role === USER_ROLE.CANDIDATE) {
    return <Outlet />
  }

  if (user?.role === USER_ROLE.COMPANY_STAFF) {
    if ([ACCOUNT_CONTEXT_STATUS.UNRESOLVED, ACCOUNT_CONTEXT_STATUS.LOADING].includes(accountContextStatus)) {
      return <RouteAccessState loading title="Đang xác định quyền trong doanh nghiệp" />
    }
    if (accountContextStatus === ACCOUNT_CONTEXT_STATUS.UNAVAILABLE) {
      return <RouteAccessState description="Không thể xác định vai trò trong doanh nghiệp. Vui lòng thử lại." retry title="Chưa tải được quyền truy cập" />
    }
    if (viewer.isRecruiter) return <Outlet />
  }

  return <RouteAccessState description={API_ERROR_MESSAGE.JOB_DISCOVERY_NOT_AVAILABLE} title="Không thể truy cập Job Discovery" />
}

export default JobDiscoveryRoute
