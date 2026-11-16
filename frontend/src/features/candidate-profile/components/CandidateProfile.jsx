import {
  CircleX,
  Download,
  LoaderCircle,
  Pencil,
  RotateCw,
  Share2,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  downloadOwnCandidateCvApi,
  saveOwnGeneratedContentApi,
} from '@/apis/candidate-cv.api'
import CenteredState from '@/components/common/CenteredState'
import { Button } from '@/components/ui/button'
import { CANDIDATE_CV_SOURCE_TYPE, CANDIDATE_CV_STATUS } from '@/utils/constant'

import useCandidateProfile from '../hooks/useCandidateProfile'
import { toContentPayload } from '../utils'
import AboutSection from './AboutSection'
import CertificationsLanguagesSection from './CertificationsLanguagesSection'
import {
  AboutEditor,
  CertificationEditor,
  EducationEditor,
  ExperienceEditor,
  LanguageEditor,
  ProjectEditor,
  SkillsEditor,
} from './ContentEditors'
import EducationSection from './EducationSection'
import ExperienceSection from './ExperienceSection'
import ProfileAiAssistantCard from './ProfileAiAssistantCard'
import ProfileBasicEditModal from './ProfileBasicEditModal'
import ProfileHeroCard from './ProfileHeroCard'
import ProjectsSection from './ProjectsSection'
import SkillsSection from './SkillsSection'

