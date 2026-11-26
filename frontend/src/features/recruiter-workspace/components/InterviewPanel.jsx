import { useState } from 'react'
import { toast } from 'sonner'

import {
  cancelInterviewProposalApi,
  createInterviewProposalApi,
} from '@/apis/recruiter-application.api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { APPLICATION_STATUS, INTERVIEW_SCHEDULE_STATUS } from '@/utils/constant'

import { slotLabel, toRecruiterErrorMessage } from '../utils'
import { AvailabilityList, ScheduleHistory } from './ApplicationBits'
import ConfirmDialog from './ConfirmDialog'
import Panel from './Panel'

const SCHEDULING_STATUSES = [APPLICATION_STATUS.CONTACTED, APPLICATION_STATUS.INTERVIEW_SCHEDULED]
const OPEN_SCHEDULE_STATUSES = [
  INTERVIEW_SCHEDULE_STATUS.PROPOSED,
  INTERVIEW_SCHEDULE_STATUS.CONFIRMED,
]

const slotKey = (slot) => `${slot.date}-${slot.dayPart}`

function todayKey() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function InterviewPanel({ application, onChanged }) {
  const [selected, setSelected] = useState(null)
  const [action, setAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const { availability, interviewSchedules: schedules = [] } = application
  const canSchedule = SCHEDULING_STATUSES.includes(application.status)
  const openSchedule = schedules.find((item) => OPEN_SCHEDULE_STATUSES.includes(item.status))
  const declined = new Set(
    schedules.filter((item) => item.status === INTERVIEW_SCHEDULE_STATUS.DECLINED).map(slotKey),
  )
  const slots = availability?.slots ?? []
  const today = todayKey()

  const confirm = async () => {
    setBusy(true)
    try {
      if (action.type === 'propose') {
        await createInterviewProposalApi(application.jobId, application.id, {
          date: action.slot.date,
          dayPart: action.slot.dayPart,
          expectedAvailabilityRevision: availability.revision,
        })
        toast.success('Đã gửi đề xuất phỏng vấn.')
        setSelected(null)
      } else {
        await cancelInterviewProposalApi(application.jobId, application.id, action.schedule.id)
        toast.success('Đã hủy đề xuất.')
      }
    } catch (error) {
      toast.error(toRecruiterErrorMessage(error))
    } finally {
      onChanged()
      setBusy(false)
      setAction(null)
    }
  }

  let proposal = null
  if (canSchedule && openSchedule) {
    proposal = (
      <div className="space-y-3">
        <AvailabilityList availability={availability} />
        <p className="text-sm text-muted-foreground">
          Đang có một lịch chờ xác nhận hoặc đã xác nhận nên chưa gửi thêm đề xuất được.
        </p>
      </div>
    )
  } else if (canSchedule && slots.length > 0) {
    proposal = (
      <div className="space-y-3">
        <fieldset>
          <legend className="text-sm font-medium">Chọn một buổi để đề xuất</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {slots.map((slot) => {
              const key = slotKey(slot)
              const reason =
                (declined.has(key) && 'Ứng viên đã từ chối buổi này') ||
                (slot.date < today && 'Buổi này đã qua') ||
                null
              return (
                <button
                  aria-pressed={selected ? slotKey(selected) === key : false}
                  className={cn(
                    'min-h-10 rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:line-through disabled:opacity-60',
                    selected && slotKey(selected) === key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'bg-background hover:bg-secondary',
                  )}
                  disabled={Boolean(reason)}
                  key={key}
                  onClick={() => setSelected(slot)}
                  title={reason ?? undefined}
                  type="button"
                >
                  {slotLabel(slot)}
                </button>
              )
            })}
          </div>
        </fieldset>
        <Button
          disabled={!selected}
          onClick={() => setAction({ type: 'propose', slot: selected })}
          size="sm"
          type="button"
        >
          Gửi đề xuất phỏng vấn
        </Button>
      </div>
    )
  }

  return (
    <Panel
      className="scroll-mt-20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      id="interview-panel"
      tabIndex={-1}
      title="Lịch phỏng vấn"
    >
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Lịch rảnh của ứng viên</h3>
          {proposal ?? <AvailabilityList availability={availability} />}
        </div>
        {!canSchedule && (
          <p className="text-xs text-muted-foreground">
            Chỉ đề xuất lịch khi hồ sơ ở bước Đã liên hệ hoặc Đã lên lịch phỏng vấn.
          </p>
        )}
        <div className="border-t pt-3">
          <h3 className="text-sm font-semibold">Lịch sử đề xuất</h3>
          <ScheduleHistory
            renderAction={(schedule) =>
              schedule.status === INTERVIEW_SCHEDULE_STATUS.PROPOSED && (
                <Button
                  onClick={() => setAction({ type: 'cancel', schedule })}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Hủy đề xuất
                </Button>
              )
            }
            schedules={schedules}
          />
        </div>
      </div>
      <ConfirmDialog
        busy={busy}
        confirmLabel={action?.type === 'cancel' ? 'Hủy đề xuất' : 'Gửi đề xuất'}
        description={
          action
            ? slotLabel(action.type === 'cancel' ? action.schedule : action.slot)
            : ''
        }
        destructive={action?.type === 'cancel'}
        onCancel={() => setAction(null)}
        onConfirm={confirm}
        open={Boolean(action)}
        title={action?.type === 'cancel' ? 'Hủy đề xuất phỏng vấn?' : 'Gửi đề xuất phỏng vấn?'}
      />
    </Panel>
  )
}

export default InterviewPanel
