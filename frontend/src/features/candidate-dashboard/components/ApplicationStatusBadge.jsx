import { cn } from '@/lib/utils'

import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_TONE } from '../utils'

function ApplicationStatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
        APPLICATION_STATUS_TONE[status] ?? 'bg-secondary text-secondary-foreground',
        className,
      )}
    >
      {APPLICATION_STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default ApplicationStatusBadge
