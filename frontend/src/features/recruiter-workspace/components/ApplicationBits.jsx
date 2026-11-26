import { Download, Eye, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { getSubmittedCvFileApi } from '@/apis/recruiter-application.api'
import { Button } from '@/components/ui/button'
import {
  APPLICATION_SOURCE_LABEL,
  INTERVIEW_SCHEDULE_STATUS_LABEL,
} from '@/features/candidate-applications/utils'

import { formatMoment, slotLabel } from '../utils'
import PdfPreview from './PdfPreview'
import Panel from './Panel'

function SourceLabel({ source }) {
  return APPLICATION_SOURCE_LABEL[source] ?? source
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

// `jobId` selects the Primary delivery route; without it the Assignee route is used.
// `inline` shows the preview straight away instead of behind a toggle.
function SubmittedCvPanel({ application, jobId, inline = false }) {
  const [toggled, setToggled] = useState(false)
  const [preview, setPreview] = useState({ url: null, error: false })
  const [downloading, setDownloading] = useState(false)
  const snapshot = application.submittedCvSnapshot
  const applicationId = application.id
  const open = Boolean(snapshot) && (inline || toggled)

  useEffect(() => {
    if (!open) return undefined
    let active = true
    let url = null
    getSubmittedCvFileApi({ jobId, applicationId, disposition: 'preview' }).then(
      (response) => {
        if (!active) return
        url = URL.createObjectURL(response.data)
        setPreview({ url, error: false })
      },
      () => active && setPreview({ url: null, error: true }),
    )
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
      setPreview({ url: null, error: false })
    }
  }, [open, jobId, applicationId])

  const download = async () => {
    setDownloading(true)
    try {
      const response = await getSubmittedCvFileApi({ jobId, applicationId, disposition: 'download' })
      saveBlob(response.data, snapshot?.pdfFile?.originalFileName ?? `${snapshot?.name ?? 'cv'}.pdf`)
    } catch {
      toast.error('Không tải được CV. Vui lòng thử lại.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Panel
      actions={
        snapshot && (
          <div className="flex gap-2">
            {!inline && (
              <Button onClick={() => setToggled((value) => !value)} size="sm" type="button" variant="outline">
                <Eye aria-hidden="true" className="size-4" />
                {open ? 'Ẩn CV' : 'Xem CV'}
              </Button>
            )}
            <Button disabled={downloading} onClick={download} size="sm" type="button" variant="outline">
              {downloading ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <Download aria-hidden="true" className="size-4" />
              )}
              Tải xuống
            </Button>
          </div>
        )
      }
      title="CV đã nộp"
    >
      <p className="text-sm text-muted-foreground">
        {snapshot ? `${snapshot.name} · chụp lúc ${formatMoment(snapshot.capturedAt)}` : 'Không có CV.'}
      </p>
      {open && <PdfPreview error={preview.error} title="CV đã nộp" url={preview.url} />}
    </Panel>
  )
}

function AvailabilityList({ availability }) {
  if (availability?.status !== 'SUBMITTED') {
    return <p className="text-sm text-muted-foreground">Ứng viên chưa gửi lịch rảnh.</p>
  }
  if (availability.slots.length === 0) {
    return <p className="text-sm text-muted-foreground">Ứng viên đã gửi nhưng không có buổi rảnh nào.</p>
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {availability.slots.map((slot) => (
        <li
          className="rounded-md border bg-secondary px-2.5 py-1 text-sm"
          key={`${slot.date}-${slot.dayPart}`}
        >
          {slotLabel(slot)}
        </li>
      ))}
    </ul>
  )
}

function ScheduleHistory({ schedules, renderAction }) {
  if (!schedules?.length) {
    return <p className="text-sm text-muted-foreground">Chưa có đề xuất phỏng vấn nào.</p>
  }
  return (
    <ul className="divide-y">
      {schedules.map((schedule) => (
        <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={schedule.id}>
          <div>
            <p className="text-sm font-semibold">{slotLabel(schedule)}</p>
            <p className="text-xs text-muted-foreground">
              {INTERVIEW_SCHEDULE_STATUS_LABEL[schedule.status] ?? schedule.status}
              {schedule.expiresAt ? ` · hết hạn ${formatMoment(schedule.expiresAt)}` : ''}
            </p>
          </div>
          {renderAction?.(schedule)}
        </li>
      ))}
    </ul>
  )
}

function WithdrawnNotice({ application }) {
  if (!application.withdrawnAt) return null
  return (
    <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
      Ứng viên đã rút đơn lúc {formatMoment(application.withdrawnAt)}.
      {application.withdrawReason ? ` Lý do: ${application.withdrawReason}` : ''}
    </p>
  )
}

export {
  AvailabilityList,
  ScheduleHistory,
  SourceLabel,
  SubmittedCvPanel,
  WithdrawnNotice,
}
