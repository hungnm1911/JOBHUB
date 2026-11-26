import { cn } from '@/lib/utils'
import { JOB_STATUS } from '@/utils/constant'

import { JOB_ROLE, JOB_ROLE_LABEL, JOB_STATUS_LABEL } from '../utils'

const JOB_STATUS_TONE = Object.freeze({
  [JOB_STATUS.DRAFT]: 'border-border bg-secondary text-secondary-foreground',
  [JOB_STATUS.PENDING_APPROVAL]: 'border-warning/30 bg-warning/10 text-warning-foreground',
  [JOB_STATUS.PUBLISHED]: 'border-success-foreground/20 bg-success text-success-foreground',
  [JOB_STATUS.CLOSED]: 'border-border bg-muted text-muted-foreground',
  [JOB_STATUS.EXPIRED]: 'border-destructive/25 bg-destructive/5 text-destructive',
})

function JobStatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        JOB_STATUS_TONE[status] ?? 'border-border bg-secondary text-secondary-foreground',
        className,
      )}
    >
      {JOB_STATUS_LABEL[status] ?? status}
    </span>
  )
}

function JobRoleChip({ role, className }) {
  if (role !== JOB_ROLE.PRIMARY && role !== JOB_ROLE.SUPPORTING) {
    return null
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        role === JOB_ROLE.PRIMARY
          ? 'border-primary/20 bg-primary/5 text-primary'
          : 'border-primary/30 bg-background text-primary',
        className,
      )}
    >
      {JOB_ROLE_LABEL[role]}
    </span>
  )
}

export { JobRoleChip }
export default JobStatusBadge
