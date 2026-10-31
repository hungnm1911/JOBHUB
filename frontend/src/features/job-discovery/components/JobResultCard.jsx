import { ArrowRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  formatProvince,
  formatRelativeTime,
  formatSalary,
  formatWorkModes,
  getJobTags,
} from '../utils'
import CompanyLogo from './CompanyLogo'

function JobResultCard({ job, provinceNameByCode, action }) {
  const locationParts = [formatProvince(job.location, provinceNameByCode), formatWorkModes(job.workModes)]
    .filter(Boolean)
    .join(' • ')
  const facts = [
    EMPLOYMENT_TYPE_LABEL[job.employmentType],
    job.experienceLevel ? EXPERIENCE_LEVEL_LABEL[job.experienceLevel.code] : null,
  ].filter(Boolean)
  const tags = getJobTags(job, 4)
  const publishedAgo = formatRelativeTime(job.publishedAt)

  return (
    <article className="group relative flex gap-4 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
      <CompanyLogo company={job.company} />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="font-semibold tracking-wide text-primary uppercase">{job.company.name}</span>
              {locationParts && (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-3.5" />
                  {locationParts}
                </span>
              )}
            </p>
            <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-6">
              <Link
                className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
                to={`/jobs/${job.id}`}
              >
                {job.title}
              </Link>
            </h3>
          </div>
          <p className="w-fit shrink-0 rounded-full bg-success px-3 py-1 text-sm font-semibold whitespace-nowrap text-success-foreground">
            {formatSalary(job.salary)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {facts.map((fact) => (
            <span className="rounded-md border px-2 py-0.5 font-medium" key={fact}>
              {fact}
            </span>
          ))}
          {publishedAgo && <span className="text-muted-foreground">• Đăng {publishedAgo}</span>}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          {tags.length > 0 ? (
            <ul aria-label="Danh mục" className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <li className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground" key={tag}>
                  {tag}
                </li>
              ))}
            </ul>
          ) : (
            <span />
          )}
          {action ?? (
            <span aria-hidden="true" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Xem chi tiết
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

export default JobResultCard
