import { cn } from '@/lib/utils'
import { APPLICATION_STATUS_LABEL } from '../utils'
import { APPLICATION_STATUS_STYLE } from '../application-status-style'

function ApplicationStatusBadge({ status, className }) {
  const style = APPLICATION_STATUS_STYLE[status]
  const Icon = style?.icon

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        style?.badge ?? 'border-border bg-secondary text-secondary-foreground',
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      <span>{APPLICATION_STATUS_LABEL[status] ?? status}</span>
    </span>
  )
}

export default ApplicationStatusBadge
