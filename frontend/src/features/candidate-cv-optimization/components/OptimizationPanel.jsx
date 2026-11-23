import {
  CircleAlert,
  CircleCheck,
  FileText,
  LoaderCircle,
  RotateCw,
  WandSparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import {
  cvSectionLabel,
  fieldReviewLabel,
  formatMatchScore,
  scoreTone,
  toCvEvaluationErrorMessage,
} from '@/features/candidate-cv-evaluation/utils'
import { cn } from '@/lib/utils'

import { toOptimizationCommitErrorMessage } from '../utils'

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
      <p className="text-xs text-muted-foreground">Điểm phù hợp hiện tại</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{formatMatchScore(score)}</p>
    </div>
  )
}

function OptimizationPanel({
  selectedJob,
  selectedCv,
  evaluationStatus,
  evaluationResult,
  evaluationError,
  evaluating,
  optimizationStatus,
  draftCv,
  optimizationError,
  optimizing,
  previewing,
  commitStatus,
  commitError,
  reviewReady,
  onReview,
  onEvaluate,
  onOptimize,
}) {
  if (!selectedJob) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center p-6">
        <CenteredState
          description="Chọn một việc làm ở danh sách bên trái để tối ưu CV theo yêu cầu job."
          icon={WandSparkles}
          title="Chọn việc để tối ưu CV"
          tone="bg-secondary text-muted-foreground"
        />
      </div>
    )
  }

  const canOptimize =
    evaluationStatus === 'success' && Boolean(evaluationResult) && !evaluating && !optimizing

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="shrink-0 border-b bg-card px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          Tối ưu CV · Việc làm
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{selectedJob.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {[selectedJob.company?.name, selectedCv?.name].filter(Boolean).join(' · ') ||
            'Chưa chọn CV'}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={!selectedCv || evaluating || optimizing}
            onClick={onEvaluate}
            type="button"
            variant={evaluationStatus === 'success' ? 'outline' : 'default'}
          >
            {evaluating ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <WandSparkles aria-hidden="true" className="size-4" />
            )}
            {evaluating
              ? 'Đang phân tích…'
              : evaluationStatus === 'success'
                ? 'Phân tích lại'
                : '1. Phân tích CV'}
          </Button>

          <Button
            disabled={!canOptimize}
            onClick={onOptimize}
            type="button"
          >
            {optimizing ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <FileText aria-hidden="true" className="size-4" />
            )}
            {previewing ? 'Đang tạo bản xem trước…' : '2. Xem bản tối ưu'}
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 p-4 sm:p-5">
        {evaluating ? (
          <CenteredState
            description="Cần kết quả đánh giá V04 trước khi gọi API tối ưu CV."
            icon={LoaderCircle}
            spinning
            title="Đang phân tích CV…"
            tone="bg-primary/10 text-primary"
          />
        ) : null}

        {!evaluating && evaluationStatus === 'error' ? (
          <CenteredState
            action={
              <Button onClick={onEvaluate} variant="outline">
                <RotateCw aria-hidden="true" className="size-4" />
                Thử lại phân tích
              </Button>
            }
            description={toCvEvaluationErrorMessage(evaluationError)}
            icon={CircleAlert}
            title="Phân tích thất bại"
            tone="bg-secondary text-muted-foreground"
          />
        ) : null}

        {!evaluating && evaluationStatus === 'idle' ? (
          <div className="rounded-2xl border bg-muted/30 px-4 py-8 text-center">
            <WandSparkles
              aria-hidden="true"
              className="mx-auto size-8 text-muted-foreground"
            />
            <p className="mt-3 text-sm font-medium">Hai bước tối ưu CV</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bước 1 đánh giá CV theo job. Bước 2 dùng kết quả đó để tạo bản xem trước; chỉ khi bạn
              chọn lưu mới tạo bản nháp Generated mới.
            </p>
          </div>
        ) : null}

        {!evaluating && evaluationStatus === 'success' && evaluationResult ? (
          <>
            <ScoreBadge score={evaluationResult.matchScore} />

            {evaluationResult.overallSummary ? (
              <section className="rounded-2xl border bg-card p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <CircleCheck aria-hidden="true" className="size-4 text-primary" />
                  Tóm tắt đánh giá
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {evaluationResult.overallSummary}
                </p>
              </section>
            ) : null}

            {evaluationResult.cvImprovements?.length > 0 ? (
              <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <h3 className="text-sm font-semibold">Gợi ý sẽ đưa vào tối ưu</h3>
                <ul className="mt-3 space-y-2">
                  {evaluationResult.cvImprovements.slice(0, 4).map((item, index) => (
                    <li
                      className="rounded-xl border bg-card px-3 py-2.5"
                      key={`${item.section}-${index}`}
                    >
                      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                        {cvSectionLabel(item.section)}
                      </p>
                      <p className="mt-1 text-sm">{item.comment || item.suggestion}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {evaluationResult.fieldReviews?.length > 0 ? (
              <section className="rounded-2xl border bg-card p-4">
                <h3 className="text-sm font-semibold">Điểm theo tiêu chí</h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {evaluationResult.fieldReviews.map((item) => (
                    <li
                      className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2.5"
                      key={item.criterion}
                    >
                      <span className="text-sm">{fieldReviewLabel(item.criterion)}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMatchScore(item.score)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}

        {previewing ? (
          <CenteredState
            description="Hệ thống đang tạo bản xem trước từ baseline CV và advice đánh giá. Chưa có bản nháp nào được lưu. Có thể mất một lúc."
            icon={LoaderCircle}
            spinning
            title="Đang tối ưu CV…"
            tone="bg-primary/10 text-primary"
          />
        ) : null}

        {!previewing && optimizationStatus === 'error' ? (
          <CenteredState
            action={
              <Button disabled={!canOptimize} onClick={onOptimize} variant="outline">
                <RotateCw aria-hidden="true" className="size-4" />
                Thử lại tối ưu
              </Button>
            }
            description={
              optimizationError?.message || 'Không tạo được bản tối ưu để xem trước.'
            }
            icon={CircleAlert}
            title="Tạo bản tối ưu thất bại"
            tone="bg-secondary text-muted-foreground"
          />
        ) : null}

        {reviewReady ? (
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <h3 className="text-sm font-semibold">Bản tối ưu đang chờ bạn xem xét</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Chưa có bản nháp nào được lưu. Mở so sánh để xem và quyết định lưu hoặc hủy.
            </p>
            <Button className="mt-3" onClick={onReview} type="button">
              Xem so sánh
            </Button>
          </section>
        ) : null}

        {commitStatus === 'error' && !reviewReady && commitError ? (
          <section className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4" role="alert">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CircleAlert aria-hidden="true" className="size-4 text-destructive" />
              Không lưu được bản nháp
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {toOptimizationCommitErrorMessage(commitError)}
            </p>
            <Button asChild className="mt-3" variant="outline">
              <Link to="/candidate/cvs">Quản lý CV</Link>
            </Button>
          </section>
        ) : null}

        {commitStatus === 'success' && draftCv ? (
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CircleCheck aria-hidden="true" className="size-4 text-primary" />
              Đã lưu bản nháp tối ưu
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              CV mới <span className="font-medium text-foreground">{draftCv.name}</span> đã
              được lưu ở trạng thái bản nháp. Bạn có thể xem và chỉnh trong Quản lý CV.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/candidate/cvs">Quản lý CV</Link>
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

export default OptimizationPanel
