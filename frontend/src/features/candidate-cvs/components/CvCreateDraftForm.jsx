import {
  ArrowRight,
  Check,
  CircleCheck,
  FileText,
  Layers,
  LoaderCircle,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { createGeneratedDraftCandidateCvApi } from '@/apis/candidate-cv.api'
import { getOwnCandidateProfileApi } from '@/apis/candidate-profile.api'
import { Button } from '@/components/ui/button'
import {
  emptyGeneratedContent,
  toContentPayload,
} from '@/features/candidate-profile/utils'
import { cn } from '@/lib/utils'
import {
  CANDIDATE_CV_CREATION_INTENT,
  CANDIDATE_CV_VISIBILITY,
} from '@/utils/constant'

import useCvCatalogOptions from '../hooks/useCvCatalogOptions'
import CvGeneratedContentFields from './CvGeneratedContentFields'
import CvMetadataFields from './CvMetadataFields'

const WORKSPACE_VIEW = Object.freeze({
  METADATA: 'metadata',
  CONTENT: 'content',
  ALL: 'all',
})

const INITIAL_VALUES = {
  name: '',
  visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
  categoryId: '',
  experienceLevelId: '',
  skillTags: [],
  employmentTypes: [],
  workModes: [],
  preferredLocations: [],
}

function withProfilePersonalInfo(content, profile) {
  return {
    ...content,
    personalInfo: {
      ...content.personalInfo,
      fullName: content.personalInfo?.fullName || profile.fullName || null,
      email: content.personalInfo?.email || profile.email || null,
      phone: content.personalInfo?.phone || profile.phoneNumber || null,
      avatarUrl: content.personalInfo?.avatarUrl || profile.avatarUrl || null,
    },
  }
}

function CvCreateDraftForm({
  formId = 'cv-create-form',
  idPrefix = 'create',
  onCreated,
  onCancel,
  onDirtyChange,
  className,
}) {
  const catalogs = useCvCatalogOptions()
  const [busy, setBusy] = useState(false)
  const [activeView, setActiveView] = useState(WORKSPACE_VIEW.METADATA)
  const [creationIntent, setCreationIntent] = useState(
    CANDIDATE_CV_CREATION_INTENT.SAVE_DRAFT,
  )
  const [values, setValues] = useState(INITIAL_VALUES)
  const [generatedContent, setGeneratedContent] = useState(() =>
    emptyGeneratedContent(),
  )
  const [initialContent, setInitialContent] = useState(() => emptyGeneratedContent())

  useEffect(() => {
    onDirtyChange?.(
      JSON.stringify(values) !== JSON.stringify(INITIAL_VALUES) ||
      JSON.stringify(generatedContent) !== JSON.stringify(initialContent),
    )
  }, [values, generatedContent, initialContent, onDirtyChange])

  useEffect(() => {
    let active = true
    getOwnCandidateProfileApi().then(
      ({ profile }) => {
        if (!active || !profile) {
          return
        }
        setGeneratedContent((current) => withProfilePersonalInfo(current, profile))
        setInitialContent((current) => withProfilePersonalInfo(current, profile))
      },
      () => {},
    )
    return () => {
      active = false
    }
  }, [])

  const checklist = useMemo(() => {
    const personalInfo = generatedContent.personalInfo ?? {}
    const educations = generatedContent.educations ?? []
    const skills = generatedContent.skills ?? []

    const items = [
      {
        key: 'name',
        label: 'Tên CV',
        step: WORKSPACE_VIEW.METADATA,
        done: Boolean(values.name.trim()),
      },
      {
        key: 'category',
        label: 'Ngành nghề',
        step: WORKSPACE_VIEW.METADATA,
        done: Boolean(values.categoryId),
      },
      {
        key: 'contact',
        label: 'Liên hệ',
        step: WORKSPACE_VIEW.CONTENT,
        done: Boolean(
          personalInfo.fullName?.trim() &&
            personalInfo.email?.trim() &&
            personalInfo.phone?.trim(),
        ),
      },
      {
        key: 'summary',
        label: 'Tóm tắt',
        step: WORKSPACE_VIEW.CONTENT,
        done: Boolean(generatedContent.professionalSummary?.trim()),
      },
      {
        key: 'skills',
        label: 'Kỹ năng',
        step: WORKSPACE_VIEW.CONTENT,
        done: skills.some((s) => Boolean(s?.trim())),
      },
      {
        key: 'education',
        label: 'Học vấn',
        step: WORKSPACE_VIEW.CONTENT,
        done: educations.some(
          (edu) => Boolean(edu?.institutionName?.trim() && edu?.degree?.trim()),
        ),
      },
    ]

    const doneCount = items.filter((item) => item.done).length
    const isDraftReady = Boolean(values.name.trim() && values.categoryId)
    const isActivationReady = doneCount === items.length

    return {
      items,
      doneCount,
      totalCount: items.length,
      percent: Math.round((doneCount / items.length) * 100),
      isDraftReady,
      isActivationReady,
    }
  }, [values.name, values.categoryId, generatedContent])

  const submitWithIntent = async (intent) => {
    if (!values.name.trim() || !values.categoryId) {
      setActiveView(WORKSPACE_VIEW.METADATA)
      toast.error('Vui lòng nhập Tên CV và chọn Ngành nghề.')
      return
    }

    if (
      intent === CANDIDATE_CV_CREATION_INTENT.COMPLETE &&
      !checklist.isActivationReady
    ) {
      setActiveView(WORKSPACE_VIEW.CONTENT)
      toast.error('Cần hoàn tất đủ 6 mục bắt buộc để kích hoạt ngay, hoặc chọn "Lưu nháp".')
      return
    }

    setCreationIntent(intent)
    setBusy(true)
    try {
      const response = await createGeneratedDraftCandidateCvApi({
        name: values.name.trim(),
        visibility: values.visibility,
        categoryId: values.categoryId,
        experienceLevelId: values.experienceLevelId || null,
        skillTags: values.skillTags,
        employmentTypes: values.employmentTypes,
        workModes: values.workModes,
        preferredLocations: values.preferredLocations,
        creationIntent: intent,
        generatedContent: toContentPayload(generatedContent),
      })
      toast.success(
        intent === CANDIDATE_CV_CREATION_INTENT.COMPLETE
          ? 'Đã tạo và kích hoạt CV'
          : 'Đã lưu bản nháp CV',
      )
      onCreated?.(response.cv)
    } catch (error) {
      const unmet = error.details?.unmetRequirements
      if (Array.isArray(unmet) && unmet.length > 0) {
        toast.error('Chưa đủ các mục bắt buộc để kích hoạt ngay. Hãy chọn "Lưu nháp".')
      } else {
        toast.error(error.message || 'Không tạo được CV')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className={cn('space-y-4', className)}
      id={formId}
      onSubmit={(event) => {
        event.preventDefault()
        submitWithIntent(
          checklist.isActivationReady
            ? CANDIDATE_CV_CREATION_INTENT.COMPLETE
            : CANDIDATE_CV_CREATION_INTENT.SAVE_DRAFT,
        )
      }}
    >
      <div className="rounded-2xl border border-l-4 border-l-violet-500 bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <button
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors',
                activeView === WORKSPACE_VIEW.METADATA
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
              onClick={() => setActiveView(WORKSPACE_VIEW.METADATA)}
              type="button"
            >
              <SlidersHorizontal aria-hidden="true" className="size-3.5" />
              <span>1. Phân loại &amp; Tiêu chí</span>
              {checklist.isDraftReady && (
                <Check aria-hidden="true" className="size-3 shrink-0" />
              )}
            </button>

            <button
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors',
                activeView === WORKSPACE_VIEW.CONTENT
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
              onClick={() => setActiveView(WORKSPACE_VIEW.CONTENT)}
              type="button"
            >
              <Sparkles aria-hidden="true" className="size-3.5" />
              <span>2. Nội dung CV</span>
              {checklist.isActivationReady && (
                <Check aria-hidden="true" className="size-3 shrink-0" />
              )}
            </button>

            <button
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors',
                activeView === WORKSPACE_VIEW.ALL
                  ? 'bg-secondary text-foreground ring-1 ring-border'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
              )}
              onClick={() =>
                setActiveView(
                  activeView === WORKSPACE_VIEW.ALL
                    ? WORKSPACE_VIEW.METADATA
                    : WORKSPACE_VIEW.ALL,
                )
              }
              title="Xem cả 2 bước trên 1 trang"
              type="button"
            >
              <Layers aria-hidden="true" className="size-3.5" />
              <span>Tất cả</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 px-1">
            <div className="h-2 w-28 overflow-hidden rounded-full bg-secondary sm:w-40">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  checklist.isActivationReady ? 'bg-emerald-500' : 'bg-violet-600',
                )}
                style={{ width: `${checklist.percent}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {checklist.percent}% ({checklist.doneCount}/{checklist.totalCount})
            </span>
          </div>
        </div>
      </div>

      {(activeView === WORKSPACE_VIEW.METADATA || activeView === WORKSPACE_VIEW.ALL) && (
        <div className="rounded-2xl border bg-card p-4 sm:p-5">
          <CvMetadataFields
            catalogsError={catalogs.error}
            catalogsLoading={catalogs.loading}
            experienceLevels={catalogs.experienceLevels}
            fields={catalogs.fields}
            idPrefix={idPrefix}
            onChange={setValues}
            provinces={catalogs.provinces}
            values={values}
          />

          {activeView === WORKSPACE_VIEW.METADATA && (
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => setActiveView(WORKSPACE_VIEW.CONTENT)}
                size="sm"
                type="button"
                variant="secondary"
              >
                <span>Sang Bước 2 · Nội dung CV</span>
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {(activeView === WORKSPACE_VIEW.CONTENT || activeView === WORKSPACE_VIEW.ALL) && (
        <CvGeneratedContentFields
          content={generatedContent}
          metadataSkillTags={values.skillTags ?? []}
          onChange={setGeneratedContent}
        />
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {onCancel ? (
          <Button
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Hủy
          </Button>
        ) : null}
        <Button
          aria-busy={busy && creationIntent === CANDIDATE_CV_CREATION_INTENT.SAVE_DRAFT}
          className="w-full sm:w-auto"
          disabled={busy}
          onClick={() => submitWithIntent(CANDIDATE_CV_CREATION_INTENT.SAVE_DRAFT)}
          type="button"
          variant="outline"
        >
          {busy && creationIntent === CANDIDATE_CV_CREATION_INTENT.SAVE_DRAFT ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <FileText aria-hidden="true" className="size-4" />
          )}
          Lưu nháp
        </Button>
        <Button
          aria-busy={busy && creationIntent === CANDIDATE_CV_CREATION_INTENT.COMPLETE}
          className="w-full sm:w-auto"
          disabled={busy}
          onClick={() => submitWithIntent(CANDIDATE_CV_CREATION_INTENT.COMPLETE)}
          type="button"
        >
          {busy && creationIntent === CANDIDATE_CV_CREATION_INTENT.COMPLETE ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <CircleCheck aria-hidden="true" className="size-4" />
          )}
          Hoàn tất &amp; Kích hoạt
        </Button>
      </div>
    </form>
  )
}

export default CvCreateDraftForm
