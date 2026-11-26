import { LoaderCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

function PdfPreview({ url, error, title, viewOnly = false, className }) {
  if (error) {
    return (
      <p className="mt-3 text-sm text-destructive" role="alert">
        Không xem trước được CV.
      </p>
    )
  }
  if (!url) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        Đang tải bản xem trước…
      </p>
    )
  }
  return <iframe className={cn('w-full rounded-lg border bg-secondary', className ?? 'mt-3 h-[70svh]')} src={viewOnly ? `${url}#toolbar=0&navpanes=0` : url} title={title} />
}

export default PdfPreview
