import { CircleX, LoaderCircle, RotateCw } from 'lucide-react'
import { Navigate, Outlet } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import {
  AUTHENTICATION_STATUS,
  selectAuthenticatedUser,
  selectAuthenticationStatus,
} from '@/features/authentication/slice'
import { useAppSelector } from '@/store/hooks'
import { API_ERROR_MESSAGE, USER_ROLE, USER_STATUS } from '@/utils/constant'

function AccessState({ title, description, loading = false, retry = false }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <CenteredState
        action={
          retry && (
            <Button onClick={() => window.location.reload()} variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          )
        }
        description={description}
        icon={loading ? LoaderCircle : CircleX}
        spinning={loading}
        title={title}
        tone={loading ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}
      />
    </div>
  )
}

function JobDiscoveryRoute() {
  const status = useAppSelector(selectAuthenticationStatus)
  const user = useAppSelector(selectAuthenticatedUser)

  if (status === AUTHENTICATION_STATUS.IDLE || status === AUTHENTICATION_STATUS.RESTORING) {
    return <AccessState loading title="Đang xác định phiên truy cập" />
  }

  if (status === AUTHENTICATION_STATUS.TEMPORARILY_UNAVAILABLE) {
    return <AccessState description="Không thể xác định phiên truy cập. Vui lòng thử lại." retry title="Chưa tải được quyền truy cập" />
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

  return <AccessState description={API_ERROR_MESSAGE.JOB_DISCOVERY_NOT_AVAILABLE} title="Không thể truy cập Job Discovery" />
}

export default JobDiscoveryRoute
