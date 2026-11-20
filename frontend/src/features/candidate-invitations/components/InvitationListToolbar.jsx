import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import { cn } from '@/lib/utils'

import {
  INVITATION_FILTER_TABS,
  INVITATION_SORT,
  INVITATION_SORT_LABEL,
  JOB_INVITATION_STATUS_LABEL,
} from '../utils'

const INVITATION_SORT_OPTIONS = Object.values(INVITATION_SORT).map((option) => ({
  value: option,
  label: INVITATION_SORT_LABEL[option],
}))

function InvitationListToolbar({
  status,
  searchInput,
  sort,
  countsByStatus,
  totalCount,
  onStatusChange,
  onSearchInputChange,
  onClearSearch,
  onSortChange,
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          aria-pressed={status == null}
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
        {INVITATION_FILTER_TABS.map((tabStatus) => {
          const count = countsByStatus[tabStatus] ?? 0
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
              {JOB_INVITATION_STATUS_LABEL[tabStatus] ?? tabStatus} ({count})
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Tìm theo việc làm, công ty hoặc nhà tuyển dụng</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="w-full rounded-lg border bg-background py-2.5 pr-10 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Tìm theo việc làm, công ty hoặc nhà tuyển dụng…"
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

        <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">Sắp xếp</span>
          <SelectDropdown
            align="end"
            ariaLabel="Sắp xếp lời mời"
            className="w-44"
            onChange={onSortChange}
            options={INVITATION_SORT_OPTIONS}
            value={sort}
          />
        </div>
      </div>
    </section>
  )
}

export default InvitationListToolbar
