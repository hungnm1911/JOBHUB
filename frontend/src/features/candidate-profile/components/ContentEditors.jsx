import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Input'
import { CV_LANGUAGE_PROFICIENCY } from '@/utils/constant'

import { LANGUAGE_PROFICIENCY_LABEL } from '../utils'
import ProfileModal from './ProfileModal'

function toDateInput(value) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function Field({ label, children, required = false }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

function EditorShell({ title, description, busy, error, onClose, onSubmit, children, canSubmit = true }) {
  return (
    <ProfileModal
      busy={busy}
      description={description}
      footer={
        <>
          <Button disabled={busy} onClick={onClose} type="button" variant="outline">
            Hủy
          </Button>
          <Button disabled={busy || !canSubmit} form="content-editor-form" type="submit">
            {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            Lưu
          </Button>
        </>
      }
      onClose={onClose}
      title={title}
    >
      <form className="space-y-4" id="content-editor-form" onSubmit={onSubmit}>
        {children}
        {error && <p className="text-sm text-destructive">{error.message || error}</p>}
      </form>
    </ProfileModal>
  )
}

function AboutEditor({ initialValue, busy, error, onClose, onSave }) {
  const [summary, setSummary] = useState(initialValue ?? '')

  return (
    <EditorShell
      busy={busy}
      description="Lưu vào professionalSummary của CV Generated."
      error={error}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        onSave(summary.trim() || null)
      }}
      title="Chỉnh sửa giới thiệu"
    >
      <Field label="Giới thiệu bản thân">
        <textarea
          className="min-h-36 w-full rounded-md border border-input bg-secondary/60 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          maxLength={5000}
          onChange={(event) => setSummary(event.target.value)}
          value={summary}
        />
      </Field>
    </EditorShell>
  )
}

function SkillsEditor({ initialValue = [], busy, error, onClose, onSave }) {
  const [skillsText, setSkillsText] = useState(initialValue.join(', '))

  return (
    <EditorShell
      busy={busy}
      description="Nhập kỹ năng, cách nhau bằng dấu phẩy."
      error={error}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        const skills = skillsText
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
        onSave(skills)
      }}
      title="Chỉnh sửa kỹ năng"
    >
      <Field label="Kỹ năng">
        <textarea
          className="min-h-28 w-full rounded-md border border-input bg-secondary/60 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onChange={(event) => setSkillsText(event.target.value)}
          placeholder="React, TypeScript, Node.js"
          value={skillsText}
        />
      </Field>
    </EditorShell>
  )
}

function ExperienceEditor({ initialValue, busy, error, onClose, onSave }) {
  const [position, setPosition] = useState(initialValue?.position ?? '')
  const [companyName, setCompanyName] = useState(initialValue?.companyName ?? '')
  const [startDate, setStartDate] = useState(toDateInput(initialValue?.startDate))
  const [endDate, setEndDate] = useState(toDateInput(initialValue?.endDate))
  const [isCurrent, setIsCurrent] = useState(!initialValue?.endDate && Boolean(initialValue?.startDate))
  const [description, setDescription] = useState(initialValue?.description ?? '')
  const [achievementsText, setAchievementsText] = useState(
    (initialValue?.achievements ?? []).join('\n'),
  )

  return (
    <EditorShell
      busy={busy}
      canSubmit={Boolean(position.trim() || companyName.trim())}
      description="Lưu vào workExperiences của CV Generated."
      error={error}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        onSave({
          position: position.trim() || null,
          companyName: companyName.trim() || null,
          startDate: startDate || null,
          endDate: isCurrent ? null : endDate || null,
          description: description.trim() || null,
          descriptionHtml: null,
          achievements: achievementsText
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
        })
      }}
      title={initialValue ? 'Sửa kinh nghiệm' : 'Thêm kinh nghiệm'}
    >
      <Field label="Vị trí" required>
        <Input onChange={(event) => setPosition(event.target.value)} value={position} />
      </Field>
      <Field label="Công ty" required>
        <Input onChange={(event) => setCompanyName(event.target.value)} value={companyName} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bắt đầu">
          <Input onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
        </Field>
        <Field label="Kết thúc">
          <Input
            disabled={isCurrent}
            onChange={(event) => setEndDate(event.target.value)}
            type="date"
            value={isCurrent ? '' : endDate}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          checked={isCurrent}
          onChange={(event) => setIsCurrent(event.target.checked)}
          type="checkbox"
        />
        Đang làm việc tại đây
      </label>
      <Field label="Mô tả">
        <textarea
          className="min-h-24 w-full rounded-md border border-input bg-secondary/60 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </Field>
      <Field label="Thành tựu (mỗi dòng một mục)">
        <textarea
          className="min-h-24 w-full rounded-md border border-input bg-secondary/60 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onChange={(event) => setAchievementsText(event.target.value)}
          value={achievementsText}
        />
      </Field>
    </EditorShell>
  )
}

