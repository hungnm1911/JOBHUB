import { Check, ChevronLeft, ChevronRight, Network } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import useFieldJobCounts from '../hooks/useFieldJobCounts'

const FIELDS_PER_PAGE = 6

const countFormatter = new Intl.NumberFormat('vi-VN')

function FieldCategoryPanel({
  fields,
  loading,
  error,
  selectedFieldId,
  previewFieldId,
  onSelect,
  onPreview,
}) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(fields.length / FIELDS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const visibleFields = fields.slice(
    (currentPage - 1) * FIELDS_PER_PAGE,
    currentPage * FIELDS_PER_PAGE,
  )
  const { counts, loading: countsLoading } = useFieldJobCounts(
    visibleFields.map((field) => field.id),
  )

  return (
    <section
      aria-labelledby="field-category-heading"
      className="flex flex-col rounded-2xl border bg-card"
    >
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold" id="field-category-heading">
          <Network aria-hidden="true" className="size-5 text-primary" />
          Danh mục ngành nghề
        </h2>
        {selectedFieldId && (
          <Button className="h-8 px-2 text-xs" onClick={() => onSelect(null)} variant="ghost">
            Bỏ chọn
          </Button>
        )}
      </div>

      <div className="flex-1 px-2 py-2">
        {loading && (
          <ul aria-busy="true" aria-label="Đang tải danh mục" className="space-y-1">
            {Array.from({ length: FIELDS_PER_PAGE }, (_, index) => (
              <li className="h-[60px] animate-pulse rounded-lg bg-secondary/70" key={index} />
            ))}
          </ul>
        )}

        {!loading && error && (
          <p className="px-3 py-6 text-sm text-muted-foreground">
            Không tải được danh mục ngành nghề.
          </p>
        )}

        {!loading && !error && fields.length === 0 && (
          <p className="px-3 py-6 text-sm text-muted-foreground">Chưa có ngành nghề nào.</p>
        )}

        {!loading && !error && visibleFields.length > 0 && (
          <ul className="space-y-1">
            {visibleFields.map((field) => {
              const selected = field.id === selectedFieldId
              const previewed = field.id === previewFieldId
              const count = counts.get(field.id)

              return (
                <li key={field.id}>
                  <button
                    aria-controls={previewed ? 'field-position-panel' : undefined}
                    aria-expanded={previewed}
                    aria-pressed={selected}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring',
                      previewed && 'bg-secondary',
                      selected && 'bg-primary/10 hover:bg-primary/10',
                    )}
                    onClick={() => {
                      onPreview(field.id)
                      onSelect(selected ? null : field.id)
                    }}
                    onFocus={() => onPreview(field.id)}
                    onMouseEnter={() => onPreview(field.id)}
                    title={field.name}
                    type="button"
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-sm font-medium',
                          (selected || previewed) && 'text-primary',
                        )}
                      >
                        {field.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {countsLoading
                          ? 'Đang đếm...'
                          : count == null
                            ? '—'
                            : `${countFormatter.format(count)} việc làm`}
                      </span>
                    </span>
                    {selected ? (
                      <Check aria-hidden="true" className="size-4 text-primary" />
                    ) : (
                      <ChevronRight
                        aria-hidden="true"
                        className={cn(
                          'size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5',
                          previewed && 'translate-x-0.5 text-primary',
                        )}
                      />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!loading && !error && fields.length > FIELDS_PER_PAGE && (
        <div className="flex items-center justify-between border-t px-5 py-3">
          <p className="text-xs text-muted-foreground">
            Trang <span className="font-semibold text-foreground">{currentPage}</span>/{totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              aria-label="Trang danh mục trước"
              className="size-8 rounded-full"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              size="icon"
              variant="outline"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label="Trang danh mục sau"
              className="size-8 rounded-full"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              size="icon"
              variant="outline"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

export default FieldCategoryPanel
