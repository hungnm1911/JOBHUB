import { LoaderCircle, Sparkles, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'

function AiAssistantBanner({ hasDefaultCv, loading, onExplore }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-hero px-5 py-5 text-hero-foreground sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-hero-muted">
            <Sparkles aria-hidden="true" className="size-4" />
            AI Assistant
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">
            {hasDefaultCv
              ? 'Phân tích CV mặc định để gợi ý việc làm phù hợp'
              : 'Thiết lập CV mặc định để mở khóa gợi ý AI'}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-hero-muted">
            JOBHUB có thể đánh giá mức độ phù hợp với công việc, gợi ý kỹ năng cần bổ sung và
            đề xuất hướng cải thiện CV dựa trên dữ liệu hồ sơ thực của bạn.
          </p>
        </div>

        <Button
          className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={loading || !hasDefaultCv}
          onClick={onExplore}
          type="button"
        >
          {loading ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Zap aria-hidden="true" className="size-4" />
          )}
          {hasDefaultCv ? 'Xem gợi ý AI ngay' : 'Cần CV mặc định'}
        </Button>
      </div>
    </section>
  )
}

export default AiAssistantBanner
