import CompanyRegistrationOverview from '@/features/company-registration-review/components/CompanyRegistrationOverview'

const REGISTRATIONS_PATH = '/admin/company-registrations'

function AdminDashboardPage() {
  return (
    <CompanyRegistrationOverview
      detailPath={(companyId) =>
        `${REGISTRATIONS_PATH}/${encodeURIComponent(companyId)}`
      }
      listPath={(stage) =>
        `${REGISTRATIONS_PATH}?stage=${encodeURIComponent(stage)}`
      }
    />
  )
}

export default AdminDashboardPage
