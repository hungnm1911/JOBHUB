import { Bookmark, CheckCircle2 } from 'lucide-react'

import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import { cn } from '@/lib/utils'

import { formatDate, formatSalary } from '../utils'

function SavedJobListItem({ entry, selected, onSelect }) {
  const job = entry.job
  const company = job?.company
  const savedLabel = formatDate(entry.savedAt)

  return (
    <button
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors',
        selected ? 'bg-primary/8 ring-1 ring-primary/25' : 'hover:bg-secondary/70',
      )}
      onClick={() => onSelect(job.id)}
      type="button"
    >
      <CompanyLogo className="size-10 shrink-0 rounded-full" company={company} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {job?.title ?? 'Việc làm'}
          </span>
          <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
            {savedLabel ? `Lưu ${savedLabel}` : null}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {company?.name ?? 'Công ty'}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5">
          {entry.hasApplication ? (
            <CheckCircle2 aria-hidden="true" className="size-3 shrink-0 text-primary" />
          ) : (
            <Bookmark aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-xs text-muted-foreground">
            {formatSalary(job?.salary)}
            {entry.hasApplication ? ' · Đã ứng tuyển' : null}
          </span>
        </span>
      </span>
    </button>
  )
}

export default SavedJobListItem
