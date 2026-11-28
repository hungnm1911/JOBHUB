import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listOwnNotificationsApi,
  openOwnNotificationApi,
} from '@/apis/notification.api'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { NOTIFICATION_TYPE, NOTIFICATION_READ_EVENT } from '@/utils/constant'
import useAdminList from '../hooks/useAdminList'
import { AdminState, AdminPager, AdminToolbar, AdminSelect } from './AdminUi'
const spec = {
  q: 'text',
  limit: ['20', '10', '50', '100'],
  readState: ['', 'UNREAD', 'READ'],
  type: ['', ...Object.values(NOTIFICATION_TYPE)],
}
function AdminNotifications({ isManager = false }) {
  const { resource, search, setFilters, setPage } = useAdminList(
    spec,
    listOwnNotificationsApi,
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const submitting = useRef(false)
  const open = async (item) => {
    if (submitting.current) return
    submitting.current = true
    setBusy(item._id)
    setError('')
    try {
      await openOwnNotificationApi(item._id)
      window.dispatchEvent(new Event(NOTIFICATION_READ_EVENT))
      resource.reload()
    } catch (failure) {
      setError(failure.message)
    } finally {
      submitting.current = false
      setBusy(null)
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Thông báo của bạn"
        description={
          resource.data
            ? `${resource.data.unreadCount} thông báo chưa đọc`
            : 'Hộp thư thông báo trên JOBHUB'
        }
      />
      <AdminToolbar {...{ search, setFilters }} reload={resource.reload}>
        <AdminSelect
          label="Trạng thái đọc"
          value={search.readState}
          onChange={(readState) => setFilters({ readState })}
          options={[
            ['', 'Tất cả'],
            ['UNREAD', 'Chưa đọc'],
            ['READ', 'Đã đọc'],
          ]}
        />
        <AdminSelect
          label="Loại thông báo"
          value={search.type}
          onChange={(type) => setFilters({ type })}
          options={[
            ['', 'Tất cả'],
            [NOTIFICATION_TYPE.PLATFORM_ANNOUNCEMENT, 'Thông báo hệ thống'],
            [NOTIFICATION_TYPE.COMPANY_SUBMITTED, 'Hồ sơ mới'],
            [NOTIFICATION_TYPE.SUPPORT_MESSAGE_CREATED, 'Hỗ trợ doanh nghiệp'],
          ]}
        />
      </AdminToolbar>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <AdminState resource={resource}>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {resource.data?.notifications.map((item) => (
            <li
              className={`space-y-3 p-5 ${!item.readAt ? 'bg-primary/5' : ''}`}
              key={item._id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString('vi-VN')} ·{' '}
                  {item.readAt ? 'Đã đọc' : 'Chưa đọc'}
                </span>
                {!item.readAt && (
                  <Button
                    disabled={busy !== null}
                    onClick={() => open(item)}
                    size="sm"
                    variant="outline"
                  >
                    {busy === item._id ? 'Đang mở…' : 'Đánh dấu đã đọc'}
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                {item.content}
              </p>
              {item.type === NOTIFICATION_TYPE.COMPANY_SUBMITTED &&
                !isManager && (
                  <Link
                    className="inline-block text-sm text-primary"
                    to={`/admin/company-registrations/${item.companyId}`}
                  >
                    Mở hồ sơ xét duyệt →
                  </Link>
                )}
              {item.type === NOTIFICATION_TYPE.SUPPORT_MESSAGE_CREATED && (
                <Link
                  className="inline-block text-sm text-primary"
                  to={
                    isManager
                      ? '/company/support'
                      : `/admin/support/${item.companyId}`
                  }
                >
                  Mở hội thoại hỗ trợ →
                </Link>
              )}
            </li>
          ))}
        </ul>
        {!resource.data?.notifications.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Chưa có thông báo phù hợp.
          </p>
        )}
        <AdminPager
          pagination={resource.data?.pagination}
          onPageChange={setPage}
        />
      </AdminState>
    </div>
  )
}
export default AdminNotifications