function CandidateProfile() {
  const profileState = useCandidateProfile()
  const [editor, setEditor] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)

  const {
    loading,
    error,
    profile,
    content,
    contentCv,
    completion,
    canEditContent,
    reload,
    setLocalContent,
    setLocalProfile,
  } = profileState

  const persistContent = async (nextContent) => {
    if (!contentCv?.id) {
      toast.error('Cần CV Generated để lưu nội dung hồ sơ chi tiết.')
      return false
    }

    setSaving(true)
    setSaveError(null)
    try {
      const response = await saveOwnGeneratedContentApi(
        contentCv.id,
        toContentPayload(nextContent),
      )
      const savedContent = response.cv?.generatedContent ?? nextContent
      setLocalContent(savedContent)
      toast.success('Đã lưu nội dung hồ sơ')
      if (response.cv?.status === CANDIDATE_CV_STATUS.DRAFT) {
        toast.warning('CV có thể đã chuyển về bản nháp nếu nội dung chưa đủ điều kiện ACTIVE.')
      }
      setEditor(null)
      return true
    } catch (persistError) {
      setSaveError(persistError)
      toast.error(persistError.message || 'Không lưu được nội dung')
      return false
    } finally {
      setSaving(false)
    }
  }

  const updateListItem = async (key, index, item) => {
    const current = [...(content[key] ?? [])]
    if (index == null) {
      current.push(item)
    } else {
      current[index] = item
    }
    await persistContent({ ...content, [key]: current })
  }

  const deleteListItem = async (key, index) => {
    const label = {
      workExperiences: 'kinh nghiệm',
      projects: 'dự án',
      educations: 'học vấn',
      certifications: 'chứng chỉ',
      languages: 'ngoại ngữ',
    }[key]
    if (!window.confirm(`Bạn chắc chắn muốn xóa ${label} này?`)) {
      return
    }
    const current = [...(content[key] ?? [])]
    current.splice(index, 1)
    await persistContent({ ...content, [key]: current })
  }

  const handleShare = async () => {
    toast.info('Chia sẻ hồ sơ công khai chưa khả dụng trên JOBHUB.')
  }

  const handleExportPdf = async () => {
    if (
      !contentCv ||
      contentCv.sourceType !== CANDIDATE_CV_SOURCE_TYPE.GENERATED ||
      contentCv.status !== CANDIDATE_CV_STATUS.ACTIVE
    ) {
      toast.info('Xuất PDF cần CV Generated đang ACTIVE. Hãy kích hoạt CV trong Quản lý CV.')
      return
    }

    setExporting(true)
    try {
      const response = await downloadOwnCandidateCvApi(contentCv.id)
      const blob = response.data
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const disposition = response.headers?.['content-disposition']
      const matched = disposition?.match(/filename="?([^"]+)"?/i)
      anchor.href = url
      anchor.download = matched?.[1] || `${contentCv.name || 'cv'}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('Đã tải PDF CV')
    } catch (exportError) {
      toast.error(exportError.message || 'Không xuất được PDF')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <CenteredState
        icon={LoaderCircle}
        spinning
        title="Đang tải hồ sơ…"
        tone="bg-primary/10 text-primary"
      />
    )
  }

  if (error) {
    return (
      <CenteredState
        action={
          <Button onClick={reload} variant="outline">
            <RotateCw aria-hidden="true" className="size-4" />
            Thử lại
          </Button>
        }
        description={error.message}
        icon={CircleX}
        title="Không tải được hồ sơ"
        tone="bg-secondary text-muted-foreground"
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link className="hover:text-foreground hover:underline" to="/candidate">
              Trang chủ
            </Link>
            <span aria-hidden="true"> › </span>
            <span className="text-foreground">Hồ sơ cá nhân</span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Hồ sơ cá nhân</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Quản lý thông tin cá nhân, kinh nghiệm và hồ sơ nghề nghiệp của bạn.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleShare}
            size="sm"
            title="Chia sẻ công khai chưa được hỗ trợ"
            type="button"
            variant="outline"
          >
            <Share2 aria-hidden="true" className="size-4" />
            Chia sẻ hồ sơ
          </Button>
          <Button
            disabled={exporting}
            onClick={handleExportPdf}
            size="sm"
            type="button"
            variant="outline"
          >
            {exporting ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Download aria-hidden="true" className="size-4" />
            )}
            Xuất PDF
          </Button>
          <Button onClick={() => setEditProfileOpen(true)} size="sm" type="button">
            <Pencil aria-hidden="true" className="size-4" />
            Chỉnh sửa hồ sơ
          </Button>
        </div>
      </div>

      {!canEditContent && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          Chưa có CV Generated để chỉnh kinh nghiệm/học vấn/kỹ năng. Các mục đó nằm trong nội dung CV,
          không thuộc User Profile API.{' '}
          <Link className="font-medium underline" to="/candidate/cvs">
            Đi tới Quản lý CV
          </Link>
        </p>
      )}

      <ProfileHeroCard completion={completion} content={content} profile={profile} />

      <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
        <div className="min-w-0 space-y-5 lg:col-span-7 xl:col-span-8">
          <AboutSection
            canEdit={canEditContent}
            content={content}
            onEdit={() => setEditor({ type: 'about' })}
          />
          <ExperienceSection
            canEdit={canEditContent}
            content={content}
            onAdd={() => setEditor({ type: 'experience', index: null })}
            onDelete={(index) => deleteListItem('workExperiences', index)}
            onEdit={(index) => setEditor({ type: 'experience', index })}
          />
          <ProjectsSection
            canEdit={canEditContent}
            content={content}
            onAdd={() => setEditor({ type: 'project', index: null })}
            onDelete={(index) => deleteListItem('projects', index)}
            onEdit={(index) => setEditor({ type: 'project', index })}
          />
        </div>

        <aside className="min-w-0 space-y-5 lg:col-span-5 xl:col-span-4">
          <SkillsSection
            canEdit={canEditContent}
            content={content}
            onEdit={() => setEditor({ type: 'skills' })}
            skillTags={contentCv?.skillTags ?? []}
          />
          <EducationSection
            canEdit={canEditContent}
            content={content}
            onAdd={() => setEditor({ type: 'education', index: null })}
            onDelete={(index) => deleteListItem('educations', index)}
            onEdit={(index) => setEditor({ type: 'education', index })}
          />
          <CertificationsLanguagesSection
            canEdit={canEditContent}
            content={content}
            onAddCertification={() => setEditor({ type: 'certification', index: null })}
            onAddLanguage={() => setEditor({ type: 'language', index: null })}
            onDeleteCertification={(index) => deleteListItem('certifications', index)}
            onDeleteLanguage={(index) => deleteListItem('languages', index)}
            onEditCertification={(index) => setEditor({ type: 'certification', index })}
            onEditLanguage={(index) => setEditor({ type: 'language', index })}
          />
        </aside>
      </div>

      <ProfileAiAssistantCard canEditContent={canEditContent} completion={completion} />

      {editProfileOpen && (
        <ProfileBasicEditModal
          onClose={() => setEditProfileOpen(false)}
          onSaved={setLocalProfile}
          profile={profile}
        />
      )}

      {editor?.type === 'about' && (
        <AboutEditor
          busy={saving}
          error={saveError}
          initialValue={content.professionalSummary}
          onClose={() => setEditor(null)}
          onSave={async (summary) => {
            await persistContent({
              ...content,
              professionalSummary: summary,
              professionalSummaryHtml: null,
            })
          }}
        />
      )}

      {editor?.type === 'skills' && (
        <SkillsEditor
          busy={saving}
          error={saveError}
          initialValue={content.skills}
          onClose={() => setEditor(null)}
          onSave={async (skills) => {
            await persistContent({ ...content, skills })
          }}
        />
      )}

      {editor?.type === 'experience' && (
        <ExperienceEditor
          busy={saving}
          error={saveError}
          initialValue={
            editor.index == null ? null : content.workExperiences?.[editor.index] ?? null
          }
          onClose={() => setEditor(null)}
          onSave={(item) => updateListItem('workExperiences', editor.index, item)}
        />
      )}

      {editor?.type === 'project' && (
        <ProjectEditor
          busy={saving}
          error={saveError}
          initialValue={editor.index == null ? null : content.projects?.[editor.index] ?? null}
          onClose={() => setEditor(null)}
          onSave={(item) => updateListItem('projects', editor.index, item)}
        />
      )}

      {editor?.type === 'education' && (
        <EducationEditor
          busy={saving}
          error={saveError}
          initialValue={editor.index == null ? null : content.educations?.[editor.index] ?? null}
          onClose={() => setEditor(null)}
          onSave={(item) => updateListItem('educations', editor.index, item)}
        />
      )}

      {editor?.type === 'certification' && (
        <CertificationEditor
          busy={saving}
          error={saveError}
          initialValue={
            editor.index == null ? null : content.certifications?.[editor.index] ?? null
          }
          onClose={() => setEditor(null)}
          onSave={(item) => updateListItem('certifications', editor.index, item)}
        />
      )}

      {editor?.type === 'language' && (
        <LanguageEditor
          busy={saving}
          error={saveError}
          initialValue={editor.index == null ? null : content.languages?.[editor.index] ?? null}
          onClose={() => setEditor(null)}
          onSave={(item) => updateListItem('languages', editor.index, item)}
        />
      )}
    </div>
  )
}

export default CandidateProfile
