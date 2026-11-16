import { formatDate } from '@/features/candidate-dashboard/utils'
import {
  EMPLOYMENT_TYPE_LABEL,
  formatProvince,
  formatSalary,
  formatWorkModes,
} from '@/features/job-discovery/utils'
import { JOB_STATUS } from '@/utils/constant'

const SAVED_JOB_FILTER = Object.freeze({
  ALL: 'all',
  OPEN: 'open',
  APPLIED: 'applied',
})

const SAVED_JOB_FILTER_LABEL = Object.freeze({
  [SAVED_JOB_FILTER.ALL]: 'Tất cả',
  [SAVED_JOB_FILTER.OPEN]: 'Chưa ứng tuyển',
  [SAVED_JOB_FILTER.APPLIED]: 'Đã ứng tuyển',
})

const JOB_STATUS_LABEL = Object.freeze({
  [JOB_STATUS.PUBLISHED]: 'Đang tuyển',
  [JOB_STATUS.CLOSED]: 'Đã đóng',
  [JOB_STATUS.EXPIRED]: 'Hết hạn',
  [JOB_STATUS.DRAFT]: 'Bản nháp',
})

function matchesSavedJobSearch(entry, query) {
  const normalized = query?.trim().toLowerCase()
  if (!normalized) {
    return true
  }
  const haystack = [entry?.job?.title, entry?.job?.company?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(normalized)
}

function matchesSavedJobFilter(entry, filter) {
  if (filter === SAVED_JOB_FILTER.OPEN) {
    return entry?.hasApplication !== true
  }
  if (filter === SAVED_JOB_FILTER.APPLIED) {
    return entry?.hasApplication === true
  }
  return true
}

function formatSavedJobMeta(job, provinceNameByCode) {
  if (!job) {
    return []
  }
  return [
    EMPLOYMENT_TYPE_LABEL[job.employmentType] ?? job.employmentType,
    formatWorkModes(job.workModes),
    formatProvince(job.location, provinceNameByCode),
    formatSalary(job.salary),
  ].filter(Boolean)
}

function getSavedJobId(entry) {
  return entry?.job?.id ?? null
}

export {
  JOB_STATUS_LABEL,
  SAVED_JOB_FILTER,
  SAVED_JOB_FILTER_LABEL,
  formatDate,
  formatSavedJobMeta,
  formatSalary,
  getSavedJobId,
  matchesSavedJobFilter,
  matchesSavedJobSearch,
}
