import { FileText } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { listRecruiterJobsApi } from '@/apis/recruiter-job.api'
import { sendJobInvitationApi } from '@/apis/recruiter-sourcing.api'
import { ErrorState, ListSkeleton } from '@/components/common/ListStates'
import { JOB_STATUS } from '@/utils/constant'

import useResource from '../hooks/useResource'
import { JOB_LIST_SCOPE, formatDay, getEffectiveJobStatus, toRecruiterErrorMessage } from '../utils'
import ConfirmDialog from './ConfirmDialog'

const JOB_QUERY = Object.freeze({
  scope: JOB_LIST_SCOPE.MY_TEAM,
  status: JOB_STATUS.PUBLISHED,
  sort: 'title',
  limit: 100,
})

function toInvitationError(error) {
  const message = String(error?.message ?? '')
  if (error?.status === 409 && /pending/i.test(message)) {
    return 'Ứng viên đã có một lời mời đang chờ phản hồi cho Job này.'
  }
  if (error?.status === 409) {
    return 'Job không còn nhận lời mời cho ứng viên này (đã ứng tuyển, đã từ chối hoặc hết hạn).'
  }
  return toRecruiterErrorMessage(error, 'Không gửi được lời mời.')
}

// `cv` needs `cvId`; its names are shown when the caller knows them.
function InviteDialog({ cv, onClose }) {
  // The dialog has no trigger element of its own, so it hands focus back to its opener.
  const [opener] = useState(() => document.activeElement)
  const { data, loading, error, reload } = useResource(listRecruiterJobsApi, JOB_QUERY)
  const [jobId, setJobId] = useState('')
  const [greeting, setGreeting] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const jobs = (data?.jobs ?? []).filter((job) => getEffectiveJobStatus(job) === JOB_STATUS.PUBLISHED)

  const close = () => {
    onClose()
    requestAnimationFrame(() => opener?.focus())
  }

  const send = async () => {
    setBusy(true)
    setFailure(null)
    try {
      await sendJobInvitationApi(jobId, {
        candidateCvId: cv.cvId,
        ...(greeting.trim() ? { greetingMessage: greeting.trim() } : {}),
      })
      toast.success('Đã gửi lời mời ứng tuyển.')
      close()
    } catch (sendError) {
      setFailure(toInvitationError(sendError))
      reload()
    } finally {
      setBusy(false)
    }
  }

  let list
  if (loading) list = <ListSkeleton label="Đang tải Job" rows={3} />
  else if (error) list = <ErrorState className="py-6" error={error} onRetry={reload} />
  else if (jobs.length === 0) {
    list = (
      <p className="text-sm text-muted-foreground">
        Bạn chưa tham gia Job nào đang tuyển. <Link className="text-primary underline" to="/recruiter/participating">Xem Job của tôi</Link>
      </p>
    )
  } else {
    list = (
      <label className="block space-y-2 text-sm font-medium">
        Job ứng tuyển
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => setJobId(event.target.value)}
          value={jobId}
        >
          <option value="">Chọn một Job đang tuyển</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title} (hạn nộp {formatDay(job.applicationDeadline)})
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <ConfirmDialog
      busy={busy}
      confirmDisabled={!jobId}
      confirmLabel="Gửi lời mời"
      description="Lời mời được gửi cho ứng viên của CV đã chọn."
      onCancel={close}
      onConfirm={send}
      open
      title="Mời ứng tuyển"
    >
      <div className="flex gap-3 rounded-md border bg-secondary/50 p-3">
        <FileText aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold break-words">{cv.cvName ?? 'CV đang xem'}</p>
          {cv.candidateName && <p className="break-words text-muted-foreground">{cv.candidateName}</p>}
        </div>
      </div>
      {list}
      <label className="block space-y-2 text-sm font-medium">
        Lời chào (không bắt buộc)
        <textarea
          className="min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => setGreeting(event.target.value)}
          value={greeting}
        />
      </label>
      {failure && (
        <p className="text-sm text-destructive" role="alert">
          {failure}
        </p>
      )}
    </ConfirmDialog>
  )
}

export default InviteDialog
