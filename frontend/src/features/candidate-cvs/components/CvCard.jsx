import {
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { CANDIDATE_CV_SOURCE_TYPE, CANDIDATE_CV_STATUS } from '@/utils/constant'
import { cn } from '@/lib/utils'

import {
  CV_SOURCE_LABEL,
  CV_STATUS_LABEL,
  canActivateCv,
  canDownloadCv,
  canReplaceUploadedFile,
  canSetDefaultCv,
  formatCvDateTime,
} from '../utils'

function ActionMenuItem({ onClick, icon: Icon, children, tone = 'default' }) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-secondary',
        tone === 'danger' && 'text-destructive hover:bg-destructive/10',
      )}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </button>
  )
}

function CvCard({
  cv,
  busy,
  onPreview,
  onDownload,
  onEditMetadata,
  onReplaceFile,
  onSetDefault,
  onActivate,
  onArchive,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const updatedLabel = formatCvDateTime(cv.updatedAt)
  const isUploaded = cv.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED
  const isDraft = cv.status === CANDIDATE_CV_STATUS.DRAFT

  useEffect(() => {
    if (!menuOpen) {
      return undefined
    }
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const run = (action) => {
    setMenuOpen(false)
    action?.()
  }

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md',
        cv.isDefault && 'border-primary/30 ring-1 ring-primary/15',
      )}
    >
      <div
        className={cn(
          'h-1.5 w-full',
          cv.isDefault
            ? 'bg-primary'
            : isDraft
              ? 'bg-warning'
              : isUploaded
                ? 'bg-secondary-foreground/20'
                : 'bg-primary/40',
        )}
      />

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-2xl',
              isUploaded ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary',
            )}
          >
            {isUploaded ? (
              <FileText aria-hidden="true" className="size-5" />
            ) : (
              <Sparkles aria-hidden="true" className="size-5" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {cv.isDefault ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  <Star aria-hidden="true" className="size-3 fill-current" />
                  Mặc định
                </span>
              ) : null}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  isDraft
                    ? 'bg-warning/15 text-warning-foreground'
                    : 'bg-secondary text-secondary-foreground',
                )}
              >
                {CV_STATUS_LABEL[cv.status] ?? cv.status}
              </span>
            </div>
            <h3 className="mt-2 line-clamp-2 text-base font-semibold tracking-tight">
              {cv.name}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {CV_SOURCE_LABEL[cv.sourceType] ?? cv.sourceType}
              {updatedLabel ? ` · Cập nhật ${updatedLabel}` : null}
            </p>
          </div>

          <div className="relative shrink-0" ref={menuRef}>
            <Button
              aria-expanded={menuOpen}
              aria-haspopup="true"
              aria-label="Thao tác CV"
              disabled={busy}
              onClick={() => setMenuOpen((open) => !open)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </Button>
            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border bg-popover p-1 shadow-lg">
                <ActionMenuItem icon={Eye} onClick={() => run(() => onPreview(cv))}>
                  Xem trước
                </ActionMenuItem>
                {canDownloadCv(cv) ? (
                  <ActionMenuItem icon={Download} onClick={() => run(() => onDownload(cv))}>
                    Tải xuống
                  </ActionMenuItem>
                ) : null}
                <ActionMenuItem icon={Pencil} onClick={() => run(() => onEditMetadata(cv))}>
                  Sửa thông tin
                </ActionMenuItem>
                {canReplaceUploadedFile(cv) ? (
                  <ActionMenuItem icon={Upload} onClick={() => run(() => onReplaceFile(cv))}>
                    Thay file PDF
                  </ActionMenuItem>
                ) : null}
                {canSetDefaultCv(cv) ? (
                  <ActionMenuItem icon={Star} onClick={() => run(() => onSetDefault(cv))}>
                    Đặt làm mặc định
                  </ActionMenuItem>
                ) : null}
                {canActivateCv(cv) ? (
                  <ActionMenuItem icon={FileText} onClick={() => run(() => onActivate(cv))}>
                    Kích hoạt CV
                  </ActionMenuItem>
                ) : null}
                <ActionMenuItem
                  icon={Trash2}
                  onClick={() => run(() => onArchive(cv))}
                  tone="danger"
                >
                  Xóa khỏi thư viện
                </ActionMenuItem>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
          <Button
            className="flex-1 sm:flex-none"
            disabled={busy}
            onClick={() => onPreview(cv)}
            size="sm"
            type="button"
          >
            <Eye aria-hidden="true" className="size-3.5" />
            Xem trước
          </Button>
          {canDownloadCv(cv) ? (
            <Button
              disabled={busy}
              onClick={() => onDownload(cv)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download aria-hidden="true" className="size-3.5" />
              Tải xuống
            </Button>
          ) : null}
          {canActivateCv(cv) ? (
            <Button
              disabled={busy}
              onClick={() => onActivate(cv)}
              size="sm"
              type="button"
              variant="outline"
            >
              Kích hoạt
            </Button>
          ) : null}
          {canSetDefaultCv(cv) ? (
            <Button
              disabled={busy}
              onClick={() => onSetDefault(cv)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Star aria-hidden="true" className="size-3.5" />
              Mặc định
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default CvCard
