import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { withdrawOwnApplicationApi } from '@/apis/application.api'
import { Button } from '@/components/ui/button'
import ProfileModal from '@/features/candidate-profile/components/ProfileModal'

function WithdrawApplicationModal({ application, onClose, onWithdrawn }) {
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await withdrawOwnApplicationApi(application.id, {
        expectedVersion: application.version,
        withdrawReason: reason.trim() || null,
      })
      toast.success('Đã rút đơn ứng tuyển')
      onWithdrawn(response.application)
      onClose()
    } catch (error) {
      toast.error(error.message || 'Không rút được đơn.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfileModal
      busy={busy}
      description="Bạn chỉ có thể rút đơn khi trạng thái còn là Đã nộp. Thao tác không hoàn tác."
      footer={
        <>
          <Button disabled={busy} onClick={onClose} type="button" variant="outline">
            Hủy
          </Button>
          <Button
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy}
            form="withdraw-application-form"
            type="submit"
          >
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
            Xác nhận rút đơn
          </Button>
        </>
      }
      onClose={onClose}
      title="Rút đơn ứng tuyển"
    >
      <form className="space-y-4" id="withdraw-application-form" onSubmit={handleSubmit}>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Lý do (tuỳ chọn)</span>
          <textarea
            className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={busy}
            maxLength={2000}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Đã nhận offer khác, đổi hướng nghề nghiệp…"
            value={reason}
          />
          <span className="block text-xs text-muted-foreground">{reason.length}/2000</span>
        </label>
      </form>
    </ProfileModal>
  )
}

export default WithdrawApplicationModal
