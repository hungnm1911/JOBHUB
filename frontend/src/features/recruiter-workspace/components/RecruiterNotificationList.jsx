import { Bell, CircleX, LoaderCircle, RotateCw, Search, SearchX } from 'lucide-react'
import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import {
  formatRelativeTime,
  getNotificationTypeMeta,
} from '@/features/candidate-notifications/utils'
import { cn } from '@/lib/utils'

import {
  NOTIFICATION_SEARCH_MAX_LENGTH,
  NOTIFICATION_SORT_OPTIONS,
  READ_STATE_OPTIONS,
  TYPE_OPTIONS,
  getRecruiterNotificationDestination,
} from '../notification-utils'
import { formatMoment } from '../utils'

function FilterBar({ search, onSearchChange }) {
  const searchId = useId()

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <label className="sr-only" htmlFor={searchId}>
          Tìm trong nội dung thông báo
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          className="h-10 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          id={searchId}
          maxLength={NOTIFICATION_SEARCH_MAX_LENGTH}
          onChange={(event) => onSearchChange({ keyword: event.target.value })}
          placeholder="Tìm trong nội dung thông báo..."
          type="search"
          value={search.keyword}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:flex lg:shrink-0">
        <SelectDropdown
          ariaLabel="Lọc theo trạng thái đọc"
          className="lg:w-36"
          onChange={(value) => onSearchChange({ readState: value })}
          options={READ_STATE_OPTIONS}
          value={search.readState}
        />
        <SelectDropdown
          ariaLabel="Lọc theo loại thông báo"
          className="lg:w-52"
          onChange={(value) => onSearchChange({ type: value })}
          options={TYPE_OPTIONS}
          value={search.type}
        />
        <SelectDropdown
          ariaLabel="Sắp xếp"
          className="lg:w-36"
          onChange={(value) => onSearchChange({ sort: value })}
          options={NOTIFICATION_SORT_OPTIONS}
          value={search.sort}
        />
      </div>
    </div>
  )
}

function RowContent({ notification, busy }) {
  const meta = getNotificationTypeMeta(notification.type)
  const Icon = meta.icon
  const unread = !notification.readAt

  return (
    <>
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', meta.tone)}>
        {busy ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Icon aria-hidden="true" className="size-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>
          {unread && (
            <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
              Chưa đọc
            </span>
          )}
        </span>
        <span
          className={cn(
            'mt-0.5 block text-sm break-words',
            unread ? 'font-semibold' : 'text-foreground/85',
          )}
        >
          {notification.content}
        </span>
      </span>
      {notification.createdAt && (
        <time
          className="shrink-0 text-xs text-muted-foreground tabular-nums"
          dateTime={notification.createdAt}
          title={formatMoment(notification.createdAt)}
        >
          {formatRelativeTime(notification.createdAt)}
        </time>
      )}
    </>
  )
}

// Opening a notification marks it read, then opens its screen when one exists.
function NotificationRow({ notification, busy, onOpen }) {
  const rowClass = 'flex w-full items-start gap-3 px-4 py-3.5 text-left'

  const destination = getRecruiterNotificationDestination(notification)

  if (notification.readAt && !destination) {
    return (
      <li className={rowClass}>
        <RowContent busy={busy} notification={notification} />
      </li>
    )
  }

  return (
    <li>
      <button
        aria-busy={busy}
        className={cn(
          rowClass,
          'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-70',
          notification.readAt ? 'hover:bg-secondary/60' : 'bg-primary/5 hover:bg-primary/10',
        )}
        disabled={busy}
        onClick={() => onOpen(notification)}
        title={destination ? 'Mở chi tiết' : 'Đánh dấu đã đọc'}
        type="button"
      >
        <RowContent busy={busy} notification={notification} />
      </button>
    </li>
  )
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải thông báo" className="divide-y" role="status">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="flex gap-3 px-4 py-4" key={index}>
          <div className="size-10 animate-pulse rounded-lg bg-secondary motion-reduce:animate-none" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ListMessage({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}

function Pagination({ pagination, onPageChange }) {
  const { page, total, totalPages } = pagination

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <p className="text-muted-foreground tabular-nums">Tổng cộng {total} thông báo</p>
      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center gap-2">
          <Button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            Trước
          </Button>
          <span className="tabular-nums">
            Trang {page} / {totalPages}
          </span>
          <Button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            Sau
          </Button>
        </nav>
      )}
    </div>
  )
}

function RecruiterNotificationList({
  search,
  notifications,
  pagination,
  loading,
  error,
  busyId,
  onOpen,
  onRetry,
  onSearchChange,
  onPageChange,
  onClearFilters,
}) {
  const hasFilters = Boolean(search.keyword || search.readState || search.type)

  let body
  if (loading) {
    body = <ListSkeleton />
  } else if (error) {
    body = (
      <ListMessage
        action={
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            <RotateCw aria-hidden="true" className="size-4" />
            Tải lại
          </Button>
        }
        description={
          error.status === 403
            ? 'Tài khoản của bạn hiện không được xem thông báo.'
            : 'Không tải được thông báo. Vui lòng thử lại.'
        }
        icon={CircleX}
        title="Chưa tải được thông báo"
      />
    )
  } else if (notifications.length === 0) {
    const outOfRange = (pagination?.total ?? 0) > 0
    let description = 'Thông báo về hồ sơ, lịch phỏng vấn, tin nhắn và lời mời sẽ hiện ở đây.'
    if (outOfRange) {
      description = 'Trang này không còn thông báo.'
    } else if (hasFilters) {
      description = 'Không có thông báo nào khớp với bộ lọc.'
    }
    body = (
      <ListMessage
        action={
          (hasFilters || outOfRange) && (
            <Button onClick={onClearFilters} size="sm" type="button" variant="outline">
              {hasFilters ? 'Xóa bộ lọc' : 'Về trang đầu'}
            </Button>
          )
        }
        description={description}
        icon={hasFilters ? SearchX : Bell}
        title={hasFilters || outOfRange ? 'Không có kết quả' : 'Chưa có thông báo'}
      />
    )
  } else {
    body = (
      <>
        <ul className="divide-y">
          {notifications.map((notification) => (
            <NotificationRow
              busy={busyId === notification.id}
              key={notification.id}
              notification={notification}
              onOpen={onOpen}
            />
          ))}
        </ul>
        {pagination && <Pagination onPageChange={onPageChange} pagination={pagination} />}
      </>
    )
  }

  return (
    <div className="space-y-4">
      <FilterBar onSearchChange={onSearchChange} search={search} />
      <section
        aria-label="Danh sách thông báo"
        className="overflow-hidden rounded-xl border bg-card shadow-xs"
      >
        {body}
      </section>
    </div>
  )
}

export default RecruiterNotificationList
