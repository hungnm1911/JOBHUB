import { ArrowRight, CircleAlert, LoaderCircle, LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useAppDispatch } from '@/store/hooks'
import { API_ERROR_MESSAGE, USER_ROLE, USER_STATUS } from '@/utils/constant'
import { loginSchema, zodResolver } from '@/validation'

import { loginThunk } from '../services/authentication-thunks'
import { AuthFormField, PasswordVisibilityToggle } from './AuthFormFields'

const LOGIN_FIELDS = ['email', 'password']

function toPostLoginDestination(user) {
  // V02 BR-21: a PENDING_ACTIVATION Company Manager only has an onboarding session.
  if (user?.status === USER_STATUS.PENDING_ACTIVATION) {
    return '/onboarding/company'
  }

  if (user?.role === USER_ROLE.PLATFORM_ADMIN) {
    return '/admin'
  }

  return '/'
}

function getLoginRejectionMessage(error) {
  const field = error.details?.field

  if (error.status === 401 && field === 'credentials') {
    return API_ERROR_MESSAGE.INVALID_CREDENTIALS
  }

  if (error.status === 403 && field === 'email') {
    return API_ERROR_MESSAGE.EMAIL_NOT_VERIFIED
  }

  if (error.status === 403 && field === 'status') {
    return API_ERROR_MESSAGE.ACCOUNT_ACCESS_DENIED
  }

  return null
}

function LoginForm({ defaultEmail = '' }) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [passwordVisible, setPasswordVisible] = useState(false)
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm({
    defaultValues: { email: defaultEmail, password: '' },
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async ({ email, password }) => {
    let authentication

    try {
      authentication = await dispatch(loginThunk({ email, password })).unwrap()
    } catch (error) {
      const rejectionMessage = getLoginRejectionMessage(error)
      const field = error.details?.field

      if (rejectionMessage) {
        setError('root.server', { message: rejectionMessage })
      } else if (error.status === 400 && LOGIN_FIELDS.includes(field)) {
        setError(field, { message: error.message }, { shouldFocus: true })
      } else {
        toast.error(error.message)
      }
      return
    }

    toast.success('Đăng nhập thành công.')

    navigate(toPostLoginDestination(authentication.user), { replace: true })
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      {errors.root?.server && (
        <div
          className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {errors.root.server.message}
        </div>
      )}

      <AuthFormField
        error={errors.email}
        icon={Mail}
        inputProps={{
          autoComplete: 'email',
          inputMode: 'email',
          placeholder: 'you@example.com',
          type: 'email',
          ...register('email'),
        }}
        label="Email tài khoản"
      />

      <AuthFormField
        error={errors.password}
        icon={LockKeyhole}
        inputProps={{
          autoComplete: 'current-password',
          placeholder: 'Nhập mật khẩu',
          type: passwordVisible ? 'text' : 'password',
          ...register('password'),
        }}
        label="Mật khẩu"
        labelAction={
          <Link
            className="text-xs font-medium text-primary hover:underline"
            to="/forgot-password"
          >
            Quên mật khẩu?
          </Link>
        }
        trailing={
          <PasswordVisibilityToggle
            onToggle={() => setPasswordVisible((visible) => !visible)}
            visible={passwordVisible}
          />
        }
      />

      <Button className="h-11 w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Đang đăng nhập…
          </>
        ) : (
          <>
            Đăng nhập
            <ArrowRight aria-hidden="true" className="size-4" />
          </>
        )}
      </Button>
    </form>
  )
}

export default LoginForm
