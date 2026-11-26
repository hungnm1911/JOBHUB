import { useNavigate } from 'react-router-dom'

import ChangePasswordForm from '@/features/authentication/components/ChangePasswordForm'
import RecruiterPageHeader from '@/features/recruiter-workspace/components/RecruiterPageHeader'
import { FLASH_MESSAGE_TYPE } from '@/utils/constant'

function RecruiterChangePasswordPage() {
  const navigate = useNavigate()

  return (
    <div className="w-full max-w-md space-y-5">
      <RecruiterPageHeader
        description="Sau khi đổi, mọi phiên đăng nhập bị thu hồi và bạn cần đăng nhập lại."
        title="Đổi mật khẩu"
      />
      <div className="rounded-xl border bg-card p-5 shadow-xs sm:p-6">
        <ChangePasswordForm
          onChanged={() =>
            navigate('/login', {
              replace: true,
              state: {
                flash: {
                  type: FLASH_MESSAGE_TYPE.SUCCESS,
                  title: 'Đổi mật khẩu thành công',
                  message: 'Hãy đăng nhập lại bằng mật khẩu mới.',
                },
              },
            })
          }
        />
      </div>
    </div>
  )
}

export default RecruiterChangePasswordPage
