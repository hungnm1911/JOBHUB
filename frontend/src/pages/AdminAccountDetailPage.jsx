import { useParams } from 'react-router-dom'
import AdminAccountDetail from '@/features/admin-management/components/AdminAccountDetail'
function AdminAccountDetailPage() {
  const { userId } = useParams()
  return <AdminAccountDetail userId={userId} key={userId} />
}
export default AdminAccountDetailPage
