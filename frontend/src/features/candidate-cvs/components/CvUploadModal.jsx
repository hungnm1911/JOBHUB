import { CANDIDATE_CV_UPLOADED_PDF } from '@/utils/constant'
import ProfileModal from '@/features/candidate-profile/components/ProfileModal'

import CvUploadForm from './CvUploadForm'

function CvUploadModal({ onClose, onCreated }) {
  const [isDirty, setIsDirty] = useState(false)
  const { confirmDiscard, markSaved } = useUnsavedChangesPrompt(isDirty)
  const handleClose = () => confirmDiscard(onClose)

  return (
    <ProfileModal
      description={`Chỉ nhận PDF, tối đa ${CANDIDATE_CV_UPLOADED_PDF.MAX_SIZE_MB} MB và ${CANDIDATE_CV_UPLOADED_PDF.MAX_PAGE_COUNT} trang.`}
      onClose={handleClose}
      title="Upload CV PDF"
    >
      <CvUploadForm
        formId="cv-upload-modal-form"
        idPrefix="upload-modal"
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

export default CvUploadModal
import { useState } from 'react'

import useUnsavedChangesPrompt from '@/components/common/useUnsavedChangesPrompt'
