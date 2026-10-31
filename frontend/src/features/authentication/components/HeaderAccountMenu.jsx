import { ChevronDown, LayoutDashboard, LoaderCircle, LogOut, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useAppSelector } from '@/store/hooks'
import { USER_ROLE } from '@/utils/constant'

import { logout } from '../services/authentication.service'
import { AUTHENTICATION_STATUS, selectAuthenticatedUser, selectAuthenticationStatus } from '../slice'
import { USER_ROLE_LABEL, getInitials, toLoginNavigationState, toPostLoginDestination } from '../utils'

const WORKSPACE_LINK_LABEL = Object.freeze({
  [USER_ROLE.PLATFORM_ADMIN]: 'Trang quản trị',
  [USER_ROLE.COMPANY_STAFF]: 'Hồ sơ doanh nghiệp',
})

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

function AccountMenu({ user }) {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const workspacePath = toPostLoginDestination(user)
  const workspaceLabel = workspacePath === '/' ? null : WORKSPACE_LINK_LABEL[user.role]

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

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-2 rounded-full py-0.5 pr-1 pl-0.5 font-semibold text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {getInitials(user.fullName) || <UserRound aria-hidden="true" className="size-4" />}
        </span>
        <span className="hidden max-w-40 truncate lg:inline">{user.fullName || user.email}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
        <span className="sr-only">Mở menu tài khoản</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg">
          <div className="border-b px-3 pt-2 pb-3">
            <p className="truncate text-sm font-semibold">{user.fullName || user.email}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            {USER_ROLE_LABEL[user.role] && (
              <span className="mt-2 inline-flex rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                {USER_ROLE_LABEL[user.role]}
              </span>
            )}
          </div>

          <ul className="pt-1">
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
