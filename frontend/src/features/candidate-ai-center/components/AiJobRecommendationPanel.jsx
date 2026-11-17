import {
  CircleAlert,
  FileText,
  LoaderCircle,
  RotateCw,
  Sparkles,
  Star,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import AiRecommendedJobCard from './AiRecommendedJobCard'

function PanelShell({ children, className }) {
  return (
    <section className={cn('rounded-2xl border bg-card p-5 shadow-xs sm:p-6', className)}>
      {children}
    </section>
  )
}

function AiJobRecommendationPanel({
  defaultCv,
  cvsLoading,
  cvsError,
  status,
  recommendations,
  error,
  onRecommend,
}) {
  const loading = status === 'loading' || cvsLoading
  const hasDefaultCv = Boolean(defaultCv)
  const hasResults = status === 'success' && recommendations.length > 0
  const emptyResults = status === 'success' && recommendations.length === 0
  const missingDefaultMessage =
    error?.status === 409 ||
    /default cv/i.test(error?.message || '') ||
    /cv mặc định/i.test(error?.message || '')

  return (
    <PanelShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            Gợi ý việc làm
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Việc làm phù hợp với bạn</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dựa trên CV mặc định, AI đề xuất các việc làm đang tuyển phù hợp nhất.
          </p>
        </div>

        {hasDefaultCv && !cvsLoading ? (
          <Button
            aria-busy={status === 'loading'}
            disabled={loading}
            onClick={onRecommend}
            type="button"
          >
            {status === 'loading' ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" className="size-4" />
            )}
            {status === 'loading' ? 'Đang phân tích…' : 'Gợi ý việc làm'}
          </Button>
        ) : null}
      </div>

      <div className="mt-5">
        {cvsLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-muted/40 px-4 py-10 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Đang kiểm tra CV mặc định…
          </div>
        ) : null}

        {!cvsLoading && cvsError ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-4">
            <div className="flex items-start gap-3">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-destructive">Không tải được danh sách CV</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {cvsError.message || 'Vui lòng thử lại để kiểm tra CV mặc định.'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {!cvsLoading && !cvsError && !hasDefaultCv ? (
          <div className="rounded-xl border bg-muted/30 px-4 py-8 text-center sm:px-6">
            <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText aria-hidden="true" className="size-5" />
            </span>
            <p className="mt-3 text-sm font-medium">Chưa có CV mặc định</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Đặt một CV đang dùng làm mặc định để AI có thể gợi ý việc làm phù hợp.
            </p>
            <Button asChild className="mt-4" size="sm">
              <Link to="/candidate/cvs">Quản lý CV</Link>
            </Button>
          </div>
        ) : null}

        {!cvsLoading && !cvsError && hasDefaultCv && status === 'idle' ? (
          <div className="rounded-xl border bg-muted/30 px-4 py-5 sm:px-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary">
                <Star aria-hidden="true" className="size-3.5" />
                CV mặc định sẵn sàng
              </span>
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                Đang dùng <span className="font-medium text-foreground">{defaultCv.name}</span>. Nhấn
                &quot;Gợi ý việc làm&quot; để bắt đầu.
              </p>
            </div>
          </div>
        ) : null}

        {!cvsLoading && status === 'loading' ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-muted/40 px-4 py-12 text-center">
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />
            <p className="text-sm font-medium">Đang phân tích CV và tìm việc phù hợp…</p>
            <p className="text-xs text-muted-foreground">Quá trình này có thể mất vài chục giây.</p>
          </div>
        ) : null}

        {!cvsLoading && status === 'error' ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-destructive">
                    {missingDefaultMessage
                      ? 'Cần CV mặc định đang dùng'
                      : 'Không lấy được gợi ý việc làm'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {missingDefaultMessage
                      ? 'Hãy đặt CV mặc định rồi thử lại.'
                      : error?.message || 'Đã xảy ra lỗi khi gọi API gợi ý.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {missingDefaultMessage ? (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/candidate/cvs">Quản lý CV</Link>
                  </Button>
                ) : (
                  <Button disabled={loading} onClick={onRecommend} size="sm" type="button" variant="outline">
                    <RotateCw aria-hidden="true" className="size-4" />
                    Thử lại
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {!cvsLoading && emptyResults ? (
          <div className="rounded-xl border bg-muted/30 px-4 py-8 text-center">
            <Sparkles aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Chưa tìm thấy việc phù hợp</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              AI chưa đề xuất được việc làm từ CV hiện tại. Bạn có thể cập nhật CV hoặc tìm việc thủ
              công.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/candidate/cvs">Cập nhật CV</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/jobs">Tìm việc làm</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {!cvsLoading && hasResults ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {recommendations.length} việc làm được đề xuất
              {defaultCv?.name ? (
                <>
                  {' '}
                  từ <span className="font-medium text-foreground">{defaultCv.name}</span>
                </>
              ) : null}
              .
            </p>
            <div className="grid gap-3">
              {recommendations.map((item) => (
                <AiRecommendedJobCard
                  job={item.job}
                  key={item.job?.id ?? item.jobId}
                  matchScore={item.matchScore}
                  reason={item.reason}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </PanelShell>
  )
}

export default AiJobRecommendationPanel
