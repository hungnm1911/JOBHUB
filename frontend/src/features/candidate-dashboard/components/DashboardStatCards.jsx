import { Bookmark, FileText, MailOpen, Send } from 'lucide-react'
import { Link } from 'react-router-dom'

import { APPLICATION_STATUS } from '@/utils/constant'

import { countApplicationsByStatus } from '../utils'

function StatCard({ icon: Icon, label, value, description, to, tone }) {
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          {description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </div>
      <Link
        className="mt-4 inline-flex text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        to={to}
      >
        Quản lý
      </Link>
    </article>
  )
}

function DashboardStatCards({ cvs, applications, invitations, savedJobs }) {
  const interviewCount = countApplicationsByStatus(applications, [
    APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    APPLICATION_STATUS.INTERVIEW_COMPLETED,
  ])
  const reviewingCount = countApplicationsByStatus(applications, [
    APPLICATION_STATUS.SCREENING,
    APPLICATION_STATUS.CONTACTED,
  ])
  const defaultCv = cvs.find((cv) => cv.isDefault)

  return (
    <section
      aria-label="Chỉ số hồ sơ ứng viên"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard
        description={defaultCv ? `Mặc định: ${defaultCv.name}` : 'Chưa chọn CV mặc định'}
        icon={FileText}
        label="CV của tôi"
        to="/candidate/cvs"
        tone="bg-primary/10 text-primary"
        value={cvs.length}
      />
      <StatCard
        description={
          applications.length > 0
            ? `${interviewCount} phỏng vấn · ${reviewingCount} đang xét`
            : 'Chưa có đơn ứng tuyển'
        }
        icon={Send}
        label="Đơn đã ứng tuyển"
        to="/candidate/applications"
        tone="bg-primary/10 text-primary"
        value={applications.length}
      />
      <StatCard
        description={
          invitations.length > 0 ? 'Lời mời từ nhà tuyển dụng' : 'Chưa có lời mời'
        }
        icon={MailOpen}
        label="Lời mời ứng tuyển"
        to="/candidate/invitations"
        tone="bg-warning/15 text-warning-foreground"
        value={invitations.length}
      />
      <StatCard
        description={
          savedJobs.length > 0 ? 'Việc làm bạn đã lưu' : 'Chưa lưu việc làm nào'
        }
        icon={Bookmark}
        label="Việc làm đã lưu"
        to="/candidate/saved-jobs"
        tone="bg-success text-success-foreground"
        value={savedJobs.length}
      />
    </section>
  )
}

export default DashboardStatCards
