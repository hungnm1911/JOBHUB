import { Eye, EyeOff, Info } from 'lucide-react'
import { useId } from 'react'

import { Input } from '@/components/ui/Input'

function AuthFormField({ label, labelAction, icon: Icon, error, hint, trailing, inputProps }) {
  const inputId = useId()
  const messageId = `${inputId}-message`
  const message = error?.message ?? hint

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium" htmlFor={inputId}>
          {label} <span className="text-destructive">*</span>
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-describedby={message ? messageId : undefined}
          aria-invalid={error ? true : undefined}
          className={trailing ? 'px-10' : 'pl-10'}
          id={inputId}
          {...inputProps}
        />
        {trailing}
      </div>
      {message && (
        <p
          className={
            error
              ? 'text-xs text-destructive'
              : 'flex items-center gap-1 text-xs text-muted-foreground'
          }
          id={messageId}
        >
          {!error && <Info aria-hidden="true" className="size-3.5" />}
          {message}
        </p>
      )}
    </div>
  )
}

function PasswordVisibilityToggle({ visible, onToggle }) {
  const Icon = visible ? EyeOff : Eye

  return (
    <button
      aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
      aria-pressed={visible}
      className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={onToggle}
      type="button"
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  )
}

export { AuthFormField, PasswordVisibilityToggle }
