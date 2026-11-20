import { Bell, MessageSquare } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CANDIDATE_PRIMARY_NAV_LINKS = Object.freeze([
  { to: '/candidate/cvs', label: 'Quản lý CV' },
  { to: '/candidate/applications', label: 'Đơn ứng tuyển' },
  { to: '/candidate/invitations', label: 'Lời mời ứng tuyển' },
  { to: '/candidate/ai-jobs', label: 'Gợi ý việc làm' },
])

const CANDIDATE_QUICK_ACTIONS = Object.freeze([
  { to: '/candidate/messages', label: 'Tin nhắn', icon: MessageSquare },
  { to: '/candidate/notifications', label: 'Thông báo', icon: Bell },
])

function AppHeader({ accountArea, isCandidate = false }) {
  const navLinkClass = ({ isActive }) =>
    cn(
      'hidden shrink-0 whitespace-nowrap font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline',
      isActive && 'text-primary hover:text-primary',
    )

  const iconLinkClass = ({ isActive }) =>
    cn(
      'relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
      isActive && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
    )

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          className="inline-flex shrink-0 items-center gap-1.5 text-xl font-extrabold tracking-tight"
          to="/"
        >
          JOBHUB
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
        </Link>

        <nav
          aria-label="Điều hướng chính"
          className="flex min-w-0 items-center gap-2 text-sm sm:gap-5"
        >
          {isCandidate &&
            CANDIDATE_PRIMARY_NAV_LINKS.map((item) => (
              <NavLink className={navLinkClass} key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}

          <Button asChild size="sm" className="shrink-0 font-semibold">
            <Link to="/jobs">Tìm việc làm</Link>
          </Button>

          {accountArea}

          {isCandidate && (
            <div className="flex shrink-0 items-center gap-1 border-l pl-2 sm:pl-3">
              {CANDIDATE_QUICK_ACTIONS.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    aria-label={item.label}
                    className={iconLinkClass}
                    key={item.to}
                    title={item.label}
                    to={item.to}
                  >
                    <Icon aria-hidden="true" className="size-[18px]" />
                  </NavLink>
                )
              })}
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}

export default AppHeader
