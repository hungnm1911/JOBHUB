import {
  Bookmark,
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useAppSelector } from '@/store/hooks'
import { COMPANY_MEMBER_ROLE, USER_ROLE, USER_STATUS } from '@/utils/constant'

import { logout } from '../services/authentication.service'
import {
  AUTHENTICATION_STATUS,
  selectAuthenticatedUser,
  selectAuthenticationStatus,
  selectMembership,
} from '../slice'
import { USER_ROLE_LABEL, getInitials, toLoginNavigationState, toPostLoginDestination } from '../utils'

const WORKSPACE_LINK_LABEL = Object.freeze({
  [USER_ROLE.PLATFORM_ADMIN]: 'Trang quản trị',
  [USER_ROLE.COMPANY_STAFF]: 'Hồ sơ doanh nghiệp',
})

const CANDIDATE_MENU_LINKS = Object.freeze([
  { to: '/candidate/profile', label: 'Hồ sơ cá nhân', icon: UserRound },
  { to: '/candidate/saved-jobs', label: 'Việc làm đã lưu', icon: Bookmark },
])

function GuestLinks() {
  const location = useLocation()

  return (
    <>
      <NavLink
        className={({ isActive }) =>
          cn(
            'hidden font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline',
            isActive && 'text-primary hover:text-primary',
          )
        }
        to="/register"
      >
        Đăng ký
      </NavLink>
      <NavLink
        aria-label="Đăng nhập"
        className={({ isActive }) =>
          cn(
            'inline-flex items-center gap-2 rounded-full font-semibold text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
            isActive && 'text-primary hover:text-primary',
          )
        }
        state={toLoginNavigationState(location)}
        to="/login"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <UserRound aria-hidden="true" className="size-4" />
        </span>
        <span className="hidden lg:inline">Đăng nhập</span>
      </NavLink>
    </>
  )
}

function AccountAvatar({ user }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const avatarUrl = user?.avatarUrl || null
  const showImage = Boolean(avatarUrl) && failedUrl !== avatarUrl
  const initials = getInitials(user?.fullName)

  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {showImage ? (
        <img
          alt=""
          className="size-full object-cover"
          onError={() => setFailedUrl(avatarUrl)}
          src={avatarUrl}
        />
      ) : (
        initials || <UserRound aria-hidden="true" className="size-4" />
      )}
    </span>
  )
}

function AccountMenu({ user }) {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const membership = useAppSelector(selectMembership)
  const isRecruiter = membership?.role === COMPANY_MEMBER_ROLE.RECRUITER
  const isCompanyManager =
    membership?.role === COMPANY_MEMBER_ROLE.COMPANY_MANAGER && user.status === USER_STATUS.ACTIVE
  const defaultPath = toPostLoginDestination(user)
  let workspacePath = defaultPath
  let workspaceLabel = defaultPath === '/' ? null : WORKSPACE_LINK_LABEL[user.role]
  if (isRecruiter) {
    workspacePath = '/recruiter/jobs'
    workspaceLabel = 'Khu nhà tuyển dụng'
  } else if (isCompanyManager) {
    workspacePath = '/company/recruiters'
    workspaceLabel = 'Quản lý Recruiter'
  }

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const closeOnOutsidePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const handleLogout = async () => {
    setLoggingOut(true)

    try {
      await logout()
      toast.success('Đã đăng xuất', { description: 'Bạn đã đăng xuất khỏi JOBHUB.' })
    } catch (error) {
      toast.error(error.message)
    }

    setLoggingOut(false)
    setOpen(false)
    navigate('/', { replace: true })
  }

  const displayName = user.fullName || user.email

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Tài khoản: ${displayName}`}
        className="inline-flex max-w-full items-center gap-2 rounded-full py-0.5 pr-1.5 pl-0.5 font-semibold text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <AccountAvatar user={user} />
        <span className="hidden min-w-0 text-left lg:block">
          <span
            className="block max-w-[9rem] truncate xl:max-w-[14rem]"
            title={displayName}
          >
            {displayName}
          </span>
          {/* Company staff see their Company job title under the name. */}
          {membership?.jobTitle && (
            <span className="block max-w-[9rem] truncate text-xs font-normal text-muted-foreground xl:max-w-[14rem]">
              {membership.jobTitle}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-border/40">
          <div className="rounded-lg bg-secondary/40 px-3 py-2.5">
            <p className="truncate text-sm font-semibold">{user.fullName || user.email}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            {USER_ROLE_LABEL[user.role] && (
              <span className="mt-1.5 inline-flex rounded-md bg-background px-2 py-0.5 text-[11px] font-medium text-secondary-foreground ring-1 ring-border">
                {USER_ROLE_LABEL[user.role]}
              </span>
            )}
          </div>

          <ul className="mt-1 space-y-0.5">
            {user.role === USER_ROLE.CANDIDATE &&
              CANDIDATE_MENU_LINKS.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.to}>
                    <Link
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors outline-none hover:bg-secondary focus-visible:bg-secondary"
                      onClick={() => setOpen(false)}
                      to={item.to}
                    >
                      <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            {workspaceLabel && (
              <li>
                <Link
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors outline-none hover:bg-secondary focus-visible:bg-secondary"
                  onClick={() => setOpen(false)}
                  to={workspacePath}
                >
                  <LayoutDashboard aria-hidden="true" className="size-4 text-muted-foreground" />
                  {workspaceLabel}
                </Link>
              </li>
            )}
            {isRecruiter && (
              <li>
                <Link
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors outline-none hover:bg-secondary focus-visible:bg-secondary"
                  onClick={() => setOpen(false)}
                  to="/recruiter/change-password"
                >
                  <KeyRound aria-hidden="true" className="size-4 text-muted-foreground" />
                  Đổi mật khẩu
                </Link>
              </li>
            )}
            <li>
              <button
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-destructive transition-colors outline-none hover:bg-destructive/10 focus-visible:bg-destructive/10 disabled:opacity-60"
                disabled={loggingOut}
                onClick={handleLogout}
                type="button"
              >
                {loggingOut ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <LogOut aria-hidden="true" className="size-4" />
                )}
                Đăng xuất
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

function HeaderAccountMenu() {
  const status = useAppSelector(selectAuthenticationStatus)
  const user = useAppSelector(selectAuthenticatedUser)

  if (status === AUTHENTICATION_STATUS.IDLE || status === AUTHENTICATION_STATUS.RESTORING) {
    return (
      <span
        aria-label="Đang kiểm tra phiên đăng nhập"
        className="size-9 animate-pulse rounded-full bg-secondary"
        role="status"
      />
    )
  }

  if (user && status !== AUTHENTICATION_STATUS.UNAUTHENTICATED) {
    return <AccountMenu user={user} />
  }

  return <GuestLinks />
}

export default HeaderAccountMenu
