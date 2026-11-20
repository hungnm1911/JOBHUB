import {
  Award,
  BriefcaseBusiness,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileText,
  FolderGit2,
  GraduationCap,
  Languages,
  Plus,
  Trash2,
  UserRound,
  Wrench,
  X,
} from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectDropdown } from '@/components/ui/select-dropdown'
import { LANGUAGE_PROFICIENCY_LABEL } from '@/features/candidate-profile/utils'
import { cn } from '@/lib/utils'
import { CV_LANGUAGE_PROFICIENCY, HARVARD_CV_SECTION } from '@/utils/constant'

const textareaClassName = cn(
  'min-h-20 w-full rounded-xl border border-input bg-secondary/50 px-3 py-2 text-sm shadow-2xs outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
)

const LANGUAGE_PROFICIENCY_OPTIONS = Object.values(CV_LANGUAGE_PROFICIENCY).map(
  (val) => ({
    value: val,
    label: LANGUAGE_PROFICIENCY_LABEL[val] ?? val,
  }),
)

const CONTENT_FILTER = Object.freeze({
  ALL: 'all',
  REQUIRED: 'required',
  OPTIONAL: 'optional',
})

function SectionCard({
  icon: Icon,
  iconTone = 'bg-primary/10 text-primary',
  title,
  requiredBadge = false,
  completedBadge = false,
  countBadge = null,
  sectionKey = null,
  hiddenSections = [],
  onToggleHidden = null,
  action = null,
  children,
}) {
  const isHidden = sectionKey ? hiddenSections.includes(sectionKey) : false

  return (
    <section
      className={cn(
        'rounded-2xl border bg-card p-4',
        isHidden && 'border-dashed opacity-75',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors',
              iconTone,
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
            {requiredBadge && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  completedBadge
                    ? 'bg-emerald-500/15 text-emerald-800'
                    : 'bg-amber-500/15 text-amber-800',
                )}
              >
                {completedBadge ? (
                  <>
                    <Check aria-hidden="true" className="size-3" />
                    Đạt
                  </>
                ) : (
                  'Bắt buộc'
                )}
              </span>
            )}
            {!requiredBadge && countBadge != null && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {countBadge}
              </span>
            )}
            {isHidden && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                Ẩn PDF
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {sectionKey && onToggleHidden && (
            <Button
              aria-label={isHidden ? 'Hiện trên PDF' : 'Ẩn trên PDF'}
              onClick={() => onToggleHidden(sectionKey)}
              size="sm"
              title={isHidden ? 'Hiện trên PDF' : 'Ẩn trên PDF'}
              type="button"
              variant="ghost"
            >
              {isHidden ? (
                <>
                  <Eye aria-hidden="true" className="size-3.5" />
                  <span className="text-xs">Hiện</span>
                </>
              ) : (
                <>
                  <EyeOff aria-hidden="true" className="size-3.5" />
                  <span className="text-xs">Ẩn PDF</span>
                </>
              )}
            </Button>
          )}
          {action}
        </div>
      </div>

      {children ? <div className="mt-3.5">{children}</div> : null}
    </section>
  )
}

