import { useSearchParams } from 'react-router-dom'

import SessionAccountCard from '@/features/authentication/components/SessionAccountCard'
import CompanyRegistrationList from '@/features/company-registration-review/components/CompanyRegistrationList'
import { isRegistrationStage } from '@/features/company-registration-review/utils'

const REGISTRATIONS_PATH = '/admin/company-registrations'

function AdminCompanyRegistrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedStage = searchParams.get('stage')

  return (
    <CompanyRegistrationList
      accountPanel={
        <SessionAccountCard
          logoutMessage="Đăng nhập lại để tiếp tục quản trị JOBHUB."
          roleLabel="Platform Admin"
        />
      }
      detailPath={(companyId) => `${REGISTRATIONS_PATH}/${encodeURIComponent(companyId)}`}
      onStageChange={(stage) => setSearchParams(stage ? { stage } : {}, { replace: true })}
      stage={isRegistrationStage(requestedStage) ? requestedStage : null}
    />
  )
}

export default AdminCompanyRegistrationsPage
