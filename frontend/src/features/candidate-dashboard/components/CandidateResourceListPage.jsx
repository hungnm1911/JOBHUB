import { CircleX, LoaderCircle, RotateCw } from 'lucide-react'
import { Link } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'

function CandidateResourceListPage({
  title,
  description,
  loading,
  error,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRetry,
  children,
  count,
}) {
  return (
    <div className="space-y-6">
      <PageHeader description={description} eyebrow="Ứng viên" title={title} />

      {loading && (
        <CenteredState
          icon={LoaderCircle}
          spinning
          title="Đang tải dữ liệu…"
          tone="bg-primary/10 text-primary"
        />
      )}

      {!loading && error && (
        <CenteredState
          action={
            <Button onClick={onRetry} variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          }
          description={error.message || 'Không tải được dữ liệu.'}
          icon={CircleX}
          title="Không tải được danh sách"
          tone="bg-secondary text-muted-foreground"
        />
      )}

      {!loading && !error && count === 0 && (
        <CenteredState
          action={emptyAction}
          description={emptyDescription}
          icon={CircleX}
          title={emptyTitle}
          tone="bg-secondary text-muted-foreground"
        />
      )}

      {!loading && !error && count > 0 && children}
    </div>
  )
}

function EmptyLink({ to, children }) {
  return (
    <Button asChild variant="outline">
      <Link to={to}>{children}</Link>
    </Button>
  )
}

export { EmptyLink }
export default CandidateResourceListPage