function ProjectEditor({ initialValue, busy, error, onClose, onSave }) {
  const [name, setName] = useState(initialValue?.name ?? '')
  const [role, setRole] = useState(initialValue?.role ?? '')
  const [description, setDescription] = useState(initialValue?.description ?? '')
  const [technologiesText, setTechnologiesText] = useState(
    (initialValue?.technologies ?? []).join(', '),
  )
  const [projectUrl, setProjectUrl] = useState(initialValue?.projectUrl ?? '')

  return (
    <EditorShell
      busy={busy}
      canSubmit={Boolean(name.trim())}
      description="Lưu vào projects của CV Generated."
      error={error}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        onSave({
          name: name.trim() || null,
          role: role.trim() || null,
          description: description.trim() || null,
          descriptionHtml: null,
          technologies: technologiesText
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          projectUrl: projectUrl.trim() || null,
        })
      }}
      title={initialValue ? 'Sửa dự án' : 'Thêm dự án'}
    >
      <Field label="Tên dự án" required>
        <Input onChange={(event) => setName(event.target.value)} value={name} />
      </Field>
      <Field label="Vai trò">
        <Input onChange={(event) => setRole(event.target.value)} value={role} />
      </Field>
      <Field label="Mô tả">
        <textarea
          className="min-h-24 w-full rounded-md border border-input bg-secondary/60 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </Field>
      <Field label="Công nghệ (phẩy)">
        <Input
          onChange={(event) => setTechnologiesText(event.target.value)}
          placeholder="React, Node.js"
          value={technologiesText}
        />
      </Field>
      <Field label="URL dự án">
        <Input
          onChange={(event) => setProjectUrl(event.target.value)}
          placeholder="https://"
          value={projectUrl}
        />
      </Field>
    </EditorShell>
  )
}

function EducationEditor({ initialValue, busy, error, onClose, onSave }) {
  const [institutionName, setInstitutionName] = useState(initialValue?.institutionName ?? '')
  const [degree, setDegree] = useState(initialValue?.degree ?? '')
  const [fieldOfStudy, setFieldOfStudy] = useState(initialValue?.fieldOfStudy ?? '')
  const [startDate, setStartDate] = useState(toDateInput(initialValue?.startDate))
  const [endDate, setEndDate] = useState(toDateInput(initialValue?.endDate))

  return (
    <EditorShell
      busy={busy}
      canSubmit={Boolean(institutionName.trim() || degree.trim())}
      description="Lưu vào educations của CV Generated."
      error={error}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        onSave({
          institutionName: institutionName.trim() || null,
          degree: degree.trim() || null,
          fieldOfStudy: fieldOfStudy.trim() || null,
          startDate: startDate || null,
          endDate: endDate || null,
        })
      }}
      title={initialValue ? 'Sửa học vấn' : 'Thêm học vấn'}
    >
      <Field label="Trường / tổ chức" required>
        <Input onChange={(event) => setInstitutionName(event.target.value)} value={institutionName} />
      </Field>
      <Field label="Bằng cấp">
        <Input onChange={(event) => setDegree(event.target.value)} value={degree} />
      </Field>
      <Field label="Chuyên ngành">
        <Input onChange={(event) => setFieldOfStudy(event.target.value)} value={fieldOfStudy} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bắt đầu">
          <Input onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
        </Field>
        <Field label="Kết thúc">
          <Input onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
        </Field>
      </div>
    </EditorShell>
  )
}

