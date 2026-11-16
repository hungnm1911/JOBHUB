import { MessageSquare, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  MESSAGE_LIST_FILTER,
  MESSAGE_LIST_FILTER_LABEL,
  matchesThreadFilter,
  matchesThreadSearch,
} from '../utils'
import ConversationListItem from './ConversationListItem'

const FILTER_SHORT_LABEL = Object.freeze({
  [MESSAGE_LIST_FILTER.ALL]: 'Tất cả',
  [MESSAGE_LIST_FILTER.OPEN]: 'Có chat',
  [MESSAGE_LIST_FILTER.READ_ONLY]: 'Chỉ xem',
})

function ConversationListPanel({
  threads,
  selectedApplicationId,
  onSelect,
  searchInput,
  onSearchInputChange,
  onClearSearch,
  filter,
  onFilterChange,
}) {
  const counts = {
    [MESSAGE_LIST_FILTER.ALL]: threads.length,
    [MESSAGE_LIST_FILTER.OPEN]: threads.filter((thread) =>
      matchesThreadFilter(thread, MESSAGE_LIST_FILTER.OPEN),
    ).length,
    [MESSAGE_LIST_FILTER.READ_ONLY]: threads.filter((thread) =>
      matchesThreadFilter(thread, MESSAGE_LIST_FILTER.READ_ONLY),
    ).length,
  }

  const visibleThreads = threads.filter(
    (thread) => matchesThreadFilter(thread, filter) && matchesThreadSearch(thread, searchInput),
  )

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r bg-card">
      <div className="shrink-0 border-b px-3 pt-3 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MessageSquare aria-hidden="true" className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold tracking-tight">Hội thoại</h2>
            <p className="text-[11px] text-muted-foreground">
              {visibleThreads.length === threads.length
                ? `${threads.length} cuộc trao đổi`
                : `${visibleThreads.length}/${threads.length} đang hiển thị`}
            </p>
          </div>
        </div>

        <label className="relative mt-2.5 block">
          <span className="sr-only">Tìm hội thoại</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-9 w-full rounded-lg border-0 bg-secondary/80 pr-9 pl-8 text-[13px] outline-none transition-shadow placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Tìm recruiter, công ty, việc làm…"
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

        <div
          aria-label="Lọc hội thoại"
          className="mt-2 flex items-center gap-1"
          role="toolbar"
        >
          {Object.values(MESSAGE_LIST_FILTER).map((option) => {
            const active = filter === option
            return (
              <button
                aria-pressed={active}
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                )}
                key={option}
                onClick={() => onFilterChange(option)}
                title={MESSAGE_LIST_FILTER_LABEL[option]}
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
        {visibleThreads.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            Không có hội thoại phù hợp.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {visibleThreads.map((thread) => (
              <li key={thread.applicationId}>
                <ConversationListItem
                  onSelect={onSelect}
                  selected={selectedApplicationId === thread.applicationId}
                  thread={thread}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

export default ConversationListPanel
