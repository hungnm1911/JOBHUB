import { LoaderCircle, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'

import { listOwnCandidateCvsApi } from '@/apis/candidate-cv.api'
import { Button } from '@/components/ui/button'
import { CANDIDATE_CV_SOURCE_TYPE, CANDIDATE_CV_STATUS } from '@/utils/constant'

const SOURCE_LABEL = Object.freeze({
  [CANDIDATE_CV_SOURCE_TYPE.GENERATED]: 'CV tạo trên JOBHUB',
  [CANDIDATE_CV_SOURCE_TYPE.UPLOADED]: 'CV tải lên',
})

function eligibleCvs(cvs) {
  return cvs.filter((cv) => cv.status === CANDIDATE_CV_STATUS.ACTIVE && !cv.archivedAt)
}

function ApplyJobDialog({ jobTitle, submitting, error, onConfirm, onClose }) {
  const titleId = useId()
  const [view, setView] = useState({ loading: true, cvs: [], loadError: null })
  const [selectedCvId, setSelectedCvId] = useState(null)

  useEffect(() => {
    let active = true

    listOwnCandidateCvsApi().then(
      ({ cvs }) => {
        if (!active) {
          return
        }

        const options = eligibleCvs(cvs)
        const defaultCv = options.find((cv) => cv.isDefault)
        setView({ loading: false, cvs: options, loadError: null })
        setSelectedCvId(defaultCv?.id ?? options[0]?.id ?? null)
      },
      (loadError) => {
        if (active) {
          setView({ loading: false, cvs: [], loadError })
        }
      },
    )

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !submitting) {
        onClose()
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, submitting])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-hero/50 p-4 sm:items-center"
      onClick={() => {
        if (!submitting) {
          onClose()
        }
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[min(36rem,90svh)] w-full max-w-lg flex-col rounded-2xl border bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold" id={titleId}>
              Ứng tuyển
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{jobTitle}</p>
          </div>
          <button
            aria-label="Đóng"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {view.loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              Đang tải danh sách CV...
            </p>
          )}

          {!view.loading && view.loadError && (
            <p className="text-sm text-destructive" role="alert">
              {view.loadError.message}
            </p>
          )}

          {!view.loading && !view.loadError && view.cvs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Bạn chưa có CV đang hoạt động để ứng tuyển. Hãy thêm CV vào thư viện của bạn rồi thử lại.
            </p>
          )}

          {!view.loading && view.cvs.length > 0 && (
            <fieldset>
              <legend className="text-sm font-medium">Chọn CV để nộp</legend>
              <ul className="mt-3 space-y-2">
                {view.cvs.map((cv) => (
                  <li key={cv.id}>
                    <label
                      className={
                        selectedCvId === cv.id
                          ? 'flex cursor-pointer items-start gap-3 rounded-xl border border-primary bg-primary/5 px-3 py-3'
                          : 'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3'
                      }
                    >
                      <input
                        checked={selectedCvId === cv.id}
                        className="mt-1 size-4 accent-primary"
                        name="candidateCvId"
                        onChange={() => setSelectedCvId(cv.id)}
                        type="radio"
                        value={cv.id}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium break-words">{cv.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {SOURCE_LABEL[cv.sourceType] ?? cv.sourceType}
                          {cv.isDefault ? ' · CV mặc định' : ''}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button disabled={submitting} onClick={onClose} type="button" variant="outline">
            Hủy
          </Button>
          <Button
            disabled={submitting || !selectedCvId}
            onClick={() => onConfirm(selectedCvId)}
            type="button"
          >
            {submitting && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            Xác nhận ứng tuyển
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ApplyJobDialog
