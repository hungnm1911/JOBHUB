import { ArrowLeft, FileText, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import useCandidateCvs from '@/features/candidate-cvs/hooks/useCandidateCvs'
import useDiscoveryJobs from '@/features/job-discovery/hooks/useDiscoveryJobs'
import { JOB_DISCOVERY_SORT } from '@/features/job-discovery/search-params'
import { cn } from '@/lib/utils'
import { CANDIDATE_CV_STATUS } from '@/utils/constant'

import useCvJobEvaluation from '../hooks/useCvJobEvaluation'
import EvaluationResultPanel from './EvaluationResultPanel'
import JobPickList from './JobPickList'

function CandidateCvEvaluateWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [cvOverrideId, setCvOverrideId] = useState(null)
  const [mobileShowResult, setMobileShowResult] = useState(false)

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

  const showResultPane = mobileShowResult || Boolean(selectedJobId)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const handleSelectJob = (job) => {
    setMobileShowResult(true)
    evaluation.reset()
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
      toast.error('Hãy chọn CV và việc làm trước khi đánh giá.')
      return
    }

    try {
      await evaluation.evaluate({
        jobId: selectedJob.id,
        candidateCvId: selectedCv.id,
      })
    } catch (error) {
      toast.error(error.message || 'Không đánh giá được CV.')
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
              Đánh giá CV theo việc làm
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Chọn việc từ danh sách, rồi so sánh với CV của bạn qua API thật.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-xl border bg-background px-3 py-2">
            <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="sr-only">Chọn CV để đánh giá</span>
            <select
              className="h-8 w-full min-w-0 bg-transparent text-sm outline-none"
              disabled={cvsLoading || selectableCvs.length === 0}
              onChange={(event) => {
                setCvOverrideId(event.target.value || null)
                evaluation.reset()
              }}
              value={selectedCvId ?? ''}
            >
              {cvsLoading ? <option value="">Đang tải CV…</option> : null}
              {!cvsLoading && selectableCvs.length === 0 ? (
                <option value="">Chưa có CV để đánh giá</option>
              ) : null}
              {selectableCvs.map((cv) => (
                <option key={cv.id} value={cv.id}>
                  {cv.isDefault ? '★ ' : ''}
                  {cv.name}
                  {cv.status === CANDIDATE_CV_STATUS.DRAFT ? ' (nháp)' : ''}
                </option>
              ))}
            </select>
          </label>

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
            <EvaluationResultPanel
              error={evaluation.error}
              evaluating={evaluation.evaluating}
              onEvaluate={handleEvaluate}
              onRetry={handleEvaluate}
              result={evaluation.result}
              selectedCv={selectedCv}
              selectedJob={selectedJob}
              status={evaluation.status}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default CandidateCvEvaluateWorkspace
