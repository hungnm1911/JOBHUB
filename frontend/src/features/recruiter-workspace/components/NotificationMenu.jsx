import { Bell, LoaderCircle } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import {
  formatRelativeTime,
  getNotificationTypeMeta,
} from '@/features/candidate-notifications/utils'
import { cn } from '@/lib/utils'

import useRecruiterNotifications from '../hooks/useRecruiterNotifications'
import {
  getRecruiterNotificationDestination,
  readNotificationSearch,
} from '../notification-utils'

const PREVIEW_LIMIT = 8
const LATEST_SEARCH = readNotificationSearch(new URLSearchParams())

function PreviewRow({ notification, busy, onOpen }) {
  const meta = getNotificationTypeMeta(notification.type)
  const Icon = meta.icon
  const unread = !notification.readAt
  const openable = unread || Boolean(getRecruiterNotificationDestination(notification))
  const Row = openable ? 'button' : 'div'

  return (
    <li>
      <Row
        className={cn(
          'flex w-full items-start gap-2.5 px-3.5 py-3 text-left',
          openable &&
            'transition-colors outline-none hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-70',
          unread && 'bg-primary/5',
        )}
        {...(openable && { disabled: busy, onClick: () => onOpen(notification), type: 'button' })}
      >
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', meta.tone)}>
          {busy ? (
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" />
          ) : (
            <Icon aria-hidden="true" className="size-3.5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-medium">{meta.label}</span>
            <span className="shrink-0 tabular-nums">{formatRelativeTime(notification.createdAt)}</span>
          </span>
          <span className={cn('mt-0.5 line-clamp-2 text-sm break-words', unread && 'font-semibold')}>
            {notification.content}
          </span>
        </span>
        {unread && (
          <span className="mt-2 size-2 shrink-0 rounded-full bg-primary">
            <span className="sr-only">Chưa đọc</span>
          </span>
        )}
      </Row>
    </li>
  )
}

// Mounted only while open, so every opening reads the latest notifications.
function NotificationPanel({ id, unreadCount, onClose, onRead }) {
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState(null)
  const { loading, notifications, error, reload, markOpened } =
    useRecruiterNotifications(LATEST_SEARCH)
  const preview = notifications.slice(0, PREVIEW_LIMIT)

  const handleOpen = async (notification) => {
    if (busyId) return
    const destination = getRecruiterNotificationDestination(notification)
    setBusyId(notification.id)
    try {
      if (!notification.readAt) {
        await markOpened(notification.id)
        onRead()
      }
      if (destination) {
        onClose()
        navigate(destination)
      }
    } catch {
      toast.error('Không mở được thông báo. Vui lòng thử lại.')
    } finally {
      setBusyId(null)
    }
  }

  let body
  if (loading) {
    body = (
      <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground" role="status">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        Đang tải…
      </p>
    )
  } else if (error) {
    body = (
      <div className="space-y-2 px-4 py-8 text-center text-sm text-muted-foreground">
        <p>
          {error.status === 403
            ? 'Tài khoản của bạn hiện không được xem thông báo.'
            : 'Không tải được thông báo.'}
        </p>
        <button
          className="rounded-md px-2 py-1 font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          onClick={reload}
          type="button"
        >
          Thử lại
        </button>
      </div>
    )
  } else if (preview.length === 0) {
    body = <p className="px-4 py-10 text-center text-sm text-muted-foreground">Chưa có thông báo</p>
  } else {
    body = (
      <ul className="divide-y">
        {preview.map((notification) => (
          <PreviewRow
            busy={busyId === notification.id}
            key={notification.id}
            notification={notification}
            onOpen={handleOpen}
          />
        ))}
      </ul>
    )
  }

  // Below `sm` the panel spans the header, because the bell is not at the screen edge.
  return (
    <div
      aria-label="Thông báo"
      className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg ring-1 ring-border/40 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96"
      id={id}
      role="region"
    >
      <div className="border-b px-3.5 py-3">
        <p className="text-sm font-semibold">Thông báo</p>
        {unreadCount !== null && (
          <p className="text-xs text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Không có thông báo chưa đọc'}
          </p>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">{body}</div>
      <div className="border-t p-1.5">
        <Link
          className="flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors outline-none hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClose}
          to="/recruiter/notifications"
        >
          Xem tất cả thông báo
        </Link>
      </div>
    </div>
  )
}

function NotificationMenu({ unreadCount, onRead }) {
  const panelId = useId()
  const containerRef = useRef(null)
  const buttonRef = useRef(null)
  const [open, setOpen] = useState(false)
  const label = unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutsidePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-label={label}
        className={cn(
          'relative flex size-10 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
          open && 'border-primary/40 bg-primary/10 text-primary',
        )}
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        title={label}
        type="button"
      >
        <Bell aria-hidden="true" className="size-4" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-primary-foreground tabular-nums"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <NotificationPanel
          id={panelId}
          onClose={() => setOpen(false)}
          onRead={onRead}
          unreadCount={unreadCount}
        />
      )}
    </div>
  )
}

export default NotificationMenu
