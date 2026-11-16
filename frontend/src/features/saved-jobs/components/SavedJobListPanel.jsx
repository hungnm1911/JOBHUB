import { Bookmark, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  SAVED_JOB_FILTER,
  SAVED_JOB_FILTER_LABEL,
  matchesSavedJobFilter,
  matchesSavedJobSearch,
} from '../utils'
import SavedJobListItem from './SavedJobListItem'

const FILTER_SHORT_LABEL = Object.freeze({
  [SAVED_JOB_FILTER.ALL]: 'Tất cả',
  [SAVED_JOB_FILTER.OPEN]: 'Chưa nộp',
  [SAVED_JOB_FILTER.APPLIED]: 'Đã nộp',
})

function SavedJobListPanel({
  savedJobs,
  selectedJobId,
  onSelect,
  searchInput,
  onSearchInputChange,
  onClearSearch,
  filter,
  onFilterChange,
}) {
  const counts = {
    [SAVED_JOB_FILTER.ALL]: savedJobs.length,
    [SAVED_JOB_FILTER.OPEN]: savedJobs.filter((entry) =>
      matchesSavedJobFilter(entry, SAVED_JOB_FILTER.OPEN),
    ).length,
    [SAVED_JOB_FILTER.APPLIED]: savedJobs.filter((entry) =>
      matchesSavedJobFilter(entry, SAVED_JOB_FILTER.APPLIED),
    ).length,
  }

  const visibleJobs = savedJobs.filter(
    (entry) => matchesSavedJobFilter(entry, filter) && matchesSavedJobSearch(entry, searchInput),
  )

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r bg-card">
      <div className="shrink-0 border-b px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bookmark aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-tight">Việc làm đã lưu</h2>
            <p className="text-xs text-muted-foreground">
              {visibleJobs.length === savedJobs.length
                ? `${savedJobs.length} việc làm`
                : `${visibleJobs.length}/${savedJobs.length} đang hiển thị`}
            </p>
          </div>
        </div>

        <label className="relative mt-3.5 block">
          <span className="sr-only">Tìm việc đã lưu</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-10 w-full rounded-xl border-0 bg-secondary/80 pr-10 pl-9 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Tìm theo việc làm hoặc công ty…"
            value={searchInput}
          />
          {searchInput ? (
            <Button
              aria-label="Xóa tìm kiếm"
              className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
              onClick={onClearSearch}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          ) : null}
        </label>

        <div aria-label="Lọc việc đã lưu" className="mt-3 flex items-center gap-1.5" role="toolbar">
          {Object.values(SAVED_JOB_FILTER).map((option) => {
            const active = filter === option
            return (
              <button
                aria-pressed={active}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                )}
                key={option}
                onClick={() => onFilterChange(option)}
                title={SAVED_JOB_FILTER_LABEL[option]}
                type="button"
              >
                <span>{FILTER_SHORT_LABEL[option]}</span>
                <span
                  className={cn(
                    'inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                    active
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-background/80 text-muted-foreground',
                  )}
                >
                  {counts[option]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {visibleJobs.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            Không có việc làm phù hợp.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {visibleJobs.map((entry) => (
              <li key={entry.job.id}>
                <SavedJobListItem
                  entry={entry}
                  onSelect={onSelect}
                  selected={selectedJobId === entry.job.id}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

export default SavedJobListPanel
