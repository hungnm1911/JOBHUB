import { MessageSquare } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import HeaderNotificationsMenu from '@/features/candidate-notifications/components/HeaderNotificationsMenu'
import { cn } from '@/lib/utils'

const CANDIDATE_PRIMARY_NAV_LINKS = Object.freeze([
  { to: '/jobs', label: 'Tìm việc làm' },
  { to: '/candidate/ai-jobs', label: 'Gợi ý việc làm', ai: true },
  { to: '/candidate/cvs', label: 'Quản lý CV' },
  { to: '/candidate/applications', label: 'Đơn ứng tuyển' },
  { to: '/candidate/invitations', label: 'Lời mời ứng tuyển' },
])

function AppHeader({ accountArea, isCandidate = false, isRecruiter = false }) {
  const navLinkClass = ({ isActive }, visibleOnMobile = false) =>
    cn(
      'shrink-0 items-center gap-1.5 whitespace-nowrap font-semibold text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring xl:inline-flex',
      visibleOnMobile ? 'inline-flex' : 'hidden',
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
              <NavLink
                className={(state) => navLinkClass(state, item.to === '/jobs')}
                key={item.to}
                to={item.to}
              >
                {item.label}
                {item.ai && <Badge className="rounded-sm border-0 px-1.5 font-bold">AI</Badge>}
              </NavLink>
            ))}

          {isRecruiter && (
            <div className="hidden items-center gap-5 xl:flex">
              <NavLink className={navLinkClass} end to="/">Trang chủ</NavLink>
              <NavLink className={navLinkClass} to="/jobs">Khám phá việc làm</NavLink>
              <Button asChild size="sm"><Link to="/recruiter/jobs">Khu tuyển dụng</Link></Button>
            </div>
          )}

          {!isCandidate && !isRecruiter && (
            <Button asChild size="sm" className="shrink-0 font-semibold">
              <Link to="/jobs">Tìm việc làm</Link>
            </Button>
          )}

          {accountArea}

          {isCandidate && (
            <div className="flex shrink-0 items-center gap-1 border-l pl-2 sm:pl-3">
              <NavLink
                aria-label="Tin nhắn"
                className={iconLinkClass}
                title="Tin nhắn"
                to="/candidate/messages"
              >
                <MessageSquare aria-hidden="true" className="size-[18px]" />
              </NavLink>
              <HeaderNotificationsMenu />
            </div>
          )}
        </nav>
      </div>
      {isRecruiter && (
        <nav aria-label="Điều hướng Recruiter" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm font-semibold xl:hidden">
          <NavLink className={({ isActive }) => cn('rounded-sm hover:text-primary focus-visible:ring-2 focus-visible:ring-ring', isActive && 'text-primary')} end to="/">Trang chủ</NavLink>
          <NavLink className={({ isActive }) => cn('rounded-sm hover:text-primary focus-visible:ring-2 focus-visible:ring-ring', isActive && 'text-primary')} to="/jobs">Khám phá việc làm</NavLink>
          <Link className="rounded-sm text-primary focus-visible:ring-2 focus-visible:ring-ring" to="/recruiter/jobs">Khu tuyển dụng</Link>
        </nav>
      )}
    </header>
  )
}

export default AppHeader
