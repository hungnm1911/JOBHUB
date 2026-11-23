import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { replaceOwnApplicationSubmittedCvApi } from '@/apis/application.api'
import { listOwnCandidateCvsApi } from '@/apis/candidate-cv.api'
import { Button } from '@/components/ui/button'
import useUnsavedChangesPrompt from '@/components/common/useUnsavedChangesPrompt'
import ProfileModal from '@/features/candidate-profile/components/ProfileModal'
import { CANDIDATE_CV_STATUS } from '@/utils/constant'

import { CV_SOURCE_LABEL, isActiveCandidateCv } from '../utils'

function ReplaceSubmittedCvModal({ application, onClose, onReplaced }) {
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cvs, setCvs] = useState([])
  const [error, setError] = useState(null)
  const [selectedCvId, setSelectedCvId] = useState('')
  const [initialCvId, setInitialCvId] = useState('')
  const { confirmDiscard, markSaved } = useUnsavedChangesPrompt(
    Boolean(initialCvId) && selectedCvId !== initialCvId,
  )
  const handleClose = () => confirmDiscard(onClose)

  useEffect(() => {
    let active = true
    listOwnCandidateCvsApi().then(
      (response) => {
        if (!active) {
          return
        }
        const activeCvs = (response.cvs ?? []).filter(isActiveCandidateCv)
        setCvs(activeCvs)
        setSelectedCvId(activeCvs[0]?.id ?? '')
        setInitialCvId(activeCvs[0]?.id ?? '')
        setLoading(false)
        setError(null)
      },
      (loadError) => {
        if (active) {
          setLoading(false)
          setError(loadError)
        }
      },
    )
    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!selectedCvId) {
      toast.error('Chọn một CV đang dùng để thay thế.')
      return
    }

    setBusy(true)
    try {
      const response = await replaceOwnApplicationSubmittedCvApi(application.id, {
        candidateCvId: selectedCvId,
        expectedVersion: application.version,
      })
      toast.success('Đã cập nhật CV đã nộp')
      markSaved()
      onReplaced(response.application)
      onClose()
    } catch (replaceError) {
      toast.error(replaceError.message || 'Không thay được CV đã nộp.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfileModal
      busy={busy}
      description="Chỉ dùng CV đang Active. Snapshot mới sẽ thay CV đã nộp cho đơn này."
      footer={
        <>
          <Button disabled={busy} onClick={handleClose} type="button" variant="outline">
            Hủy
          </Button>
          <Button
            disabled={busy || loading || !selectedCvId}
            form="replace-submitted-cv-form"
            type="submit"
          >
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
            Cập nhật CV
          </Button>
        </>
      }
      onClose={handleClose}
      title="Thay CV đã nộp"
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Đang tải thư viện CV…
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">
          {error.message || 'Không tải được danh sách CV.'}
        </p>
      ) : null}

      {!loading && !error && cvs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Bạn chưa có CV Active. Kích hoạt một CV trong thư viện rồi thử lại.
        </p>
      ) : null}

      {!loading && !error && cvs.length > 0 ? (
        <form className="space-y-3" id="replace-submitted-cv-form" onSubmit={handleSubmit}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Chọn CV</legend>
            <ul className="space-y-2">
              {cvs.map((cv) => (
                <li key={cv.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      checked={selectedCvId === cv.id}
                      className="mt-1"
                      disabled={busy}
                      name="candidateCvId"
                      onChange={() => setSelectedCvId(cv.id)}
                      type="radio"
                      value={cv.id}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{cv.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {CV_SOURCE_LABEL[cv.sourceType] ?? cv.sourceType}
                        {cv.status === CANDIDATE_CV_STATUS.ACTIVE ? ' · Đang dùng' : null}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </form>
      ) : null}
    </ProfileModal>
  )
}

export default ReplaceSubmittedCvModal
