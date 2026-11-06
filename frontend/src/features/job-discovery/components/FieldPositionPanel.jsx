import { ArrowRight, RotateCw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import useFieldPositions from '../hooks/useFieldPositions'

function FieldPositionPanel({ field, onSelect, onClose }) {
  const { positions, loading, error, reload } = useFieldPositions(field.id)

  return (
    <section
      aria-labelledby="field-position-heading"
      className="flex h-full min-h-80 flex-col rounded-2xl border bg-card shadow-sm"
      id="field-position-panel"
    >
      <div className="flex items-start justify-between gap-3 border-b px-6 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Vị trí trong ngành</p>
          <h2 className="mt-0.5 truncate text-base font-semibold" id="field-position-heading">
            {field.name}
          </h2>
        </div>
        <Button
          aria-label="Đóng danh sách vị trí"
          className="size-8 shrink-0 rounded-full"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading && (
          <ul aria-busy="true" aria-label="Đang tải vị trí" className="flex flex-wrap gap-2">
            {[96, 132, 112, 148, 88, 120, 104, 140].map((width) => (
              <li
                className="h-8 animate-pulse rounded-full bg-secondary"
                key={width}
                style={{ width }}
              />
            ))}
          </ul>
        )}

        {!loading && error && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">Không tải được danh sách vị trí.</p>
            <Button onClick={reload} size="sm" variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          </div>
        )}

        {!loading && !error && positions.length === 0 && (
          <p className="text-sm text-muted-foreground">Ngành này chưa có vị trí nào.</p>
        )}

        {!loading && !error && positions.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {positions.map((position) => (
              <li key={position.id}>
                <button
                  className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-secondary px-3 py-1.5 text-sm text-secondary-foreground transition-colors outline-none hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onSelect(field.id, position.id)}
                  type="button"
                >
                  {position.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t px-6 py-3">
        <button
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onSelect(field.id, null)}
          type="button"
        >
          Xem tất cả việc làm {field.name}
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </div>
    </section>
  )
}

export default FieldPositionPanel
