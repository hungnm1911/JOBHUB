import { useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import RecruiterPageHeader from '@/features/recruiter-workspace/components/RecruiterPageHeader'
import RecruiterNotificationList from '@/features/recruiter-workspace/components/RecruiterNotificationList'
import useRecruiterNotifications from '@/features/recruiter-workspace/hooks/useRecruiterNotifications'
import {
  getRecruiterNotificationDestination,
  readNotificationSearch,
  toNotificationSearchParams,
} from '@/features/recruiter-workspace/notification-utils'

function RecruiterNotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { refreshUnreadCount } = useOutletContext()
  const navigate = useNavigate()
  const search = useMemo(() => readNotificationSearch(searchParams), [searchParams])
  const { notifications, pagination, loading, error, reload, markOpened } =
    useRecruiterNotifications(search)
  const [busyId, setBusyId] = useState(null)

  // Filter changes replace history and return to page 1; paging adds a history entry.
  const changeFilters = (patch) =>
    setSearchParams(toNotificationSearchParams({ ...search, ...patch, page: 1 }), { replace: true })

  const handleOpen = async (notification) => {
    const destination = getRecruiterNotificationDestination(notification)
    setBusyId(notification.id)
    try {
      if (!notification.readAt) {
        await markOpened(notification.id)
        refreshUnreadCount()
      }
      if (destination) navigate(destination)
    } catch {
      toast.error('Không mở được thông báo. Vui lòng thử lại.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <RecruiterPageHeader title="Thông báo" />
      <RecruiterNotificationList
        busyId={busyId}
        error={error}
        loading={loading}
        notifications={notifications}
        onClearFilters={() => setSearchParams(new URLSearchParams())}
        onOpen={handleOpen}
        onPageChange={(page) => setSearchParams(toNotificationSearchParams({ ...search, page }))}
        onRetry={reload}
        onSearchChange={changeFilters}
        pagination={pagination}
        search={search}
      />
    </div>
  )
}

export default RecruiterNotificationsPage
