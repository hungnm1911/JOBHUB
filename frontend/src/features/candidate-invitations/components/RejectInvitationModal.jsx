import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { rejectOwnJobInvitationApi } from '@/apis/job-invitation.api'
import { Button } from '@/components/ui/button'
import ProfileModal from '@/features/candidate-profile/components/ProfileModal'

function RejectInvitationModal({ invitation, onClose, onRejected }) {
  const [busy, setBusy] = useState(false)
  const jobTitle = invitation?.job?.title ?? 'việc làm này'
  const companyName = invitation?.company?.name

  const handleReject = async () => {
    setBusy(true)
    try {
      const response = await rejectOwnJobInvitationApi(invitation.id)
      toast.success('Đã từ chối lời mời ứng tuyển')
      onRejected(response.invitation)
      onClose()
    } catch (error) {
      toast.error(error.message || 'Không từ chối được lời mời.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfileModal
      busy={busy}
      description={
        companyName
          ? `Bạn sắp từ chối lời mời cho “${jobTitle}” tại ${companyName}. Thao tác không hoàn tác.`
          : `Bạn sắp từ chối lời mời cho “${jobTitle}”. Thao tác không hoàn tác.`
      }
      footer={
        <>
          <Button disabled={busy} onClick={onClose} type="button" variant="outline">
            Hủy
          </Button>
          <Button
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy}
            onClick={handleReject}
            type="button"
          >
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
            Xác nhận từ chối
          </Button>
        </>
      }
      onClose={onClose}
      title="Từ chối lời mời"
    >
      <p className="text-sm text-muted-foreground">
        Nhà tuyển dụng sẽ nhận thông báo về quyết định của bạn. Bạn vẫn có thể ứng tuyển việc làm
        khác trên JOBHUB.
      </p>
    </ProfileModal>
  )
}

export default RejectInvitationModal
