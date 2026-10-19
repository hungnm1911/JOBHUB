import { ArrowRight, LoaderCircle, Mail } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { forgotPasswordApi } from '@/apis/authentication.api'
import { Button } from '@/components/ui/button'
import { API_ERROR_MESSAGE } from '@/utils/constant'
import { forgotPasswordSchema, zodResolver } from '@/validation'

import { AuthFormField } from './AuthFormFields'

function ForgotPasswordForm({ onRequested }) {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm({
    defaultValues: { email: '' },
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async ({ email }) => {
    try {
      await forgotPasswordApi({ email })
    } catch (error) {
      if (error.status === 400 && error.details?.field === 'email') {
        setError('email', { message: error.message }, { shouldFocus: true })
      } else if (error.status === 503) {
        toast.error(API_ERROR_MESSAGE.PASSWORD_RESET_EMAIL_UNAVAILABLE)
      } else {
        toast.error(error.message)
      }
      return
    }

    onRequested(email)
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
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

      <Button className="h-11 w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Đang gửi…
          </>
        ) : (
          <>
            Gửi hướng dẫn
            <ArrowRight aria-hidden="true" className="size-4" />
          </>
        )}
      </Button>
    </form>
  )
}

export default ForgotPasswordForm
