import { useNavigate } from 'react-router-dom'

import { useAppDispatch } from '@/store/hooks'
import { API_ERROR_MESSAGE, FLASH_MESSAGE_TYPE } from '@/utils/constant'

import { registerCandidateThunk } from '../services/authentication-thunks'
import AccountRegistrationForm from './AccountRegistrationForm'

const fieldCopy = {
  fullNameLabel: 'Họ và tên',
  emailLabel: 'Email',
  emailPlaceholder: 'minh.nguyen@email.com',
}

function CandidateRegistrationForm() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  return (
    <AccountRegistrationForm
      fieldCopy={fieldCopy}
      onRegister={(registration) =>
        dispatch(registerCandidateThunk(registration)).unwrap()
      }
      onRegistered={({ registration }) =>
        navigate('/login', {
          state: {
            registeredEmail: registration.email,
            flash: {
              type: FLASH_MESSAGE_TYPE.SUCCESS,
              title: 'Đăng ký thành công. Đã gửi email xác thực',
              message: `Chúng tôi đã gửi liên kết xác thực tới ${registration.email}. Vui lòng xác thực email trước khi đăng nhập.`,
            },
          },
        })
      }
      serviceUnavailableMessage={API_ERROR_MESSAGE.VERIFICATION_EMAIL_UNAVAILABLE}
    />
  )
}

export default CandidateRegistrationForm
