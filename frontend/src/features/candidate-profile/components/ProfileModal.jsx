import { X } from 'lucide-react'
import { useEffect, useId } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function ProfileModal({
  title,
  description,
  onClose,
  children,
  footer,
  busy = false,
  panelClassName,
}) {
  const titleId = useId()

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-hero/50 p-4 sm:items-center"
      onClick={() => {
        if (!busy) {
          onClose()
        }
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          'flex max-h-[min(40rem,92svh)] w-full max-w-lg flex-col rounded-2xl border bg-card shadow-lg',
          panelClassName,
        )}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold" id={titleId}>
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <Button
            aria-label="Đóng"
            disabled={busy}
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export default ProfileModal
