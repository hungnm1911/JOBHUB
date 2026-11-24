import { useState } from 'react'

import useUnsavedChangesPrompt from '@/components/common/UnsavedChangesProvider/hooks/useUnsavedChangesPrompt'
import ProfileModal from '@/features/candidate-profile/components/ProfileModal'

import CvCreateDraftForm from './CvCreateDraftForm'

function CvCreateDraftModal({ onClose, onCreated }) {
  const [isDirty, setIsDirty] = useState(false)
  const { confirmDiscard, markSaved } = useUnsavedChangesPrompt(isDirty)
  const handleClose = () => confirmDiscard(onClose)

  return (
    <ProfileModal
      description="Tạo CV Generated dạng bản nháp. Bạn có thể bổ sung nội dung và kích hoạt khi đủ điều kiện."
      onClose={handleClose}
      title="Tạo CV mới"
    >
      <CvCreateDraftForm
        formId="cv-create-modal-form"
        idPrefix="create-modal"
        onCancel={handleClose}
        onCreated={(cv) => {
          markSaved()
          onCreated?.(cv)
          onClose()
        }}
        onDirtyChange={setIsDirty}
      />
    </ProfileModal>
  )
}

export default CvCreateDraftModal
