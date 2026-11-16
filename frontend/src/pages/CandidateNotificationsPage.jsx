import { useEffect, useState } from 'react'

import { listOwnNotificationsApi } from '@/apis/notification.api'
import CandidateResourceListPage from '@/features/candidate-dashboard/components/CandidateResourceListPage'
import {
  formatRelativeTime,
  normalizeNotification,
} from '@/features/candidate-dashboard/utils'
import { cn } from '@/lib/utils'

function CandidateNotificationsPage() {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({ key: null, notifications: [], unreadCount: 0, error: null })

  useEffect(() => {
    let active = true
    const key = String(loadAttempt)

    listOwnNotificationsApi().then(
      (response) => {
        if (active) {
          setView({
            key,
            notifications: (response.notifications ?? []).map(normalizeNotification).filter(Boolean),
            unreadCount: response.unreadCount ?? 0,
            error: null,
          })
        }
      },
      (error) => {
        if (active) {
          setView({ key, notifications: [], unreadCount: 0, error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [loadAttempt])

  return (
    <CandidateResourceListPage
      count={view.notifications.length}
      description={
        view.unreadCount > 0
          ? `Bạn có ${view.unreadCount} thông báo chưa đọc.`
          : 'Các cập nhật liên quan đến đơn, lời mời và tài khoản.'
      }
      emptyDescription="Khi có cập nhật về đơn ứng tuyển, lời mời hoặc tin nhắn, chúng sẽ xuất hiện tại đây."
      emptyTitle="Chưa có thông báo"
      error={view.error}
      loading={view.key !== String(loadAttempt)}
      onRetry={() => setLoadAttempt((current) => current + 1)}
      title="Thông báo"
    >
      <ul className="space-y-3">
        {view.notifications.map((notification) => {
          const unread = !notification.readAt
          return (
            <li
              className={cn(
                'rounded-xl border px-4 py-3',
                unread ? 'border-primary/20 bg-primary/5' : 'bg-card',
              )}
              key={notification.id}
            >
              <p className="text-sm">{notification.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatRelativeTime(notification.createdAt)}
                {unread ? ' · Chưa đọc' : ' · Đã đọc'}
              </p>
            </li>
          )
        })}
      </ul>
    </CandidateResourceListPage>
  )
}

export default CandidateNotificationsPage
