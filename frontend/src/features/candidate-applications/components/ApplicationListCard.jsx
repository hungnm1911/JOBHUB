import {
  BellRing,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileText,
  MailCheck,
  MapPin,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  confirmOwnInterviewProposalApi,
  declineOwnInterviewProposalApi,
} from '@/apis/application.api'
import { Button } from '@/components/ui/button'
import ApplicationStatusBadge, {
  APPLICATION_STATUS_STYLE,
} from '@/features/candidate-dashboard/components/ApplicationStatusBadge'
import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import {
  EMPLOYMENT_TYPE_LABEL,
  formatProvince,
  formatSalary,
  formatWorkModes,
} from '@/features/job-discovery/utils'
import { cn } from '@/lib/utils'
import { APPLICATION_SOURCE, APPLICATION_STATUS } from '@/utils/constant'

import {
  DAY_PART_LABEL,
  INTERVIEW_SCHEDULE_STATUS_LABEL,
  INTERVIEW_SCHEDULE_STATUS_TONE,
  canRespondToInterviewProposal,
  canSubmitAvailabilityFirstTime,
  canWithdrawApplication,
  formatDate,
  getActiveInterviewSchedules,
} from '../utils'

const PIPELINE_STEPS = Object.freeze([
  { id: 'applied', label: 'Đã nộp' },
  { id: 'review', label: 'Xét duyệt' },
  { id: 'interview', label: 'Phỏng vấn' },
  { id: 'result', label: 'Kết quả' },
])

function getPipelineStageIndex(status) {
  switch (status) {
    case APPLICATION_STATUS.APPLIED:
      return 0
    case APPLICATION_STATUS.SCREENING:
    case APPLICATION_STATUS.CONTACTED:
      return 1
    case APPLICATION_STATUS.INTERVIEW_SCHEDULED:
    case APPLICATION_STATUS.INTERVIEW_COMPLETED:
      return 2
    case APPLICATION_STATUS.HIRED:
      return 3
    default:
      return -1
  }
}

