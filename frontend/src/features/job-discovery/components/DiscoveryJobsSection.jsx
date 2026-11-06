import { RotateCw, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

import useDiscoveryJobs from '../hooks/useDiscoveryJobs'
import { toJobDiscoveryErrorMessage } from '../utils'
import JobCard from './JobCard'
import JobListPagination from './JobListPagination'

const JOBS_PER_PAGE = 6

function DiscoveryJobsSection({
  id,
  page,
  provinceNameByCode,
  renderJobAction,
  onPageChange,
}) {
  const { jobs, pagination, loading, error, reload } = useDiscoveryJobs({
    page,
    limit: JOBS_PER_PAGE,
    sort: 'FEATURED',
  })

  return (
    <section aria-labelledby={`${id}-heading`} className="scroll-mt-24" id={id}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" id={`${id}-heading`}>
            Việc làm nổi bật
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Khám phá các vị trí tuyển dụng nổi bật trên JOBHUB
          </p>
        </div>
        <Link className="text-sm font-medium text-primary hover:underline focus-visible:underline" to="/jobs">
          Xem tất cả
        </Link>
      </div>

      <div className="mt-6">
        {loading && (
          <ul aria-busy="true" aria-label="Đang tải việc làm" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: JOBS_PER_PAGE }, (_, index) => (
              <li className="h-60 animate-pulse rounded-xl border bg-card" key={index} />
            ))}
          </ul>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center" role="alert">
            <p className="text-sm text-muted-foreground">{toJobDiscoveryErrorMessage(error)}</p>
            <Button onClick={reload} variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          </div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
            <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
            <p className="font-medium">
              Chưa có việc làm nào đang tuyển
            </p>
          </div>
        )}

        {!loading && !error && jobs.length > 0 && (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <li key={job.id}>
                <JobCard
                  action={renderJobAction?.(job)}
                  job={job}
                  provinceNameByCode={provinceNameByCode}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {!error && (
        <div className="mt-8">
          <JobListPagination
            onPageChange={onPageChange}
            page={pagination.page || page}
            totalPages={pagination.totalPages}
          />
        </div>
      )}
    </section>
  )
}

export default DiscoveryJobsSection
