import { Banknote, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import {
  formatProvince,
  formatRelativeTime,
  formatSalary,
  formatWorkModes,
  getJobTags,
} from '@/features/job-discovery/utils'

function AiRecommendedJobCard({ job, matchScore, reason }) {
  const locationParts = [
    formatProvince(job.location, new Map()),
    formatWorkModes(job.workModes),
  ]
    .filter(Boolean)
    .join(' · ')
  const tags = getJobTags(job)
  const deadlineLabel = formatRelativeTime(job.applicationDeadline)
  const scoreLabel =
    typeof matchScore === 'number' && !Number.isNaN(matchScore)
      ? `${Math.round(matchScore)} điểm phù hợp`
      : null

  return (
    <article className="rounded-2xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-3">
        <CompanyLogo className="size-11" company={job.company} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-5">
              <Link
                className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                to={`/jobs/${job.id}`}
              >
                {job.title}
              </Link>
            </h3>
            {scoreLabel ? (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {scoreLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {job.company?.id ? (
              <Link className="hover:underline" to={`/companies/${job.company.id}`}>
                {job.company.name}
              </Link>
            ) : (
              (job.company?.name ?? null)
            )}
            {locationParts ? ` · ${locationParts}` : null}
          </p>
        </div>
      </div>

      <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-success-foreground">
        <Banknote aria-hidden="true" className="size-3.5" />
        {formatSalary(job.salary)}
      </p>

      {locationParts ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{locationParts}</span>
        </p>
      ) : null}

      {reason ? (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{reason}</p>
      ) : null}

      {tags.length > 0 ? (
        <ul aria-label="Phân loại" className="mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 4).map((tag) => (
            <li
              className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
              key={tag}
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">
          {deadlineLabel ? `Hạn ${deadlineLabel}` : null}
        </span>
        <Button asChild size="sm" variant="outline">
          <Link to={`/jobs/${job.id}`}>Xem việc làm</Link>
        </Button>
      </div>
    </article>
  )
}

export default AiRecommendedJobCard
