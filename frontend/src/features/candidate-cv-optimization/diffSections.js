// AI-V06 F04 / Data §6.7: readable text for the Preview Diff. `baseline` and
// `proposedContent` are rendered section by section in the seven career groups
// AI-V06 may change; raw JSON is never diffed. Source order and text are kept.

const DIFF_SECTIONS = Object.freeze([
  { key: 'professionalSummary', title: 'Tóm tắt nghề nghiệp' },
  { key: 'skills', title: 'Kỹ năng' },
  { key: 'workExperiences', title: 'Kinh nghiệm làm việc' },
  { key: 'projects', title: 'Dự án' },
  { key: 'educations', title: 'Học vấn' },
  { key: 'certifications', title: 'Chứng chỉ' },
  { key: 'languages', title: 'Ngoại ngữ' },
])

const CHANGE = Object.freeze({
  UNCHANGED: 'unchanged',
  EMPTY: 'empty',
  ADDED: 'added',
  REMOVED: 'removed',
  MODIFIED: 'modified',
})

const text = (value) => (typeof value === 'string' ? value.trim() : '')
const list = (value) => (Array.isArray(value) ? value : [])

function formatDate(value) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? text(String(value)) : date.toISOString().slice(0, 10)
}

function formatRange(start, end, openEnded) {
  const from = formatDate(start)
  const to = formatDate(end)
  if (!from && !to) {
    return ''
  }
  return `${from || '…'} → ${to || (openEnded ? 'Hiện tại' : '…')}`
}

// Entry lines are joined by "\n"; blank/absent parts are skipped, not invented.
const joinLines = (lines) => lines.filter(Boolean).join('\n')

const bullets = (items) =>
  list(items).map(text).filter(Boolean).map((item) => `• ${item}`)

const formatters = {
  professionalSummary: (content) => text(content?.professionalSummary),
  skills: (content) => bullets(content?.skills).join('\n'),
  workExperiences: (content) =>
    list(content?.workExperiences).map((item) =>
      joinLines([
        [text(item?.position), text(item?.companyName)].filter(Boolean).join(' — '),
        formatRange(item?.startDate, item?.endDate, true),
        text(item?.description),
        ...bullets(item?.achievements),
      ]),
    ),
  projects: (content) =>
    list(content?.projects).map((item) =>
      joinLines([
        [text(item?.name), text(item?.role)].filter(Boolean).join(' — '),
        list(item?.technologies).map(text).filter(Boolean).join(', '),
        text(item?.description),
        text(item?.projectUrl),
      ]),
    ),
  educations: (content) =>
    list(content?.educations).map((item) =>
      joinLines([
        text(item?.institutionName),
        [text(item?.degree), text(item?.fieldOfStudy)].filter(Boolean).join(' — '),
        formatRange(item?.startDate, item?.endDate, true),
      ]),
    ),
  certifications: (content) =>
    list(content?.certifications).map((item) =>
      joinLines([
        [text(item?.name), text(item?.issuer)].filter(Boolean).join(' — '),
        formatRange(item?.issueDate, item?.expirationDate, false),
        text(item?.credentialId),
        text(item?.credentialUrl),
      ]),
    ),
  languages: (content) =>
    list(content?.languages).map((item) =>
      [text(item?.name), text(item?.proficiency)].filter(Boolean).join(' — '),
    ),
}

// Entries are separated by a blank line so each one is a distinct diff block.
function formatSection(key, content) {
  const formatted = formatters[key](content)
  const value = Array.isArray(formatted)
    ? formatted.filter(Boolean).join('\n\n')
    : formatted
  return value
}

function classifyChange(before, after) {
  if (before === after) {
    return before === '' ? CHANGE.EMPTY : CHANGE.UNCHANGED
  }
  if (before === '') {
    return CHANGE.ADDED
  }
  return after === '' ? CHANGE.REMOVED : CHANGE.MODIFIED
}

function buildOptimizationDiffSections(baseline, proposedContent) {
  return DIFF_SECTIONS.map(({ key, title }) => {
    const before = formatSection(key, baseline)
    const after = formatSection(key, proposedContent)
    return { key, title, before, after, change: classifyChange(before, after) }
  })
}

export { buildOptimizationDiffSections, CHANGE, DIFF_SECTIONS, formatSection }
