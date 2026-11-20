import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

function normalizeSearchText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function SelectDropdown({
  id,
  value = '',
  onChange,
  options = [],
  placeholder = 'Chọn...',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Tìm kiếm...',
  emptyText = 'Không có kết quả phù hợp',
  ariaLabel,
  align = 'start',
  size = 'default',
  icon: LeadingIcon = null,
  className,
  panelClassName,
}) {
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)
  const listboxId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)) ?? null,
    [options, value],
  )

  const shouldShowSearch = searchable || options.length >= 8

  const filteredOptions = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      return options
    }
    const normalizedQuery = normalizeSearchText(trimmed)
    return options.filter((opt) =>
      normalizeSearchText(opt.label).includes(normalizedQuery),
    )
  }, [options, query])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handleOutsidePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
        setQuery('')
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('pointerdown', handleOutsidePointer)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  useEffect(() => {
    if (open && shouldShowSearch) {
      searchInputRef.current?.focus()
    }
  }, [open, shouldShowSearch])

  const toggleOpen = () => {
    if (disabled) {
      return
    }
    setOpen((current) => {
      const next = !current
      if (!next) {
        setQuery('')
      }
      return next
    })
  }

  const handleSelect = (optionValue) => {
    onChange?.(optionValue)
    setOpen(false)
    setQuery('')
  }

  const hasValue =
    selectedOption != null &&
    selectedOption.value !== '' &&
    selectedOption.value != null
  const displayLabel = selectedOption ? selectedOption.label : placeholder

  return (
    <div className={cn('relative min-w-0', className)} ref={containerRef}>
      <button
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={cn(
          'flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-input bg-secondary/50 px-3 text-left text-sm shadow-2xs outline-none transition-all',
          'hover:bg-secondary/80 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
          'disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm' ? 'h-9 text-xs' : 'h-10',
          open && 'border-primary/60 bg-background ring-2 ring-primary/15',
        )}
        disabled={disabled}
        id={id}
        onClick={toggleOpen}
        type="button"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {LeadingIcon ? (
            <LeadingIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          ) : null}
          <span
            className={cn(
              'truncate',
              hasValue ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            {displayLabel}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
            open && 'rotate-180 text-primary',
          )}
        />
      </button>

      {open && !disabled && (
        <div
          className={cn(
            'absolute top-full z-50 mt-1.5 w-full min-w-48 overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-border/40',
            align === 'end' ? 'right-0' : 'left-0',
            panelClassName,
          )}
          id={listboxId}
          role="listbox"
        >
          {shouldShowSearch && (
            <div className="mb-1.5 px-0.5">
              <div className="flex h-8 items-center gap-2 rounded-lg border bg-secondary/40 px-2.5 focus-within:border-ring focus-within:bg-background">
                <Search
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <input
                  className="w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && filteredOptions.length > 0) {
                      event.preventDefault()
                      handleSelect(filteredOptions[0].value)
                    }
                  }}
                  placeholder={searchPlaceholder}
                  ref={searchInputRef}
                  type="text"
                  value={query}
                />
              </div>
            </div>
          )}

          <ul className="max-h-60 space-y-0.5 overflow-y-auto overscroll-contain">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                {emptyText}
              </li>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value)
                return (
                  <li key={String(opt.value)}>
                    <button
                      aria-selected={isSelected}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors outline-none sm:text-sm',
                        isSelected
                          ? 'bg-primary/10 font-semibold text-primary'
                          : 'text-foreground hover:bg-secondary/80 focus-visible:bg-secondary/80',
                      )}
                      onClick={() => handleSelect(opt.value)}
                      role="option"
                      type="button"
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && (
                        <Check
                          aria-hidden="true"
                          className="size-4 shrink-0 text-primary"
                        />
                      )}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export { SelectDropdown }
export default SelectDropdown
