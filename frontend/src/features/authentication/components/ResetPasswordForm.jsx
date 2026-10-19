import { CircleCheck, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { resetPasswordApi } from '@/apis/authentication.api'
import { Button } from '@/components/ui/button'
import { ACCOUNT_FIELD_LIMIT } from '@/utils/constant'
import { resetPasswordSchema, zodResolver } from '@/validation'

import { AuthFormField, PasswordVisibilityToggle } from './AuthFormFields'

function ResetPasswordForm({ token, onReset, onInvalidToken }) {
  const [visiblePasswords, setVisiblePasswords] = useState({
    password: false,
    confirmPassword: false,
  })
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm({
    defaultValues: { password: '', confirmPassword: '' },
    resolver: zodResolver(resetPasswordSchema),
  })

  const togglePassword = (field) => {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }))
  }

  const onSubmit = async ({ password }) => {
    try {
      await resetPasswordApi({ token, password })
    } catch (error) {
      const field = error.details?.field

      if (error.status === 400 && field === 'token') {
        onInvalidToken()
      } else if (error.status === 400 && field === 'password') {
        setError('password', { message: error.message }, { shouldFocus: true })
      } else {
        toast.error(error.message)
      }
      return
    }

    onReset()
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      <AuthFormField
        error={errors.password}
        hint={`Mật khẩu từ ${ACCOUNT_FIELD_LIMIT.PASSWORD_MIN_LENGTH}–${ACCOUNT_FIELD_LIMIT.PASSWORD_MAX_LENGTH} ký tự`}
        icon={LockKeyhole}
        inputProps={{
          autoComplete: 'new-password',
          placeholder: `Từ ${ACCOUNT_FIELD_LIMIT.PASSWORD_MIN_LENGTH}–${ACCOUNT_FIELD_LIMIT.PASSWORD_MAX_LENGTH} ký tự`,
          type: visiblePasswords.password ? 'text' : 'password',
          ...register('password'),
        }}
        label="Mật khẩu mới"
        trailing={
          <PasswordVisibilityToggle
            onToggle={() => togglePassword('password')}
            visible={visiblePasswords.password}
          />
        }
      />

      <AuthFormField
        error={errors.confirmPassword}
        icon={ShieldCheck}
        inputProps={{
          autoComplete: 'new-password',
          placeholder: 'Nhập lại mật khẩu',
          type: visiblePasswords.confirmPassword ? 'text' : 'password',
          ...register('confirmPassword'),
        }}
        label="Xác nhận mật khẩu mới"
        trailing={
          <PasswordVisibilityToggle
            onToggle={() => togglePassword('confirmPassword')}
            visible={visiblePasswords.confirmPassword}
          />
        }
      />

      <Button className="h-11 w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Đang đặt lại…
          </>
        ) : (
          <>
            Đặt lại mật khẩu
            <CircleCheck aria-hidden="true" className="size-4" />
          </>
        )}
      </Button>
    </form>
  )
}

export default ResetPasswordForm
