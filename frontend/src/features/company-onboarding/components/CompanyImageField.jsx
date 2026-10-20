import { Image as ImageIcon, LoaderCircle, Trash2, Upload } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import { uploadOwnedCompanyImageApi } from '@/apis/company.api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { COMPANY_IMAGE_ACCEPT } from '@/utils/constant'

function CompanyImageField({
  kind,
  label,
  value,
  frameClassName,
  error,
  disabled = false,
  onUploaded,
  onCleared,
}) {
  const inputId = useId()
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [failedUrl, setFailedUrl] = useState(null)
  const hasImage = Boolean(value) && failedUrl !== value
  const isBusy = disabled || uploading

  const pickFile = () => {
    if (!isBusy) {
      inputRef.current?.click()
    }
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setUploading(true)

    try {
      const result = await uploadOwnedCompanyImageApi({ kind, file })
      setFailedUrl(null)
      onUploaded(result.image.url)
      toast.success(`${label} đã được tải lên. Nhớ lưu hồ sơ để giữ thay đổi.`)
    } catch (uploadError) {
      toast.error(uploadError.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium" htmlFor={inputId}>
          {label}
        </label>
        {error && <p className="text-xs text-destructive">{error.message}</p>}
      </div>

      <button
        aria-busy={uploading}
        aria-label={hasImage ? `Đổi ${label}` : `Chọn ${label}`}
        className={cn(
          'group relative block w-full overflow-hidden rounded-xl border border-dashed bg-secondary/30 text-left transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          !isBusy && 'hover:border-primary/40 hover:bg-secondary/50',
          isBusy && 'cursor-not-allowed opacity-70',
          frameClassName,
        )}
        disabled={isBusy}
        onClick={pickFile}
        type="button"
      >
        {hasImage ? (
          <img
            alt={`Xem trước ${label}`}
            className="absolute inset-0 size-full object-cover"
            onError={() => setFailedUrl(value)}
            src={value}
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            <span className="flex size-10 items-center justify-center rounded-full bg-background/80 shadow-sm">
              {uploading ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <ImageIcon aria-hidden="true" className="size-4" />
              )}
            </span>
            <span className="text-sm font-medium text-foreground">
              {uploading ? 'Đang tải lên…' : 'Chọn ảnh'}
            </span>
            <span className="text-xs">JPEG, PNG hoặc WebP</span>
          </span>
        )}

        {hasImage && (
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition',
              'group-hover:opacity-100 group-focus-visible:opacity-100',
              uploading && 'opacity-100',
            )}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-sm font-medium backdrop-blur-sm">
              {uploading ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Upload aria-hidden="true" className="size-4" />
              )}
              {uploading ? 'Đang tải lên…' : 'Đổi ảnh'}
            </span>
          </span>
        )}
      </button>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {hasImage ? 'Nhấp vào ảnh để thay thế.' : 'Nhấp vào khung để tải ảnh lên.'}
        </p>
        {hasImage && (
          <Button
            className="h-8 px-2 text-xs"
            disabled={isBusy}
            onClick={onCleared}
            type="button"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            Xóa
          </Button>
        )}
      </div>

      <input
        accept={COMPANY_IMAGE_ACCEPT}
        className="sr-only"
        disabled={isBusy}
        id={inputId}
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
    </div>
  )
}

export default CompanyImageField
