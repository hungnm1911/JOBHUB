import {
  CircleAlert,
  CircleCheck,
  FileSearch,
  Lightbulb,
  LoaderCircle,
  RotateCw,
} from 'lucide-react'
import { useEffect, useRef } from 'react'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  cvSectionLabel,
  fieldReviewLabel,
  formatMatchScore,
  scoreTone,
  toCvEvaluationErrorMessage,
} from '../utils'

function ScoreBadge({ score }) {
  const tone = scoreTone(score)
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3',
        tone === 'high' && 'border-emerald-500/25 bg-emerald-500/10',
        tone === 'mid' && 'border-amber-500/25 bg-amber-500/10',
        tone === 'low' && 'border-destructive/25 bg-destructive/10',
        tone === 'muted' && 'bg-muted/60',
      )}
    >
      <p className="text-xs text-muted-foreground">Điểm phù hợp</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{formatMatchScore(score)}</p>
    </div>
  )
}

function EvaluationResultPanel({
  status,
  result,
  error,
  selectedJob,
  selectedCv,
  evaluating,
  onEvaluate,
  onRetry,
}) {
  const resultsRef = useRef(null)

  useEffect(() => {
    if (status !== 'success' || !resultsRef.current) {
      return
    }
    resultsRef.current.scrollTo({ top: 0, behavior: 'smooth' })
  }, [status, result])

  if (!selectedJob) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center p-6">
        <CenteredState
          description="Chọn một việc làm ở danh sách bên trái để so sánh với CV của bạn."
          icon={FileSearch}
          title="Chọn việc để đánh giá"
          tone="bg-secondary text-muted-foreground"
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b bg-card px-4 py-3 sm:px-5">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          So sánh CV · Việc làm
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight sm:text-lg">
          {selectedJob.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {[selectedJob.company?.name, selectedCv?.name].filter(Boolean).join(' · ') ||
            'Chưa chọn CV'}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={!selectedCv || evaluating} onClick={onEvaluate} type="button">
            {evaluating ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <FileSearch aria-hidden="true" className="size-4" />
            )}
            {evaluating ? 'Đang đánh giá…' : 'Đánh giá CV với việc này'}
          </Button>
          {status === 'error' ? (
            <Button onClick={onRetry} type="button" variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5" ref={resultsRef}>
        {evaluating ? (
          <CenteredState
            description="Hệ thống đang phân tích CV theo yêu cầu của việc làm. Có thể mất vài chục giây."
            icon={LoaderCircle}
            spinning
            title="Đang đánh giá CV…"
            tone="bg-primary/10 text-primary"
          />
        ) : null}

        {!evaluating && status === 'error' ? (
          <CenteredState
            action={
              <Button onClick={onRetry} variant="outline">
                <RotateCw aria-hidden="true" className="size-4" />
                Thử lại
              </Button>
            }
            description={toCvEvaluationErrorMessage(error)}
            icon={CircleAlert}
            title="Đánh giá thất bại"
            tone="bg-secondary text-muted-foreground"
          />
        ) : null}

        {!evaluating && status === 'idle' ? (
          <div className="rounded-2xl border bg-muted/30 px-4 py-8 text-center">
            <FileSearch aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Sẵn sàng so sánh</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nhấn &quot;Đánh giá CV với việc này&quot; để xem điểm phù hợp và gợi ý cải thiện.
            </p>
          </div>
        ) : null}

        {!evaluating && status === 'success' && result ? (
          <>
            <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <ScoreBadge score={result.matchScore} />
              {result.overallSummary ? (
                <section className="rounded-2xl border bg-card p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <CircleCheck aria-hidden="true" className="size-4 text-primary" />
                    Tóm tắt
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {result.overallSummary}
                  </p>
                </section>
              ) : (
                <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Không có tóm tắt từ kết quả đánh giá.
                </div>
              )}
            </div>

            {result.cvImprovements.length > 0 ? (
              <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Lightbulb aria-hidden="true" className="size-4 text-primary" />
                  Gợi ý cải thiện CV
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {result.cvImprovements.map((item, index) => (
                    <li
                      className="rounded-xl border bg-card px-3 py-3"
                      key={`${item.section}-${index}`}
                    >
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {cvSectionLabel(item.section)}
                      </p>
                      {item.comment ? (
                        <p className="mt-1.5 text-sm text-foreground">{item.comment}</p>
                      ) : null}
                      {item.suggestion ? (
                        <p className="mt-1 text-sm text-muted-foreground">{item.suggestion}</p>
                      ) : null}
                      {item.rewrite ? (
                        <p className="mt-2 rounded-lg bg-primary/5 px-3 py-2 text-sm text-foreground">
                          {item.rewrite}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {result.fieldReviews.length > 0 ? (
              <section className="rounded-2xl border bg-card p-4">
                <h3 className="text-sm font-semibold">Điểm theo tiêu chí</h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {result.fieldReviews.map((item) => (
                    <li
                      className="rounded-xl border bg-background px-3 py-2.5"
                      key={item.criterion}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{fieldReviewLabel(item.criterion)}</p>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatMatchScore(item.score)}
                        </span>
                      </div>
                      {item.review ? (
                        <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground">
                          {item.review}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

export default EvaluationResultPanel
