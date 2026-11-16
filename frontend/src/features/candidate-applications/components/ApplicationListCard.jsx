import { CalendarDays, Check, ChevronRight, MapPin, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  confirmOwnInterviewProposalApi,
  declineOwnInterviewProposalApi,
} from '@/apis/application.api'
import { Button } from '@/components/ui/button'
import ApplicationStatusBadge from '@/features/candidate-dashboard/components/ApplicationStatusBadge'
import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import { formatProvince } from '@/features/job-discovery/utils'
import { cn } from '@/lib/utils'

import {
  DAY_PART_LABEL,
  INTERVIEW_SCHEDULE_STATUS_LABEL,
  INTERVIEW_SCHEDULE_STATUS_TONE,
  canRespondToInterviewProposal,
  canWithdrawApplication,
  formatDate,
  formatJobMeta,
  getActiveInterviewSchedules,
} from '../utils'

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
  const jobMeta = formatJobMeta(job)
  const locationLabel = job?.location
    ? [job.location.addressText, formatProvince(job.location, provinceNameByCode)]
        .filter(Boolean)
        .join(', ')
    : null
  const activeSchedules = getActiveInterviewSchedules(application)
  const cvName = application.submittedCvSnapshot?.name

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
    <article className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <CompanyLogo className="size-12" company={company} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight">
                <Link className="hover:underline" to={detailTo}>
                  {job?.title ?? 'Việc làm'}
                </Link>
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {company?.name ?? 'Công ty'}
                {formatDate(application.appliedAt)
                  ? ` · Nộp ${formatDate(application.appliedAt)}`
                  : null}
              </p>
            </div>
            <ApplicationStatusBadge status={application.status} />
          </div>

          {(jobMeta.length > 0 || locationLabel) && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {jobMeta.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {locationLabel ? (
                <li className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-3.5" />
                  {locationLabel}
                </li>
              ) : null}
            </ul>
          )}

          {cvName ? (
            <p className="text-xs text-muted-foreground">CV đã nộp: {cvName}</p>
          ) : null}
        </div>
      </div>

      {activeSchedules.length > 0 ? (
        <div className="mt-4 space-y-2 border-t pt-4">
          {activeSchedules.map((schedule) => {
            const busy = busyScheduleId === schedule.id
            const canRespond = canRespondToInterviewProposal(schedule)
            return (
              <div className="rounded-lg border bg-secondary/40 px-3 py-3" key={schedule.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <CalendarDays aria-hidden="true" className="mt-0.5 size-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">
                        {formatDate(schedule.date) ?? schedule.date}
                        {DAY_PART_LABEL[schedule.dayPart]
                          ? ` · ${DAY_PART_LABEL[schedule.dayPart]}`
                          : null}
                      </p>
                      {schedule.timezone ? (
                        <p className="text-xs text-muted-foreground">
                          Múi giờ {schedule.timezone}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                      INTERVIEW_SCHEDULE_STATUS_TONE[schedule.status] ??
                        'bg-secondary text-secondary-foreground',
                    )}
                  >
                    {INTERVIEW_SCHEDULE_STATUS_LABEL[schedule.status] ?? schedule.status}
                  </span>
                </div>
                {canRespond ? (
                  <div className="mt-3 flex flex-wrap gap-2">
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

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
        {canWithdrawApplication(application) ? (
          <Button onClick={() => onWithdraw(application)} size="sm" type="button" variant="outline">
            Rút đơn
          </Button>
        ) : null}
        <Button asChild size="sm">
          <Link to={detailTo}>
            Xem chi tiết
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </div>
    </article>
  )
}

export default ApplicationListCard
