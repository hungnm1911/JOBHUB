import { LoaderCircle, Upload } from 'lucide-react'
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
    experienceLevelId: '',
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
          experienceLevelId: values.experienceLevelId || null,
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
    <form className={cn('space-y-5', className)} id={formId} onSubmit={handleSubmit}>
      <div className="rounded-xl border border-dashed bg-secondary/30 px-4 py-6 text-center">
        <Upload aria-hidden="true" className="mx-auto size-8 text-primary" />
        <p className="mt-3 text-sm font-medium">Chọn file PDF CV của bạn</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tối đa {CANDIDATE_CV_UPLOADED_PDF.MAX_SIZE_MB} MB · tối đa{' '}
          {CANDIDATE_CV_UPLOADED_PDF.MAX_PAGE_COUNT} trang · không mã hóa
        </p>
        <label className="mt-4 inline-flex cursor-pointer">
          <span className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
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
          <p className="mt-3 text-sm text-muted-foreground">
            {file.name}
            {formatFileSize(file.size) ? ` · ${formatFileSize(file.size)}` : null}
          </p>
        ) : null}
      </div>

      <CvMetadataFields
        catalogsError={catalogs.error}
        catalogsLoading={catalogs.loading}
        experienceLevels={catalogs.experienceLevels}
        fields={catalogs.fields}
        idPrefix={idPrefix}
        onChange={setValues}
        values={values}
      />

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button disabled={busy} onClick={onCancel} type="button" variant="outline">
            Hủy
          </Button>
        ) : null}
        <Button disabled={busy} type="submit">
          {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
          Tải lên
        </Button>
      </div>
    </form>
  )
}

export default CvUploadForm
