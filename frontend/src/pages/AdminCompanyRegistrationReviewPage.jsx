import { useParams } from 'react-router-dom'

import CompanyRegistrationReview from '@/features/company-registration-review/components/CompanyRegistrationReview'

function AdminCompanyRegistrationReviewPage() {
  const { companyId } = useParams()

  return (
    <CompanyRegistrationReview
      companyId={companyId}
      listPath="/admin/company-registrations"
    />
  )
}

export default AdminCompanyRegistrationReviewPage
