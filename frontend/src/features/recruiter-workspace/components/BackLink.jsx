import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

function BackLink({ to, children }) {
  return (
    <Link
      className="inline-flex min-h-6 items-center pointer-coarse:min-h-11 gap-1.5 rounded-sm text-sm font-medium text-muted-foreground outline-none hover:text-foreground active:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring"
      to={to}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  )
}

export default BackLink
