import {
  CircleAlert,
  CircleCheck,
  FileSearch,
  FileText,
  Lightbulb,
  LoaderCircle,
  RotateCw,
  WandSparkles,
  X,
} from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { listOwnCandidateCvsApi } from '@/apis/candidate-cv.api'
import { Button } from '@/components/ui/button'
import useCvJobOptimization from '@/features/candidate-cv-optimization/hooks/useCvJobOptimization'
import { cn } from '@/lib/utils'
import { CANDIDATE_CV_SOURCE_TYPE, CANDIDATE_CV_STATUS } from '@/utils/constant'

import useCvJobEvaluation from '../hooks/useCvJobEvaluation'
import { toCvEvaluationErrorMessage } from '../utils'
import {
  cvSectionLabel,
  fieldReviewLabel,
  formatMatchScore,
  scoreTone,
} from '../utils'

const SOURCE_LABEL = Object.freeze({
  [CANDIDATE_CV_SOURCE_TYPE.GENERATED]: 'CV tạo trên JOBHUB',
  [CANDIDATE_CV_SOURCE_TYPE.UPLOADED]: 'CV tải lên',
})

function selectableCvs(cvs) {
  return cvs.filter(
    (cv) =>
      (cv.status === CANDIDATE_CV_STATUS.ACTIVE ||
        cv.status === CANDIDATE_CV_STATUS.DRAFT) &&
      !cv.archivedAt,
  )
}

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

