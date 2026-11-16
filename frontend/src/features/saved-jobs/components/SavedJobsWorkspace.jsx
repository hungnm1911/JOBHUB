import { Bookmark, CircleX, LoaderCircle, RotateCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import useSavedJobs from '../hooks/useSavedJobs'
import { SAVED_JOB_FILTER, getSavedJobId } from '../utils'
import SavedJobDetailPanel from './SavedJobDetailPanel'
import SavedJobListPanel from './SavedJobListPanel'

function SavedJobsWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { loading, savedJobs, error, reload, removeSavedJob } = useSavedJobs()
  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState(SAVED_JOB_FILTER.ALL)
  const [mobileShowDetail, setMobileShowDetail] = useState(Boolean(searchParams.get('jobId')))

  const requestedJobId = searchParams.get('jobId')

  const selectedJobId = useMemo(() => {
    if (requestedJobId && savedJobs.some((entry) => entry.job?.id === requestedJobId)) {
      return requestedJobId
    }
    return getSavedJobId(savedJobs[0])
  }, [requestedJobId, savedJobs])

  const selectedEntry = useMemo(
    () => savedJobs.find((entry) => entry.job?.id === selectedJobId) ?? null,
    [savedJobs, selectedJobId],
  )

  const handleSelect = (jobId) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('jobId', jobId)
        return next
      },
      { replace: true },
    )
    setMobileShowDetail(true)
  }

  const handleUnsave = async (jobId) => {
    await removeSavedJob(jobId)
    const remaining = savedJobs.filter((entry) => entry.job?.id !== jobId)
    const nextId = getSavedJobId(remaining[0])
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (nextId) {
          next.set('jobId', nextId)
        } else {
          next.delete('jobId')
        }
        return next
      },
      { replace: true },
    )
    if (!nextId) {
      setMobileShowDetail(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[min(32rem,70svh)] flex-1 items-center justify-center">
        <CenteredState
          icon={LoaderCircle}
          spinning
          title="Đang tải việc làm đã lưu…"
          tone="bg-primary/10 text-primary"
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[min(32rem,70svh)] flex-1 items-center justify-center p-6">
        <CenteredState
          action={
            <Button onClick={reload} variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          }
          description={error.message || 'Không tải được danh sách việc đã lưu.'}
          icon={CircleX}
          title="Không tải được việc làm đã lưu"
          tone="bg-secondary text-muted-foreground"
        />
      </div>
    )
  }

  if (savedJobs.length === 0) {
    return (
      <div className="flex min-h-[min(32rem,70svh)] flex-1 items-center justify-center p-6">
        <CenteredState
          action={
            <Button asChild variant="outline">
              <Link to="/jobs">Tìm việc làm</Link>
            </Button>
          }
          description="Lưu việc làm từ trang tìm kiếm hoặc chi tiết để theo dõi tại đây."
          icon={Bookmark}
          title="Chưa lưu việc làm nào"
          tone="bg-secondary text-muted-foreground"
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            'min-h-0 w-full shrink-0 lg:w-[22.5rem] xl:w-[24rem]',
            mobileShowDetail ? 'hidden lg:flex lg:flex-col' : 'flex flex-col',
          )}
        >
          <SavedJobListPanel
            filter={filter}
            onClearSearch={() => setSearchInput('')}
            onFilterChange={setFilter}
            onSearchInputChange={setSearchInput}
            onSelect={handleSelect}
            savedJobs={savedJobs}
            searchInput={searchInput}
            selectedJobId={selectedJobId}
          />
        </div>

        <div
          className={cn(
            'min-h-0 min-w-0 flex-1',
            mobileShowDetail ? 'flex' : 'hidden lg:flex',
          )}
        >
          <SavedJobDetailPanel
            entry={selectedEntry}
            onBack={() => setMobileShowDetail(false)}
            onUnsave={handleUnsave}
          />
        </div>
      </div>
    </div>
  )
}

export default SavedJobsWorkspace
