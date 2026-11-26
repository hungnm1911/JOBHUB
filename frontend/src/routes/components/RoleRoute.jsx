import { CircleX, LoaderCircle, LockKeyhole, RotateCw } from 'lucide-react'
import { Navigate, Outlet } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import {
  ACCOUNT_CONTEXT_STATUS,
  selectAccountContextStatus,
  selectAuthenticatedUser,
  selectIsAuthenticationResolved,
  selectMembership,
} from '@/features/authentication/slice'
import { toPostLoginDestination } from '@/features/authentication/utils'
import { useAppSelector } from '@/store/hooks'

function RoleRoute({
  allowedRoles,
  allowedStatuses,
  allowedMembershipRoles,
  allowedMembershipStatuses,
  requirePasswordSetup = false,
  redirectTo,
  fallback = null,
  children,
}) {
  const user = useAppSelector(selectAuthenticatedUser)
  const isResolved = useAppSelector(selectIsAuthenticationResolved)
  const membership = useAppSelector(selectMembership)
  const accountContextStatus = useAppSelector(selectAccountContextStatus)

  if (!isResolved) {
    return fallback
  }

  if (
    !allowedRoles.includes(user?.role) ||
    (allowedStatuses && !allowedStatuses.includes(user?.status))
  ) {
    return <Navigate replace to={redirectTo ?? toPostLoginDestination(user)} />
  }

  // V3 BR-13: no business access until the Staff account has set its own password.
  // There is no forced change-password flow (V1 BR-16), so the screen only explains.
  if (requirePasswordSetup && user?.mustChangePassword) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <CenteredState
          description="Hãy mở liên kết trong email kích hoạt để đặt mật khẩu. Nếu liên kết đã hết hạn, nhờ Quản lý công ty gửi lại."
          icon={LockKeyhole}
          title="Tài khoản chưa hoàn tất thiết lập mật khẩu"
          tone="bg-secondary text-muted-foreground"
        />
      </div>
    )
  }

  if (allowedMembershipRoles || allowedMembershipStatuses) {
    if (
      accountContextStatus === ACCOUNT_CONTEXT_STATUS.UNRESOLVED ||
      accountContextStatus === ACCOUNT_CONTEXT_STATUS.LOADING
    ) {
      return fallback ?? (
        <div className="mx-auto w-full max-w-2xl px-6 py-10">
          <CenteredState
            icon={LoaderCircle}
            spinning
            title="Đang xác định quyền trong doanh nghiệp"
            tone="bg-primary/10 text-primary"
          />
        </div>
      )
    }

    if (accountContextStatus === ACCOUNT_CONTEXT_STATUS.UNAVAILABLE) {
      return (
        <div className="mx-auto w-full max-w-2xl px-6 py-10">
          <CenteredState
            action={
              <Button onClick={() => window.location.reload()} variant="outline">
                <RotateCw aria-hidden="true" className="size-4" />
                Thử lại
              </Button>
            }
            description="Không thể xác định vai trò trong doanh nghiệp. Vui lòng thử lại."
            icon={CircleX}
            title="Chưa tải được quyền truy cập"
            tone="bg-secondary text-muted-foreground"
          />
        </div>
      )
    }

    if (
      accountContextStatus !== ACCOUNT_CONTEXT_STATUS.RESOLVED ||
      !membership ||
      (allowedMembershipRoles && !allowedMembershipRoles.includes(membership.role)) ||
      (allowedMembershipStatuses && !allowedMembershipStatuses.includes(membership.status))
    ) {
      return <Navigate replace to={redirectTo ?? toPostLoginDestination(user)} />
    }
  }

  return children ?? <Outlet />
}

export default RoleRoute
