import AdminNotifications from '@/features/admin-management/components/AdminNotifications'
import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
function CompanyNotificationsPage() {
  const viewer = useSessionViewer()
  return <AdminNotifications isManager key={viewer.userId} />
}
export default CompanyNotificationsPage
