import { BriefcaseBusiness, LoaderCircle, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import CompanyLogo from '@/features/job-discovery/components/CompanyLogo'
import {
  formatSalary,
  formatWorkModes,
} from '@/features/job-discovery/utils'
import { cn } from '@/lib/utils'

function JobPickList({
  jobs,
  loading,
  error,
  searchInput,
  onSearchInputChange,
  onClearSearch,
  onReload,
  selectedJobId,
  onSelect,
}) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r bg-card">
      <div className="shrink-0 border-b px-3 pt-3 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BriefcaseBusiness aria-hidden="true" className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold tracking-tight">Chọn việc làm</h2>
            <p className="text-[11px] text-muted-foreground">
              {loading ? 'Đang tải…' : `${jobs.length} việc đang hiển thị`}
            </p>
          </div>
        </div>

        <label className="relative mt-2.5 block">
          <span className="sr-only">Tìm việc làm</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-9 w-full rounded-lg border-0 bg-secondary/80 pr-9 pl-8 text-[13px] outline-none transition-shadow placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Tìm theo tiêu đề, công ty…"
            value={searchInput}
          />
          {searchInput ? (
            <Button
              aria-label="Xóa tìm kiếm"
              className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
              onClick={onClearSearch}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="size-3.5" />
            </Button>
          ) : null}
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Đang tải việc làm…
          </div>
        ) : null}

        {!loading && error ? (
          <div className="space-y-3 px-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {error.message || 'Không tải được danh sách việc làm.'}
            </p>
            <Button onClick={onReload} size="sm" type="button" variant="outline">
              Thử lại
            </Button>
          </div>
        ) : null}

        {!loading && !error && jobs.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            Không tìm thấy việc làm phù hợp.
          </p>
        ) : null}

        {!loading && !error && jobs.length > 0 ? (
          <ul className="space-y-1">
            {jobs.map((job) => {
              const selected = selectedJobId === job.id
              const meta = [
                formatSalary(job.salary),
                formatWorkModes(job.workModes),
              ]
                .filter(Boolean)
                .join(' · ')

              return (
                <li key={job.id}>
                  <button
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                      selected
                        ? 'bg-primary/8 ring-1 ring-primary/25'
                        : 'hover:bg-secondary/70',
                    )}
                    onClick={() => onSelect(job)}
                    type="button"
                  >
                    <CompanyLogo className="size-9 rounded-md" company={job.company} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">
                        {job.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {job.company?.name || 'Công ty'}
                      </span>
                      {meta ? (
                        <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                          {meta}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </aside>
  )
}

export default JobPickList
