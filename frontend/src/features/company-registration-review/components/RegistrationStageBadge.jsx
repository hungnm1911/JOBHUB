import { cn } from '@/lib/utils'

import { REGISTRATION_STAGE_META } from '../utils'

function RegistrationStageBadge({ stage, className }) {
  const meta = REGISTRATION_STAGE_META[stage]

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  )
}

export default RegistrationStageBadge
