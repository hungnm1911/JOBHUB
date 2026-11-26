import { CircleX, Lock, RotateCw, SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Domain-neutral loading, empty, error and paging blocks for data lists.
function StateMessage({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-14 text-center', className)}>
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      )}
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}

function ErrorState({ error, onRetry, forbiddenDescription, className }) {
  if (error?.status === 403) {
    return (
      <StateMessage
        className={className}
        description={forbiddenDescription ?? 'Bạn không có quyền xem nội dung này.'}
        icon={Lock}
        title="Không có quyền truy cập"
      />
    )
  }

  if (error?.status === 404) {
    return (
      <StateMessage
        className={className}
        description="Nội dung không tồn tại hoặc đã bị xóa."
        icon={SearchX}
        title="Không tìm thấy"
      />
    )
  }

  return (
    <StateMessage
      action={
        onRetry && (
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            <RotateCw aria-hidden="true" className="size-4" />
            Tải lại
          </Button>
        )
      }
      className={className}
      description={error?.status ? 'Đã có lỗi khi tải dữ liệu. Vui lòng thử lại.' : error?.message}
      icon={CircleX}
      title="Chưa tải được dữ liệu"
    />
  )
}

function ListSkeleton({ rows = 5, label = 'Đang tải' }) {
  return (
    <div aria-busy="true" aria-label={label} className="divide-y" role="status">
      {Array.from({ length: rows }, (_, index) => (
        <div className="space-y-2 px-4 py-4" key={index}>
          <div className="h-4 w-2/5 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-secondary motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  )
}

// First, last and the neighbours of the current page; 0 marks a gap.
function pageNumbers(page, totalPages) {
  const shown = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right)
  return shown.flatMap((value, index) => (index && value - shown[index - 1] > 1 ? [0, value] : [value]))
}

function Pager({ pagination, onPageChange, unit }) {
  if (!pagination || pagination.total === 0) return null
  const { page, total, totalPages } = pagination

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <p className="text-muted-foreground tabular-nums">
        Tổng cộng {total} {unit}
      </p>
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
          {pageNumbers(page, totalPages).map((value, index) =>
            value === 0 ? (
              <span aria-hidden="true" key={`gap-${index}`}>
                …
              </span>
            ) : (
              <Button
                aria-current={value === page ? 'page' : undefined}
                aria-label={`Trang ${value}`}
                className="min-w-9 px-2 tabular-nums"
                key={value}
                onClick={() => onPageChange(value)}
                size="sm"
                type="button"
                variant={value === page ? 'default' : 'outline'}
              >
                {value}
              </Button>
            ),
          )}
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

export { ErrorState, ListSkeleton, Pager, StateMessage }
