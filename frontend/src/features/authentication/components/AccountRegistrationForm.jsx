import { ArrowRight, LoaderCircle, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ACCOUNT_FIELD_LIMIT, API_ERROR_MESSAGE } from '@/utils/constant'
import { accountRegistrationSchema, zodResolver } from '@/validation'

import { AuthFormField as FormField, PasswordVisibilityToggle } from './AuthFormFields'

const defaultValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

const SUBMITTED_FIELDS = ['fullName', 'email', 'password']

function AccountRegistrationForm({
  fieldCopy,
  onRegister,
  onRegistered,
  serviceUnavailableMessage,
}) {
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
    defaultValues,
    resolver: zodResolver(accountRegistrationSchema),
  })

  const togglePassword = (field) => {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }))
  }

  const onSubmit = async ({ fullName, email, password }) => {
    const registration = { fullName, email, password }
    let result

    try {
      result = await onRegister(registration)
    } catch (error) {
      const field = error.details?.field

      if (error.status === 409 && field === 'email') {
        setError('email', { message: API_ERROR_MESSAGE.EMAIL_ALREADY_REGISTERED }, { shouldFocus: true })
      } else if (error.status === 400 && SUBMITTED_FIELDS.includes(field)) {
        setError(field, { message: error.message }, { shouldFocus: true })
      } else if (error.status === 503 && serviceUnavailableMessage) {
        toast.error(serviceUnavailableMessage)
      } else {
        toast.error(error.message)
      }
      return
    }

    onRegistered({ registration, result })
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      <FormField
        error={errors.fullName}
        icon={UserRound}
        inputProps={{
          autoComplete: 'name',
          placeholder: 'Ví dụ: Nguyễn Văn Minh',
          ...register('fullName'),
        }}
        label={fieldCopy.fullNameLabel}
      />

      <FormField
        error={errors.email}
        icon={Mail}
        inputProps={{
          autoComplete: 'email',
          inputMode: 'email',
          placeholder: fieldCopy.emailPlaceholder,
          type: 'email',
          ...register('email'),
        }}
        label={fieldCopy.emailLabel}
      />

      <FormField
        error={errors.password}
        hint={`Mật khẩu từ ${ACCOUNT_FIELD_LIMIT.PASSWORD_MIN_LENGTH}–${ACCOUNT_FIELD_LIMIT.PASSWORD_MAX_LENGTH} ký tự`}
        icon={LockKeyhole}
        inputProps={{
          autoComplete: 'new-password',
          placeholder: `Tối thiểu ${ACCOUNT_FIELD_LIMIT.PASSWORD_MIN_LENGTH} ký tự`,
          type: visiblePasswords.password ? 'text' : 'password',
          ...register('password'),
        }}
        label="Mật khẩu"
        trailing={
          <PasswordVisibilityToggle
            onToggle={() => togglePassword('password')}
            visible={visiblePasswords.password}
          />
        }
      />

      <FormField
        error={errors.confirmPassword}
        icon={ShieldCheck}
        inputProps={{
          autoComplete: 'new-password',
          placeholder: 'Nhập lại mật khẩu',
          type: visiblePasswords.confirmPassword ? 'text' : 'password',
          ...register('confirmPassword'),
        }}
        label="Xác nhận mật khẩu"
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
            Đang tạo tài khoản…
          </>
        ) : (
          <>
            Tạo tài khoản
            <ArrowRight aria-hidden="true" className="size-4" />
          </>
        )}
      </Button>
    </form>
  )
}

export default AccountRegistrationForm
