import { RotateCw, SearchX } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

import useDiscoveryCatalogs from '../hooks/useDiscoveryCatalogs'
import useDiscoveryJobs from '../hooks/useDiscoveryJobs'
import { JOB_DISCOVERY_SORT } from '../search-params'
import { toJobDiscoveryErrorMessage } from '../utils'
import JobListPagination from './JobListPagination'
import JobResultCard from './JobResultCard'

const JOBS_PER_PAGE = 10
const countFormatter = new Intl.NumberFormat('vi-VN')

function CompanyJobsSection({ companyId }) {
  const [page, setPage] = useState(1)
  const { provinceNameByCode } = useDiscoveryCatalogs()
  const { jobs, pagination, loading, error, reload } = useDiscoveryJobs({
    companyId,
    page,
    limit: JOBS_PER_PAGE,
    sort: JOB_DISCOVERY_SORT.NEWEST,
  })

  return (
    <section aria-labelledby="company-jobs-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight" id="company-jobs-heading">
          Vị trí đang tuyển dụng
        </h2>
        {!loading && !error && (
          <p className="text-sm text-muted-foreground" role="status">
            {countFormatter.format(pagination.total)} vị trí
          </p>
        )}
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
          <p className="font-medium">Công ty hiện chưa có vị trí đang tuyển dụng</p>
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobResultCard job={job} provinceNameByCode={provinceNameByCode} />
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && (
        <JobListPagination
          onPageChange={setPage}
          page={pagination.page}
          totalPages={pagination.totalPages}
        />
      )}
    </section>
  )
}

export default CompanyJobsSection
