import { ArrowDown, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { updatePipelineStatusApi } from '@/apis/recruiter-application.api'
import { Button } from '@/components/ui/button'
import { APPLICATION_STATUS_LABEL } from '@/features/candidate-dashboard/utils'
import { APPLICATION_STATUS } from '@/utils/constant'

import { NEXT_STATUS, TERMINAL_STATUSES, toRecruiterErrorMessage } from '../utils'
import ConfirmDialog from './ConfirmDialog'
import Panel from './Panel'

function showInterviewPanel() {
  const panel = document.getElementById('interview-panel')
  panel?.scrollIntoView({ block: 'start' })
  panel?.focus({ preventScroll: true })
}

function PipelinePanel({ application, onChanged }) {
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const next = NEXT_STATUS[application.status]
  const terminal = TERMINAL_STATUSES.includes(application.status)
  const rejecting = target === APPLICATION_STATUS.REJECTED

  const confirm = async () => {
    setBusy(true)
    try {
      await updatePipelineStatusApi(application.jobId, application.id, {
        targetStatus: target,
        expectedStatus: application.status,
        expectedVersion: application.version,
      })
      toast.success('Đã cập nhật trạng thái.')
    } catch (error) {
      toast.error(toRecruiterErrorMessage(error))
    } finally {
      // Success or conflict, the screen must show the current server state.
      onChanged()
      setBusy(false)
      setTarget(null)
    }
  }

  return (
    <Panel title="Tiến trình tuyển dụng">
      {terminal ? (
        <p className="text-sm text-muted-foreground">Hồ sơ đã kết thúc, chỉ có thể xem lại.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {next && (
              <Button onClick={() => setTarget(next)} size="sm" type="button">
                Chuyển sang: {APPLICATION_STATUS_LABEL[next]}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            )}
            <Button
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setTarget(APPLICATION_STATUS.REJECTED)}
              size="sm"
              type="button"
              variant="outline"
            >
              Từ chối hồ sơ
            </Button>
          </div>
          {application.status === APPLICATION_STATUS.CONTACTED && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                Bước tiếp theo diễn ra khi bạn gửi đề xuất phỏng vấn đầu tiên.
              </p>
              <Button onClick={showInterviewPanel} size="sm" type="button">
                Đến phần đề xuất lịch
                <ArrowDown aria-hidden="true" className="size-4" />
              </Button>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Chỉ chuyển tiếp từng bước, không quay lại được.
          </p>
        </>
      )}
      <ConfirmDialog
        busy={busy}
        confirmLabel={rejecting ? 'Từ chối' : 'Xác nhận'}
        description={
          rejecting
            ? 'Hồ sơ sẽ kết thúc và cuộc trò chuyện chuyển sang chỉ đọc.'
            : `Hồ sơ chuyển sang "${APPLICATION_STATUS_LABEL[target]}" và không quay lại được.`
        }
        destructive={rejecting}
        onCancel={() => setTarget(null)}
        onConfirm={confirm}
        open={Boolean(target)}
        title={rejecting ? 'Từ chối ứng viên?' : 'Chuyển trạng thái hồ sơ?'}
      />
    </Panel>
  )
}

export default PipelinePanel