function CertificationEditor({ initialValue, busy, error, onClose, onSave }) {
  const [name, setName] = useState(initialValue?.name ?? '')
  const [issuer, setIssuer] = useState(initialValue?.issuer ?? '')
  const [issueDate, setIssueDate] = useState(toDateInput(initialValue?.issueDate))
  const [expirationDate, setExpirationDate] = useState(toDateInput(initialValue?.expirationDate))
  const [credentialId, setCredentialId] = useState(initialValue?.credentialId ?? '')
  const [credentialUrl, setCredentialUrl] = useState(initialValue?.credentialUrl ?? '')

  return (
    <EditorShell
      busy={busy}
      canSubmit={Boolean(name.trim())}
      description="Lưu vào certifications của CV Generated."
      error={error}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        onSave({
          name: name.trim() || null,
          issuer: issuer.trim() || null,
          issueDate: issueDate || null,
          expirationDate: expirationDate || null,
          credentialId: credentialId.trim() || null,
          credentialUrl: credentialUrl.trim() || null,
        })
      }}
      title={initialValue ? 'Sửa chứng chỉ' : 'Thêm chứng chỉ'}
    >
      <Field label="Tên chứng chỉ" required>
        <Input onChange={(event) => setName(event.target.value)} value={name} />
      </Field>
      <Field label="Tổ chức cấp">
        <Input onChange={(event) => setIssuer(event.target.value)} value={issuer} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ngày cấp">
          <Input onChange={(event) => setIssueDate(event.target.value)} type="date" value={issueDate} />
        </Field>
        <Field label="Hết hạn">
          <Input
            onChange={(event) => setExpirationDate(event.target.value)}
            type="date"
            value={expirationDate}
          />
        </Field>
      </div>
      <Field label="Mã chứng chỉ">
        <Input onChange={(event) => setCredentialId(event.target.value)} value={credentialId} />
      </Field>
      <Field label="URL chứng chỉ">
        <Input onChange={(event) => setCredentialUrl(event.target.value)} value={credentialUrl} />
      </Field>
    </EditorShell>
  )
}

function LanguageEditor({ initialValue, busy, error, onClose, onSave }) {
  const [name, setName] = useState(initialValue?.name ?? '')
  const [proficiency, setProficiency] = useState(
    initialValue?.proficiency ?? CV_LANGUAGE_PROFICIENCY.INTERMEDIATE,
  )

  return (
    <EditorShell
      busy={busy}
      canSubmit={Boolean(name.trim())}
      description="Lưu vào languages của CV Generated."
      error={error}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        onSave({
          name: name.trim() || null,
          proficiency: proficiency || null,
        })
      }}
      title={initialValue ? 'Sửa ngoại ngữ' : 'Thêm ngoại ngữ'}
    >
      <Field label="Ngôn ngữ" required>
        <Input onChange={(event) => setName(event.target.value)} value={name} />
      </Field>
      <Field label="Mức độ">
        <select
          className="flex h-11 w-full rounded-md border border-input bg-secondary/60 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onChange={(event) => setProficiency(event.target.value)}
          value={proficiency}
        >
          {Object.values(CV_LANGUAGE_PROFICIENCY).map((value) => (
            <option key={value} value={value}>
              {LANGUAGE_PROFICIENCY_LABEL[value]}
            </option>
          ))}
        </select>
      </Field>
    </EditorShell>
  )
}

export {
  AboutEditor,
  CertificationEditor,
  EducationEditor,
  ExperienceEditor,
  LanguageEditor,
  ProjectEditor,
  SkillsEditor,
}
