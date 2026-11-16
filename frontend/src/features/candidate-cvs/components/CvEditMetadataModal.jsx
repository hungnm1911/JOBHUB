import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { updateOwnCandidateCvMetadataApi } from '@/apis/candidate-cv.api'
import { Button } from '@/components/ui/button'
import ProfileModal from '@/features/candidate-profile/components/ProfileModal'
import { CANDIDATE_CV_VISIBILITY } from '@/utils/constant'

import useCvCatalogOptions from '../hooks/useCvCatalogOptions'
import CvMetadataFields from './CvMetadataFields'

function CvEditMetadataModal({ cv, onClose, onUpdated }) {
  const catalogs = useCvCatalogOptions()
  const [busy, setBusy] = useState(false)
  const [values, setValues] = useState({
    name: cv.name ?? '',
    visibility: cv.visibility ?? CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId: cv.categoryId ?? '',
    experienceLevelId: cv.experienceLevelId ?? '',
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!values.name.trim() || !values.categoryId) {
      toast.error('Vui lòng nhập tên CV và chọn ngành nghề.')
      return
    }

    setBusy(true)
    try {
      const response = await updateOwnCandidateCvMetadataApi(cv.id, {
        name: values.name.trim(),
        visibility: values.visibility,
        categoryId: values.categoryId,
        experienceLevelId: values.experienceLevelId || null,
      })
      toast.success('Đã cập nhật thông tin CV')
      onUpdated(response.cv)
      onClose()
    } catch (error) {
      toast.error(error.message || 'Không cập nhật được CV')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfileModal
      busy={busy}
      description="Chỉnh sửa metadata CV. Không thay đổi nội dung hoặc file PDF."
      footer={
        <>
          <Button disabled={busy} onClick={onClose} type="button" variant="outline">
            Hủy
          </Button>
          <Button disabled={busy} form="cv-edit-form" type="submit">
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
            Lưu
          </Button>
        </>
      }
      onClose={onClose}
      title="Sửa thông tin CV"
    >
      <form className="space-y-4" id="cv-edit-form" onSubmit={handleSubmit}>
        <CvMetadataFields
          catalogsError={catalogs.error}
          catalogsLoading={catalogs.loading}
          experienceLevels={catalogs.experienceLevels}
          fields={catalogs.fields}
          idPrefix="edit"
          onChange={setValues}
          values={values}
        />
      </form>
    </ProfileModal>
  )
}

export default CvEditMetadataModal
