import { ChevronRight, Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'

import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'

import ApplicationStatusBadge from './ApplicationStatusBadge'
import DashboardSectionHeader from './DashboardSectionHeader'
import { formatDate } from '../utils'

function RecentApplicationsList({ applications }) {
  const items = applications.slice(0, 5)

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <DashboardSectionHeader
        actionLabel="Xem tất cả"
        actionTo="/candidate/applications"
        title="Đơn ứng tuyển gần đây"
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/40 px-4 py-10 text-center">
          <Inbox aria-hidden="true" className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Chưa có đơn ứng tuyển</p>
          <p className="text-xs text-muted-foreground">
            Khi bạn nộp hồ sơ, trạng thái sẽ xuất hiện tại đây.
          </p>
          <Link
            className="mt-1 text-sm font-medium text-primary hover:underline"
            to="/jobs"
          >
            Tìm việc để ứng tuyển
          </Link>
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((application) => {
            const title = application.job?.title ?? 'Việc làm'
            const company = application.company
            const appliedLabel = formatDate(application.appliedAt)

            return (
              <li key={application.id}>
                <Link
                  className="flex items-center gap-3 py-3 outline-none transition-colors hover:bg-secondary/50 focus-visible:bg-secondary/50"
                  to={`/candidate/applications/${encodeURIComponent(application.id)}`}
                >
                  <CompanyLogo className="size-10" company={company} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {company?.name ?? 'Công ty'}
                      {appliedLabel ? ` · Nộp ${appliedLabel}` : null}
                    </p>
                  </div>
                  <ApplicationStatusBadge status={application.status} />
                  <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default RecentApplicationsList
