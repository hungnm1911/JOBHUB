import AdminNotifications from '@/features/admin-management/components/AdminNotifications'
import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
function AdminNotificationsPage() {
  const viewer = useSessionViewer()
  return <AdminNotifications key={viewer.userId} />
}
export default AdminNotificationsPage
