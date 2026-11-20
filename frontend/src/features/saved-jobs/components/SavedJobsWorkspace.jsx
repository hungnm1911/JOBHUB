import {
  Bookmark,
  CircleX,
  LoaderCircle,
  RotateCw,
  Search,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import useDiscoveryCatalogs from '@/features/job-discovery/hooks/useDiscoveryCatalogs'
import { cn } from '@/lib/utils'

import useSavedJobs from '../hooks/useSavedJobs'
import {
  SAVED_JOB_FILTER,
  SAVED_JOB_FILTER_LABEL,
  matchesSavedJobFilter,
  matchesSavedJobSearch,
} from '../utils'
import SavedJobCard from './SavedJobCard'

function SavedJobsWorkspace() {
  const { loading, savedJobs, error, reload, removeSavedJob } = useSavedJobs()
  const { provinceNameByCode } = useDiscoveryCatalogs()
  const [busyJobId, setBusyJobId] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState(SAVED_JOB_FILTER.ALL)

  const filterCounts = useMemo(
    () => ({
      [SAVED_JOB_FILTER.ALL]: savedJobs.length,
      [SAVED_JOB_FILTER.OPEN]: savedJobs.filter((entry) =>
        matchesSavedJobFilter(entry, SAVED_JOB_FILTER.OPEN),
      ).length,
      [SAVED_JOB_FILTER.APPLIED]: savedJobs.filter((entry) =>
        matchesSavedJobFilter(entry, SAVED_JOB_FILTER.APPLIED),
      ).length,
    }),
    [savedJobs],
  )

  const visibleJobs = useMemo(
    () =>
      savedJobs.filter(
        (entry) =>
          matchesSavedJobFilter(entry, filter) && matchesSavedJobSearch(entry, searchInput),
      ),
    [savedJobs, filter, searchInput],
  )

  const handleUnsave = async (jobId) => {
    setBusyJobId(jobId)
    try {
      await removeSavedJob(jobId)
    } catch (unsaveError) {
      toast.error(unsaveError.message || 'Không bỏ lưu được việc làm.')
    } finally {
      setBusyJobId(null)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Việc làm đã lưu</h1>
            {!loading && !error && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {savedJobs.length} việc làm
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Theo dõi các công việc bạn quan tâm để xem lại chi tiết, đánh giá CV và ứng tuyển kịp
            thời.
          </p>

          {!loading && !error && savedJobs.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span>
                Chưa ứng tuyển:{' '}
                <strong className="font-semibold text-foreground">
                  {filterCounts[SAVED_JOB_FILTER.OPEN]}
                </strong>
              </span>
              <span>
                Đã ứng tuyển:{' '}
                <strong className="font-semibold text-foreground">
                  {filterCounts[SAVED_JOB_FILTER.APPLIED]}
                </strong>
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/jobs">Tìm thêm việc làm</Link>
          </Button>
        </div>
      </header>

      {loading ? (
        <CenteredState
          icon={LoaderCircle}
          spinning
          title="Đang tải việc làm đã lưu…"
          tone="bg-primary/10 text-primary"
        />
      ) : null}

      {!loading && error ? (
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
      ) : null}

      {!loading && !error && savedJobs.length === 0 ? (
        <CenteredState
          action={
            <Button asChild>
              <Link to="/jobs">Khám phá việc làm</Link>
            </Button>
          }
          description="Lưu việc làm từ trang tìm kiếm hoặc chi tiết công việc để theo dõi tại đây."
          icon={Bookmark}
          title="Chưa lưu việc làm nào"
          tone="bg-secondary text-muted-foreground"
        />
      ) : null}

      {!loading && !error && savedJobs.length > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
            <div
              aria-label="Lọc danh sách việc đã lưu"
              className="flex flex-wrap gap-1.5"
              role="group"
            >
              {Object.values(SAVED_JOB_FILTER).map((option) => {
                const active = filter === option
                const count = filterCounts[option] ?? 0
                return (
                  <button
                    aria-pressed={active}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground',
                    )}
                    key={option}
                    onClick={() => setFilter(option)}
                    type="button"
                  >
                    {SAVED_JOB_FILTER_LABEL[option]}
                    <span
                      className={cn(
                        'inline-flex min-w-4 justify-center rounded-full px-1 text-[10px] font-semibold',
                        active
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-background/80 text-muted-foreground',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <label className="relative block sm:w-64 md:w-72">
              <span className="sr-only">Tìm việc đã lưu</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                className="h-9 w-full rounded-xl border bg-background pr-9 pl-9 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm theo việc làm hoặc công ty…"
                value={searchInput}
              />
              {searchInput ? (
                <Button
                  aria-label="Xóa tìm kiếm"
                  className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
                  onClick={() => setSearchInput('')}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </Button>
              ) : null}
            </label>
          </div>

          {visibleJobs.length === 0 ? (
            <CenteredState
              action={
                <Button
                  onClick={() => {
                    setFilter(SAVED_JOB_FILTER.ALL)
                    setSearchInput('')
                  }}
                  variant="outline"
                >
                  Xóa bộ lọc
                </Button>
              }
              description="Thử đổi từ khóa hoặc chọn bộ lọc khác."
              icon={Search}
              title="Không tìm thấy việc làm phù hợp"
              tone="bg-secondary text-muted-foreground"
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {visibleJobs.map((entry) => (
                <li key={entry.job.id}>
                  <SavedJobCard
                    busy={busyJobId === entry.job.id}
                    entry={entry}
                    onUnsave={handleUnsave}
                    provinceNameByCode={provinceNameByCode}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}

export default SavedJobsWorkspace
