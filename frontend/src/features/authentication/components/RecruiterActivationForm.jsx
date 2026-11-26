import { Circle, CircleCheck, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { activateRecruiterApi } from '@/apis/authentication.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { useAppDispatch } from '@/store/hooks'
import { ACCOUNT_FIELD_LIMIT } from '@/utils/constant'
import { resetPasswordSchema, zodResolver } from '@/validation'

import { loginThunk } from '../services/authentication-thunks'
import { endSessionAfterPasswordReset, loadCurrentAccountContext } from '../services/authentication.service'

function PasswordField({ label, error, visible, onToggleVisible, inputProps, describedBy }) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <Input
          aria-describedby={[error ? errorId : null, describedBy].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          className="bg-card pr-11"
          id={id}
          type={visible ? 'text' : 'password'}
          {...inputProps}
        />
        <button
          aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground active:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onToggleVisible}
          type="button"
        >
          {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </button>
      </div>
      {error && (
        <p className="text-xs text-destructive" id={errorId} role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}

function RequirementList({ id, items }) {
  return (
    <ul aria-label="Yêu cầu mật khẩu" className="space-y-1.5" id={id}>
      {items.map((item) => (
        <li
          className={cn(
            'flex items-center gap-2 text-sm transition-colors',
            item.met ? 'text-foreground' : 'text-muted-foreground',
          )}
          key={item.label}
        >
          {item.met ? (
            <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-success-foreground" />
          ) : (
            <Circle aria-hidden="true" className="size-4 shrink-0" />
          )}
          {item.label}
          <span className="sr-only">{item.met ? '(đã đạt)' : '(chưa đạt)'}</span>
        </li>
      ))}
    </ul>
  )
}

// V3 F05: the Recruiter sets the first password; the Company Manager never knows it.
// After activation the same credentials sign the Recruiter in, so the button can say so.
function RecruiterActivationForm({ token, onActivated, onInvalidToken, onAlreadyActivated }) {
  const dispatch = useAppDispatch()
  const requirementId = useId()
  const [visible, setVisible] = useState({ password: false, confirmPassword: false })
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm({
    defaultValues: { password: '', confirmPassword: '' },
    resolver: zodResolver(resetPasswordSchema),
  })

  const [password = '', confirmPassword = ''] = useWatch({
    control,
    name: ['password', 'confirmPassword'],
  })
  // Only the rules the account policy enforces (V1: 8 to 64 characters) are listed.
  const requirements = [
    {
      label: `Từ ${ACCOUNT_FIELD_LIMIT.PASSWORD_MIN_LENGTH} đến ${ACCOUNT_FIELD_LIMIT.PASSWORD_MAX_LENGTH} ký tự`,
      met:
        password.length >= ACCOUNT_FIELD_LIMIT.PASSWORD_MIN_LENGTH &&
        password.length <= ACCOUNT_FIELD_LIMIT.PASSWORD_MAX_LENGTH,
    },
    { label: 'Hai mật khẩu trùng khớp', met: password !== '' && password === confirmPassword },
  ]

  const toggle = (field) => setVisible((current) => ({ ...current, [field]: !current[field] }))

  const onSubmit = async ({ password: newPassword }) => {
    let activatedUser
    try {
      const result = await activateRecruiterApi({ token, password: newPassword })
      activatedUser = result.user
    } catch (error) {
      const field = error.details?.field

      if (error.status === 400 && field === 'token') {
        onInvalidToken()
      } else if (error.status === 409 && field === 'mustChangePassword') {
        onAlreadyActivated()
      } else if (error.status === 400 && field === 'password') {
        setError('password', { message: 'Mật khẩu chưa đạt yêu cầu.' }, { shouldFocus: true })
      } else if (error.status === 409 || error.status === 403) {
        toast.error('Tài khoản hoặc doanh nghiệp hiện không cho phép kích hoạt. Vui lòng liên hệ Quản lý công ty.')
      } else {
        toast.error(error.message)
      }
      return
    }

    // A session from another account in this browser must not survive the activation.
    await endSessionAfterPasswordReset()

    let signedIn = false
    if (activatedUser?.email) {
      try {
        await dispatch(loginThunk({ email: activatedUser.email, password: newPassword })).unwrap()
        await loadCurrentAccountContext()
        signedIn = true
      } catch {
        signedIn = false
      }
    }

    onActivated({ email: activatedUser?.email ?? null, signedIn })
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-3">
        <PasswordField
          describedBy={requirementId}
          error={errors.password}
          inputProps={{
            autoComplete: 'new-password',
            placeholder: 'Nhập mật khẩu mới',
            ...register('password'),
          }}
          label="Mật khẩu mới"
          onToggleVisible={() => toggle('password')}
          visible={visible.password}
        />
        <RequirementList id={requirementId} items={requirements} />
      </div>

      <PasswordField
        error={errors.confirmPassword}
        inputProps={{
          autoComplete: 'new-password',
          placeholder: 'Nhập lại mật khẩu',
          ...register('confirmPassword'),
        }}
        label="Nhập lại mật khẩu"
        onToggleVisible={() => toggle('confirmPassword')}
        visible={visible.confirmPassword}
      />

      <Button aria-busy={isSubmitting} className="h-11 w-full" disabled={isSubmitting} type="submit">
        {isSubmitting && (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        )}
        {isSubmitting ? 'Đang kích hoạt…' : 'Kích hoạt và đăng nhập'}
      </Button>
    </form>
  )
}

export default RecruiterActivationForm
