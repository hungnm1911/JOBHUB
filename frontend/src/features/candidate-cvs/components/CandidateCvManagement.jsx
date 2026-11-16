import { CircleX, FilePlus2, LoaderCircle, RotateCw, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  activateOwnGeneratedCandidateCvApi,
  archiveOwnCandidateCvApi,
  downloadOwnCandidateCvApi,
  setOwnCandidateCvAsDefaultApi,
} from '@/apis/candidate-cv.api'
import CenteredState from '@/components/common/CenteredState'
import PageHeader from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'

import useCandidateCvs from '../hooks/useCandidateCvs'
import {
  fileNameFromContentDisposition,
  triggerBlobDownload,
} from '../utils'
import CvCard from './CvCard'
import CvEditMetadataModal from './CvEditMetadataModal'
import CvPreviewModal from './CvPreviewModal'
import CvReplaceFileModal from './CvReplaceFileModal'

function CandidateCvManagement() {
  const { loading, cvs, error, reload, upsertCv, removeCv } = useCandidateCvs()
  const [busyId, setBusyId] = useState(null)
  const [dialog, setDialog] = useState(null)

  const withBusy = async (cvId, action) => {
    setBusyId(cvId)
    try {
      await action()
    } finally {
      setBusyId(null)
    }
  }

  const handleDownload = async (cv) => {
    await withBusy(cv.id, async () => {
      try {
        const response = await downloadOwnCandidateCvApi(cv.id)
        const disposition = response.headers?.['content-disposition']
        triggerBlobDownload(
          response.data,
          fileNameFromContentDisposition(disposition, `${cv.name || 'cv'}.pdf`),
        )
        toast.success('Đã tải CV')
      } catch (downloadError) {
        toast.error(downloadError.message || 'Không tải được CV')
      }
    })
  }

  const handleSetDefault = async (cv) => {
    await withBusy(cv.id, async () => {
      try {
        const response = await setOwnCandidateCvAsDefaultApi(cv.id)
        const nextDefault = response.cv
        cvs.forEach((item) => {
          if (item.isDefault && item.id !== nextDefault.id) {
            upsertCv({ ...item, isDefault: false })
          }
        })
        upsertCv(nextDefault)
        toast.success('Đã đặt CV mặc định')
        reload()
      } catch (setDefaultError) {
        toast.error(setDefaultError.message || 'Không đặt được CV mặc định')
      }
    })
  }

  const handleActivate = async (cv) => {
    await withBusy(cv.id, async () => {
      try {
        const response = await activateOwnGeneratedCandidateCvApi(cv.id)
        upsertCv(response.cv)
        toast.success('Đã kích hoạt CV')
      } catch (activateError) {
        toast.error(
          activateError.message ||
            'Không kích hoạt được CV. Kiểm tra nội dung đã đủ điều kiện chưa.',
        )
      }
    })
  }

  const handleArchive = async (cv) => {
    if (
      !window.confirm(
        `Bạn chắc chắn muốn xóa “${cv.name}” khỏi thư viện CV? Thao tác này lưu trữ (archive) CV, không khôi phục từ giao diện hiện tại.`,
      )
    ) {
      return
    }

    await withBusy(cv.id, async () => {
      try {
        await archiveOwnCandidateCvApi(cv.id)
        removeCv(cv.id)
        toast.success('Đã xóa CV khỏi thư viện')
      } catch (archiveError) {
        toast.error(archiveError.message || 'Không xóa được CV')
      }
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/candidate/cvs/create?method=upload">
                <Upload aria-hidden="true" className="size-4" />
                Upload CV
              </Link>
            </Button>
            <Button asChild>
              <Link to="/candidate/cvs/create">
                <FilePlus2 aria-hidden="true" className="size-4" />
                Tạo CV mới
              </Link>
            </Button>
          </div>
        }
        description="Quản lý thư viện CV đang hoạt động: tải lên PDF, tạo bản nháp, xem trước và đặt CV mặc định."
        eyebrow="Ứng viên"
        title="CV của tôi"
      />

      {loading ? (
        <CenteredState
          icon={LoaderCircle}
          spinning
          title="Đang tải danh sách CV…"
          tone="bg-primary/10 text-primary"
        />
      ) : null}

      {!loading && error ? (
        <CenteredState
          action={
            <Button onClick={reload} variant="outline">
              <RotateCw aria-hidden="true" className="size-4" />
              Thử lại
            </Button>
          }
          description="Không tải được danh sách CV. Vui lòng thử lại."
          icon={CircleX}
          title="Không tải được CV"
          tone="bg-secondary text-muted-foreground"
        />
      ) : null}

      {!loading && !error && cvs.length === 0 ? (
        <CenteredState
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link to="/candidate/cvs/create?method=upload">
                  <Upload aria-hidden="true" className="size-4" />
                  Upload CV
                </Link>
              </Button>
              <Button asChild>
                <Link to="/candidate/cvs/create">
                  <FilePlus2 aria-hidden="true" className="size-4" />
                  Tạo CV mới
                </Link>
              </Button>
            </div>
          }
          description="Bạn chưa có CV trong thư viện. Hãy tải lên PDF hoặc tạo bản nháp trên JOBHUB."
          icon={CircleX}
          title="Chưa có CV"
          tone="bg-secondary text-muted-foreground"
        />
      ) : null}

      {!loading && !error && cvs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cvs.map((cv) => (
            <CvCard
              busy={busyId === cv.id}
              cv={cv}
              key={cv.id}
              onActivate={handleActivate}
              onArchive={handleArchive}
              onDownload={handleDownload}
              onEditMetadata={(item) => setDialog({ type: 'edit', cv: item })}
              onPreview={(item) => setDialog({ type: 'preview', cv: item })}
              onReplaceFile={(item) => setDialog({ type: 'replace', cv: item })}
              onSetDefault={handleSetDefault}
            />
          ))}
        </div>
      ) : null}

      {dialog?.type === 'edit' ? (
        <CvEditMetadataModal
          cv={dialog.cv}
          onClose={() => setDialog(null)}
          onUpdated={(cv) => {
            upsertCv(cv)
            reload()
          }}
        />
      ) : null}

      {dialog?.type === 'replace' ? (
        <CvReplaceFileModal
          cv={dialog.cv}
          onClose={() => setDialog(null)}
          onUpdated={(cv) => {
            upsertCv(cv)
            reload()
          }}
        />
      ) : null}

      {dialog?.type === 'preview' ? (
        <CvPreviewModal
          cv={dialog.cv}
          key={dialog.cv.id}
          onClose={() => setDialog(null)}
          onDownload={handleDownload}
        />
      ) : null}
    </div>
  )
}

export default CandidateCvManagement
