import { ArrowLeft, FileText, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import JobPickList from '@/features/candidate-cv-evaluation/components/JobPickList'
import useCvJobEvaluation from '@/features/candidate-cv-evaluation/hooks/useCvJobEvaluation'
import { toCvEvaluationErrorMessage } from '@/features/candidate-cv-evaluation/utils'
import useCandidateCvs from '@/features/candidate-cvs/hooks/useCandidateCvs'
import useDiscoveryJobs from '@/features/job-discovery/hooks/useDiscoveryJobs'
import { JOB_DISCOVERY_SORT } from '@/features/job-discovery/search-params'
import { cn } from '@/lib/utils'
import { CANDIDATE_CV_STATUS } from '@/utils/constant'

import useCvOptimizationProposal from '../hooks/useCvOptimizationProposal'
import {
  isProposalRejectedStatus,
  toOptimizationCommitErrorMessage,
  toOptimizationPreviewErrorMessage,
} from '../utils'
import OptimizationPanel from './OptimizationPanel'
import OptimizationProposalReviewModal from './OptimizationProposalReviewModal'

function CandidateCvOptimizeWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [cvOverrideId, setCvOverrideId] = useState(null)
  const [mobileShowResult, setMobileShowResult] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  const { loading: cvsLoading, cvs, error: cvsError } = useCandidateCvs()
  const jobQuery = useMemo(
    () => ({
      keyword: debouncedKeyword || undefined,
      page: 1,
      limit: 20,
      sort: JOB_DISCOVERY_SORT.NEWEST,
    }),
    [debouncedKeyword],
  )
  const {
    loading: jobsLoading,
    jobs,
    error: jobsError,
    reload: reloadJobs,
  } = useDiscoveryJobs(jobQuery)
  const evaluation = useCvJobEvaluation()
  const selectableCvs = useMemo(
    () =>
      cvs.filter(
        (cv) =>
          cv.status === CANDIDATE_CV_STATUS.ACTIVE ||
          cv.status === CANDIDATE_CV_STATUS.DRAFT,
      ),
    [cvs],
  )

  const preferredCvId = useMemo(() => {
    const preferred =
      selectableCvs.find((cv) => cv.isDefault) ??
      selectableCvs.find((cv) => cv.status === CANDIDATE_CV_STATUS.ACTIVE) ??
      selectableCvs[0]
    return preferred?.id ?? null
  }, [selectableCvs])

  const selectedCvId =
    cvOverrideId && selectableCvs.some((cv) => cv.id === cvOverrideId)
      ? cvOverrideId
      : preferredCvId

  const selectedCv = useMemo(
    () => selectableCvs.find((cv) => cv.id === selectedCvId) ?? null,
    [selectableCvs, selectedCvId],
  )

  const selectedJobId = searchParams.get('jobId')
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  )

  const optimization = useCvOptimizationProposal({
    jobId: selectedJob?.id,
    candidateCvId: selectedCv?.id,
  })

  const showResultPane = mobileShowResult || Boolean(selectedJobId)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const resetFlow = () => {
    evaluation.reset()
    optimization.reset()
  }

  const handleSelectJob = (job) => {
    setMobileShowResult(true)
    resetFlow()
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('jobId', job.id)
        return next
      },
      { replace: true },
    )
  }

  const handleEvaluate = async () => {
    if (!selectedJob?.id || !selectedCv?.id) {
      toast.error('Hãy chọn CV và việc làm trước khi phân tích.')
      return
    }

    optimization.reset()
    try {
      await evaluation.evaluate({
        jobId: selectedJob.id,
        candidateCvId: selectedCv.id,
      })
      toast.success('Đã phân tích CV. Bạn có thể xem bản tối ưu.')
    } catch (error) {
      toast.error(toCvEvaluationErrorMessage(error))
    }
  }

  // Optimize only requests a Preview Proposal and opens the Diff; no Draft yet.
  const handleOptimize = async () => {
    if (!selectedJob?.id || !selectedCv?.id || !evaluation.rawResult) {
      toast.error('Hãy phân tích CV thành công trước khi tối ưu.')
      return
    }

    try {
      const response = await optimization.requestPreview(evaluation.rawResult)
      if (response) {
        setReviewOpen(true)
      }
    } catch (error) {
      toast.error(toOptimizationPreviewErrorMessage(error))
    }
  }

  // Save commits the signed Proposal exactly as previewed; it never calls AI.
  const handleSaveDraft = async () => {
    try {
      const draft = await optimization.commit()
      if (draft) {
        setReviewOpen(false)
        toast.success(draft.name ? `Đã lưu bản nháp “${draft.name}”` : 'Đã lưu bản nháp CV tối ưu')
      }
    } catch (error) {
      if (isProposalRejectedStatus(error?.status)) {
        setReviewOpen(false)
        toast.error(toOptimizationCommitErrorMessage(error))
      }
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b bg-card px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="sm" variant="ghost">
            <Link to="/candidate/ai-center">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Trung tâm AI
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">
              Tối ưu CV theo việc làm
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Chọn việc, phân tích CV, xem so sánh bản tối ưu rồi lưu thành bản nháp Generated.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SelectDropdown
            ariaLabel="Chọn CV nguồn"
            className="min-w-64 flex-1"
            disabled={cvsLoading || selectableCvs.length === 0}
            icon={FileText}
            onChange={(nextId) => {
              setCvOverrideId(nextId || null)
              resetFlow()
            }}
            options={selectableCvs.map((cv) => ({
              value: cv.id,
              label: `${cv.isDefault ? '★ ' : ''}${cv.name}${cv.status === CANDIDATE_CV_STATUS.DRAFT ? ' (nháp)' : ''}`,
            }))}
            placeholder={
              cvsLoading ? 'Đang tải CV…' : 'Chưa có CV để tối ưu'
            }
            value={selectedCvId ?? ''}
          />

          {selectedCv?.isDefault ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary">
              <Star aria-hidden="true" className="size-3.5" />
              CV mặc định
            </span>
          ) : null}

          {cvsError ? (
            <span className="text-xs text-destructive">
              {cvsError.message || 'Không tải được CV'}
            </span>
          ) : null}

          {!cvsLoading && selectableCvs.length === 0 ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/candidate/cvs">Quản lý CV</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            'min-h-0 w-full shrink-0 lg:w-[22rem] xl:w-[24rem]',
            showResultPane ? 'hidden lg:flex lg:flex-col' : 'flex flex-col',
          )}
        >
          <JobPickList
            error={jobsError}
            jobs={jobs}
            loading={jobsLoading}
            onClearSearch={() => setSearchInput('')}
            onReload={reloadJobs}
            onSearchInputChange={setSearchInput}
            onSelect={handleSelectJob}
            searchInput={searchInput}
            selectedJobId={selectedJobId}
          />
        </div>

        <div
          className={cn(
            'min-h-0 min-w-0 flex-1',
            showResultPane ? 'flex' : 'hidden lg:flex',
          )}
        >
          <div className="flex h-full min-h-0 w-full flex-col">
            {showResultPane ? (
              <div className="shrink-0 border-b px-3 py-2 lg:hidden">
                <Button
                  onClick={() => setMobileShowResult(false)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Danh sách việc
                </Button>
              </div>
            ) : null}
            <OptimizationPanel
              draftCv={optimization.draftCv}
              onReview={() => setReviewOpen(true)}
              reviewReady={Boolean(optimization.preview) && !reviewOpen}
              evaluating={evaluation.evaluating}
              evaluationError={evaluation.error}
              evaluationResult={evaluation.result}
              evaluationStatus={evaluation.status}
              onEvaluate={handleEvaluate}
              onOptimize={handleOptimize}
              commitError={optimization.commitError}
              commitStatus={optimization.commitStatus}
              optimizationError={optimization.previewError}
              optimizationStatus={optimization.previewStatus}
              optimizing={optimization.previewing || optimization.committing}
              previewing={optimization.previewing}
              selectedCv={selectedCv}
              selectedJob={selectedJob}
            />
          </div>
        </div>
      </div>
      {reviewOpen && optimization.preview ? (
        <OptimizationProposalReviewModal
          commitError={optimization.commitError}
          committing={optimization.committing}
          onCancel={() => setReviewOpen(false)}
          onSave={handleSaveDraft}
          preview={optimization.preview}
        />
      ) : null}
    </div>
  )
}

export default CandidateCvOptimizeWorkspace
