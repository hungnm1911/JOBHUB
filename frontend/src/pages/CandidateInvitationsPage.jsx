import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { listOwnJobInvitationsApi } from '@/apis/job-invitation.api'
import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import CandidateResourceListPage, {
  EmptyLink,
} from '@/features/candidate-dashboard/components/CandidateResourceListPage'
import { formatDate } from '@/features/candidate-dashboard/utils'

function CandidateInvitationsPage() {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({ key: null, invitations: [], error: null })

  useEffect(() => {
    let active = true
    const key = String(loadAttempt)

    listOwnJobInvitationsApi().then(
      (response) => {
        if (active) {
          setView({ key, invitations: response.invitations ?? [], error: null })
        }
      },
      (error) => {
        if (active) {
          setView({ key, invitations: [], error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [loadAttempt])

  return (
    <CandidateResourceListPage
      count={view.invitations.length}
      description="Các lời mời ứng tuyển từ nhà tuyển dụng."
      emptyAction={<EmptyLink to="/candidate/cvs">Hoàn thiện CV để tăng cơ hội</EmptyLink>}
      emptyDescription="Khi nhà tuyển dụng gửi lời mời, bạn sẽ thấy chúng tại đây."
      emptyTitle="Chưa có lời mời"
      error={view.error}
      loading={view.key !== String(loadAttempt)}
      onRetry={() => setLoadAttempt((current) => current + 1)}
      title="Lời mời ứng tuyển"
    >
      <ul className="divide-y rounded-xl border bg-card">
        {view.invitations.map((invitation) => (
          <li className="flex items-center gap-3 px-4 py-4" key={invitation.id}>
            <CompanyLogo className="size-10" company={invitation.company} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                <Link
                  className="hover:underline"
                  to={
                    invitation.jobId ? `/jobs/${encodeURIComponent(invitation.jobId)}` : '/jobs'
                  }
                >
                  {invitation.job?.title ?? 'Việc làm'}
                </Link>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {invitation.company?.name ?? 'Công ty'}
                {formatDate(invitation.sentAt) ? ` · Gửi ${formatDate(invitation.sentAt)}` : null}
                {invitation.status ? ` · ${invitation.status}` : null}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </CandidateResourceListPage>
  )
}

export default CandidateInvitationsPage
