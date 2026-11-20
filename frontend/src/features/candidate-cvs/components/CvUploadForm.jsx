import { Check, FileText, LoaderCircle, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { createUploadedCandidateCvApi } from '@/apis/candidate-cv.api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CANDIDATE_CV_UPLOADED_PDF,
  CANDIDATE_CV_VISIBILITY,
} from '@/utils/constant'

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
    experienceLevelId: '',
    skillTags: [],
    employmentTypes: [],
    workModes: [],
    preferredLocations: [],
  })

  const handleFileChange = (picked) => {
    setFile(picked)
    if (picked && !values.name.trim()) {
      const baseName = picked.name.replace(/\.pdf$/i, '')
      setValues((current) => ({ ...current, name: baseName }))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!file) {
      toast.error('Vui lòng chọn tệp PDF.')
      return
    }
    if (!values.name.trim() || !values.categoryId) {
      toast.error('Vui lòng nhập Tên CV và chọn Ngành nghề.')
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
          experienceLevelId: values.experienceLevelId || null,
          skillTags: values.skillTags,
          employmentTypes: values.employmentTypes,
          workModes: values.workModes,
          preferredLocations: values.preferredLocations,
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
    <form className={cn('space-y-4', className)} id={formId} onSubmit={handleSubmit}>
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-l-4 border-l-sky-500 bg-card px-4 py-3.5 transition-colors',
          file ? 'border-sky-500/40 bg-sky-500/5' : '',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors',
              file
                ? 'bg-emerald-500/15 text-emerald-700'
                : 'bg-sky-500/15 text-sky-700',
            )}
          >
            {file ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <Upload aria-hidden="true" className="size-4" />
            )}
          </span>

          <div className="min-w-0">
            {file ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                <FileText aria-hidden="true" className="size-3.5 shrink-0 text-sky-600" />
                <span className="truncate font-semibold">{file.name}</span>
                {formatFileSize(file.size) ? (
                  <span className="text-muted-foreground">
                    ({formatFileSize(file.size)})
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">
                  Tệp CV PDF <span className="text-destructive">*</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Tối đa {CANDIDATE_CV_UPLOADED_PDF.MAX_SIZE_MB} MB ·{' '}
                  {CANDIDATE_CV_UPLOADED_PDF.MAX_PAGE_COUNT} trang
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer">
            <span
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors',
                file
                  ? 'border border-border bg-background text-foreground hover:bg-secondary'
                  : 'bg-primary text-primary-foreground hover:opacity-90',
              )}
            >
              <Upload aria-hidden="true" className="size-3.5" />
              {file ? 'Đổi tệp' : 'Chọn PDF'}
            </span>
            <input
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null
                if (picked) {
                  handleFileChange(picked)
                }
              }}
              type="file"
            />
          </label>

          {file && (
            <Button
              disabled={busy}
              onClick={() => setFile(null)}
              size="icon-sm"
              title="Gỡ tệp"
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" className="size-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 sm:p-5">
        <CvMetadataFields
          catalogsError={catalogs.error}
          catalogsLoading={catalogs.loading}
          experienceLevels={catalogs.experienceLevels}
          fields={catalogs.fields}
          idPrefix={idPrefix}
          onChange={setValues}
          provinces={catalogs.provinces}
          values={values}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
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
        <Button
          aria-busy={busy}
          className="w-full sm:min-w-36 sm:w-auto"
          disabled={busy}
          type="submit"
        >
          {busy ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Upload aria-hidden="true" className="size-4" />
          )}
          {busy ? 'Đang tải lên…' : 'Tải lên CV'}
        </Button>
      </div>
    </form>
  )
}

export default CvUploadForm
