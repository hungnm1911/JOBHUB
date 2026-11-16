import { Download, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { previewOwnApplicationSubmittedCvApi } from '@/apis/application.api'
import { Button } from '@/components/ui/button'
import ProfileModal from '@/features/candidate-profile/components/ProfileModal'

function SubmittedCvPreviewModal({ applicationId, title, onClose, onDownload }) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    objectUrl: null,
  })

  useEffect(() => {
    let active = true
    let objectUrl = null

    previewOwnApplicationSubmittedCvApi(applicationId).then(
      (response) => {
        if (!active) {
          return
        }
        objectUrl = URL.createObjectURL(response.data)
        setState({ loading: false, error: null, objectUrl })
      },
      (error) => {
        if (active) {
          setState({
            loading: false,
            error: error.message || 'Không xem trước được CV đã nộp.',
            objectUrl: null,
          })
        }
      },
    )

    return () => {
      active = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [applicationId])

  return (
    <ProfileModal
      description={title}
      footer={
        <>
          <Button onClick={onClose} type="button" variant="outline">
            Đóng
          </Button>
          <Button onClick={onDownload} type="button">
            <Download aria-hidden="true" className="size-4" />
            Tải xuống
          </Button>
        </>
      }
      onClose={onClose}
      panelClassName="max-w-4xl"
      title="Xem CV đã nộp"
    >
      {state.loading ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
          Đang tải bản xem trước…
        </div>
      ) : null}

      {state.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      {state.objectUrl ? (
        <iframe
          className="min-h-[28rem] w-full rounded-lg border bg-secondary/30"
          src={state.objectUrl}
          title={`Xem trước ${title}`}
        />
      ) : null}
    </ProfileModal>
  )
}

export default SubmittedCvPreviewModal
