import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { listRecruiterJobsApi } from '@/apis/recruiter-job.api'
import {
  ErrorState,
  ListSkeleton,
  Pager,
  StateMessage,
} from '@/components/common/ListStates'
import PageHeader from '@/components/common/PageHeader'
import { Input } from '@/components/ui/Input'
import { formatSalary } from '@/features/job-discovery/public'
import {
  formatDay,
  getEffectiveJobStatus,
  JobStatusBadge,
  toListQuery,
  useDebouncedValue,
  useListSearch,
  useResource,
} from '@/features/recruiter-workspace/public'
import { cn } from '@/lib/utils'
import { JOB_STATUS } from '@/utils/constant'

const filters = {
  q: 'text',
  status: [
    JOB_STATUS.PENDING_APPROVAL,
    JOB_STATUS.PUBLISHED,
    JOB_STATUS.CLOSED,
    JOB_STATUS.EXPIRED,
  ],
  sort: ['-createdAt', 'createdAt', 'title', 'applicationDeadline'],
}
const statuses = [
  [JOB_STATUS.PENDING_APPROVAL, 'Chờ duyệt'],
  [JOB_STATUS.PUBLISHED, 'Đã đăng'],
  [JOB_STATUS.CLOSED, 'Đã đóng'],
  [JOB_STATUS.EXPIRED, 'Hết hạn'],
]

function CompanyJobs() {
  const { search, setFilters, setPage } = useListSearch(filters)
  const q = useDebouncedValue(search.q)
  const query = useMemo(() => toListQuery({ ...search, q }), [search, q])
  const { data, loading, error, reload } = useResource(
    listRecruiterJobsApi,
    query,
  )
  return (
    <div className="space-y-5">
      <PageHeader
        description="Xét duyệt và quản lý các Job thuộc công ty."
        title="Job tuyển dụng"
      />
      <nav
        aria-label="Lọc Job theo trạng thái"
        className="flex flex-wrap gap-2"
      >
        {statuses.map(([value, label]) => (
          <button
            aria-pressed={search.status === value}
            className={cn(
              'rounded-md border px-3 py-2 text-sm font-medium',
              search.status === value
                ? 'border-primary bg-primary/10 text-primary'
                : 'bg-card',
            )}
            key={value}
            onClick={() => setFilters({ status: value })}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="space-y-1 text-sm">
          <span>Tìm theo tiêu đề</span>
          <Input
            onChange={(e) => setFilters({ q: e.target.value })}
            type="search"
            value={search.q}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Sắp xếp</span>
          <select
            className="h-10 w-full rounded-md border bg-card px-3"
            onChange={(e) => setFilters({ sort: e.target.value })}
            value={search.sort}
          >
            <option value="-createdAt">Mới nhất</option>
            <option value="createdAt">Cũ nhất</option>
            <option value="title">Tiêu đề A–Z</option>
            <option value="applicationDeadline">Hạn nhận hồ sơ</option>
          </select>
        </label>
      </div>
      <section
        aria-label="Danh sách Job"
        className="rounded-xl border bg-card px-5"
      >
        {loading ? (
          <ListSkeleton label="Đang tải Job" />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : data.jobs.length === 0 ? (
          <StateMessage
            description="Job phù hợp với trạng thái và từ khóa sẽ xuất hiện tại đây."
            title="Không có Job phù hợp"
          />
        ) : (
          <>
            <ul className="divide-y">
              {data.jobs.map((job) => (
                <li
                  className="flex flex-wrap items-start justify-between gap-4 py-5"
                  key={job.id}
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <Link
                      className="font-semibold break-words hover:text-primary"
                      to={`/company/jobs/${job.id}`}
                    >
                      {job.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {formatSalary(job.salary)} · Hạn nhận hồ sơ:{' '}
                      {formatDay(job.applicationDeadline) ?? 'Chưa có'}
                    </p>
                    <JobStatusBadge status={getEffectiveJobStatus(job)} />
                  </div>
                  <Link
                    className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-secondary"
                    to={`/company/jobs/${job.id}`}
                  >
                    {job.status === JOB_STATUS.PENDING_APPROVAL
                      ? 'Xét duyệt'
                      : 'Quản lý Job'}
                  </Link>
                </li>
              ))}
            </ul>
            <Pager
              onPageChange={setPage}
              pagination={data.pagination}
              unit="Job"
            />
          </>
        )}
      </section>
      {search.status === JOB_STATUS.PUBLISHED && (
        <p className="text-sm text-muted-foreground">
          Nhóm đã đăng có thể gồm Job đã đến hạn nhưng máy chủ chưa cập nhật
          trạng thái. Nhãn trên từng Job thể hiện hiệu lực hiện tại.
        </p>
      )}
    </div>
  )
}

export default CompanyJobs
