import {
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Pencil,
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
  const createdLabel = formatCvDateTime(cv.createdAt)

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
    <article className="flex flex-col rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-lg',
            cv.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-primary/10 text-primary',
          )}
        >
          <FileText aria-hidden="true" className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{cv.name}</h3>
            {cv.isDefault ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Star aria-hidden="true" className="size-3" />
                Mặc định
              </span>
            ) : null}
            {cv.status === CANDIDATE_CV_STATUS.DRAFT ? (
              <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground">
                {CV_STATUS_LABEL[cv.status]}
              </span>
            ) : (
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                {CV_STATUS_LABEL[cv.status] ?? cv.status}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {CV_SOURCE_LABEL[cv.sourceType] ?? cv.sourceType}
            {updatedLabel ? ` · Cập nhật ${updatedLabel}` : null}
          </p>
          {createdLabel ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Tạo {createdLabel}</p>
          ) : null}
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

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() => onPreview(cv)}
          size="sm"
          type="button"
          variant="outline"
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
        {canSetDefaultCv(cv) ? (
          <Button
            disabled={busy}
            onClick={() => onSetDefault(cv)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Star aria-hidden="true" className="size-3.5" />
            Đặt mặc định
          </Button>
        ) : null}
      </div>
    </article>
  )
}

export default CvCard
