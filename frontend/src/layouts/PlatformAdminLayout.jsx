import { Building2, BriefcaseBusiness, House, LayoutDashboard } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import FlashMessage from '@/components/common/FlashMessage'
import { cn } from '@/lib/utils'

const adminNavigation = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/admin/company-registrations', label: 'Xét duyệt doanh nghiệp', icon: Building2 },
]

function PlatformAdminLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 bg-hero px-4 py-4 text-hero-foreground lg:sticky lg:top-0 lg:h-svh lg:w-64 lg:gap-8 lg:px-5 lg:py-6">
        <Link className="inline-flex items-center gap-2 font-semibold tracking-tight" to="/admin">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BriefcaseBusiness aria-hidden="true" className="size-5" />
          </span>
          <span>
            <span className="block leading-tight">JOBHUB</span>
            <span className="block text-xs font-medium text-hero-muted">Platform Admin</span>
          </span>
        </Link>

        <nav aria-label="Điều hướng quản trị" className="flex gap-1 overflow-x-auto lg:flex-col">
          {adminNavigation.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-hero-muted transition-colors hover:bg-hero-foreground/10 hover:text-hero-foreground',
                    isActive && 'bg-hero-foreground/15 text-hero-foreground',
                  )
                }
                end={item.end}
                key={item.to}
                to={item.to}
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <Link
          className="mt-auto hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-hero-muted transition-colors hover:text-hero-foreground lg:flex"
          to="/"
        >
          <House aria-hidden="true" className="size-4" />
          Về trang chủ JOBHUB
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <FlashMessage />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default PlatformAdminLayout
