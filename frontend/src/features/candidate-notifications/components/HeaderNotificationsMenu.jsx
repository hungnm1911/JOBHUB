import { Bell, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

import useCandidateNotifications from '../hooks/useCandidateNotifications'
import {
  formatRelativeTime,
  getNotificationDestination,
  getNotificationTypeMeta,
} from '../utils'

const PREVIEW_LIMIT = 8

function HeaderNotificationsMenu() {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const { loading, notifications, unreadCount, error, reload, markOpened } =
    useCandidateNotifications()

  const previewItems = useMemo(
    () => notifications.slice(0, PREVIEW_LIMIT),
    [notifications],
  )

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const closeOnOutsidePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const handleOpenNotification = async (notification) => {
    if (!notification?.id || busyId) {
      return
    }

    const destination = getNotificationDestination(notification)
    setBusyId(notification.id)

    try {
      if (!notification.readAt) {
        await markOpened(notification.id)
      }
      setOpen(false)
      if (destination) {
        navigate(destination)
      }
    } catch (openError) {
      toast.error(openError.message || 'Không mở được thông báo.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={
          unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : 'Thông báo'
        }
        className={cn(
          'relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
          open && 'bg-primary/10 text-primary',
        )}
        onClick={() => setOpen((current) => !current)}
        title="Thông báo"
        type="button"
      >
        <Bell aria-hidden="true" className="size-[18px]" />
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg ring-1 ring-border/40"
          role="menu"
        >
          <div className="flex items-center justify-between gap-3 border-b px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Thông báo</p>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} chưa đọc`
                  : 'Không có thông báo mới'}
              </p>
            </div>
            {error ? (
              <button
                className="text-xs font-medium text-primary hover:underline"
                onClick={reload}
                type="button"
              >
                Thử lại
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                Đang tải…
              </div>
            ) : null}

            {!loading && error ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Không tải được thông báo.
              </div>
            ) : null}

            {!loading && !error && previewItems.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Chưa có thông báo
              </div>
            ) : null}

            {!loading && !error && previewItems.length > 0 ? (
              <ul className="divide-y">
                {previewItems.map((notification) => {
                  const unread = !notification.readAt
                  const meta = getNotificationTypeMeta(notification.type)
                  const Icon = meta.icon
                  const busy = busyId === notification.id

                  return (
                    <li key={notification.id}>
                      <button
                        className={cn(
                          'flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition-colors outline-none hover:bg-secondary/70 focus-visible:bg-secondary',
                          unread && 'bg-primary/[0.04]',
                          busy && 'opacity-70',
                        )}
                        disabled={busy}
                        onClick={() => handleOpenNotification(notification)}
                        role="menuitem"
                        type="button"
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                            meta.tone,
                          )}
                        >
                          {busy ? (
                            <LoaderCircle
                              aria-hidden="true"
                              className="size-3.5 animate-spin"
                            />
                          ) : (
                            <Icon aria-hidden="true" className="size-3.5" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                              {meta.label}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {formatRelativeTime(notification.createdAt)}
                            </span>
                          </span>
                          <span
                            className={cn(
                              'mt-0.5 line-clamp-2 text-sm leading-5',
                              unread ? 'font-medium text-foreground' : 'text-foreground/90',
                            )}
                          >
                            {notification.content}
                          </span>
                        </span>
                        {unread ? (
                          <span
                            aria-hidden="true"
                            className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                          />
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>

          <div className="border-t p-1.5">
            <Link
              className="flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors outline-none hover:bg-primary/5 focus-visible:bg-primary/5"
              onClick={() => setOpen(false)}
              to="/candidate/notifications"
            >
              Xem tất cả thông báo
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default HeaderNotificationsMenu
