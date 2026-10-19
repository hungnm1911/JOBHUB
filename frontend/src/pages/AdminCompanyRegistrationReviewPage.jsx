import { useParams } from 'react-router-dom'

import SessionAccountCard from '@/features/authentication/components/SessionAccountCard'
import CompanyRegistrationReview from '@/features/company-registration-review/components/CompanyRegistrationReview'

function AdminCompanyRegistrationReviewPage() {
  const { companyId } = useParams()

  return (
    <CompanyRegistrationReview
      accountPanel={
        <SessionAccountCard
          logoutMessage="Đăng nhập lại để tiếp tục quản trị JOBHUB."
          roleLabel="Platform Admin"
        />
      }
      companyId={companyId}
      listPath="/admin/company-registrations"
    />
  )
}

export default AdminCompanyRegistrationReviewPage
