import { KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { changePasswordApi } from '@/apis/authentication.api'
import useUnsavedChangesPrompt from '@/components/common/UnsavedChangesProvider/hooks/useUnsavedChangesPrompt'
import { Button } from '@/components/ui/button'
import { ACCOUNT_FIELD_LIMIT } from '@/utils/constant'
import { changePasswordSchema, zodResolver } from '@/validation'

import { endSessionAfterPasswordReset } from '../services/authentication.service'
import { AuthFormField, PasswordVisibilityToggle } from './AuthFormFields'

const PASSWORD_HINT = `Mật khẩu từ ${ACCOUNT_FIELD_LIMIT.PASSWORD_MIN_LENGTH}–${ACCOUNT_FIELD_LIMIT.PASSWORD_MAX_LENGTH} ký tự`

const FIELDS = Object.freeze([
  { name: 'currentPassword', label: 'Mật khẩu hiện tại', icon: KeyRound, autoComplete: 'current-password' },
  { name: 'password', label: 'Mật khẩu mới', icon: LockKeyhole, autoComplete: 'new-password', hint: PASSWORD_HINT },
  { name: 'confirmPassword', label: 'Xác nhận mật khẩu mới', icon: ShieldCheck, autoComplete: 'new-password' },
])

function ChangePasswordForm({ onChanged }) {
  const [visible, setVisible] = useState({})
  const {
    formState: { errors, isSubmitting, isDirty },
    handleSubmit,
    register,
    setError,
  } = useForm({
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
    resolver: zodResolver(changePasswordSchema),
  })
  const { markSaved } = useUnsavedChangesPrompt(isDirty)

  const onSubmit = async ({ currentPassword, password }) => {
    try {
      await changePasswordApi({ currentPassword, password })
    } catch (error) {
      if (error.status === 400 && error.details?.field === 'currentPassword') {
        setError(
          'currentPassword',
          { message: 'Mật khẩu hiện tại không chính xác.' },
          { shouldFocus: true },
        )
      } else {
        toast.error(error.status ? 'Không đổi được mật khẩu. Vui lòng thử lại.' : error.message)
      }
      return
    }

    // The backend revokes every session after a password change.
    markSaved()
    await endSessionAfterPasswordReset()
    onChanged()
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      {FIELDS.map((field) => (
        <AuthFormField
          error={errors[field.name]}
          hint={field.hint}
          icon={field.icon}
          inputProps={{
            autoComplete: field.autoComplete,
            type: visible[field.name] ? 'text' : 'password',
            ...register(field.name),
          }}
          key={field.name}
          label={field.label}
          trailing={
            <PasswordVisibilityToggle
              onToggle={() =>
                setVisible((current) => ({ ...current, [field.name]: !current[field.name] }))
              }
              visible={Boolean(visible[field.name])}
            />
          }
        />
      ))}

      <Button aria-busy={isSubmitting} className="h-11" disabled={isSubmitting} type="submit">
        {isSubmitting && (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        )}
        {isSubmitting ? 'Đang đổi mật khẩu…' : 'Đổi mật khẩu'}
      </Button>
    </form>
  )
}

export default ChangePasswordForm
