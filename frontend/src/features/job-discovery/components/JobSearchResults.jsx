import { RotateCw, SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import useDiscoveryJobs from '../hooks/useDiscoveryJobs'
import { JOB_DISCOVERY_SORT, toDiscoveryJobsQuery } from '../search-params'
import { toJobDiscoveryErrorMessage } from '../utils'
import JobListPagination from './JobListPagination'
import JobResultCard from './JobResultCard'

const JOBS_PER_PAGE = 10
const countFormatter = new Intl.NumberFormat('vi-VN')

const SORT_OPTIONS = [
  { value: JOB_DISCOVERY_SORT.NEWEST, label: 'Mới nhất' },
  { value: JOB_DISCOVERY_SORT.RELEVANCE, label: 'Phù hợp nhất', requiresKeyword: true },
  { value: JOB_DISCOVERY_SORT.EXPIRING_SOON, label: 'Sắp hết hạn' },
]

function toSearchErrorMessage(error) {
  if (error?.status === 400) {
    return 'Bộ lọc tìm kiếm không hợp lệ. Hãy thiết lập lại bộ lọc rồi thử lại.'
  }

  return toJobDiscoveryErrorMessage(error)
}

function JobSearchResults({
  search,
  filtered,
  provinceNameByCode,
  renderJobAction,
  onSortChange,
  onPageChange,
  onReset,
}) {
  const { jobs, pagination, sort, loading, error, reload } = useDiscoveryJobs(
    toDiscoveryJobsQuery(search, JOBS_PER_PAGE),
  )
  const activeSort = sort ?? search.sort ?? (search.keyword ? JOB_DISCOVERY_SORT.RELEVANCE : JOB_DISCOVERY_SORT.NEWEST)
  const firstIndex = (pagination.page - 1) * pagination.limit + 1
  const lastIndex = firstIndex + jobs.length - 1

  return (
    <section aria-labelledby="job-results-heading" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold" id="job-results-heading">
            {filtered ? 'Việc làm phù hợp' : 'Tất cả việc làm'}
          </h2>
          {!loading && !error && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary" role="status">
              {countFormatter.format(pagination.total)} việc làm
            </span>
          )}
        </div>

        <div aria-label="Sắp xếp kết quả" className="flex w-fit rounded-lg bg-secondary p-1" role="group">
          {SORT_OPTIONS.map((option) => {
            const disabled = option.requiresKeyword && !search.keyword
            const active = activeSort === option.value

            return (
              <button
                aria-pressed={active}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
                  active && 'bg-card text-primary shadow-sm hover:text-primary',
                )}
                disabled={disabled}
                key={option.value}
                onClick={() => onSortChange(option.value)}
                title={disabled ? 'Nhập từ khóa để sắp xếp theo mức độ phù hợp' : undefined}
                type="button"
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading && (
        <ul aria-busy="true" aria-label="Đang tải việc làm" className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <li className="h-36 animate-pulse rounded-xl border bg-card" key={index} />
          ))}
        </ul>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center" role="alert">
          <p className="text-sm text-muted-foreground">{toSearchErrorMessage(error)}</p>
          <Button onClick={error.status === 400 ? onReset : reload} variant="outline">
            <RotateCw aria-hidden="true" className="size-4" />
            {error.status === 400 ? 'Thiết lập lại bộ lọc' : 'Thử lại'}
          </Button>
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
          <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
          <p className="font-medium">{filtered ? 'Không có việc làm phù hợp' : 'Chưa có việc làm nào đang tuyển'}</p>
          {filtered && (
            <>
              <p className="text-sm text-muted-foreground">Thử từ khóa khác hoặc bỏ bớt một vài bộ lọc.</p>
              <Button onClick={onReset} size="sm" variant="outline">
                Thiết lập lại bộ lọc
              </Button>
            </>
          )}
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobResultCard
                action={renderJobAction?.(job)}
                job={job}
                provinceNameByCode={provinceNameByCode}
              />
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-5 py-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Hiển thị {firstIndex} – {lastIndex} trong tổng số {countFormatter.format(pagination.total)} việc làm
          </p>
          <JobListPagination onPageChange={onPageChange} page={pagination.page} totalPages={pagination.totalPages} />
        </div>
      )}
    </section>
  )
}

export default JobSearchResults
