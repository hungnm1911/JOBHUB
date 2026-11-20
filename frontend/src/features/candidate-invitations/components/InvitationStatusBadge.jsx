import {
  Ban,
  CheckCircle2,
  Clock3,
  Hourglass,
  RotateCcw,
  XCircle,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { JOB_INVITATION_STATUS } from '@/utils/constant'

import { JOB_INVITATION_STATUS_LABEL } from '../utils'

const STATUS_CONFIG = Object.freeze({
  [JOB_INVITATION_STATUS.PENDING]: {
    icon: Hourglass,
    className: 'border-amber-500/35 bg-amber-500/15 font-semibold text-amber-800',
  },
  [JOB_INVITATION_STATUS.ACCEPTED]: {
    icon: CheckCircle2,
    className: 'border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-700',
  },
  [JOB_INVITATION_STATUS.REJECTED]: {
    icon: XCircle,
    className: 'border-rose-500/30 bg-rose-500/10 font-semibold text-rose-700',
  },
  [JOB_INVITATION_STATUS.EXPIRED]: {
    icon: Clock3,
    className: 'border-slate-400/40 bg-slate-500/10 font-medium text-slate-600',
  },
  [JOB_INVITATION_STATUS.REVOKED]: {
    icon: RotateCcw,
    className: 'border-slate-400/40 bg-slate-500/10 font-medium text-slate-600',
  },
  [JOB_INVITATION_STATUS.INVALIDATED]: {
    icon: Ban,
    className: 'border-slate-400/40 bg-slate-500/10 font-medium text-slate-600',
  },
})

function InvitationStatusBadge({ status, className }) {
  const config = STATUS_CONFIG[status]
  const Icon = config?.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs',
        config?.className ?? 'border-border bg-secondary text-secondary-foreground',
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      {JOB_INVITATION_STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default InvitationStatusBadge
