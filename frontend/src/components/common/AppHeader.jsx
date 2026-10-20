import { BriefcaseBusiness } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'

const navigationLinks = [
  { to: '/login', label: 'Đăng nhập' },
  { to: '/register', label: 'Đăng ký' },
]

function AppHeader() {
  return (
    <header className="border-b bg-card/90 backdrop-blur">
      <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-6">
        <Link
          className="inline-flex items-center gap-2 justify-self-start font-semibold tracking-tight"
          to="/"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BriefcaseBusiness aria-hidden="true" className="size-5" />
          </span>
          JOBHUB
        </Link>

        <nav aria-label="Điều hướng chính" className="flex items-center gap-6 text-sm">
          {navigationLinks.map((link) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  'font-medium text-muted-foreground transition-colors hover:text-foreground',
                  isActive && 'text-primary hover:text-primary',
                )
              }
              key={link.to}
              to={link.to}
            >
              {link.label}
            </NavLink>
          ))}
          <span className="font-medium text-muted-foreground">Hỗ trợ</span>
        </nav>
      </div>
    </header>
  )
}

export default AppHeader
