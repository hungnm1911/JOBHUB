import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
  getOwnCandidateCvApi,
  saveOwnGeneratedContentApi,
  updateOwnCandidateCvMetadataApi,
} from '@/apis/candidate-cv.api'
import { Button } from '@/components/ui/button'
import ProfileModal from '@/features/candidate-profile/components/ProfileModal'
import {
  emptyGeneratedContent,
  toContentPayload,
} from '@/features/candidate-profile/utils'
import { cn } from '@/lib/utils'
import {
  CANDIDATE_CV_SOURCE_TYPE,
  CANDIDATE_CV_VISIBILITY,
} from '@/utils/constant'

import useCvCatalogOptions from '../hooks/useCvCatalogOptions'
import CvGeneratedContentFields from './CvGeneratedContentFields'
import CvMetadataFields from './CvMetadataFields'

function CvEditMetadataModal({ cv, onClose, onUpdated }) {
  const catalogs = useCvCatalogOptions()
  const isGenerated = cv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED
  const [activeTab, setActiveTab] = useState('metadata')
  const [busy, setBusy] = useState(false)
  const [loadedDetailCvId, setLoadedDetailCvId] = useState(null)
  const [detailError, setDetailError] = useState(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const loadingDetail = isGenerated && loadedDetailCvId !== cv.id

  const [values, setValues] = useState({
    name: cv.name ?? '',
    visibility: cv.visibility ?? CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId: cv.categoryId ?? '',
    experienceLevelId: cv.experienceLevelId ?? '',
    skillTags: cv.skillTags ?? [],
    employmentTypes: cv.employmentTypes ?? [],
    workModes: cv.workModes ?? [],
    preferredLocations: cv.preferredLocations ?? [],
  })

  const [generatedContent, setGeneratedContent] = useState(() =>
    cv.generatedContent ?? emptyGeneratedContent(),
  )

  useEffect(() => {
    if (!isGenerated) {
      return undefined
    }
    let active = true
    getOwnCandidateCvApi(cv.id).then(
      ({ cv: detail }) => {
        if (active) {
          if (detail) {
            setGeneratedContent(detail.generatedContent ?? emptyGeneratedContent())
            setLoadedDetailCvId(cv.id)
            setDetailError(null)
          } else {
            setDetailError('Không tải được nội dung CV.')
          }
        }
      },
      (error) => {
        if (active) {
          setDetailError(error.message || 'Không tải được nội dung CV.')
        }
      },
    )
    return () => {
      active = false
    }
  }, [cv.id, isGenerated, loadAttempt])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy || loadingDetail) {
      return
    }
    if (!values.name.trim() || !values.categoryId) {
      toast.error('Vui lòng nhập tên CV và chọn ngành nghề.')
      return
    }

    setBusy(true)
    try {
      const metadataRes = await updateOwnCandidateCvMetadataApi(cv.id, {
        name: values.name.trim(),
        visibility: values.visibility,
        categoryId: values.categoryId,
        experienceLevelId: values.experienceLevelId || null,
        skillTags: values.skillTags,
        employmentTypes: values.employmentTypes,
        workModes: values.workModes,
        preferredLocations: values.preferredLocations,
      })

      let latestCv = metadataRes.cv

      if (isGenerated && !loadingDetail) {
        const contentRes = await saveOwnGeneratedContentApi(
          cv.id,
          toContentPayload(generatedContent),
        )
        latestCv = contentRes.cv ?? latestCv
      }

      toast.success('Đã cập nhật thông tin CV')
      onUpdated(latestCv)
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
      description={
        isGenerated
          ? 'Chỉnh sửa đầy đủ metadata tìm kiếm và nội dung chi tiết của CV tạo trên JOBHUB.'
          : 'Chỉnh sửa đầy đủ metadata, kỹ năng, hình thức và địa điểm mong muốn của CV.'
      }
      footer={
        <>
          <Button disabled={busy} onClick={onClose} type="button" variant="outline">
            Hủy
          </Button>
          <Button disabled={busy || loadingDetail} form="cv-edit-form" type="submit">
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
            Lưu thay đổi
          </Button>
        </>
      }
      onClose={onClose}
      panelClassName="max-w-3xl"
      title={`Chỉnh sửa CV · ${cv.name}`}
    >
      {isGenerated && (
        <div className="mb-4 flex gap-1.5 rounded-xl bg-secondary p-1">
          <button
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              activeTab === 'metadata'
                ? 'bg-card text-primary shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab('metadata')}
            type="button"
          >
            1. Metadata &amp; Tiêu chí tìm việc
          </button>
          <button
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              activeTab === 'content'
                ? 'bg-card text-primary shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab('content')}
            type="button"
          >
            2. Nội dung CV Harvard
          </button>
        </div>
      )}

      <form className="space-y-4" id="cv-edit-form" onSubmit={handleSubmit}>
        {detailError && (
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm" role="alert">
            <p>{detailError} Vui lòng tải lại trước khi lưu thay đổi.</p>
            <Button onClick={() => {
              setDetailError(null)
              setLoadAttempt((attempt) => attempt + 1)
            }} type="button" variant="outline">
              Thử lại
            </Button>
          </div>
        )}
        {(!isGenerated || activeTab === 'metadata') && (
          <CvMetadataFields
            catalogsError={catalogs.error}
            catalogsLoading={catalogs.loading}
            experienceLevels={catalogs.experienceLevels}
            fields={catalogs.fields}
            idPrefix="edit"
            onChange={setValues}
            provinces={catalogs.provinces}
            values={values}
          />
        )}

        {isGenerated && activeTab === 'content' && (
          detailError ? null : loadingDetail ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              Đang tải nội dung CV…
            </p>
          ) : (
            <CvGeneratedContentFields
              content={generatedContent}
              metadataSkillTags={values.skillTags ?? []}
              onChange={setGeneratedContent}
            />
          )
        )}
      </form>
    </ProfileModal>
  )
}

export default CvEditMetadataModal
