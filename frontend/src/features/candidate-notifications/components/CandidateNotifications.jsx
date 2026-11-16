import {
  Bell,
  BellRing,
  CircleCheck,
  CircleX,
  LoaderCircle,
  RotateCw,
  Search,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import useCandidateNotifications from '../hooks/useCandidateNotifications'
import {
  NOTIFICATION_LIST_FILTER,
  NOTIFICATION_LIST_FILTER_LABEL,
  computeNotificationStats,
  getNotificationDestination,
  matchesNotificationFilter,
  matchesNotificationSearch,
} from '../utils'
import NotificationItem from './NotificationItem'

function StatPill({ label, value, tone = 'default' }) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3',
        tone === 'primary' ? 'border-primary/20 bg-primary/5' : 'bg-card',
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function CandidateNotifications() {
  const navigate = useNavigate()
  const { loading, notifications, unreadCount, error, reload, markOpened } =
    useCandidateNotifications()
  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState(NOTIFICATION_LIST_FILTER.ALL)
  const [busyId, setBusyId] = useState(null)

  const stats = useMemo(() => computeNotificationStats(notifications), [notifications])

  const filterCounts = useMemo(() => {
    const counts = Object.fromEntries(
      Object.values(NOTIFICATION_LIST_FILTER).map((option) => [option, 0]),
    )
    counts[NOTIFICATION_LIST_FILTER.ALL] = notifications.length
    for (const notification of notifications) {
      for (const option of Object.values(NOTIFICATION_LIST_FILTER)) {
        if (
          option !== NOTIFICATION_LIST_FILTER.ALL &&
          matchesNotificationFilter(notification, option)
        ) {
          counts[option] += 1
        }
      }
    }
    return counts
  }, [notifications])

  const visibleNotifications = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          matchesNotificationFilter(notification, filter) &&
          matchesNotificationSearch(notification, searchInput),
      ),
    [notifications, filter, searchInput],
  )

  const handleOpen = async (notification) => {
    if (!notification?.id || busyId) {
      return
    }

    const destination = getNotificationDestination(notification)
    setBusyId(notification.id)

    try {
      if (!notification.readAt) {
        await markOpened(notification.id)
      }
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
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border bg-card">
        <div className="bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_55%)] px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Bell aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                    Cập nhật
                  </p>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Thông báo</h1>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Theo dõi cập nhật đơn ứng tuyển, lời mời, lịch phỏng vấn và tin nhắn từ nhà tuyển
                dụng.
              </p>
            </div>

            <Button onClick={reload} type="button" variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Làm mới
            </Button>
          </div>

          {!loading && !error ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatPill label="Tổng thông báo" value={stats.total} />
              <StatPill label="Chưa đọc" tone="primary" value={unreadCount} />
              <StatPill label="Đã đọc" value={stats.read} />
            </div>
          ) : null}

          {!loading && !error && unreadCount > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/15 bg-background/80 px-4 py-3 text-sm">
              <BellRing aria-hidden="true" className="size-4 text-primary" />
              <span className="text-muted-foreground">Bạn còn</span>
              <span className="font-medium">{unreadCount} thông báo chưa đọc</span>
            </div>
          ) : null}
        </div>
      </section>

      {loading ? (
        <CenteredState
          icon={LoaderCircle}
          spinning
          title="Đang tải thông báo…"
          tone="bg-primary/10 text-primary"
        />
      ) : null}

      {!loading && error ? (
        <CenteredState
          action={
            <Button onClick={reload} variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          }
          description={error.message || 'Không tải được danh sách thông báo.'}
          icon={CircleX}
          title="Không tải được thông báo"
          tone="bg-secondary text-muted-foreground"
        />
      ) : null}

      {!loading && !error && notifications.length === 0 ? (
        <CenteredState
          description="Khi có cập nhật về đơn, lời mời, phỏng vấn hoặc tin nhắn, chúng sẽ xuất hiện tại đây."
          icon={Bell}
          title="Chưa có thông báo"
          tone="bg-secondary text-muted-foreground"
        />
      ) : null}

      {!loading && !error && notifications.length > 0 ? (
        <section className="space-y-4">
          <div className="rounded-2xl border bg-card p-3 sm:p-4">
            <label className="relative block">
              <span className="sr-only">Tìm thông báo</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                className="h-11 w-full rounded-xl border-0 bg-secondary/80 pr-10 pl-10 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm nội dung hoặc loại thông báo…"
                value={searchInput}
              />
              {searchInput ? (
                <Button
                  aria-label="Xóa tìm kiếm"
                  className="absolute top-1/2 right-1.5 size-8 -translate-y-1/2"
                  onClick={() => setSearchInput('')}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              ) : null}
            </label>

            <div
              aria-label="Lọc thông báo"
              className="mt-3 flex flex-wrap items-center gap-1.5"
              role="toolbar"
            >
              {Object.values(NOTIFICATION_LIST_FILTER).map((option) => {
                const active = filter === option
                return (
                  <button
                    aria-pressed={active}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                    )}
                    key={option}
                    onClick={() => setFilter(option)}
                    type="button"
                  >
                    <span>{NOTIFICATION_LIST_FILTER_LABEL[option]}</span>
                    <span
                      className={cn(
                        'inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                        active
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-background/80 text-muted-foreground',
                      )}
                    >
                      {filterCounts[option]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {visibleNotifications.length === 0 ? (
            <CenteredState
              description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm."
              icon={CircleCheck}
              title="Không có thông báo phù hợp"
              tone="bg-secondary text-muted-foreground"
            />
          ) : (
            <ul className="space-y-2.5">
              {visibleNotifications.map((notification) => (
                <NotificationItem
                  busy={busyId === notification.id}
                  key={notification.id}
                  notification={notification}
                  onOpen={handleOpen}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}

export default CandidateNotifications
