import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { APPLICATION_LIST_STATUS_TABS, APPLICATION_STATUS_LABEL } from '../utils'

function ApplicationListToolbar({
  status,
  searchInput,
  countsByStatus,
  totalCount,
  onStatusChange,
  onSearchInputChange,
  onClearSearch,
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
            status == null
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          )}
          onClick={() => onStatusChange(null)}
          type="button"
        >
          Tất cả ({totalCount})
        </button>
        {APPLICATION_LIST_STATUS_TABS.map((tabStatus) => {
          const count = countsByStatus[tabStatus] ?? 0
          // Hide empty statuses unless currently selected (so filter state stays clear).
          if (count === 0 && status !== tabStatus) {
            return null
          }
          return (
            <button
              aria-pressed={status === tabStatus}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                status === tabStatus
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
              )}
              key={tabStatus}
              onClick={() => onStatusChange(tabStatus)}
              type="button"
            >
              {APPLICATION_STATUS_LABEL[tabStatus] ?? tabStatus} ({count})
            </button>
          )
        })}
      </div>

      <label className="relative block">
        <span className="sr-only">Tìm theo việc làm hoặc công ty</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          className="w-full rounded-lg border bg-background py-2.5 pr-10 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => onSearchInputChange(event.target.value)}
          placeholder="Tìm theo tên việc làm hoặc công ty…"
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
    </section>
  )
}

export default ApplicationListToolbar
