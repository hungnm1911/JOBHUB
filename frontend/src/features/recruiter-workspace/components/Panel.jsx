import { Search, UserRound } from 'lucide-react'
import { useId } from 'react'

import { getInitials } from '@/features/authentication/utils'
import { cn } from '@/lib/utils'


function Panel({ title, actions, className, children, ...props }) {
  return (
    <section className={cn('rounded-xl border bg-card p-5', className)} {...props}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

// Filter bar + bordered result area shared by the recruiter lists.
function ListCard({ label, children }) {
  return (
    <section aria-label={label} className="overflow-hidden rounded-xl border bg-card">
      {children}
    </section>
  )
}

function FilterBar({ children }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center">
      {children}
    </div>
  )
}

function SearchInput({ label, value, onChange, placeholder }) {
  const id = useId()
  return (
    <div className="relative min-w-0 flex-1">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        className="h-10 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        id={id}
        maxLength={200}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? label}
        type="search"
        value={value}
      />
    </div>
  )
}

function Avatar({ person, className }) {
  const base = cn('size-9 shrink-0 rounded-full', className)
  if (person?.avatarUrl) {
    return <img alt="" className={cn(base, 'object-cover')} height="36" src={person.avatarUrl} width="36" />
  }
  const initials = getInitials(person?.fullName)
  return (
    <span
      aria-hidden="true"
      className={cn(
        base,
        'flex items-center justify-center bg-secondary text-xs font-semibold text-foreground/70',
      )}
    >
      {initials || <UserRound className="size-4" />}
    </span>
  )
}

export { Avatar, FilterBar, ListCard, SearchInput }
export default Panel
