import { CV_LANGUAGE_PROFICIENCY } from '@/utils/constant'

const LANGUAGE_PROFICIENCY_LABEL = Object.freeze({
  [CV_LANGUAGE_PROFICIENCY.BEGINNER]: 'Cơ bản',
  [CV_LANGUAGE_PROFICIENCY.INTERMEDIATE]: 'Trung cấp',
  [CV_LANGUAGE_PROFICIENCY.ADVANCED]: 'Nâng cao',
  [CV_LANGUAGE_PROFICIENCY.FLUENT]: 'Thành thạo',
  [CV_LANGUAGE_PROFICIENCY.NATIVE]: 'Bản ngữ',
})

const monthFormatter = new Intl.DateTimeFormat('vi-VN', {
  month: '2-digit',
  year: 'numeric',
})

function emptyGeneratedContent() {
  return {
    personalInfo: {
      fullName: null,
      email: null,
      phone: null,
      displayLocation: null,
      links: [],
      avatarUrl: null,
    },
    professionalSummary: null,
    professionalSummaryHtml: null,
    educations: [],
    skills: [],
    workExperiences: [],
    projects: [],
    certifications: [],
    languages: [],
    hiddenSections: [],
  }
}

function toContentPayload(content) {
  const source = content ?? emptyGeneratedContent()
  return {
    personalInfo: {
      fullName: source.personalInfo?.fullName ?? null,
      email: source.personalInfo?.email ?? null,
      phone: source.personalInfo?.phone ?? null,
      displayLocation: source.personalInfo?.displayLocation ?? null,
      links: [...(source.personalInfo?.links ?? [])],
      avatarUrl: source.personalInfo?.avatarUrl ?? null,
    },
    professionalSummary: source.professionalSummary ?? null,
    professionalSummaryHtml: source.professionalSummaryHtml ?? null,
    educations: [...(source.educations ?? [])],
    skills: [...(source.skills ?? [])],
    workExperiences: [...(source.workExperiences ?? [])],
    projects: [...(source.projects ?? [])],
    certifications: [...(source.certifications ?? [])],
    languages: [...(source.languages ?? [])],
    hiddenSections: [...(source.hiddenSections ?? [])],
  }
}

function formatMonthYear(value) {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : monthFormatter.format(date)
}

function formatDateRange(startDate, endDate) {
  const start = formatMonthYear(startDate)
  const end = endDate ? formatMonthYear(endDate) : 'Hiện tại'
  if (!start && !endDate) {
    return endDate == null && startDate == null ? null : end
  }
  if (!start) {
    return end
  }
  return `${start} – ${end}`
}

function formatDuration(startDate, endDate) {
  if (!startDate) {
    return null
  }
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null
  }
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  const years = Math.floor(months / 12)
  const remain = months % 12
  if (years <= 0) {
    return `${Math.max(remain, 1)} tháng`
  }
  if (remain === 0) {
    return `${years} năm`
  }
  return `${years} năm ${remain} tháng`
}

function sortByStartDateDesc(items) {
  return [...items].sort((left, right) => {
    const leftTime = left.startDate ? new Date(left.startDate).getTime() : 0
    const rightTime = right.startDate ? new Date(right.startDate).getTime() : 0
    return rightTime - leftTime
  })
}

function hasUsableAvatar(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return false
  }
  return !/dicebear\.com|ui-avatars\.com|robohash\.org/i.test(url)
}

function computeProfilePageCompletion({ profile, content, hasDefaultCv }) {
  const checks = [
    { key: 'fullName', label: 'Họ và tên', done: Boolean(profile?.fullName?.trim()), weight: 10 },
    {
      key: 'avatarUrl',
      label: 'Ảnh đại diện',
      done: hasUsableAvatar(profile?.avatarUrl),
      weight: 10,
    },
    { key: 'phoneNumber', label: 'Số điện thoại', done: Boolean(profile?.phoneNumber?.trim()), weight: 10 },
    { key: 'dateOfBirth', label: 'Ngày sinh', done: Boolean(profile?.dateOfBirth), weight: 10 },
    {
      key: 'summary',
      label: 'Giới thiệu bản thân',
      done: Boolean(content?.professionalSummary?.trim() || content?.professionalSummaryHtml?.trim()),
      weight: 15,
    },
    {
      key: 'experience',
      label: 'Kinh nghiệm làm việc',
      done: (content?.workExperiences?.length ?? 0) > 0,
      weight: 15,
    },
    {
      key: 'skills',
      label: 'Kỹ năng',
      done: (content?.skills?.length ?? 0) > 0,
      weight: 10,
    },
    {
      key: 'education',
      label: 'Học vấn',
      done: (content?.educations?.length ?? 0) > 0,
      weight: 10,
    },
    { key: 'defaultCv', label: 'CV mặc định', done: Boolean(hasDefaultCv), weight: 10 },
  ]

  const percent = checks.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0)
  return {
    percent,
    missing: checks.filter((item) => !item.done),
  }
}

function companyInitials(name) {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export {
  LANGUAGE_PROFICIENCY_LABEL,
  companyInitials,
  computeProfilePageCompletion,
  emptyGeneratedContent,
  formatDateRange,
  formatDuration,
  formatMonthYear,
  sortByStartDateDesc,
  toContentPayload,
}
