import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

import DashboardSectionHeader from './DashboardSectionHeader'
import { formatRelativeTime } from '../utils'

function NotificationsPanel({ notifications, unreadCount }) {
  const items = notifications.slice(0, 5)

  return (
    <section className="rounded-xl border bg-card p-5">
      <DashboardSectionHeader
        actionLabel="Xem tất cả"
        actionTo="/candidate/notifications"
        title="Thông báo mới nhất"
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/40 px-3 py-8 text-center">
          <Bell aria-hidden="true" className="size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Chưa có thông báo</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((notification) => {
            const unread = !notification.readAt
            return (
              <li
                className={cn(
                  'rounded-lg border px-3 py-2.5',
                  unread ? 'border-primary/20 bg-primary/5' : 'bg-card',
                )}
                key={notification.id}
              >
                <p className="text-sm leading-5">{notification.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatRelativeTime(notification.createdAt)}
                  {unread ? ' · Chưa đọc' : null}
                </p>
              </li>
            )
          })}
        </ul>
      )}

      {unreadCount > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {unreadCount} thông báo chưa đọc.{' '}
          <Link className="font-medium text-primary hover:underline" to="/candidate/notifications">
            Xem tất cả thông báo
          </Link>
        </p>
      )}
    </section>
  )
}

export default NotificationsPanel
