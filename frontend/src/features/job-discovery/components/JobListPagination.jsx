import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function getPageItems(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  const sorted = [...pages].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b)

  return sorted.flatMap((item, index) =>
    index > 0 && item - sorted[index - 1] > 1 ? [`gap-${item}`, item] : [item],
  )
}

function JobListPagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <nav aria-label="Phân trang việc làm" className="flex items-center justify-center gap-2">
      <Button
        aria-label="Trang trước"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        size="icon"
        variant="outline"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </Button>

      {getPageItems(page, totalPages).map((item) =>
        typeof item === 'string' ? (
          <span aria-hidden="true" className="w-6 text-center text-muted-foreground" key={item}>
            …
          </span>
        ) : (
          <Button
            aria-current={item === page ? 'page' : undefined}
            className={cn(item !== page && 'bg-card')}
            key={item}
            onClick={() => onPageChange(item)}
            size="icon"
            variant={item === page ? 'default' : 'outline'}
          >
            {item}
          </Button>
        ),
      )}

      <Button
        aria-label="Trang sau"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        size="icon"
        variant="outline"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </Button>
    </nav>
  )
}

export default JobListPagination
