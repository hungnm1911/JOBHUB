import { BriefcaseBusiness } from 'lucide-react'
import { Link } from 'react-router-dom'

function AppHeader() {
  return (
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
  )
}

export default AppHeader
