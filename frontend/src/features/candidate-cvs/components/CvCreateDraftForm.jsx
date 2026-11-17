import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { createGeneratedDraftCandidateCvApi } from '@/apis/candidate-cv.api'
import { Button } from '@/components/ui/button'
import {
  CANDIDATE_CV_CREATION_INTENT,
  CANDIDATE_CV_VISIBILITY,
} from '@/utils/constant'
import { cn } from '@/lib/utils'

import useCvCatalogOptions from '../hooks/useCvCatalogOptions'
import CvMetadataFields from './CvMetadataFields'

function CvCreateDraftForm({
  formId = 'cv-create-form',
  idPrefix = 'create',
  onCreated,
  onCancel,
  className,
}) {
  const catalogs = useCvCatalogOptions()
  const [busy, setBusy] = useState(false)
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
      const response = await createGeneratedDraftCandidateCvApi({
        name: values.name.trim(),
        visibility: values.visibility,
        categoryId: values.categoryId,
        experienceLevelId: values.experienceLevelId || null,
        creationIntent: CANDIDATE_CV_CREATION_INTENT.SAVE_DRAFT,
      })
      toast.success('Đã tạo bản nháp CV')
      onCreated?.(response.cv)
    } catch (error) {
      toast.error(error.message || 'Không tạo được CV')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={cn('space-y-6', className)} id={formId} onSubmit={handleSubmit}>
      <CvMetadataFields
        catalogsError={catalogs.error}
        catalogsLoading={catalogs.loading}
        experienceLevels={catalogs.experienceLevels}
        fields={catalogs.fields}
        idPrefix={idPrefix}
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
          {busy ? 'Đang tạo…' : 'Tạo bản nháp'}
        </Button>
      </div>
    </form>
  )
}

export default CvCreateDraftForm
