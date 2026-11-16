import { CalendarDays, Check, LoaderCircle, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  confirmOwnInterviewProposalApi,
  declineOwnInterviewProposalApi,
} from '@/apis/application.api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  DAY_PART_LABEL,
  INTERVIEW_SCHEDULE_STATUS_LABEL,
  INTERVIEW_SCHEDULE_STATUS_TONE,
  canRespondToInterviewProposal,
  formatDate,
  formatDateTime,
  sortInterviewSchedules,
} from '../utils'

function ApplicationInterviewSection({ application, onScheduleUpdated }) {
  const schedules = sortInterviewSchedules(application.interviewSchedules)
  const [busyId, setBusyId] = useState(null)

  if (schedules.length === 0) {
    return null
  }

  const respond = async (schedule, action) => {
    setBusyId(schedule.id)
    try {
      const response =
        action === 'confirm'
          ? await confirmOwnInterviewProposalApi(application.id, schedule.id)
          : await declineOwnInterviewProposalApi(application.id, schedule.id)
      toast.success(action === 'confirm' ? 'Đã xác nhận lịch phỏng vấn' : 'Đã từ chối lịch đề xuất')
      onScheduleUpdated(response.interviewSchedule)
    } catch (error) {
      toast.error(error.message || 'Không cập nhật được lịch phỏng vấn.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="interview-heading">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarDays aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold" id="interview-heading">
            Lịch phỏng vấn
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Đề xuất theo ngày và buổi (sáng/chiều). Không có link họp trong hệ thống.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {schedules.map((schedule) => {
          const busy = busyId === schedule.id
          const canRespond = canRespondToInterviewProposal(schedule)

          return (
            <li className="rounded-lg border px-4 py-3" key={schedule.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold">
                    {formatDate(schedule.date) ?? schedule.date}
                    {DAY_PART_LABEL[schedule.dayPart]
                      ? ` · ${DAY_PART_LABEL[schedule.dayPart]}`
                      : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {schedule.timezone ? `Múi giờ ${schedule.timezone}` : null}
                    {schedule.expiresAt && canRespond
                      ? ` · Hết hạn đề xuất ${formatDateTime(schedule.expiresAt)}`
                      : null}
                  </p>
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
                    {busy ? (
                      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                    ) : (
                      <Check aria-hidden="true" className="size-4" />
                    )}
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
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default ApplicationInterviewSection
