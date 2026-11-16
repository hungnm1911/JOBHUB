import {
  Bell,
  Bookmark,
  Bot,
  BriefcaseBusiness,
  FileText,
  House,
  LayoutDashboard,
  Mail,
  MailOpen,
  Menu,
  MessageSquare,
  Search,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom'

import FlashMessage from '@/components/common/FlashMessage'
import { Button } from '@/components/ui/button'
import HeaderAccountMenu from '@/features/authentication/components/HeaderAccountMenu'
import { SEARCH_PARAM } from '@/features/job-discovery/search-params'
import { cn } from '@/lib/utils'

const candidateNavigation = [
  { to: '/candidate', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/candidate/profile', label: 'Hồ sơ cá nhân', icon: UserRound },
  { to: '/candidate/cvs', label: 'Quản lý CV', icon: FileText },
  { to: '/candidate/applications', label: 'Đơn ứng tuyển', icon: Mail },
  { to: '/candidate/invitations', label: 'Lời mời ứng tuyển', icon: MailOpen },
  { to: '/candidate/saved-jobs', label: 'Việc làm đã lưu', icon: Bookmark },
  { to: '/candidate/messages', label: 'Tin nhắn', icon: MessageSquare },
  { to: '/candidate/notifications', label: 'Thông báo', icon: Bell },
  { to: '/candidate/ai-jobs', label: 'Việc làm phù hợp với AI', icon: Sparkles },
  { to: '/candidate/ai-center', label: 'Trung tâm AI', icon: Bot },
]

function CandidateLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const isFullBleedWorkspace =
    location.pathname.startsWith('/candidate/messages') ||
    location.pathname.startsWith('/candidate/saved-jobs')

  const handleSearch = (event) => {
    event.preventDefault()
    const params = new URLSearchParams()
    const value = keyword.trim()
    if (value) {
      params.set(SEARCH_PARAM.KEYWORD, value)
    }
    navigate(params.size > 0 ? `/jobs?${params.toString()}` : '/jobs')
  }

  const navLinkClass = ({ isActive }) =>
    cn(
      'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-hero-muted transition-colors hover:bg-hero-foreground/10 hover:text-hero-foreground',
      isActive && 'bg-hero-foreground/15 text-hero-foreground',
    )

  return (
    <div
      className={cn(
        'flex flex-col bg-background lg:flex-row',
        isFullBleedWorkspace ? 'h-svh overflow-hidden' : 'min-h-svh',
      )}
    >
      <ScrollRestoration />

      <aside
        className={cn(
          'shrink-0 bg-hero text-hero-foreground lg:sticky lg:top-0 lg:flex lg:h-svh lg:w-64 lg:flex-col lg:gap-8 lg:px-5 lg:py-6',
          mobileOpen ? 'fixed inset-0 z-50 flex flex-col px-4 py-4' : 'hidden lg:flex',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <Link className="inline-flex items-center gap-2 font-semibold tracking-tight" to="/candidate">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BriefcaseBusiness aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block leading-tight">JOBHUB</span>
              <span className="block text-xs font-medium text-hero-muted">Ứng viên</span>
            </span>
          </Link>
          <button
            aria-label="Đóng menu"
            className="rounded-lg p-2 text-hero-muted hover:bg-hero-foreground/10 hover:text-hero-foreground lg:hidden"
            onClick={() => setMobileOpen(false)}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <nav
          aria-label="Điều hướng ứng viên"
          className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto lg:mt-0"
        >
          {candidateNavigation.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                className={navLinkClass}
                end={item.end}
                key={item.to}
                onClick={() => setMobileOpen(false)}
                to={item.to}
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <Link
          className="mt-4 hidden items-center gap-2 rounded-lg px-3 py-2 text-sm text-hero-muted transition-colors hover:text-hero-foreground lg:flex"
          to="/"
        >
          <House aria-hidden="true" className="size-4" />
          Về trang chủ JOBHUB
        </Link>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 shrink-0 border-b bg-card/95 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
            <button
              aria-label="Mở menu điều hướng"
              className="shrink-0 rounded-lg border p-2 text-foreground lg:hidden"
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              <Menu aria-hidden="true" className="size-5" />
            </button>

            <form
              aria-label="Tìm việc làm"
              className="hidden min-w-0 flex-1 items-center gap-2 rounded-xl border bg-background px-3 sm:flex sm:max-w-sm md:max-w-md lg:max-w-lg"
              onSubmit={handleSearch}
              role="search"
            >
              <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <input
                className="h-10 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tìm việc làm…"
                type="search"
                value={keyword}
              />
            </form>

            <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
              <Button asChild className="hidden md:inline-flex" size="sm" variant="outline">
                <Link to="/candidate/cvs/create">Tạo CV nhanh</Link>
              </Button>
              <Button asChild className="hidden lg:inline-flex" size="sm">
                <Link to="/candidate/ai-jobs">
                  <Sparkles aria-hidden="true" className="size-4" />
                  Khám phá AI
                </Link>
              </Button>
              <Button
                asChild
                aria-label="Thông báo"
                className="shrink-0"
                size="icon"
                variant="outline"
              >
                <Link to="/candidate/notifications">
                  <Bell aria-hidden="true" className="size-4" />
                </Link>
              </Button>
              <HeaderAccountMenu />
            </div>
          </div>
          <form
            aria-label="Tìm việc làm"
            className="flex items-center gap-2 border-t px-4 py-2 sm:hidden"
            onSubmit={handleSearch}
            role="search"
          >
            <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <input
              className="h-9 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm việc làm…"
              type="search"
              value={keyword}
            />
          </form>
        </header>

        <FlashMessage />
        <main
          className={cn(
            'flex w-full min-w-0 flex-1 flex-col',
            isFullBleedWorkspace
              ? 'min-h-0 overflow-hidden p-0'
              : 'mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8',
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default CandidateLayout
