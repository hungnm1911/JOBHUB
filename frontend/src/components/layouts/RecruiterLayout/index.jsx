import {
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronsUpDown,
  FolderKanban,
  House,
  Menu,
  MessageSquare,
  Search,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom'

import FlashMessage from '@/components/common/FlashMessage'
import UnsavedChangesProvider from '@/components/common/UnsavedChangesProvider'
import HeaderAccountMenu from '@/features/authentication/components/HeaderAccountMenu'
import { selectMembership } from '@/features/authentication/slice'
import NotificationMenu from '@/features/recruiter-workspace/components/NotificationMenu'
import { cn } from '@/lib/utils'
import { useAppSelector } from '@/store/hooks'

import useMobileMenu from './hooks/useMobileMenu'
import useOwnCompanyProfile from './hooks/useOwnCompanyProfile'
import useRecruiterDocumentTitle from './hooks/useRecruiterDocumentTitle'
import useUnreadNotificationCount from './hooks/useUnreadNotificationCount'

// Each workspace owns its sidebar; its first item is where switching to it lands.
const workspaces = [
  {
    key: 'recruitment',
    label: 'Quy trình tuyển dụng',
    icon: FolderKanban,
    items: [
      { to: '/', label: 'Trang chủ', icon: House, end: true },
      { to: '/recruiter/jobs', label: 'Job tôi phụ trách chính', icon: BriefcaseBusiness },
      {
        to: '/recruiter/participating',
        label: 'Job được giao',
        icon: Users,
        // Assigned Applications are reached through their Job.
        also: ['/recruiter/my-applications'],
      },
      { to: '/recruiter/messages', label: 'Tin nhắn', icon: MessageSquare },
    ],
  },
  {
    key: 'sourcing',
    label: 'Săn ứng viên',
    icon: Search,
    items: [{ to: '/recruiter/candidates', label: 'Tìm CV', icon: Search }],
  },
]

// Shared screens such as notifications belong to the recruitment workspace.
function getActiveWorkspace(pathname) {
  return (
    workspaces.find((workspace) => workspace.items.some((item) => item.end ? pathname === item.to : pathname.startsWith(item.to))) ??
    workspaces[0]
  )
}

const itemBaseClass =
  'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring'

function WorkspaceSwitcher() {
  const listboxId = useId()
  const containerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = getActiveWorkspace(pathname)
  const ActiveIcon = active.icon

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

  const handleSelect = (workspace) => {
    setOpen(false)
    navigate(workspace.items[0].to)
  }

  return (
    <div className="relative min-w-0" ref={containerRef}>
      <button
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Không gian làm việc: ${active.label}`}
        className={cn(
          'flex h-10 max-w-full items-center gap-2 rounded-lg border bg-secondary/50 pr-2.5 pl-1.5 text-left transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring',
          open && 'border-primary/40 bg-secondary ring-2 ring-primary/15',
        )}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ActiveIcon aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{active.label}</span>
        <ChevronsUpDown
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-colors',
            open && 'text-primary',
          )}
        />
      </button>

      {open && (
        <div
          aria-label="Chọn không gian làm việc"
          className="absolute left-0 z-50 mt-1.5 w-60 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-border/40"
          id={listboxId}
          role="listbox"
        >
          {workspaces.map((workspace) => {
            const selected = workspace.key === active.key
            return (
              <button
                aria-selected={selected}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors outline-none',
                  selected
                    ? 'bg-primary/10 font-semibold text-primary'
                    : 'font-medium text-foreground/85 hover:bg-secondary hover:text-foreground focus-visible:bg-secondary',
                )}
                key={workspace.key}
                onClick={() => handleSelect(workspace)}
                role="option"
                type="button"
              >
                <span className="truncate">{workspace.label}</span>
                {selected && <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SidebarNavigation({ onNavigate }) {
  const location = useLocation()

  const workspace = getActiveWorkspace(location.pathname)

  return (
    <nav aria-label="Điều hướng nhà tuyển dụng" className="flex flex-1 flex-col gap-1 overflow-y-auto">
      {workspace.items.map((item) => {
        const Icon = item.icon
        // Detail pages still belong to their list destination.
        const active = item.end
          ? location.pathname.replace(/\/$/, '') === item.to
          : [item.to, ...(item.also ?? [])].some((path) => location.pathname.startsWith(path))
        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={cn(
              itemBaseClass,
              active
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-foreground/80 hover:bg-secondary hover:text-foreground active:bg-secondary/80',
            )}
            key={item.to}
            onClick={onNavigate}
            to={item.to}
          >
            <Icon aria-hidden="true" className="size-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function RecruiterLayout() {
  const { open: mobileOpen, show: showMenu, close: closeMenu, triggerRef, closeRef } = useMobileMenu()
  const mainRef = useRef(null)
  useRecruiterDocumentTitle()
  const membership = useAppSelector(selectMembership)
  const company = useOwnCompanyProfile(membership?.companyId ?? null)
  const { count: unreadCount, refresh: refreshUnreadCount } = useUnreadNotificationCount()

  // The recruiter route group sits outside RootLayout, so it mounts its own provider.
  return (
    <UnsavedChangesProvider>
      <div className="flex min-h-svh flex-col bg-background lg:flex-row" data-area="recruiter">
        <ScrollRestoration />
        <a
          className="sr-only rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60]"
          href="#recruiter-main"
          onClick={(event) => {
            event.preventDefault()
            mainRef.current?.focus()
          }}
        >
          Bỏ qua tới nội dung
        </a>

        <aside
          aria-label={mobileOpen ? 'Menu điều hướng' : undefined}
          aria-modal={mobileOpen ? true : undefined}
          className={cn(
            'shrink-0 flex-col gap-5 border-r bg-card px-3 py-4 lg:sticky lg:top-0 lg:flex lg:h-svh lg:w-64',
            mobileOpen ? 'fixed inset-0 z-50 flex' : 'hidden',
          )}
          role={mobileOpen ? 'dialog' : undefined}
        >
          <div className="flex items-center justify-between gap-3">
            <Link
              aria-label="JOBHUB, khu nhà tuyển dụng"
              className="inline-flex items-center gap-2 rounded-lg px-1 font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={closeMenu}
              to="/"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BriefcaseBusiness aria-hidden="true" className="size-5" />
              </span>
              <span>
                <span className="block leading-tight">JOBHUB</span>
                <span className="block text-xs font-medium text-muted-foreground">Nhà tuyển dụng</span>
              </span>
            </Link>
            <button
              aria-label="Đóng menu"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              onClick={closeMenu}
              ref={closeRef}
              type="button"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>

          <SidebarNavigation onNavigate={closeMenu} />

          <Link
            className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            to="/"
          >
            <House aria-hidden="true" className="size-4" />
            Về trang chủ JOBHUB
          </Link>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col" inert={mobileOpen}>
          <header className="sticky top-0 z-40 shrink-0 border-b bg-card/95 backdrop-blur">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <button
                aria-expanded={mobileOpen}
                aria-label="Mở menu điều hướng"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg border text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                onClick={showMenu}
                ref={triggerRef}
                type="button"
              >
                <Menu aria-hidden="true" className="size-5" />
              </button>

              <WorkspaceSwitcher />

              {company && (
                <div className="hidden min-w-0 items-center gap-2.5 border-l pl-3 md:flex">
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-card">
                    {company.logoUrl ? (
                      <img alt="" className="size-full object-contain" height="36" src={company.logoUrl} width="36" />
                    ) : (
                      <Building2 aria-hidden="true" className="size-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="truncate text-sm font-medium">{company.name}</span>
                </div>
              )}

              <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
                <NotificationMenu onRead={refreshUnreadCount} unreadCount={unreadCount} />
                <HeaderAccountMenu />
              </div>
            </div>
          </header>

          <FlashMessage />
          <main
            className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col px-4 py-6 outline-none sm:px-6 sm:py-8"
            id="recruiter-main"
            ref={mainRef}
            tabIndex={-1}
          >
            <Outlet context={{ refreshUnreadCount }} />
          </main>
        </div>
      </div>
    </UnsavedChangesProvider>
  )
}

export default RecruiterLayout
