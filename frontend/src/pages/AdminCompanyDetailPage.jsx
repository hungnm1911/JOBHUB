import { useParams } from 'react-router-dom'
import AdminCompanyDetail from '@/features/admin-management/components/AdminCompanyDetail'
function AdminCompanyDetailPage() {
  const { companyId } = useParams()
  return <AdminCompanyDetail companyId={companyId} key={companyId} />
}
export default AdminCompanyDetailPage
