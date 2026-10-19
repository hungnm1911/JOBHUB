import { useNavigate } from 'react-router-dom'

import { useAppDispatch } from '@/store/hooks'
import { FLASH_MESSAGE_TYPE } from '@/utils/constant'

import { registerCompanyManagerThunk } from '../services/authentication-thunks'
import AccountRegistrationForm from './AccountRegistrationForm'

const fieldCopy = {
  fullNameLabel: 'Họ và tên người quản lý',
  emailLabel: 'Địa chỉ email công ty',
  emailPlaceholder: 'minh.nguyen@company.vn',
}

function CompanyManagerRegistrationForm() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  return (
    <AccountRegistrationForm
      fieldCopy={fieldCopy}
      onRegister={(registration) =>
        dispatch(registerCompanyManagerThunk(registration)).unwrap()
      }
      onRegistered={() =>
        navigate('/onboarding/company', {
          replace: true,
          state: {
            flash: {
              type: FLASH_MESSAGE_TYPE.SUCCESS,
              title: 'Đăng ký thành công',
              message: 'Hãy hoàn thiện hồ sơ doanh nghiệp để kích hoạt tài khoản.',
            },
          },
        })
      }
    />
  )
}

export default CompanyManagerRegistrationForm
