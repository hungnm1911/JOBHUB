import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  Clock3,
  Globe,
  Loader2,
  MapPin,
  RotateCw,
  SearchX,
  TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'

import useDiscoveryCatalogs from '../hooks/useDiscoveryCatalogs'
import useDiscoveryJob from '../hooks/useDiscoveryJob'
import {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  formatDate,
  formatProvince,
  formatSalary,
  formatWorkModes,
  getHistoricalJobLabel,
  toJobDiscoveryErrorMessage,
} from '../utils'
import CompanyLogo from './CompanyLogo'

function JobFact({ icon: Icon, label, value }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium break-words">{value || '—'}</dd>
      </div>
    </div>
  )
}

function JobDetail({ jobId, renderJobAction }) {
  const { job, districtName, loading, error, reload } = useDiscoveryJob(jobId)
  const { provinceNameByCode } = useDiscoveryCatalogs()

  if (loading) {
    return (
      <CenteredState
        icon={Loader2}
        spinning
        title="Đang tải việc làm"
        tone="bg-primary/10 text-primary"
      />
    )
  }

  if (error) {
    const notFound = error.status === 404 || error.status === 403

    return (
      <CenteredState
        action={
          notFound ? (
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Về trang chủ
              </Link>
            </Button>
          ) : (
            <Button onClick={reload} variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          )
        }
        description={toJobDiscoveryErrorMessage(error)}
        icon={notFound ? SearchX : TriangleAlert}
        title={notFound ? 'Không xem được việc làm' : 'Chưa tải được việc làm'}
        tone="bg-secondary text-muted-foreground"
      />
    )
  }

  const location = [districtName, formatProvince(job.location, provinceNameByCode)]
    .filter(Boolean)
    .join(', ')
  const categories = [...job.fieldCategories, ...job.positionCategories]
  const experience = job.experienceLevel
    ? EXPERIENCE_LEVEL_LABEL[job.experienceLevel.code] ?? job.experienceLevel.code
    : null

  return (
    <article className="flex flex-col gap-6">
      <Link
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        to="/"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Quay lại danh sách việc làm
      </Link>

      {job.isHistoricalReadOnly && (
        <div
          className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-warning-foreground"
          role="status"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">{getHistoricalJobLabel(job)}.</span> Việc làm này không
            còn nhận hồ sơ; nội dung chỉ được hiển thị để tham khảo.
          </p>
        </div>
      )}

      <header className="rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <CompanyLogo className="size-16 text-base" company={job.company} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{job.company.name}</p>
            <h1 className="mt-1 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
              {job.title}
            </h1>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-success px-2.5 py-1 text-sm font-semibold text-success-foreground">
              <Banknote aria-hidden="true" className="size-4" />
              {formatSalary(job.salary)}
            </p>
          </div>
          {renderJobAction?.(job)}
        </div>

        <dl className="mt-6 grid gap-5 border-t pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <JobFact icon={MapPin} label="Địa điểm" value={location} />
          <JobFact icon={Globe} label="Hình thức làm việc" value={formatWorkModes(job.workModes)} />
          <JobFact
            icon={BriefcaseBusiness}
            label="Loại hình"
            value={EMPLOYMENT_TYPE_LABEL[job.employmentType] ?? job.employmentType}
          />
          <JobFact icon={Clock3} label="Kinh nghiệm" value={experience} />
          <JobFact icon={CalendarDays} label="Ngày đăng" value={formatDate(job.publishedAt)} />
          <JobFact icon={CalendarClock} label="Hạn nhận hồ sơ" value={formatDate(job.applicationDeadline)} />
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6 rounded-2xl border bg-card p-6 sm:p-8">
          <section aria-labelledby="job-description-heading">
            <h2 className="text-lg font-semibold" id="job-description-heading">
              Mô tả công việc
            </h2>
            <p className="mt-3 max-w-[70ch] whitespace-pre-line text-base leading-7 text-foreground/90">
              {job.jobDescription || 'Chưa có mô tả.'}
            </p>
          </section>

          {job.requiredSkills?.length > 0 && (
            <section aria-labelledby="job-skills-heading" className="border-t pt-6">
              <h2 className="text-lg font-semibold" id="job-skills-heading">
                Kỹ năng yêu cầu
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {job.requiredSkills.map((skill) => (
                  <li className="rounded-md bg-secondary px-2.5 py-1 text-sm" key={skill}>
                    {skill}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {categories.length > 0 && (
            <section aria-labelledby="job-categories-heading" className="border-t pt-6">
              <h2 className="text-lg font-semibold" id="job-categories-heading">
                Ngành nghề và vị trí
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <li
                    className="rounded-md border px-2.5 py-1 text-sm text-muted-foreground"
                    key={category.id}
                  >
                    {category.name}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside aria-labelledby="job-company-heading" className="h-fit rounded-2xl border bg-card p-6">
          <h2 className="text-base font-semibold" id="job-company-heading">
            Về công ty
          </h2>
          <Link
            className="group mt-4 flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to={`/companies/${job.company.id}`}
          >
            <CompanyLogo company={job.company} />
            <span className="min-w-0 font-medium break-words group-hover:text-primary">
              {job.company.name}
            </span>
          </Link>
          {job.company.description && (
            <p className="mt-4 line-clamp-6 whitespace-pre-line text-sm text-muted-foreground">
              {job.company.description}
            </p>
          )}
          <dl className="mt-4 space-y-3 text-sm">
            {job.company.address && (
              <div>
                <dt className="text-xs text-muted-foreground">Địa chỉ</dt>
                <dd className="break-words">{job.company.address}</dd>
              </div>
            )}
            {job.company.website && (
              <div>
                <dt className="text-xs text-muted-foreground">Website</dt>
                <dd className="break-all">
                  <a
                    className="text-primary underline-offset-4 hover:underline"
                    href={job.company.website}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {job.company.website}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          <Button asChild className="mt-5 w-full" variant="outline">
            <Link to={`/companies/${job.company.id}`}>
              Xem trang công ty
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </aside>
      </div>
    </article>
  )
}

export default JobDetail