function JobCvEvaluationDialog({ jobId, jobTitle, onClose }) {
  const titleId = useId()
  const [view, setView] = useState({ loading: true, cvs: [], loadError: null })
  const [selectedCvId, setSelectedCvId] = useState(null)

  const evaluation = useCvJobEvaluation()
  const optimization = useCvJobOptimization()
  const busy = evaluation.evaluating || optimization.optimizing

  useEffect(() => {
    let active = true

    listOwnCandidateCvsApi().then(
      ({ cvs }) => {
        if (!active) {
          return
        }

        const options = selectableCvs(cvs ?? [])
        const preferred =
          options.find((cv) => cv.isDefault) ??
          options.find((cv) => cv.status === CANDIDATE_CV_STATUS.ACTIVE) ??
          options[0]
        setView({ loading: false, cvs: options, loadError: null })
        setSelectedCvId(preferred?.id ?? null)
      },
      (loadError) => {
        if (active) {
          setView({ loading: false, cvs: [], loadError })
        }
      },
    )

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !busy) {
        onClose()
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, busy])

  const selectedCv = useMemo(
    () => view.cvs.find((cv) => cv.id === selectedCvId) ?? null,
    [view.cvs, selectedCvId],
  )

  const handleSelectCv = (nextCvId) => {
    setSelectedCvId(nextCvId)
    evaluation.reset()
    optimization.reset()
  }

  const handleEvaluate = async () => {
    if (!jobId || !selectedCvId) {
      toast.error('Hãy chọn một CV để đánh giá.')
      return
    }

    optimization.reset()
    try {
      await evaluation.evaluate({
        jobId,
        candidateCvId: selectedCvId,
      })
    } catch (error) {
      toast.error(toCvEvaluationErrorMessage(error))
    }
  }

  const handleOptimize = async () => {
    if (!jobId || !selectedCvId || !evaluation.rawResult) {
      toast.error('Hãy đánh giá CV thành công trước khi tối ưu.')
      return
    }

    try {
      const draft = await optimization.optimize({
        jobId,
        candidateCvId: selectedCvId,
        evaluationResult: evaluation.rawResult,
      })
      toast.success(
        draft?.name ? `Đã tạo bản nháp “${draft.name}”` : 'Đã tạo bản nháp CV tối ưu',
      )
    } catch (error) {
      toast.error(error.message || 'Không tối ưu được CV.')
    }
  }

  const hasEvaluationResult =
    evaluation.status === 'success' && Boolean(evaluation.result)
  const canOptimize = hasEvaluationResult && !busy

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-hero/50 p-4 sm:items-center"
      onClick={() => {
        if (!busy) {
          onClose()
        }
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[min(46rem,92svh)] w-full max-w-2xl flex-col rounded-2xl border bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold" id={titleId}>
              Đánh giá &amp; Tối ưu CV với AI
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{jobTitle}</p>
          </div>
          <button
            aria-label="Đóng"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {view.loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              Đang tải danh sách CV...
            </p>
          )}

          {!view.loading && view.loadError && (
            <p className="text-sm text-destructive" role="alert">
              {view.loadError.message}
            </p>
          )}

          {!view.loading && !view.loadError && view.cvs.length === 0 && (
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p>
                Bạn chưa có CV nào để đánh giá. Hãy tạo hoặc tải lên CV trong thư viện của bạn trước.
              </p>
              <Button asChild className="mt-3" size="sm" variant="outline">
                <Link onClick={onClose} to="/candidate/cvs">
                  Quản lý CV
                </Link>
              </Button>
            </div>
          )}

          {!view.loading && view.cvs.length > 0 && (
            <fieldset disabled={busy}>
              <legend className="text-sm font-medium">1. Chọn CV để đánh giá</legend>
              <ul className="mt-2.5 max-h-48 space-y-2 overflow-y-auto pr-1">
                {view.cvs.map((cv) => (
                  <li key={cv.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                        selectedCvId === cv.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-secondary/40',
                      )}
                    >
                      <input
                        checked={selectedCvId === cv.id}
                        className="mt-1 size-4 accent-primary"
                        name="evaluateCandidateCvId"
                        onChange={() => handleSelectCv(cv.id)}
                        type="radio"
                        value={cv.id}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium break-words">
                          {cv.name}
                          {cv.status === CANDIDATE_CV_STATUS.DRAFT ? ' (Bản nháp)' : ''}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {SOURCE_LABEL[cv.sourceType] ?? cv.sourceType}
                          {cv.isDefault ? ' · CV mặc định' : ''}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {evaluation.evaluating && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border bg-primary/5 px-4 py-8 text-center">
              <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
              <p className="text-sm font-medium">Đang đánh giá CV theo yêu cầu công việc…</p>
              <p className="text-xs text-muted-foreground">
                Hệ thống AI đang phân tích độ phù hợp của CV. Quá trình này có thể mất vài chục giây.
              </p>
            </div>
          )}

          {!evaluation.evaluating && evaluation.status === 'error' && (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                  />
                  <div>
                    <p className="text-sm font-medium text-destructive">Đánh giá CV thất bại</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {toCvEvaluationErrorMessage(evaluation.error)}
                    </p>
                  </div>
                </div>
                <Button onClick={handleEvaluate} size="sm" type="button" variant="outline">
                  <RotateCw aria-hidden="true" className="size-4" />
                  Thử lại
                </Button>
              </div>
            </div>
          )}

          {!evaluation.evaluating && hasEvaluationResult && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  2. Kết quả đánh giá{selectedCv?.name ? ` · ${selectedCv.name}` : ''}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                <ScoreBadge score={evaluation.result.matchScore} />
                {evaluation.result.overallSummary ? (
                  <section className="rounded-2xl border bg-card p-3.5">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                      <CircleCheck aria-hidden="true" className="size-4 text-primary" />
                      Nhận xét tổng quan
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      {evaluation.result.overallSummary}
                    </p>
                  </section>
                ) : (
                  <div className="rounded-2xl border bg-muted/30 p-3.5 text-sm text-muted-foreground">
                    Không có nhận xét tổng quan.
                  </div>
                )}
              </div>

              {evaluation.result.fieldReviews.length > 0 && (
                <section className="rounded-2xl border bg-card p-4">
                  <h3 className="text-sm font-semibold">Điểm theo tiêu chí</h3>
                  <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    {evaluation.result.fieldReviews.map((item) => (
                      <li
                        className="rounded-xl border bg-background px-3 py-2.5"
                        key={item.criterion}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{fieldReviewLabel(item.criterion)}</p>
                          <span className="text-sm font-semibold tabular-nums">
                            {formatMatchScore(item.score)}
                          </span>
                        </div>
                        {item.review && (
                          <p className="mt-1 text-xs text-muted-foreground">{item.review}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {evaluation.result.cvImprovements.length > 0 && (
                <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Lightbulb aria-hidden="true" className="size-4 text-primary" />
                    Gợi ý cải thiện CV
                  </h3>
                  <ul className="mt-2.5 space-y-2">
                    {evaluation.result.cvImprovements.map((item, index) => (
                      <li
                        className="rounded-xl border bg-card px-3 py-2.5"
                        key={`${item.section}-${index}`}
                      >
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          {cvSectionLabel(item.section)}
                        </p>
                        {item.comment && (
                          <p className="mt-1 text-sm text-foreground">{item.comment}</p>
                        )}
                        {item.suggestion && (
                          <p className="mt-1 text-sm text-muted-foreground">{item.suggestion}</p>
                        )}
                        {item.rewrite && (
                          <p className="mt-2 rounded-lg bg-primary/5 px-3 py-2 text-sm text-foreground">
                            {item.rewrite}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="rounded-2xl border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                      <WandSparkles aria-hidden="true" className="size-4 text-primary" />
                      3. Tối ưu CV theo việc làm này
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                      Dùng kết quả đánh giá trên để tạo một bản nháp CV mới tối ưu riêng cho vị trí này.
                    </p>
                  </div>
                  <Button
                    disabled={!canOptimize}
                    onClick={handleOptimize}
                    size="sm"
                    type="button"
                  >
                    {optimization.optimizing ? (
                      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                    ) : (
                      <WandSparkles aria-hidden="true" className="size-4" />
                    )}
                    {optimization.optimizing ? 'Đang tối ưu CV…' : 'Tối ưu CV'}
                  </Button>
                </div>

                {optimization.optimizing && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Hệ thống đang tạo bản nháp CV tối ưu từ CV gốc và các gợi ý đánh giá…
                  </p>
                )}

                {!optimization.optimizing && optimization.status === 'error' && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5">
                    <p className="text-xs text-destructive sm:text-sm">
                      {optimization.error?.message || 'Không tạo được bản nháp CV tối ưu.'}
                    </p>
                    <Button
                      disabled={!canOptimize}
                      onClick={handleOptimize}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <RotateCw aria-hidden="true" className="size-3.5" />
                      Thử lại
                    </Button>
                  </div>
                )}

                {!optimization.optimizing &&
                  optimization.status === 'success' &&
                  optimization.draftCv && (
                    <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <CircleCheck aria-hidden="true" className="size-4" />
                        Đã tạo bản nháp CV tối ưu
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                        Bản nháp{' '}
                        <span className="font-medium text-foreground">
                          {optimization.draftCv.name}
                        </span>{' '}
                        đã được lưu vào thư viện CV của bạn.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild size="sm">
                          <Link onClick={onClose} to="/candidate/cvs">
                            <FileText aria-hidden="true" className="size-4" />
                            Mở thư viện CV
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link onClick={onClose} to="/candidate/cvs/create">
                            Tiếp tục chỉnh CV
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )}
              </section>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
          <Button disabled={busy} onClick={onClose} type="button" variant="outline">
            Đóng
          </Button>
          <Button
            disabled={busy || !selectedCvId}
            onClick={handleEvaluate}
            type="button"
            variant={hasEvaluationResult ? 'outline' : 'default'}
          >
            {evaluation.evaluating ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <FileSearch aria-hidden="true" className="size-4" />
            )}
            {evaluation.evaluating
              ? 'Đang đánh giá…'
              : hasEvaluationResult
                ? 'Đánh giá lại'
                : 'Đánh giá CV'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default JobCvEvaluationDialog
