import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { listOwnApplicationsApi } from '@/apis/application.api'
import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import ApplicationStatusBadge from '@/features/candidate-dashboard/components/ApplicationStatusBadge'
import CandidateResourceListPage, {
  EmptyLink,
} from '@/features/candidate-dashboard/components/CandidateResourceListPage'
import { formatDate } from '@/features/candidate-dashboard/utils'

function CandidateApplicationsPage() {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({ key: null, applications: [], error: null })

  useEffect(() => {
    let active = true
    const key = String(loadAttempt)

    listOwnApplicationsApi().then(
      (response) => {
        if (active) {
          setView({ key, applications: response.applications ?? [], error: null })
        }
      },
      (error) => {
        if (active) {
          setView({ key, applications: [], error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [loadAttempt])

  return (
    <CandidateResourceListPage
      count={view.applications.length}
      description="Theo dõi trạng thái các đơn bạn đã nộp."
      emptyAction={<EmptyLink to="/jobs">Tìm việc để ứng tuyển</EmptyLink>}
      emptyDescription="Khi bạn nộp hồ sơ cho một việc làm, đơn sẽ xuất hiện tại đây."
      emptyTitle="Chưa có đơn ứng tuyển"
      error={view.error}
      loading={view.key !== String(loadAttempt)}
      onRetry={() => setLoadAttempt((current) => current + 1)}
      title="Đơn ứng tuyển"
    >
      <ul className="divide-y rounded-xl border bg-card">
        {view.applications.map((application) => (
          <li key={application.id}>
            <Link
              className="flex items-center gap-3 px-4 py-4 outline-none transition-colors hover:bg-secondary/50 focus-visible:bg-secondary/50"
              to={`/candidate/applications/${encodeURIComponent(application.id)}`}
            >
              <CompanyLogo className="size-10" company={application.company} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {application.job?.title ?? 'Việc làm'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {application.company?.name ?? 'Công ty'}
                  {formatDate(application.appliedAt)
                    ? ` · Nộp ${formatDate(application.appliedAt)}`
                    : null}
                </p>
              </div>
              <ApplicationStatusBadge status={application.status} />
              <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </CandidateResourceListPage>
  )
}

export default CandidateApplicationsPage
