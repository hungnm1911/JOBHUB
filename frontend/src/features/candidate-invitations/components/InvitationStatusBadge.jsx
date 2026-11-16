import { cn } from '@/lib/utils'

import { JOB_INVITATION_STATUS_LABEL, JOB_INVITATION_STATUS_TONE } from '../utils'

function InvitationStatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
        JOB_INVITATION_STATUS_TONE[status] ?? 'bg-secondary text-secondary-foreground',
        className,
      )}
    >
      {JOB_INVITATION_STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default InvitationStatusBadge
