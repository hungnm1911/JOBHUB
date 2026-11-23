import { X } from 'lucide-react'
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

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
      if (event.key === 'Escape' && !busy && !document.querySelector('[data-slot="alert-dialog-content"]')) {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  // Lock background scroll while open; restore whatever value was there before.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // Portal to <body> so ancestor stacking contexts/overflow (app navbar,
  // workspace layout) cannot clip or cover the overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-hero/50 p-4 sm:items-center"
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
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export default ProfileModal
