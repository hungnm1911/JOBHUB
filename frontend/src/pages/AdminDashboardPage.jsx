import SessionAccountCard from '@/features/authentication/components/SessionAccountCard'
import CompanyRegistrationOverview from '@/features/company-registration-review/components/CompanyRegistrationOverview'

const REGISTRATIONS_PATH = '/admin/company-registrations'

function AdminDashboardPage() {
  return (
    <CompanyRegistrationOverview
      accountPanel={
        <SessionAccountCard
          logoutMessage="Đăng nhập lại để tiếp tục quản trị JOBHUB."
          roleLabel="Platform Admin"
        />
      }
      detailPath={(companyId) => `${REGISTRATIONS_PATH}/${encodeURIComponent(companyId)}`}
      listPath={(stage) => `${REGISTRATIONS_PATH}?stage=${encodeURIComponent(stage)}`}
    />
  )
}

export default AdminDashboardPage
