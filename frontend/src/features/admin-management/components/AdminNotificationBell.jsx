import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getOwnUnreadNotificationCountApi } from '@/apis/notification.api'
import useAdminResource from '../hooks/useAdminResource'
function AdminNotificationBell({ to = '/admin/notifications' }) {
  const viewer = useSessionViewer()
  const resource = useAdminResource(
    getOwnUnreadNotificationCountApi,
    viewer.userId,
  )
  const count = resource.data?.unreadCount
  return (
    <Link
      aria-label={`Thông báo${count === undefined ? '' : `, ${count} chưa đọc`}`}
      className="relative inline-flex min-h-10 items-center gap-2 rounded-md border bg-card px-3 text-sm hover:bg-secondary"
      title={
        resource.error
          ? 'Không thể tải số thông báo, mở để thử lại'
          : 'Thông báo'
      }
      to={to}
    >
      <Bell aria-hidden="true" className="size-4" />
      <span className="hidden sm:inline">Thông báo</span>
      {count > 0 && (
        <span className="rounded-md bg-primary px-1.5 text-xs leading-5 text-primary-foreground">
          {count > 99 ? '99+' : count}
        </span>
      )}
      {resource.error && <span aria-label="Lỗi tải số chưa đọc">!</span>}
    </Link>
  )
}
export default AdminNotificationBell
