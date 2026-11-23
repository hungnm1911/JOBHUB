import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { replaceOwnUploadedCandidateCvPdfApi } from '@/apis/candidate-cv.api'
import { Button } from '@/components/ui/button'
import useUnsavedChangesPrompt from '@/components/common/useUnsavedChangesPrompt'
import ProfileModal from '@/features/candidate-profile/components/ProfileModal'
import { CANDIDATE_CV_UPLOADED_PDF } from '@/utils/constant'

import { prepareUploadedPdfFile, toUploadedCvErrorMessage } from '../utils'

function CvReplaceFileModal({ cv, onClose, onUpdated }) {
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState(null)
  const { confirmDiscard, markSaved } = useUnsavedChangesPrompt(Boolean(file))
  const handleClose = () => confirmDiscard(onClose)

  const handleSubmit = async (event) => {
    event.preventDefault()

    setBusy(true)
    try {
      const prepared = await prepareUploadedPdfFile(file)
      if (prepared.error) {
        toast.error(prepared.error)
        return
      }

      const response = await replaceOwnUploadedCandidateCvPdfApi(cv.id, prepared.file)
      toast.success('Đã thay file PDF')
      markSaved()
      onUpdated(response.cv)
      onClose()
    } catch (error) {
      toast.error(toUploadedCvErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfileModal
      busy={busy}
      description={`Thay PDF hiện tại của “${cv.name}”. Giới hạn ${CANDIDATE_CV_UPLOADED_PDF.MAX_SIZE_MB} MB / ${CANDIDATE_CV_UPLOADED_PDF.MAX_PAGE_COUNT} trang.`}
      footer={
        <>
          <Button disabled={busy} onClick={handleClose} type="button" variant="outline">
            Hủy
          </Button>
          <Button disabled={busy} form="cv-replace-form" type="submit">
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
            Thay file
          </Button>
        </>
      }
      onClose={handleClose}
      title="Thay file PDF"
    >
      <form className="space-y-4" id="cv-replace-form" onSubmit={handleSubmit}>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">File PDF mới</span>
          <input
            accept="application/pdf,.pdf"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            disabled={busy}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
          {file ? (
            <span className="block text-xs text-muted-foreground">{file.name}</span>
          ) : null}
        </label>
      </form>
    </ProfileModal>
  )
}

export default CvReplaceFileModal
