import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

const ONBOARDING_STEPS = [
  'Hồ sơ doanh nghiệp',
  'Gửi xét duyệt',
  'JOBHUB xét duyệt',
  'Kích hoạt tài khoản',
]

function CompanyOnboardingStepper({ currentStep }) {
  return (
    <ol className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-4 sm:p-5">
      {ONBOARDING_STEPS.map((label, index) => {
        const step = index + 1
        const done = step < currentStep
        const current = step === currentStep

        return (
          <li
            aria-current={current ? 'step' : undefined}
            className="flex items-center gap-3"
            key={label}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                done && 'bg-primary text-primary-foreground',
                current && 'bg-primary text-primary-foreground ring-4 ring-primary/15',
                !done && !current && 'bg-secondary text-muted-foreground',
              )}
            >
              {done ? <Check aria-hidden="true" className="size-4" /> : step}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-[11px] font-semibold uppercase tracking-wide',
                  current ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {current ? 'Hiện tại' : `Bước ${step}`}
              </span>
              <span
                className={cn(
                  'block truncate text-sm font-semibold',
                  !done && !current && 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default CompanyOnboardingStepper
