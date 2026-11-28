import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  Users,
  MessageSquare,
  Bell,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { cn } from '@/lib/utils'

const navigation = [
  { to: '/company/jobs', label: 'Job tuyển dụng', icon: BriefcaseBusiness },
  { to: '/company/recruiters', label: 'Recruiter', icon: Users },
  { to: '/company/profile', label: 'Hồ sơ công ty', icon: Building2 },
  { to: '/company/support', label: 'Hỗ trợ JOBHUB', icon: MessageSquare },
  { to: '/company/notifications', label: 'Thông báo', icon: Bell },
]

function CompanyManagerLayout() {
  return (
    <div
      className="flex w-full min-w-0 flex-col lg:flex-row"
      data-area="company-manager"
    >
      <aside className="shrink-0 border-b bg-card p-4 lg:w-56 lg:border-r lg:border-b-0 lg:py-7">
        <Link
          className="mb-4 inline-flex items-center gap-2 px-3 text-sm text-muted-foreground hover:text-primary"
          to="/"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Trang chủ
        </Link>
        <p className="mb-4 px-3 text-xs font-semibold tracking-wide text-muted-foreground">
          COMPANY WORKSPACE
        </p>
        <nav
          aria-label="Điều hướng Company Manager"
          className="flex flex-wrap gap-1 lg:flex-col"
        >
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground',
                )
              }
              key={to}
              to={to}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <Outlet />
      </div>
    </div>
  )
}

export default CompanyManagerLayout
