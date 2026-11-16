import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { listSavedJobsApi } from '@/apis/saved-job.api'
import { Button } from '@/components/ui/button'
import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import { formatSalary } from '@/features/job-discovery/utils'
import CandidateResourceListPage, {
  EmptyLink,
} from '@/features/candidate-dashboard/components/CandidateResourceListPage'
import { formatDate } from '@/features/candidate-dashboard/utils'

function CandidateSavedJobsPage() {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({ key: null, savedJobs: [], error: null })

  useEffect(() => {
    let active = true
    const key = String(loadAttempt)

    listSavedJobsApi().then(
      (response) => {
        if (active) {
          setView({ key, savedJobs: response.savedJobs ?? [], error: null })
        }
      },
      (error) => {
        if (active) {
          setView({ key, savedJobs: [], error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [loadAttempt])

  return (
    <CandidateResourceListPage
      count={view.savedJobs.length}
      description="Các việc làm bạn đã lưu để xem lại sau."
      emptyAction={<EmptyLink to="/jobs">Tìm việc làm</EmptyLink>}
      emptyDescription="Lưu việc làm từ trang tìm kiếm hoặc chi tiết để theo dõi tại đây."
      emptyTitle="Chưa lưu việc làm nào"
      error={view.error}
      loading={view.key !== String(loadAttempt)}
      onRetry={() => setLoadAttempt((current) => current + 1)}
      title="Việc làm đã lưu"
    >
      <ul className="divide-y rounded-xl border bg-card">
        {view.savedJobs.map((entry) => (
          <li className="flex flex-wrap items-center gap-3 px-4 py-4" key={entry.job.id}>
            <CompanyLogo className="size-10" company={entry.job.company} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                <Link className="hover:underline" to={`/jobs/${encodeURIComponent(entry.job.id)}`}>
                  {entry.job.title}
                </Link>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {entry.job.company?.name}
                {formatDate(entry.savedAt) ? ` · Lưu ${formatDate(entry.savedAt)}` : null}
                {entry.hasApplication ? ' · Đã ứng tuyển' : null}
              </p>
              <p className="mt-1 text-xs font-medium text-success-foreground">
                {formatSalary(entry.job.salary)}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to={`/jobs/${encodeURIComponent(entry.job.id)}`}>Chi tiết</Link>
            </Button>
          </li>
        ))}
      </ul>
    </CandidateResourceListPage>
  )
}

export default CandidateSavedJobsPage
