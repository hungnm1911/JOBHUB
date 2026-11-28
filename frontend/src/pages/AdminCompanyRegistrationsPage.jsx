import { useSearchParams } from 'react-router-dom'

import CompanyRegistrationList from '@/features/company-registration-review/components/CompanyRegistrationList'
import { isRegistrationStage } from '@/features/company-registration-review/utils'

const REGISTRATIONS_PATH = '/admin/company-registrations'

function AdminCompanyRegistrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedStage = searchParams.get('stage')

  return (
    <CompanyRegistrationList
      detailPath={(companyId) =>
        `${REGISTRATIONS_PATH}/${encodeURIComponent(companyId)}`
      }
      onStageChange={(stage) =>
        setSearchParams(stage ? { stage } : {}, { replace: true })
      }
      stage={isRegistrationStage(requestedStage) ? requestedStage : null}
    />
  )
}

export default AdminCompanyRegistrationsPage