function CvGeneratedContentFields({ content, onChange, metadataSkillTags = [] }) {
  const [skillInput, setSkillInput] = useState('')
  const [linkInput, setLinkInput] = useState('')
  const [sectionFilter, setSectionFilter] = useState(CONTENT_FILTER.ALL)

  const personalInfo = content.personalInfo ?? {}
  const educations = content.educations ?? []
  const workExperiences = content.workExperiences ?? []
  const projects = content.projects ?? []
  const certifications = content.certifications ?? []
  const languages = content.languages ?? []
  const skills = content.skills ?? []
  const hiddenSections = content.hiddenSections ?? []

  const isPersonalComplete = Boolean(
    personalInfo.fullName?.trim() &&
      personalInfo.email?.trim() &&
      personalInfo.phone?.trim(),
  )
  const isSummaryComplete = Boolean(content.professionalSummary?.trim())
  const isSkillsComplete = skills.some((s) => Boolean(s?.trim()))
  const isEducationComplete = educations.some(
    (edu) => Boolean(edu?.institutionName?.trim() && edu?.degree?.trim()),
  )

  const uncopiedMetadataSkills = metadataSkillTags.filter(
    (tag) => !skills.some((existing) => existing.toLowerCase() === tag.toLowerCase()),
  )

  const syncFromMetadataSkills = () => {
    if (uncopiedMetadataSkills.length === 0) {
      return
    }
    onChange({
      ...content,
      skills: [...skills, ...uncopiedMetadataSkills],
    })
  }

  const updatePersonalInfo = (patch) => {
    onChange({
      ...content,
      personalInfo: {
        ...personalInfo,
        ...patch,
      },
    })
  }

  const toggleHiddenSection = (sectionKey) => {
    const exists = hiddenSections.includes(sectionKey)
    const next = exists
      ? hiddenSections.filter((s) => s !== sectionKey)
      : [...hiddenSections, sectionKey]
    onChange({ ...content, hiddenSections: next })
  }

  const addLink = () => {
    const url = linkInput.trim()
    if (!url) {
      return
    }
    const currentLinks = personalInfo.links ?? []
    if (!currentLinks.includes(url)) {
      updatePersonalInfo({ links: [...currentLinks, url] })
    }
    setLinkInput('')
  }

  const removeLink = (urlToRemove) => {
    updatePersonalInfo({
      links: (personalInfo.links ?? []).filter((l) => l !== urlToRemove),
    })
  }

  const addSkill = () => {
    const raw = skillInput.trim()
    if (!raw) {
      return
    }
    const items = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const next = [...skills]
    for (const item of items) {
      if (!next.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
        next.push(item)
      }
    }
    onChange({ ...content, skills: next })
    setSkillInput('')
  }

  const removeSkill = (skillToRemove) => {
    onChange({
      ...content,
      skills: skills.filter((s) => s !== skillToRemove),
    })
  }

  const updateList = (key, nextItems) => {
    onChange({ ...content, [key]: nextItems })
  }

  const patchListItem = (key, list, index, patch) => {
    updateList(
      key,
      list.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    )
  }

  const removeListItem = (key, list, index) => {
    updateList(
      key,
      list.filter((_, idx) => idx !== index),
    )
  }

  const showRequired =
    sectionFilter === CONTENT_FILTER.ALL || sectionFilter === CONTENT_FILTER.REQUIRED
  const showOptional =
    sectionFilter === CONTENT_FILTER.ALL || sectionFilter === CONTENT_FILTER.OPTIONAL

  return (
    <div className="space-y-3.5">
      <div className="inline-flex flex-wrap gap-1 rounded-xl border bg-card p-1">
        {[
          { id: CONTENT_FILTER.ALL, label: 'Tất cả (8)' },
          { id: CONTENT_FILTER.REQUIRED, label: 'Bắt buộc (4)' },
          { id: CONTENT_FILTER.OPTIONAL, label: 'Mở rộng (4)' },
        ].map((tab) => (
          <button
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              sectionFilter === tab.id
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            key={tab.id}
            onClick={() => setSectionFilter(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {showRequired && (
        <>
          <SectionCard
            completedBadge={isPersonalComplete}
            icon={UserRound}
            iconTone="bg-sky-500/15 text-sky-700"
            requiredBadge
            title="1. Thông tin liên hệ"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium">
                  Họ và tên <span className="text-destructive">*</span>
                </span>
                <Input
                  className="h-10"
                  onChange={(e) => updatePersonalInfo({ fullName: e.target.value })}
                  placeholder="Nguyễn Văn A"
                  value={personalInfo.fullName ?? ''}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium">
                  Email <span className="text-destructive">*</span>
                </span>
                <Input
                  className="h-10"
                  onChange={(e) => updatePersonalInfo({ email: e.target.value })}
                  placeholder="candidate@example.com"
                  type="email"
                  value={personalInfo.email ?? ''}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium">
                  Số điện thoại <span className="text-destructive">*</span>
                </span>
                <Input
                  className="h-10"
                  onChange={(e) => updatePersonalInfo({ phone: e.target.value })}
                  placeholder="0901 234 567"
                  value={personalInfo.phone ?? ''}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium">Địa chỉ</span>
                <Input
                  className="h-10"
                  onChange={(e) => updatePersonalInfo({ displayLocation: e.target.value })}
                  placeholder="Quận 1, TP. Hồ Chí Minh"
                  value={personalInfo.displayLocation ?? ''}
                />
              </label>
            </div>

            <div className="mt-3 space-y-1">
              <span className="block text-xs font-medium">Liên kết (GitHub, LinkedIn...)</span>
              <div className="flex gap-2">
                <Input
                  className="h-10"
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addLink()
                    }
                  }}
                  placeholder="https://github.com/..."
                  value={linkInput}
                />
                <Button className="h-10" onClick={addLink} type="button" variant="outline">
                  <Plus aria-hidden="true" className="size-4" />
                  Thêm
                </Button>
              </div>
              {(personalInfo.links ?? []).length > 0 && (
                <ul className="flex flex-wrap gap-1.5 pt-1">
                  {(personalInfo.links ?? []).map((link) => (
                    <li
                      className="inline-flex items-center gap-1 rounded-full border bg-secondary/60 py-0.5 pr-1.5 pl-2.5 text-xs"
                      key={link}
                    >
                      <span className="max-w-60 truncate">{link}</span>
                      <button
                        aria-label={`Xóa ${link}`}
                        className="inline-flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
                        onClick={() => removeLink(link)}
                        type="button"
                      >
                        <X aria-hidden="true" className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionCard>

          <SectionCard
            completedBadge={isSummaryComplete}
            hiddenSections={hiddenSections}
            icon={FileText}
            iconTone="bg-indigo-500/15 text-indigo-700"
            onToggleHidden={toggleHiddenSection}
            requiredBadge
            sectionKey={HARVARD_CV_SECTION.PROFESSIONAL_SUMMARY}
            title="2. Tóm tắt chuyên môn"
          >
            <textarea
              className={textareaClassName}
              maxLength={5000}
              onChange={(e) =>
                onChange({
                  ...content,
                  professionalSummary: e.target.value,
                  professionalSummaryHtml: null,
                })
              }
              placeholder="Tóm tắt mục tiêu nghề nghiệp, kinh nghiệm và thế mạnh cốt lõi..."
              value={content.professionalSummary ?? ''}
            />
          </SectionCard>

          <SectionCard
            action={
              uncopiedMetadataSkills.length > 0 ? (
                <Button
                  onClick={syncFromMetadataSkills}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Copy aria-hidden="true" className="size-3.5" />
                  Lấy {uncopiedMetadataSkills.length} kỹ năng từ Bước 1
                </Button>
              ) : null
            }
            completedBadge={isSkillsComplete}
            hiddenSections={hiddenSections}
            icon={Wrench}
            iconTone="bg-violet-500/15 text-violet-700"
            onToggleHidden={toggleHiddenSection}
            requiredBadge
            sectionKey={HARVARD_CV_SECTION.SKILLS}
            title="3. Kỹ năng trên CV"
          >
            <div className="flex gap-2">
              <Input
                className="h-10"
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSkill()
                  }
                }}
                placeholder="JavaScript, React, SQL, Git... (nhấn Enter để thêm)"
                value={skillInput}
              />
              <Button className="h-10" onClick={addSkill} type="button" variant="outline">
                <Plus aria-hidden="true" className="size-4" />
                Thêm
              </Button>
            </div>
            {skills.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <li
                    className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 py-0.5 pr-1.5 pl-2.5 text-xs font-medium text-violet-700"
                    key={skill}
                  >
                    <span>{skill}</span>
                    <button
                      aria-label={`Xóa ${skill}`}
                      className="inline-flex size-4 items-center justify-center rounded-full hover:bg-violet-500/20"
                      onClick={() => removeSkill(skill)}
                      type="button"
                    >
                      <X aria-hidden="true" className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            action={
              <Button
                onClick={() =>
                  updateList('educations', [
                    ...educations,
                    {
                      institutionName: '',
                      degree: '',
                      fieldOfStudy: '',
                      startDate: null,
                      endDate: null,
                    },
                  ])
                }
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Thêm học vấn
              </Button>
            }
            completedBadge={isEducationComplete}
            hiddenSections={hiddenSections}
            icon={GraduationCap}
            iconTone="bg-amber-500/15 text-amber-700"
            onToggleHidden={toggleHiddenSection}
            requiredBadge
            sectionKey={HARVARD_CV_SECTION.EDUCATIONS}
            title="4. Học vấn"
          >
            {educations.length > 0 ? (
              <div className="space-y-2.5">
                {educations.map((edu, index) => (
                  <div className="rounded-xl border bg-background/60 p-3" key={`edu-${index}`}>
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <span className="text-xs font-semibold text-primary">
                        Học vấn #{index + 1}
                      </span>
                      <Button
                        onClick={() => removeListItem('educations', educations, index)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">
                          Trường đào tạo <span className="text-destructive">*</span>
                        </span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('educations', educations, index, {
                              institutionName: e.target.value,
                            })
                          }
                          placeholder="ĐH Bách Khoa..."
                          value={edu.institutionName ?? ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">
                          Bằng cấp <span className="text-destructive">*</span>
                        </span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('educations', educations, index, {
                              degree: e.target.value,
                            })
                          }
                          placeholder="Cử nhân / Kỹ sư..."
                          value={edu.degree ?? ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Chuyên ngành</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('educations', educations, index, {
                              fieldOfStudy: e.target.value,
                            })
                          }
                          placeholder="Khoa học máy tính"
                          value={edu.fieldOfStudy ?? ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Từ ngày</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('educations', educations, index, {
                              startDate: e.target.value || null,
                            })
                          }
                          type="date"
                          value={edu.startDate ? String(edu.startDate).slice(0, 10) : ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Đến ngày</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('educations', educations, index, {
                              endDate: e.target.value || null,
                            })
                          }
                          type="date"
                          value={edu.endDate ? String(edu.endDate).slice(0, 10) : ''}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        </>
      )}

      {showOptional && (
        <>
          <SectionCard
            action={
              <Button
                onClick={() =>
                  updateList('workExperiences', [
                    ...workExperiences,
                    {
                      companyName: '',
                      position: '',
                      startDate: null,
                      endDate: null,
                      description: '',
                      achievements: [],
                    },
                  ])
                }
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Thêm kinh nghiệm
              </Button>
            }
            countBadge={`${workExperiences.length}`}
            hiddenSections={hiddenSections}
            icon={BriefcaseBusiness}
            iconTone="bg-emerald-500/15 text-emerald-700"
            onToggleHidden={toggleHiddenSection}
            sectionKey={HARVARD_CV_SECTION.WORK_EXPERIENCES}
            title="5. Kinh nghiệm làm việc"
          >
            {workExperiences.length > 0 ? (
              <div className="space-y-2.5">
                {workExperiences.map((exp, index) => (
                  <div className="rounded-xl border bg-background/60 p-3" key={`exp-${index}`}>
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <span className="text-xs font-semibold text-primary">
                        Kinh nghiệm #{index + 1}
                      </span>
                      <Button
                        onClick={() => removeListItem('workExperiences', workExperiences, index)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Chức danh</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('workExperiences', workExperiences, index, {
                              position: e.target.value,
                            })
                          }
                          placeholder="Frontend Developer"
                          value={exp.position ?? ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Công ty</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('workExperiences', workExperiences, index, {
                              companyName: e.target.value,
                            })
                          }
                          placeholder="Công ty ABC"
                          value={exp.companyName ?? ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Từ ngày</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('workExperiences', workExperiences, index, {
                              startDate: e.target.value || null,
                            })
                          }
                          type="date"
                          value={exp.startDate ? String(exp.startDate).slice(0, 10) : ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Đến ngày (trống = hiện tại)</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('workExperiences', workExperiences, index, {
                              endDate: e.target.value || null,
                            })
                          }
                          type="date"
                          value={exp.endDate ? String(exp.endDate).slice(0, 10) : ''}
                        />
                      </label>
                    </div>
                    <label className="mt-2.5 block space-y-1">
                      <span className="text-xs font-medium">Mô tả</span>
                      <textarea
                        className={textareaClassName}
                        onChange={(e) =>
                          patchListItem('workExperiences', workExperiences, index, {
                            description: e.target.value,
                            descriptionHtml: null,
                          })
                        }
                        placeholder="Trách nhiệm chính..."
                        value={exp.description ?? ''}
                      />
                    </label>
                    <label className="mt-2.5 block space-y-1">
                      <span className="text-xs font-medium">Thành tựu (mỗi dòng 1 ý)</span>
                      <textarea
                        className={textareaClassName}
                        onChange={(e) =>
                          patchListItem('workExperiences', workExperiences, index, {
                            achievements: e.target.value.split('\n'),
                          })
                        }
                        placeholder="Giảm 30% thời gian tải trang..."
                        value={(exp.achievements ?? []).join('\n')}
                      />
                    </label>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            action={
              <Button
                onClick={() =>
                  updateList('projects', [
                    ...projects,
                    {
                      name: '',
                      role: '',
                      technologies: [],
                      description: '',
                      projectUrl: '',
                    },
                  ])
                }
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Thêm dự án
              </Button>
            }
            countBadge={`${projects.length}`}
            hiddenSections={hiddenSections}
            icon={FolderGit2}
            iconTone="bg-cyan-500/15 text-cyan-700"
            onToggleHidden={toggleHiddenSection}
            sectionKey={HARVARD_CV_SECTION.PROJECTS}
            title="6. Dự án"
          >
            {projects.length > 0 ? (
              <div className="space-y-2.5">
                {projects.map((proj, index) => (
                  <div className="rounded-xl border bg-background/60 p-3" key={`proj-${index}`}>
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <span className="text-xs font-semibold text-primary">Dự án #{index + 1}</span>
                      <Button
                        onClick={() => removeListItem('projects', projects, index)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Tên dự án</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('projects', projects, index, { name: e.target.value })
                          }
                          placeholder="JOBHUB"
                          value={proj.name ?? ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Vai trò</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('projects', projects, index, { role: e.target.value })
                          }
                          placeholder="Fullstack Developer"
                          value={proj.role ?? ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Công nghệ (cách nhau dấu phẩy)</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('projects', projects, index, {
                              technologies: e.target.value.split(','),
                            })
                          }
                          placeholder="React, Node.js, MongoDB"
                          value={(proj.technologies ?? []).join(',')}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Link dự án</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('projects', projects, index, {
                              projectUrl: e.target.value,
                            })
                          }
                          placeholder="https://github.com/..."
                          value={proj.projectUrl ?? ''}
                        />
                      </label>
                    </div>
                    <label className="mt-2.5 block space-y-1">
                      <span className="text-xs font-medium">Mô tả</span>
                      <textarea
                        className={textareaClassName}
                        onChange={(e) =>
                          patchListItem('projects', projects, index, {
                            description: e.target.value,
                            descriptionHtml: null,
                          })
                        }
                        placeholder="Mô tả ngắn về dự án..."
                        value={proj.description ?? ''}
                      />
                    </label>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            action={
              <Button
                onClick={() =>
                  updateList('certifications', [
                    ...certifications,
                    {
                      name: '',
                      issuer: '',
                      issueDate: null,
                      expirationDate: null,
                      credentialId: '',
                      credentialUrl: '',
                    },
                  ])
                }
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Thêm chứng chỉ
              </Button>
            }
            countBadge={`${certifications.length}`}
            hiddenSections={hiddenSections}
            icon={Award}
            iconTone="bg-rose-500/15 text-rose-700"
            onToggleHidden={toggleHiddenSection}
            sectionKey={HARVARD_CV_SECTION.CERTIFICATIONS}
            title="7. Chứng chỉ"
          >
            {certifications.length > 0 ? (
              <div className="space-y-2.5">
                {certifications.map((cert, index) => (
                  <div className="rounded-xl border bg-background/60 p-3" key={`cert-${index}`}>
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <span className="text-xs font-semibold text-primary">
                        Chứng chỉ #{index + 1}
                      </span>
                      <Button
                        onClick={() => removeListItem('certifications', certifications, index)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">
                          Tên chứng chỉ <span className="text-destructive">*</span>
                        </span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('certifications', certifications, index, {
                              name: e.target.value,
                            })
                          }
                          placeholder="AWS Certified..."
                          value={cert.name ?? ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Tổ chức cấp</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('certifications', certifications, index, {
                              issuer: e.target.value,
                            })
                          }
                          placeholder="Amazon Web Services"
                          value={cert.issuer ?? ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Ngày cấp</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('certifications', certifications, index, {
                              issueDate: e.target.value || null,
                            })
                          }
                          type="date"
                          value={cert.issueDate ? String(cert.issueDate).slice(0, 10) : ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Ngày hết hạn</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('certifications', certifications, index, {
                              expirationDate: e.target.value || null,
                            })
                          }
                          type="date"
                          value={cert.expirationDate ? String(cert.expirationDate).slice(0, 10) : ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Mã chứng chỉ</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('certifications', certifications, index, {
                              credentialId: e.target.value,
                            })
                          }
                          placeholder="ABC-12345"
                          value={cert.credentialId ?? ''}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium">Link xác thực</span>
                        <Input
                          className="h-9"
                          onChange={(e) =>
                            patchListItem('certifications', certifications, index, {
                              credentialUrl: e.target.value,
                            })
                          }
                          placeholder="https://..."
                          value={cert.credentialUrl ?? ''}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            action={
              <Button
                onClick={() =>
                  updateList('languages', [
                    ...languages,
                    {
                      name: '',
                      proficiency: CV_LANGUAGE_PROFICIENCY.INTERMEDIATE,
                    },
                  ])
                }
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Thêm ngoại ngữ
              </Button>
            }
            countBadge={`${languages.length}`}
            hiddenSections={hiddenSections}
            icon={Languages}
            iconTone="bg-teal-500/15 text-teal-700"
            onToggleHidden={toggleHiddenSection}
            sectionKey={HARVARD_CV_SECTION.LANGUAGES}
            title="8. Ngoại ngữ"
          >
            {languages.length > 0 ? (
              <div className="space-y-2">
                {languages.map((lang, index) => (
                  <div
                    className="grid items-end gap-2.5 rounded-xl border bg-background/60 p-2.5 sm:grid-cols-[1fr_1fr_auto]"
                    key={`lang-${index}`}
                  >
                    <label className="block space-y-1">
                      <span className="text-xs font-medium">
                        Ngôn ngữ <span className="text-destructive">*</span>
                      </span>
                      <Input
                        className="h-9"
                        onChange={(e) =>
                          patchListItem('languages', languages, index, { name: e.target.value })
                        }
                        placeholder="Tiếng Anh, Tiếng Nhật..."
                        value={lang.name ?? ''}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium">
                        Trình độ <span className="text-destructive">*</span>
                      </span>
                      <SelectDropdown
                        onChange={(nextVal) =>
                          patchListItem('languages', languages, index, {
                            proficiency: nextVal,
                          })
                        }
                        options={LANGUAGE_PROFICIENCY_OPTIONS}
                        size="sm"
                        value={lang.proficiency ?? CV_LANGUAGE_PROFICIENCY.INTERMEDIATE}
                      />
                    </label>
                    <Button
                      onClick={() => removeListItem('languages', languages, index)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        </>
      )}
    </div>
  )
}

export default CvGeneratedContentFields
