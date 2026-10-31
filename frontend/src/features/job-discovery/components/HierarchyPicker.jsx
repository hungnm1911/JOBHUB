import { ChevronDown, ChevronRight, LoaderCircle, RotateCw, Search } from 'lucide-react'
import { useCallback, useId, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import useDismissableLayer from '../hooks/useDismissableLayer'

function normalizeText(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function filterByName(items, query) {
  const normalizedQuery = normalizeText(query.trim())
  return normalizedQuery ? items.filter((item) => normalizeText(item.name).includes(normalizedQuery)) : items
}

function Checkbox({ checked, indeterminate = false, label, onChange }) {
  return (
    <input
      aria-label={label}
      checked={checked}
      className="size-4 shrink-0 cursor-pointer accent-primary"
      onChange={onChange}
      ref={(element) => {
        if (element) {
          element.indeterminate = indeterminate
        }
      }}
      type="checkbox"
    />
  )
}

function SearchField({ label, value, onChange }) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-lg border bg-card px-3 focus-within:border-ring">
      <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="sr-only">{label}</span>
      <input
        className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        type="search"
        value={value}
      />
    </label>
  )
}

// A branch with an empty `childIds` list selects the whole parent.
function toggleParent(branches, parentId) {
  return branches.some((branch) => branch.id === parentId)
    ? branches.filter((branch) => branch.id !== parentId)
    : [...branches, { id: parentId, childIds: [] }]
}

function toggleChild(branches, parentId, childId, allChildIds) {
  const branch = branches.find((item) => item.id === parentId)
  const selected = !branch
    ? new Set()
    : branch.childIds.length === 0
      ? new Set(allChildIds)
      : new Set(branch.childIds)

  if (selected.has(childId)) {
    selected.delete(childId)
  } else {
    selected.add(childId)
  }

  const others = branches.filter((item) => item.id !== parentId)

  if (selected.size === 0) {
    return others
  }

  const childIds = selected.size === allChildIds.length ? [] : allChildIds.filter((id) => selected.has(id))
  return [...others, { id: parentId, childIds }]
}

function HierarchyPicker({
  align = 'start',
  icon: Icon,
  label,
  allLabel,
  parents,
  parentsLoading,
  value,
  onApply,
  useChildren,
  text,
}) {
  const containerRef = useRef(null)
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [activeParentId, setActiveParentId] = useState(null)
  const [parentQuery, setParentQuery] = useState('')
  const [childQuery, setChildQuery] = useState('')
  const children = useChildren(open ? activeParentId : null)

  const close = useCallback(() => setOpen(false), [])
  useDismissableLayer(containerRef, open, close)

  const nameById = useMemo(() => new Map(parents.map((parent) => [parent.id, parent.name])), [parents])
  const visibleParents = filterByName(parents, parentQuery)
  const visibleChildren = filterByName(children.items, childQuery)
  const allChildIds = children.items.map((child) => child.id)
  const activeBranch = draft.find((branch) => branch.id === activeParentId)

  const summary =
    value.length === 0
      ? allLabel
      : `${nameById.get(value[0].id) ?? text.unknownParent}${value.length > 1 ? ` +${value.length - 1}` : ''}`

  const openPicker = () => {
    setDraft(value)
    setParentQuery('')
    setChildQuery('')
    setActiveParentId(value[0]?.id ?? parents[0]?.id ?? null)
    setOpen(true)
  }

  const selectParentForBrowsing = (parentId) => {
    setActiveParentId(parentId)
    setChildQuery('')
  }

  return (
    <div className="relative min-w-0" ref={containerRef}>
      <button
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left outline-none hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => (open ? close() : openPicker())}
        type="button"
      >
        <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="truncate text-sm font-medium">{summary}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          aria-label={label}
          className={cn(
            'absolute top-full z-30 mt-2 flex w-[min(40rem,calc(100vw-3rem))] flex-col rounded-xl border bg-popover text-popover-foreground shadow-xl',
            align === 'end' ? 'right-0' : 'left-0',
          )}
          id={panelId}
          role="dialog"
        >
          <div className="grid min-h-0 grid-cols-1 sm:grid-cols-2 sm:divide-x">
            <div className="flex min-h-0 flex-col gap-2 p-3">
              <SearchField label={text.parentSearch} onChange={setParentQuery} value={parentQuery} />
              <ul className="max-h-72 overflow-y-auto">
                {parentsLoading && (
                  <li className="px-2 py-3 text-sm text-muted-foreground">Đang tải...</li>
                )}
                {visibleParents.map((parent) => {
                  const branch = draft.find((item) => item.id === parent.id)

                  return (
                    <li
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2',
                        activeParentId === parent.id && 'bg-primary/10',
                      )}
                      key={parent.id}
                    >
                      <Checkbox
                        checked={Boolean(branch)}
                        indeterminate={Boolean(branch && branch.childIds.length > 0)}
                        label={parent.name}
                        onChange={() => setDraft((current) => toggleParent(current, parent.id))}
                      />
                      <button
                        className={cn(
                          'flex min-h-10 flex-1 items-center justify-between gap-2 text-left text-sm',
                          activeParentId === parent.id && 'font-semibold text-primary',
                        )}
                        onClick={() => selectParentForBrowsing(parent.id)}
                        type="button"
                      >
                        <span className="min-w-0 truncate">{parent.name}</span>
                        {branch?.childIds.length > 0 && (
                          <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                            {branch.childIds.length}
                          </span>
                        )}
                        <ChevronRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  )
                })}
                {!parentsLoading && visibleParents.length === 0 && (
                  <li className="px-2 py-3 text-sm text-muted-foreground">Không có kết quả phù hợp.</li>
                )}
              </ul>
            </div>

            <div className="flex min-h-0 flex-col gap-2 border-t p-3 sm:border-t-0">
              <SearchField label={text.childSearch} onChange={setChildQuery} value={childQuery} />
              <ul className="max-h-72 overflow-y-auto">
                {!activeParentId && (
                  <li className="px-2 py-3 text-sm text-muted-foreground">{text.chooseParent}</li>
                )}
                {children.loading && (
                  <li className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                    Đang tải...
                  </li>
                )}
                {children.error && (
                  <li className="flex items-center justify-between gap-2 px-2 py-3 text-sm text-muted-foreground">
                    Chưa tải được danh sách.
                    <Button onClick={children.reload} size="sm" variant="ghost">
                      <RotateCw aria-hidden="true" className="size-4" />
                      Thử lại
                    </Button>
                  </li>
                )}
                {visibleChildren.map((child) => (
                  <li key={child.id}>
                    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-secondary">
                      <Checkbox
                        checked={Boolean(
                          activeBranch &&
                            (activeBranch.childIds.length === 0 || activeBranch.childIds.includes(child.id)),
                        )}
                        onChange={() =>
                          setDraft((current) => toggleChild(current, activeParentId, child.id, allChildIds))
                        }
                      />
                      <span className="min-w-0 break-words">{child.name}</span>
                    </label>
                  </li>
                ))}
                {activeParentId && !children.loading && !children.error && visibleChildren.length === 0 && (
                  <li className="px-2 py-3 text-sm text-muted-foreground">Không có kết quả phù hợp.</li>
                )}
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t px-3 py-2.5">
            <Button
              className="text-muted-foreground"
              disabled={draft.length === 0}
              onClick={() => setDraft([])}
              size="sm"
              type="button"
              variant="ghost"
            >
              Bỏ chọn tất cả
            </Button>
            <Button
              onClick={() => {
                onApply(draft)
                close()
              }}
              size="sm"
              type="button"
            >
              Áp dụng
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default HierarchyPicker
