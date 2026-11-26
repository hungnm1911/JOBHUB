import { Fragment } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Đường dẫn">
      <ol className="flex flex-wrap items-center gap-x-2 text-sm">
        {items.map((item, index) => (
          <Fragment key={`${index}-${item.label}`}>
            {index > 0 && (
              <li aria-hidden="true" className="text-muted-foreground">
                /
              </li>
            )}
            <li className="min-w-0">
              {item.to ? (
                <Link
                  className="inline-flex min-h-6 items-center rounded-sm text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
                  to={item.to}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium break-words">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}

// The card that opens every recruiter screen. `children` sits flush at the bottom (tabs).
function RecruiterPageHeader({
  breadcrumbs,
  leading,
  title,
  badges,
  description,
  actions,
  children,
}) {
  // A lone title needs no surrounding box.
  if (!breadcrumbs && !leading && !badges && !description && !actions && !children) {
    return <h1 className="text-2xl font-bold tracking-tight break-words">{title}</h1>
  }

  return (
    <header className={cn('rounded-xl border bg-card px-5 pt-4', !children && 'pb-4')}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className={cn('flex flex-wrap items-center justify-between gap-4', breadcrumbs && 'mt-2')}>
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-xl font-bold tracking-tight break-words sm:text-2xl">{title}</h1>
              {badges}
            </div>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </header>
  )
}

export default RecruiterPageHeader
