import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { acceptOwnJobInvitationApi } from '@/apis/job-invitation.api'
import { Button } from '@/components/ui/button'
import ProfileModal from '@/features/candidate-profile/components/ProfileModal'

function AcceptInvitationModal({ invitation, onClose, onAccepted }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const jobTitle = invitation?.job?.title ?? 'việc làm này'
  const companyName = invitation?.company?.name
  const cvName = invitation?.invitedCvSnapshot?.name

  const handleAccept = async () => {
    setBusy(true)
    try {
      const response = await acceptOwnJobInvitationApi(invitation.id)
      toast.success('Đã chấp nhận lời mời. Đơn ứng tuyển đã được tạo.', {
        action: {
          label: 'Xem đơn',
          onClick: () => navigate('/candidate/applications'),
        },
      })
      onAccepted(response.invitation)
      onClose()
    } catch (error) {
      toast.error(error.message || 'Không chấp nhận được lời mời.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfileModal
      busy={busy}
      description={
        companyName
          ? `Chấp nhận lời mời sẽ tạo đơn ứng tuyển cho “${jobTitle}” tại ${companyName}.`
          : `Chấp nhận lời mời sẽ tạo đơn ứng tuyển cho “${jobTitle}”.`
      }
      footer={
        <>
          <Button disabled={busy} onClick={onClose} type="button" variant="outline">
            Hủy
          </Button>
          <Button disabled={busy} onClick={handleAccept} type="button">
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
            Chấp nhận lời mời
          </Button>
        </>
      }
      onClose={onClose}
      title="Chấp nhận lời mời"
    >
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          Hệ thống sẽ dùng CV được gắn với lời mời để tạo đơn ứng tuyển. Sau khi chấp nhận, bạn có
          thể theo dõi tiến trình tại{' '}
          <Link className="font-medium text-primary hover:underline" to="/candidate/applications">
            Đơn ứng tuyển
          </Link>
          .
        </p>
        {cvName ? (
          <p>
            CV gắn với lời mời: <span className="font-medium text-foreground">{cvName}</span>
          </p>
        ) : null}
      </div>
    </ProfileModal>
  )
}

export default AcceptInvitationModal
