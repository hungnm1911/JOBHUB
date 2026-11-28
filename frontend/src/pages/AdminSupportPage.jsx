import { useParams } from 'react-router-dom'
import AdminSupportInbox from '@/features/company-support/components/AdminSupportInbox'
import CompanySupportConversation from '@/features/company-support/components/CompanySupportConversation'
function AdminSupportPage() {
  const { companyId } = useParams()
  return companyId ? (
    <CompanySupportConversation companyId={companyId} isAdmin key={companyId} />
  ) : (
    <AdminSupportInbox />
  )
}
export default AdminSupportPage
