import { Link, NavLink } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function AppHeader({ accountArea }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          className="inline-flex items-center gap-1.5 text-xl font-extrabold tracking-tight"
          to="/"
        >
          JOBHUB
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
        </Link>

        <nav aria-label="Điều hướng chính" className="flex items-center gap-2 text-sm sm:gap-5">
          <NavLink
            className={({ isActive }) =>
              cn(
                'hidden font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline',
                isActive && 'text-primary hover:text-primary',
              )
            }
            end
            to="/"
          >
            Trang chủ
          </NavLink>

          <Button asChild size="sm" className="font-semibold">
            <Link to="/jobs">Tìm việc làm</Link>
          </Button>

          {accountArea}
        </nav>
      </div>
    </header>
  )
}

export default AppHeader
