import { FileText, LoaderCircle, Upload } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { createUploadedCandidateCvApi } from '@/apis/candidate-cv.api'
import { Button } from '@/components/ui/button'
import {
  CANDIDATE_CV_UPLOADED_PDF,
  CANDIDATE_CV_VISIBILITY,
} from '@/utils/constant'
import { cn } from '@/lib/utils'

import useCvCatalogOptions from '../hooks/useCvCatalogOptions'
import {
  formatFileSize,
  prepareUploadedPdfFile,
  toUploadedCvErrorMessage,
} from '../utils'
import CvMetadataFields from './CvMetadataFields'

function CvUploadForm({
  formId = 'cv-upload-form',
  idPrefix = 'upload',
  onCreated,
  onCancel,
  className,
}) {
  const catalogs = useCvCatalogOptions()
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState(null)
  const [values, setValues] = useState({
    name: '',
    visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId: '',
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!values.name.trim() || !values.categoryId) {
      toast.error('Vui lòng nhập tên CV và chọn ngành nghề.')
      return
    }

    setBusy(true)
    try {
      const prepared = await prepareUploadedPdfFile(file)
      if (prepared.error) {
        toast.error(prepared.error)
        return
      }

      const response = await createUploadedCandidateCvApi({
        file: prepared.file,
        fields: {
          name: values.name.trim(),
          visibility: values.visibility,
          categoryId: values.categoryId,
        },
      })
      toast.success('Đã tải lên CV')
      onCreated?.(response.cv)
    } catch (error) {
      toast.error(toUploadedCvErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={cn('space-y-6', className)} id={formId} onSubmit={handleSubmit}>
      <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-4 transition-colors hover:bg-secondary/45">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Upload aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Chọn file PDF</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tối đa {CANDIDATE_CV_UPLOADED_PDF.MAX_SIZE_MB} MB · tối đa{' '}
              {CANDIDATE_CV_UPLOADED_PDF.MAX_PAGE_COUNT} trang · không mã hóa
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer">
                <span className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                  Chọn tệp
                </span>
                <input
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>
              {file ? (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md bg-background px-2.5 py-1.5 text-xs text-muted-foreground ring-1 ring-border">
                  <FileText aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {file.name}
                    {formatFileSize(file.size) ? ` · ${formatFileSize(file.size)}` : null}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <CvMetadataFields
        catalogsError={catalogs.error}
        catalogsLoading={catalogs.loading}
        experienceLevels={catalogs.experienceLevels}
        fields={catalogs.fields}
        idPrefix={idPrefix}
        includeExperienceLevel={false}
        onChange={setValues}
        values={values}
      />

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-end">
        {onCancel ? (
          <Button
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Hủy
          </Button>
        ) : null}
        <Button aria-busy={busy} className="w-full sm:min-w-36 sm:w-auto" disabled={busy} type="submit">
          {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
          {busy ? 'Đang tải lên…' : 'Tải lên'}
        </Button>
      </div>
    </form>
  )
}

export default CvUploadForm
