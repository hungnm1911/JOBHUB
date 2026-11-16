import ProfileModal from '@/features/candidate-profile/components/ProfileModal'

import CvCreateDraftForm from './CvCreateDraftForm'

function CvCreateDraftModal({ onClose, onCreated }) {
  return (
    <ProfileModal
      description="Tạo CV Generated dạng bản nháp. Bạn có thể bổ sung nội dung và kích hoạt khi đủ điều kiện."
      onClose={onClose}
      title="Tạo CV mới"
    >
      <CvCreateDraftForm
        formId="cv-create-modal-form"
        idPrefix="create-modal"
        onCancel={onClose}
        onCreated={(cv) => {
          onCreated?.(cv)
          onClose()
        }}
      />
    </ProfileModal>
  )
}

export default CvCreateDraftModal
