import {
  CircleCheck,
  Download,
  Eye,
  FileText,
  Globe,
  LoaderCircle,
  Lock,
  Pencil,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  CANDIDATE_CV_SOURCE_TYPE,
  CANDIDATE_CV_STATUS,
  CANDIDATE_CV_VISIBILITY,
} from '@/utils/constant'
import { cn } from '@/lib/utils'

import {
  CV_SOURCE_LABEL,
  CV_STATUS_LABEL,
  CV_VISIBILITY_LABEL,
  canActivateCv,
  canDownloadCv,
  canReplaceUploadedFile,
  canSetDefaultCv,
  formatCvDateTime,
} from '../utils'

function CvCard({
  cv,
  busy,
  onPreview,
  onDownload,
  onEditMetadata,
  onReplaceFile,
  onSetDefault,
  onUnsetDefault,
  onToggleVisibility,
  onActivate,
  onArchive,
}) {
  const updatedLabel = formatCvDateTime(cv.updatedAt)
  const isUploaded = cv.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED
  const isDraft = cv.status === CANDIDATE_CV_STATUS.DRAFT
  const isPublic = cv.visibility === CANDIDATE_CV_VISIBILITY.PUBLIC
  const showActivate = canActivateCv(cv)
  const showSetDefault = canSetDefaultCv(cv)

  return (
    <article
      aria-busy={busy}
      className={cn(
        'group relative flex flex-col gap-4 rounded-xl border border-l-4 bg-card p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-5',
        isUploaded
          ? 'border-sky-500/25 border-l-sky-500 bg-sky-500/[0.015]'
          : 'border-violet-500/25 border-l-violet-500 bg-violet-500/[0.015]',
        isDraft &&
          'border-dashed border-amber-500/50 border-l-solid border-l-amber-500 bg-amber-500/[0.03]',
        cv.isDefault &&
          'border-solid border-primary/50 border-l-primary bg-primary/[0.03] ring-2 ring-primary/15',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <button
          aria-label={`Xem trước ${cv.name}`}
          className={cn(
            'relative flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl border transition-opacity outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring',
            isDraft
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
              : isUploaded
                ? 'border-sky-500/25 bg-sky-500/10 text-sky-700'
                : 'border-violet-500/25 bg-violet-500/10 text-violet-700',
          )}
          disabled={busy}
          onClick={() => onPreview(cv)}
          type="button"
        >
          {busy ? (
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
          ) : isUploaded ? (
            <>
              <FileText aria-hidden="true" className="size-4" />
              <span className="mt-0.5 text-[9px] leading-none font-extrabold tracking-wider">
                PDF
              </span>
            </>
          ) : (
            <>
              <Sparkles aria-hidden="true" className="size-4" />
              <span className="mt-0.5 text-[9px] leading-none font-extrabold tracking-wider">
                WEB
              </span>
            </>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <button
            className="block max-w-full truncate rounded-sm text-left text-base font-semibold tracking-tight outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            disabled={busy}
            onClick={() => onPreview(cv)}
            title={cv.name}
            type="button"
          >
            {cv.name}
          </button>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {cv.isDefault ? (
              <button
                aria-label="Đang là CV mặc định. Nhấn để bỏ đặt mặc định"
                className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-2xs transition-opacity outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                disabled={busy}
                onClick={() => onUnsetDefault?.(cv)}
                title="Đang là CV mặc định — Nhấn để bỏ mặc định"
                type="button"
              >
                <Star aria-hidden="true" className="size-3 fill-current" />
                Mặc định
              </button>
            ) : showSetDefault ? (
              <button
                aria-label={`Đặt ${cv.name} làm CV mặc định`}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-primary transition-colors outline-none hover:border-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                disabled={busy}
                onClick={() => onSetDefault?.(cv)}
                title="Nhấn để đặt làm CV mặc định"
                type="button"
              >
                <Star aria-hidden="true" className="size-3" />
                Đặt mặc định
              </button>
            ) : null}

            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                isUploaded
                  ? 'border-sky-500/30 bg-sky-500/10 text-sky-700'
                  : 'border-violet-500/30 bg-violet-500/10 text-violet-700',
              )}
            >
              {isUploaded ? (
                <Upload aria-hidden="true" className="size-3" />
              ) : (
                <Sparkles aria-hidden="true" className="size-3" />
              )}
              {CV_SOURCE_LABEL[cv.sourceType] ?? cv.sourceType}
            </span>

            {showActivate ? (
              <button
                aria-label={`Bản nháp — Nhấn để kích hoạt ${cv.name}`}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 transition-colors outline-none hover:bg-amber-500/25 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                disabled={busy}
                onClick={() => onActivate?.(cv)}
                title="Đang là Bản nháp — Nhấn để kích hoạt sang Đang dùng"
                type="button"
              >
                {CV_STATUS_LABEL[cv.status] ?? cv.status}
                <span aria-hidden="true" className="underline">
                  · Kích hoạt
                </span>
              </button>
            ) : (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                  isDraft
                    ? 'border-amber-500/35 bg-amber-500/15 font-semibold text-amber-800'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
                )}
              >
                {isDraft ? null : <CircleCheck aria-hidden="true" className="size-3" />}
                {CV_STATUS_LABEL[cv.status] ?? cv.status}
              </span>
            )}

            {cv.visibility ? (
              <button
                aria-label={`Chế độ hiển thị: ${CV_VISIBILITY_LABEL[cv.visibility] ?? cv.visibility}. Nhấn để đổi`}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                  isPublic
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20'
                    : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
                disabled={busy}
                onClick={() => onToggleVisibility?.(cv)}
                title={
                  isPublic
                    ? 'Đang Công khai (nhà tuyển dụng có thể tìm thấy) — Nhấn để chuyển sang Riêng tư'
                    : 'Đang Riêng tư — Nhấn để chuyển sang Công khai'
                }
                type="button"
              >
                {isPublic ? (
                  <Globe aria-hidden="true" className="size-3" />
                ) : (
                  <Lock aria-hidden="true" className="size-3" />
                )}
                {CV_VISIBILITY_LABEL[cv.visibility] ?? cv.visibility}
              </button>
            ) : null}
          </div>

          <p className="mt-1.5 text-xs text-muted-foreground">
            {isDraft && showActivate
              ? 'Bản nháp chưa dùng để ứng tuyển — kích hoạt khi nội dung đã hoàn chỉnh.'
              : updatedLabel
                ? `Cập nhật ${updatedLabel}`
                : null}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
        {showActivate ? (
          <Button
            aria-label={`Kích hoạt ${cv.name}`}
            disabled={busy}
            onClick={() => onActivate(cv)}
            size="icon"
            title="Kích hoạt"
            type="button"
          >
            <CircleCheck aria-hidden="true" className="size-4" />
          </Button>
        ) : null}

        <Button
          aria-label={`Xem trước ${cv.name}`}
          disabled={busy}
          onClick={() => onPreview(cv)}
          size="icon"
          title="Xem trước"
          type="button"
          variant="outline"
        >
          <Eye aria-hidden="true" className="size-4" />
        </Button>

        {canDownloadCv(cv) ? (
          <Button
            aria-label={`Tải xuống ${cv.name}`}
            disabled={busy}
            onClick={() => onDownload(cv)}
            size="icon"
            title="Tải xuống PDF"
            type="button"
            variant="outline"
          >
            <Download aria-hidden="true" className="size-4" />
          </Button>
        ) : null}

        <Button
          aria-label={`Sửa thông tin ${cv.name}`}
          disabled={busy}
          onClick={() => onEditMetadata(cv)}
          size="icon"
          title="Sửa thông tin"
          type="button"
          variant="outline"
        >
          <Pencil aria-hidden="true" className="size-4" />
        </Button>

        {canReplaceUploadedFile(cv) ? (
          <Button
            aria-label={`Thay file PDF ${cv.name}`}
            disabled={busy}
            onClick={() => onReplaceFile(cv)}
            size="icon"
            title="Thay file PDF"
            type="button"
            variant="outline"
          >
            <Upload aria-hidden="true" className="size-4" />
          </Button>
        ) : null}

        <Button
          aria-label={`Xóa ${cv.name} khỏi thư viện`}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={busy}
          onClick={() => onArchive(cv)}
          size="icon"
          title="Xóa khỏi thư viện"
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </article>
  )
}

export default CvCard
