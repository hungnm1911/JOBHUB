import { KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { changePasswordApi } from '@/apis/authentication.api'
import { Button } from '@/components/ui/button'
import {
  AuthFormField,
  PasswordVisibilityToggle,
} from '@/features/authentication/components/AuthFormFields'
import { endSessionAfterPasswordReset } from '@/features/authentication/services/authentication.service'
import { ACCOUNT_FIELD_LIMIT, FLASH_MESSAGE_TYPE } from '@/utils/constant'
import { changePasswordSchema, zodResolver } from '@/validation'

import ProfileModal from './ProfileModal'

function ChangePasswordModal({ onClose }) {
  const navigate = useNavigate()
  const [visiblePasswords, setVisiblePasswords] = useState({
    currentPassword: false,
    password: false,
    confirmPassword: false,
  })
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm({
    defaultValues: {
      currentPassword: '',
      password: '',
      confirmPassword: '',
    },
    resolver: zodResolver(changePasswordSchema),
  })

  const togglePassword = (field) => {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }))
  }

  const onSubmit = async ({ currentPassword, password }) => {
    try {
      await changePasswordApi({ currentPassword, password })
    } catch (error) {
      const field = error.details?.field
      if (
        error.status === 400 &&
        (field === 'currentPassword' || /current password/i.test(error.message || ''))
      ) {
        setError(
          'currentPassword',
          { message: 'Mật khẩu hiện tại không chính xác.' },
          { shouldFocus: true },
        )
      } else if (error.status === 400 && field === 'password') {
        setError('password', { message: error.message }, { shouldFocus: true })
      } else {
        toast.error(error.message || 'Không đổi được mật khẩu.')
      }
      return
    }

    await endSessionAfterPasswordReset()
    onClose()
    navigate('/login', {
      replace: true,
      state: {
        flash: {
          type: FLASH_MESSAGE_TYPE.SUCCESS,
          title: 'Đổi mật khẩu thành công',
          message:
            'Mật khẩu mới đã có hiệu lực. Các phiên đăng nhập hiện tại đã bị thu hồi, vui lòng đăng nhập lại.',
        },
      },
    })
  }

  return (
    <ProfileModal
      busy={isSubmitting}
      description="Sau khi đổi mật khẩu, toàn bộ phiên đăng nhập hiện có sẽ được thu hồi để bảo mật và bạn cần đăng nhập lại."
      footer={
        <>
          <Button disabled={isSubmitting} onClick={onClose} type="button" variant="outline">
            Hủy
          </Button>
          <Button disabled={isSubmitting} form="candidate-change-password-form" type="submit">
            {isSubmitting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
            Cập nhật mật khẩu
          </Button>
        </>
      }
      onClose={onClose}
      title="Đổi mật khẩu"
    >
      <form
        className="space-y-4"
        id="candidate-change-password-form"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
      >
        <AuthFormField
          error={errors.currentPassword}
          icon={KeyRound}
          inputProps={{
            autoComplete: 'current-password',
            placeholder: 'Nhập mật khẩu hiện tại',
            type: visiblePasswords.currentPassword ? 'text' : 'password',
            ...register('currentPassword'),
          }}
          label="Mật khẩu hiện tại"
          trailing={
            <PasswordVisibilityToggle
              onToggle={() => togglePassword('currentPassword')}
              visible={visiblePasswords.currentPassword}
            />
          }
        />

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
            placeholder: 'Nhập lại mật khẩu mới',
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
      </form>
    </ProfileModal>
  )
}

export default ChangePasswordModal
