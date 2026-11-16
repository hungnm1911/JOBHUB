import { ChevronRight, LoaderCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

import {
  formatRelativeTime,
  getNotificationDestination,
  getNotificationTypeMeta,
} from '../utils'

function NotificationItem({ notification, busy = false, onOpen }) {
  const unread = !notification.readAt
  const meta = getNotificationTypeMeta(notification.type)
  const Icon = meta.icon
  const destination = getNotificationDestination(notification)
  const timeLabel = formatRelativeTime(notification.createdAt)

  return (
    <li>
      <button
        className={cn(
          'group flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors',
          unread
            ? 'border-primary/20 bg-primary/5 hover:bg-primary/8'
            : 'bg-card hover:bg-secondary/60',
          busy && 'opacity-70',
        )}
        disabled={busy}
        onClick={() => onOpen(notification)}
        type="button"
      >
        <span
          className={cn(
            'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl',
            meta.tone,
          )}
        >
          {busy ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Icon aria-hidden="true" className="size-4" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {meta.label}
              </span>
              {unread ? (
                <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Mới
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel}</span>
          </span>

          <span
            className={cn(
              'mt-1 block text-sm leading-5',
              unread ? 'font-medium text-foreground' : 'text-foreground/90',
            )}
          >
            {notification.content}
          </span>

          <span className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            {destination ? (
              <>
                <span>Mở chi tiết</span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 transition-transform group-hover:translate-x-0.5"
                />
              </>
            ) : (
              <span>{unread ? 'Đánh dấu đã đọc' : 'Đã đọc'}</span>
            )}
          </span>
        </span>

        {unread ? (
          <span
            aria-hidden="true"
            className="mt-2 size-2 shrink-0 rounded-full bg-primary"
          />
        ) : (
          <span aria-hidden="true" className="mt-2 size-2 shrink-0" />
        )}
      </button>
    </li>
  )
}

export default NotificationItem
