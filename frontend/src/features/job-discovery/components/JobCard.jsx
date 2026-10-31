import { ArrowRight, Banknote, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

import { formatProvince, formatRelativeTime, formatSalary, formatWorkModes, getJobTags } from '../utils'
import CompanyLogo from './CompanyLogo'

function JobCard({ job, provinceNameByCode, action }) {
  const locationParts = [formatProvince(job.location, provinceNameByCode), formatWorkModes(job.workModes)]
    .filter(Boolean)
    .join(' • ')
  const tags = getJobTags(job)
  const publishedAgo = formatRelativeTime(job.publishedAt)

  return (
    <article className="group relative flex h-full flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <CompanyLogo company={job.company} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{job.company.name}</p>
          {locationParts && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{locationParts}</span>
            </p>
          )}
        </div>
      </div>

      <h3 className="mt-4 line-clamp-2 text-base font-semibold leading-6">
        <Link
          className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
          to={`/jobs/${job.id}`}
        >
          {job.title}
        </Link>
      </h3>

      <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-md bg-success px-2 py-1 text-xs font-semibold text-success-foreground">
        <Banknote aria-hidden="true" className="size-3.5" />
        {formatSalary(job.salary)}
      </p>

      {tags.length > 0 && (
        <ul aria-label="Danh mục" className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground" key={tag}>
              {tag}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <span className="text-xs text-muted-foreground">
            {publishedAgo ? `Đăng ${publishedAgo}` : null}
          </span>
          {action ?? (
            <span
              aria-hidden="true"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
            >
              Xem chi tiết
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

export default JobCard
