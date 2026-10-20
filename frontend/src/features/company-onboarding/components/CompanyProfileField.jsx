import { useId } from 'react'

import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

const TEXTAREA_CLASS_NAME =
  'flex min-h-32 w-full min-w-0 rounded-md border border-input bg-secondary/60 px-3 py-2.5 text-sm shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20'

function CompanyProfileField({
  label,
  required = false,
  icon: Icon,
  error,
  hint,
  multiline = false,
  className,
  inputProps,
}) {
  const inputId = useId()
  const messageId = `${inputId}-message`
  const message = error?.message ?? hint
  const describedBy = message ? messageId : undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-sm font-medium" htmlFor={inputId}>
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {multiline ? (
        <textarea
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={TEXTAREA_CLASS_NAME}
          id={inputId}
          {...inputProps}
        />
      ) : (
        <div className="relative">
          {Icon && (
            <Icon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
          )}
          <Input
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={Icon ? 'pl-10' : undefined}
            id={inputId}
            {...inputProps}
          />
        </div>
      )}
      {message && (
        <p
          className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}
          id={messageId}
        >
          {message}
        </p>
      )}
    </div>
  )
}

export default CompanyProfileField
