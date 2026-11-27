import { useNavigate } from 'react-router-dom'

import PageHeader from '@/components/common/PageHeader'
import RecruiterForm from '@/features/company-management/components/RecruiterForm'
import { FLASH_MESSAGE_TYPE } from '@/utils/constant'

export default function CompanyRecruiterCreatePage() {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      <PageHeader
        description="Gửi email để nhân viên tự thiết lập mật khẩu."
        title="Tạo Recruiter"
      />
      <RecruiterForm
        onSaved={(recruiter) =>
          navigate(`/company/recruiters/${recruiter.id}`, {
            state: {
              flash: {
                type: FLASH_MESSAGE_TYPE.SUCCESS,
                title: 'Đã tạo Recruiter',
                message: 'Email kích hoạt đã được gửi trực tiếp tới Recruiter.',
              },
            },
          })
        }
      />
    </div>
  )
}
