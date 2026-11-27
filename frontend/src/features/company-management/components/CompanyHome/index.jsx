import { ArrowRight, ArrowUpRight, CheckCircle2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { listCompanyRecruitersApi } from '@/apis/company-recruiter.api'
import { getOwnedCompanyApi } from '@/apis/company.api'
import { listRecruiterJobsApi } from '@/apis/recruiter-job.api'
import { ErrorState, ListSkeleton } from '@/components/common/ListStates'
import { Button } from '@/components/ui/button'
import { selectAuthenticatedUser } from '@/features/authentication/slice'
import { getInitials } from '@/features/authentication/utils'
import { formatSalary, formatWorkModes } from '@/features/job-discovery/public'
import {
  formatDay,
  getEffectiveJobStatus,
  JobStatusBadge,
  useResource,
} from '@/features/recruiter-workspace/public'
import { subscribeRealtimeEvent } from '@/socket/realtime-subscriptions'
import { useAppSelector } from '@/store/hooks'
import { JOB_STATUS, SOCKET_LIFECYCLE_EVENT } from '@/utils/constant'

import { recruiterReadiness } from '../../utils'

const pendingQuery = {
  page: 1,
  limit: 3,
  status: JOB_STATUS.PENDING_APPROVAL,
  sort: '-createdAt',
}
const publishedQuery = {
  page: 1,
  limit: 2,
  status: JOB_STATUS.PUBLISHED,
  sort: '-createdAt',
}
const recruitersQuery = { page: 1, limit: 3, sort: '-createdAt' }
const linkClass =
  'inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring'

function JobsPreview({ resource, pending = false }) {
  const title = pending ? 'Job chờ duyệt' : 'Job đã đăng'
  const to = pending
    ? '/company/jobs?status=PENDING_APPROVAL'
    : '/company/jobs?status=PUBLISHED'
  const total =
    !resource.loading && !resource.error
      ? resource.data?.pagination?.total
      : null
  const jobs = resource.data?.jobs ?? []
  let body
  if (resource.loading)
    body = <ListSkeleton label={`Đang tải ${title}`} rows={pending ? 3 : 2} />
  else if (resource.error)
    body = (
      <ErrorState
        className="py-7"
        error={resource.error}
        onRetry={resource.reload}
      />
    )
  else if (jobs.length === 0)
    body = (
      <div className="space-y-3 border-t px-5 py-8">
        <h3 className="flex items-center gap-2 font-medium">
          {pending && (
            <CheckCircle2
              aria-hidden="true"
              className="size-5 text-success-foreground"
            />
          )}
          {pending
            ? 'Đã xử lý hết Job chờ duyệt'
            : 'Chưa có Job trong nhóm đã đăng'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {pending
            ? 'Job mới sẽ xuất hiện khi Recruiter gửi duyệt.'
            : 'Job được duyệt và đăng sẽ xuất hiện tại đây.'}
        </p>
        {pending && (
          <Button asChild variant="outline">
            <Link to="/company/jobs?status=PUBLISHED">Xem Job đã đăng</Link>
          </Button>
        )}
      </div>
    )
  else
    body = (
      <ul className="divide-y border-t">
        {jobs.map((job) => (
          <li
            className="flex flex-wrap items-start justify-between gap-4 px-5 py-5"
            key={job.id}
          >
            <div className="min-w-0 flex-1 basis-56 space-y-2">
              <h3>
                <Link
                  className="rounded-sm font-semibold break-words hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                  to={`/company/jobs/${job.id}`}
                >
                  {job.title}
                </Link>
              </h3>
              <p className="text-sm text-muted-foreground">
                {[formatSalary(job.salary), formatWorkModes(job.workModes)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <JobStatusBadge status={getEffectiveJobStatus(job)} />
                <p className="text-xs text-muted-foreground">
                  Hạn {formatDay(job.applicationDeadline) ?? 'Chưa có'}
                </p>
              </div>
            </div>
            {pending ? (
              <Button asChild size="sm">
                <Link to={`/company/jobs/${job.id}`}>Xét duyệt</Link>
              </Button>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-3">
                <Link
                  className={linkClass}
                  to={`/company/jobs/${job.id}?tab=team`}
                >
                  Đội tuyển dụng
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </Link>
                <Link
                  className={linkClass}
                  to={`/company/jobs/${job.id}?tab=applications`}
                >
                  Phân công
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </Link>
              </div>
            )}
          </li>
        ))}
      </ul>
    )
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-xl border bg-card"
    >
      <div className="px-5 pt-5 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          {pending && (
            <span
              aria-label="Tổng số Job chờ duyệt"
              className="rounded-md bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary tabular-nums"
            >
              {total ?? '—'}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {pending
            ? 'Kiểm tra nội dung trước khi công khai.'
            : 'Mở đội tuyển dụng hoặc phân công hồ sơ theo từng Job.'}
        </p>
      </div>
      {body}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
        <p className="text-xs text-muted-foreground tabular-nums">
          {Number.isSafeInteger(total)
            ? `Hiển thị ${jobs.length} / ${total} Job ${
                pending ? 'chờ duyệt' : 'trong nhóm đã đăng'
              }`
            : 'Job thuộc công ty của bạn'}
        </p>
        <Link className={linkClass} to={to}>
          Xem tất cả
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </section>
  )
}

function CompanyMark({ company }) {
  const [failedUrl, setFailedUrl] = useState(null)
  return company.logoUrl && failedUrl !== company.logoUrl ? (
    <img
      alt=""
      className="mb-4 size-11 rounded-lg bg-card object-contain p-1"
      onError={() => setFailedUrl(company.logoUrl)}
      src={company.logoUrl}
    />
  ) : (
    <span
      aria-hidden="true"
      className="mb-4 flex size-11 items-center justify-center rounded-lg bg-card font-semibold text-primary"
    >
      {getInitials(company.name)}
    </span>
  )
}

function CompanyPreview({ resource }) {
  if (resource.loading)
    return (
      <section
        aria-label="Hồ sơ công ty"
        className="rounded-xl border bg-card p-5"
      >
        <h2 className="font-semibold">Hồ sơ công ty</h2>
        <ListSkeleton label="Đang tải công ty" rows={2} />
      </section>
    )
  if (resource.error)
    return (
      <section
        aria-label="Hồ sơ công ty"
        className="rounded-xl border bg-card p-5"
      >
        <h2 className="font-semibold">Hồ sơ công ty</h2>
        <ErrorState
          className="px-0 py-6"
          error={resource.error}
          onRetry={resource.reload}
        />
      </section>
    )
  const company = resource.data.company
  return (
    <section
      aria-label="Hồ sơ công ty"
      className="rounded-xl bg-hero p-5 text-hero-foreground"
    >
      <CompanyMark company={company} />
      <h2 className="text-base font-semibold break-words">{company.name}</h2>
      <p className="mt-2 text-sm break-words text-hero-muted">
        {company.address || 'Chưa cập nhật địa chỉ.'}
      </p>
      <Link
        className="mt-4 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-hero-foreground"
        to="/company/profile"
      >
        Cập nhật hồ sơ công ty
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
      </Link>
    </section>
  )
}

function RecruitersPreview({ resource }) {
  let body
  if (resource.loading)
    body = <ListSkeleton label="Đang tải Recruiter mới nhất" rows={3} />
  else if (resource.error)
    body = (
      <ErrorState
        className="py-7"
        error={resource.error}
        onRetry={resource.reload}
      />
    )
  else if (resource.data.recruiters.length === 0)
    body = (
      <p className="border-t px-5 py-6 text-sm text-muted-foreground">
        Công ty chưa có Recruiter. Tạo tài khoản đầu tiên để bắt đầu.
      </p>
    )
  else
    body = (
      <ul className="divide-y border-t">
        {resource.data.recruiters.map((recruiter) => (
          <li className="flex items-start gap-3 px-5 py-4" key={recruiter.id}>
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary"
            >
              {getInitials(recruiter.fullName)}
            </span>
            <div className="min-w-0 space-y-1">
              <Link
                className="rounded-sm text-sm font-semibold break-words hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                to={`/company/recruiters/${recruiter.id}`}
              >
                {recruiter.fullName}
              </Link>
              <p className="text-xs text-muted-foreground">
                {recruiterReadiness(recruiter)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    )
  return (
    <section
      aria-label="Recruiter mới nhất"
      className="overflow-hidden rounded-xl border bg-card"
    >
      <div className="px-5 pt-5 pb-4">
        <h2 className="text-base font-semibold">Recruiter mới nhất</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Các tài khoản được tạo gần đây.
        </p>
      </div>
      {body}
      <div className="border-t px-5 py-3">
        <Link className={linkClass} to="/company/recruiters">
          Quản lý Recruiter
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </section>
  )
}

function CompanyHome() {
  const user = useAppSelector(selectAuthenticatedUser)
  const pending = useResource(listRecruiterJobsApi, pendingQuery)
  const published = useResource(listRecruiterJobsApi, publishedQuery)
  const recruiters = useResource(listCompanyRecruitersApi, recruitersQuery)
  const company = useResource(getOwnedCompanyApi)
  const { reload: reloadPending } = pending
  const { reload: reloadPublished } = published
  const { reload: reloadRecruiters } = recruiters
  const { reload: reloadCompany } = company

  useEffect(() => {
    const reload = () => {
      reloadPending()
      reloadPublished()
      reloadRecruiters()
      reloadCompany()
    }
    window.addEventListener('focus', reload)
    const unsubscribe = subscribeRealtimeEvent(
      SOCKET_LIFECYCLE_EVENT.CONNECT,
      reload,
    )
    return () => {
      window.removeEventListener('focus', reload)
      unsubscribe()
    }
  }, [reloadPending, reloadPublished, reloadRecruiters, reloadCompany])

  return (
    <div
      className="mx-auto w-full min-w-0 max-w-6xl space-y-7 px-4 py-8 sm:px-6 sm:py-10"
      data-area="company-manager"
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold tracking-wide text-primary uppercase">
            {company.data?.company.name || 'Company Manager'}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
            Chào {user?.fullName || 'bạn'},
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Các công việc cần bạn xét duyệt và quản lý.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/company/jobs">Mở khu quản lý</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/company/recruiters/new">
              <UserPlus aria-hidden="true" className="size-4" />
              Tạo Recruiter
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <JobsPreview pending resource={pending} />
          <JobsPreview resource={published} />
          <p className="text-xs text-muted-foreground">
            Nhóm đã đăng bao gồm cả Job còn tuyển và Job đã hết hạn. Xem nhãn
            từng Job để biết trạng thái hiện tại.
          </p>
        </div>
        <aside
          aria-label="Công ty và đội tuyển dụng"
          className="grid min-w-0 items-start gap-6 sm:grid-cols-2 lg:grid-cols-1"
        >
          <CompanyPreview resource={company} />
          <RecruitersPreview resource={recruiters} />
        </aside>
      </div>
    </div>
  )
}

export default CompanyHome
