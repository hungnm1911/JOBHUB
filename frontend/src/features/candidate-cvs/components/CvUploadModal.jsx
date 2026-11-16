import { CANDIDATE_CV_UPLOADED_PDF } from '@/utils/constant'
import ProfileModal from '@/features/candidate-profile/components/ProfileModal'

import CvUploadForm from './CvUploadForm'

function CvUploadModal({ onClose, onCreated }) {
  return (
    <ProfileModal
      description={`Chỉ nhận PDF, tối đa ${CANDIDATE_CV_UPLOADED_PDF.MAX_SIZE_MB} MB và ${CANDIDATE_CV_UPLOADED_PDF.MAX_PAGE_COUNT} trang.`}
      onClose={onClose}
      title="Upload CV PDF"
    >
      <CvUploadForm
        formId="cv-upload-modal-form"
        idPrefix="upload-modal"
        onCancel={onClose}
        onCreated={(cv) => {
          onCreated?.(cv)
          onClose()
        }}
      />
    </ProfileModal>
  )
}

export default CvUploadModal
