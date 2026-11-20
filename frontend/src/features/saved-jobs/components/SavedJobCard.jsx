import {
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Trash2,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import {
  EMPLOYMENT_TYPE_LABEL,
  formatProvince,
  formatRelativeTime,
  formatSalary,
  formatWorkModes,
} from '@/features/job-discovery/utils'
import { cn } from '@/lib/utils'
import { JOB_STATUS } from '@/utils/constant'

import { JOB_STATUS_LABEL, formatDate } from '../utils'

function SavedJobCard({ entry, provinceNameByCode, busy = false, onUnsave }) {
  const job = entry?.job
  if (!job) {
    return null
  }

  const company = job.company
  const statusLabel = JOB_STATUS_LABEL[job.status] ?? job.status
  const isPublished = !job.status || job.status === JOB_STATUS.PUBLISHED
  const savedLabel = formatDate(entry.savedAt)
  const deadlineLabel = formatDate(job.applicationDeadline)
  const publishedAgo = formatRelativeTime(job.publishedAt)
  const salaryLabel = formatSalary(job.salary)
  const employmentLabel = EMPLOYMENT_TYPE_LABEL[job.employmentType] ?? job.employmentType
  const workModeLabel = formatWorkModes(job.workModes)
  const locationLabel = [
    job.location?.addressText,
    formatProvince(job.location, provinceNameByCode),
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <article
      aria-busy={busy}
      className={cn(
        'group relative flex flex-col gap-4 rounded-xl border border-l-4 bg-card p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-5',
        entry.hasApplication
          ? 'border-emerald-500/25 border-l-emerald-500 bg-emerald-500/[0.015]'
          : isPublished
            ? 'border-primary/25 border-l-primary bg-primary/[0.01]'
            : 'border-border border-l-muted-foreground/40 bg-muted/20',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <Link
          aria-label={`Xem việc làm ${job.title}`}
          className="shrink-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          to={`/jobs/${encodeURIComponent(job.id)}`}
        >
          <CompanyLogo className="size-12 rounded-xl" company={company} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {company?.id ? (
              <Link
                className="text-xs font-semibold tracking-wide text-primary uppercase hover:underline"
                to={`/companies/${encodeURIComponent(company.id)}`}
              >
                {company.name}
              </Link>
            ) : (
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {company?.name ?? 'Công ty'}
              </span>
            )}
            {savedLabel && (
              <span className="text-xs text-muted-foreground">· Lưu ngày {savedLabel}</span>
            )}
            {publishedAgo && (
              <span className="text-xs text-muted-foreground">· Đăng {publishedAgo}</span>
            )}
          </div>

          <h3 className="mt-1 truncate text-base font-semibold tracking-tight">
            <Link
              className="hover:text-primary hover:underline"
              title={job.title}
              to={`/jobs/${encodeURIComponent(job.id)}`}
            >
              {job.title}
            </Link>
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 text-[11px] font-semibold text-success-foreground">
              <Banknote aria-hidden="true" className="size-3" />
              {salaryLabel}
            </span>

            {entry.hasApplication && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 aria-hidden="true" className="size-3" />
                Đã ứng tuyển
              </span>
            )}

            {statusLabel && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                  isPublished
                    ? 'border-primary/25 bg-primary/5 text-primary'
                    : 'border-border bg-secondary text-muted-foreground',
                )}
              >
                {statusLabel}
              </span>
            )}

            {employmentLabel && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                <BriefcaseBusiness aria-hidden="true" className="size-3" />
                {employmentLabel}
              </span>
            )}

            {workModeLabel && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Clock3 aria-hidden="true" className="size-3" />
                {workModeLabel}
              </span>
            )}
          </div>

          {(locationLabel || deadlineLabel) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {locationLabel && (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">{locationLabel}</span>
                </span>
              )}
              {deadlineLabel && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
                  Hạn nộp: {deadlineLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <Button asChild size="sm">
          <Link to={`/jobs/${encodeURIComponent(job.id)}`}>
            Xem việc làm
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </Link>
        </Button>
        <Button
          disabled={busy}
          onClick={() => onUnsave(job.id)}
          size="sm"
          type="button"
          variant="outline"
        >
          {busy ? (
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <Trash2 aria-hidden="true" className="size-3.5" />
          )}
          Bỏ lưu
        </Button>
      </div>
    </article>
  )
}

export default SavedJobCard
