import { BriefcaseBusiness } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'

function RootLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-6">
          <Link
            className="inline-flex items-center gap-2 font-semibold tracking-tight"
            to="/"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BriefcaseBusiness aria-hidden="true" className="size-5" />
            </span>
            JOBHUB
          </Link>
        </div>
      </header>

      <main className="flex flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export default RootLayout
