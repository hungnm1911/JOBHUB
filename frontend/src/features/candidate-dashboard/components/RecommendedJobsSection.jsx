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

import DashboardSectionHeader from './DashboardSectionHeader'

function RecommendedJobCard({ job, matchScore, reason, provinceNameByCode }) {
  const locationParts = [formatProvince(job.location, provinceNameByCode), formatWorkModes(job.workModes)]
    .filter(Boolean)
    .join(' • ')
  const tags = getJobTags(job)
  const deadlineLabel = formatRelativeTime(job.applicationDeadline)

  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <CompanyLogo className="size-11" company={job.company} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-5">
              <Link
                className="outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                to={`/jobs/${job.id}`}
              >
                {job.title}
              </Link>
            </h3>
            {typeof matchScore === 'number' && (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {Math.round(matchScore)}% phù hợp
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            <Link className="hover:underline" to={`/companies/${job.company?.id}`}>
              {job.company?.name}
            </Link>
            {locationParts ? ` · ${locationParts}` : null}
          </p>
        </div>
      </div>

      <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-success-foreground">
        <Banknote aria-hidden="true" className="size-3.5" />
        {formatSalary(job.salary)}
      </p>

      {locationParts && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{locationParts}</span>
        </p>
      )}

      {reason && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{reason}</p>}

      {tags.length > 0 && (
        <ul aria-label="Kỹ năng và phân loại" className="mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 4).map((tag) => (
            <li className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground" key={tag}>
              {tag}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">
          {deadlineLabel ? `Hạn ${deadlineLabel}` : null}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={`/jobs/${job.id}`}>Chi tiết</Link>
          </Button>
          <Button asChild size="sm">
            <Link to={`/jobs/${job.id}`}>Ứng tuyển nhanh</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

function RecommendedJobsSection({
  source,
  jobs,
  recommendations,
  loading,
  error,
  provinceNameByCode = new Map(),
}) {
  const aiItems = recommendations.map((item) => ({
    key: item.job.id,
    job: item.job,
    matchScore: item.matchScore,
    reason: item.reason,
  }))
  const discoveryItems = jobs.map((job) => ({
    key: job.id,
    job,
    matchScore: null,
    reason: null,
  }))
  const items = source === 'ai' ? aiItems : discoveryItems

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <DashboardSectionHeader
        actionLabel="Xem thêm việc làm"
        actionTo="/jobs"
        title={source === 'ai' ? 'Việc làm gợi ý bởi AI' : 'Việc làm gợi ý nổi bật'}
      />

      {loading && (
        <p className="rounded-lg bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Đang tải gợi ý việc làm…
        </p>
      )}

      {!loading && error && (
        <p className="mb-3 rounded-lg bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error.message || 'Không tải được gợi ý AI. Đang hiển thị việc làm mới nhất thay thế.'}
        </p>
      )}

      {!loading && items.length === 0 && (
        <p className="rounded-lg bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Chưa có việc làm để gợi ý. Hãy thử tìm kiếm trên trang việc làm.
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="grid gap-3">
          {items.map((item) => (
            <RecommendedJobCard
              job={item.job}
              key={item.key}
              matchScore={item.matchScore}
              provinceNameByCode={provinceNameByCode}
              reason={item.reason}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default RecommendedJobsSection