function MiniPipeline({ status }) {
  const stageIndex = getPipelineStageIndex(status)
  if (stageIndex < 0) {
    return null
  }
  const isHired = status === APPLICATION_STATUS.HIRED

  return (
    <ol
      aria-label="Tiến độ đơn ứng tuyển"
      className="flex flex-wrap items-center gap-1.5 text-[11px]"
    >
      {PIPELINE_STEPS.map((step, index) => {
        const done = index < stageIndex || (isHired && index === stageIndex)
        const current = !isHired && index === stageIndex
        return (
          <li className="inline-flex items-center gap-1.5" key={step.id}>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                done && 'bg-emerald-500/12 text-emerald-700',
                current && 'bg-primary/12 font-semibold text-primary',
                !done && !current && 'bg-secondary/70 text-muted-foreground',
              )}
            >
              {done ? (
                <Check aria-hidden="true" className="size-3 shrink-0" />
              ) : (
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    current ? 'bg-primary' : 'bg-muted-foreground/40',
                  )}
                />
              )}
              <span>{step.label}</span>
            </span>
            {index < PIPELINE_STEPS.length - 1 ? (
              <ChevronRight
                aria-hidden="true"
                className="size-3 text-muted-foreground/50"
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function ApplicationListCard({
  application,
  provinceNameByCode,
  onWithdraw,
  onInterviewUpdated,
}) {
  const [busyScheduleId, setBusyScheduleId] = useState(null)
  const job = application.job
  const company = application.company
  const detailTo = `/candidate/applications/${encodeURIComponent(application.id)}`

  const employmentTypeLabel = job?.employmentType
    ? (EMPLOYMENT_TYPE_LABEL[job.employmentType] ?? job.employmentType)
    : null
  const workModesLabel = job?.workModes ? formatWorkModes(job.workModes) : null
  const salaryLabel = job?.salary ? formatSalary(job.salary) : null
  const locationLabel = job?.location
    ? [job.location.addressText, formatProvince(job.location, provinceNameByCode)]
        .filter(Boolean)
        .join(', ')
    : null

  const activeSchedules = getActiveInterviewSchedules(application)
  const hasProposedInterview = activeSchedules.some((schedule) =>
    canRespondToInterviewProposal(schedule),
  )
  const needsAvailability = canSubmitAvailabilityFirstTime(application)
  const cvName = application.submittedCvSnapshot?.name
  const isFromInvitation =
    application.source === APPLICATION_SOURCE.RECRUITER_INVITATION
  const statusCardClass =
    APPLICATION_STATUS_STYLE[application.status]?.card ?? 'border-l-border'

  const respond = async (schedule, action) => {
    setBusyScheduleId(schedule.id)
    try {
      const response =
        action === 'confirm'
          ? await confirmOwnInterviewProposalApi(application.id, schedule.id)
          : await declineOwnInterviewProposalApi(application.id, schedule.id)
      toast.success(
        action === 'confirm' ? 'Đã xác nhận lịch phỏng vấn' : 'Đã từ chối lịch đề xuất',
      )
      onInterviewUpdated?.(application.id, response.interviewSchedule)
    } catch (error) {
      toast.error(error.message || 'Không cập nhật được lịch phỏng vấn.')
    } finally {
      setBusyScheduleId(null)
    }
  }

  return (
    <article
      className={cn(
        'rounded-2xl border border-l-4 bg-card p-4 transition-colors sm:p-5',
        statusCardClass,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <CompanyLogo className="size-12 shrink-0" company={company} />

          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <ApplicationStatusBadge status={application.status} />

              {needsAvailability ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/35 bg-orange-500/15 px-2.5 py-0.5 text-xs font-semibold text-orange-800">
                  <BellRing aria-hidden="true" className="size-3.5 shrink-0" />
                  Cần gửi lịch rảnh
                </span>
              ) : null}

              {hasProposedInterview ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  <CalendarClock aria-hidden="true" className="size-3.5 shrink-0" />
                  Chờ xác nhận lịch PV
                </span>
              ) : null}

              {isFromInvitation ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                  <MailCheck aria-hidden="true" className="size-3 shrink-0" />
                  Từ lời mời
                </span>
              ) : null}
            </div>

            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                <Link className="hover:text-primary hover:underline" to={detailTo}>
                  {job?.title ?? 'Việc làm'}
                </Link>
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  {company?.name ?? 'Công ty'}
                </span>
                {formatDate(application.appliedAt)
                  ? ` · Nộp ${formatDate(application.appliedAt)}`
                  : null}
              </p>
            </div>

            <ul className="flex flex-wrap items-center gap-1.5 text-xs">
              {salaryLabel ? (
                <li className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700">
                  <CircleDollarSign aria-hidden="true" className="size-3.5 shrink-0" />
                  {salaryLabel}
                </li>
              ) : null}
              {employmentTypeLabel ? (
                <li className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                  <BriefcaseBusiness aria-hidden="true" className="size-3 shrink-0" />
                  {employmentTypeLabel}
                </li>
              ) : null}
              {workModesLabel ? (
                <li className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                  {workModesLabel}
                </li>
              ) : null}
              {locationLabel ? (
                <li className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-muted-foreground">
                  <MapPin aria-hidden="true" className="size-3 shrink-0" />
                  {locationLabel}
                </li>
              ) : null}
              {cvName ? (
                <li className="inline-flex items-center gap-1 rounded-md bg-primary/8 px-2 py-0.5 font-medium text-primary">
                  <FileText aria-hidden="true" className="size-3 shrink-0" />
                  <span className="max-w-52 truncate">CV: {cvName}</span>
                </li>
              ) : null}
            </ul>

            <MiniPipeline status={application.status} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            {canWithdrawApplication(application) ? (
              <Button
                onClick={() => onWithdraw(application)}
                size="sm"
                type="button"
                variant="outline"
              >
                Rút đơn
              </Button>
            ) : null}

            {needsAvailability ? (
              <Button asChild size="sm">
                <Link to={detailTo}>
                  <CalendarDays aria-hidden="true" className="size-4" />
                  Gửi lịch rảnh
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to={detailTo}>
                  Xem chi tiết
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {activeSchedules.length > 0 ? (
        <div className="mt-3.5 space-y-2">
          {activeSchedules.map((schedule) => {
            const busy = busyScheduleId === schedule.id
            const canRespond = canRespondToInterviewProposal(schedule)
            return (
              <div
                className={cn(
                  'flex flex-col gap-3 rounded-xl border px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between',
                  canRespond
                    ? 'border-amber-500/35 bg-amber-500/10'
                    : 'border-border bg-secondary/40',
                )}
                key={schedule.id}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-2xs">
                    <CalendarDays aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">
                        Phỏng vấn: {formatDate(schedule.date) ?? schedule.date}
                        {DAY_PART_LABEL[schedule.dayPart]
                          ? ` · ${DAY_PART_LABEL[schedule.dayPart]}`
                          : null}
                      </p>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          INTERVIEW_SCHEDULE_STATUS_TONE[schedule.status] ??
                            'bg-secondary text-secondary-foreground',
                        )}
                      >
                        {INTERVIEW_SCHEDULE_STATUS_LABEL[schedule.status] ?? schedule.status}
                      </span>
                    </div>
                    {schedule.timezone ? (
                      <p className="text-xs text-muted-foreground">
                        Múi giờ: {schedule.timezone}
                      </p>
                    ) : null}
                  </div>
                </div>

                {canRespond ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      disabled={busy}
                      onClick={() => respond(schedule, 'confirm')}
                      size="sm"
                      type="button"
                    >
                      <Check aria-hidden="true" className="size-4" />
                      Xác nhận
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() => respond(schedule, 'decline')}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <X aria-hidden="true" className="size-4" />
                      Từ chối
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </article>
  )
}

export default ApplicationListCard
