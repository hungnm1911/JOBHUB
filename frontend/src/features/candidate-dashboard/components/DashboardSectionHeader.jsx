import { Link } from 'react-router-dom'

function DashboardSectionHeader({ title, actionLabel, actionTo, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="flex items-center gap-3">
        {children}
        {actionTo && actionLabel && (
          <Link
            className="text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            to={actionTo}
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  )
}

export default DashboardSectionHeader
