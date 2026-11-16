import {
  APPLICATION_SOURCE,
  APPLICATION_STATUS,
  AVAILABILITY_DAY_PART,
  CANDIDATE_CV_SOURCE_TYPE,
  CANDIDATE_CV_STATUS,
  INTERVIEW_SCHEDULE_STATUS,
} from '@/utils/constant'
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  formatDate,
} from '@/features/candidate-dashboard/utils'
import {
  EMPLOYMENT_TYPE_LABEL,
  formatSalary,
  formatWorkModes,
} from '@/features/job-discovery/utils'

const INTERVIEW_SCHEDULE_STATUS_LABEL = Object.freeze({
  [INTERVIEW_SCHEDULE_STATUS.PROPOSED]: 'Chờ xác nhận',
  [INTERVIEW_SCHEDULE_STATUS.CONFIRMED]: 'Đã xác nhận',
  [INTERVIEW_SCHEDULE_STATUS.DECLINED]: 'Đã từ chối',
  [INTERVIEW_SCHEDULE_STATUS.CANCELLED]: 'Đã hủy',
})

const INTERVIEW_SCHEDULE_STATUS_TONE = Object.freeze({
  [INTERVIEW_SCHEDULE_STATUS.PROPOSED]: 'bg-warning/15 text-warning-foreground',
  [INTERVIEW_SCHEDULE_STATUS.CONFIRMED]: 'bg-success text-success-foreground',
  [INTERVIEW_SCHEDULE_STATUS.DECLINED]: 'bg-destructive/10 text-destructive',
  [INTERVIEW_SCHEDULE_STATUS.CANCELLED]: 'bg-muted text-muted-foreground',
})

const DAY_PART_LABEL = Object.freeze({
  [AVAILABILITY_DAY_PART.MORNING]: 'Buổi sáng',
  [AVAILABILITY_DAY_PART.AFTERNOON]: 'Buổi chiều',
})

const CV_SOURCE_LABEL = Object.freeze({
  [CANDIDATE_CV_SOURCE_TYPE.GENERATED]: 'Tạo trên JOBHUB',
  [CANDIDATE_CV_SOURCE_TYPE.UPLOADED]: 'PDF tải lên',
})

const APPLICATION_SOURCE_LABEL = Object.freeze({
  [APPLICATION_SOURCE.DIRECT_APPLICATION]: 'Nộp trực tiếp',
  [APPLICATION_SOURCE.RECRUITER_INVITATION]: 'Lời mời',
})

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDateTime(value) {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : dateTimeFormatter.format(date)
}

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return null
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const APPLICATION_TERMINAL_STATUSES = Object.freeze([
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
])

function canWithdrawApplication(application) {
  return application?.status === APPLICATION_STATUS.APPLIED
}

function canReplaceSubmittedCv(application) {
  return application?.status === APPLICATION_STATUS.APPLIED
}

function canRespondToInterviewProposal(schedule) {
  return schedule?.status === INTERVIEW_SCHEDULE_STATUS.PROPOSED
}

function isAvailabilitySubmitted(availability) {
  return availability?.status === 'SUBMITTED'
}

/** Backend: first submit only while Application is CONTACTED. */
function canSubmitAvailabilityFirstTime(application) {
  return (
    application?.status === APPLICATION_STATUS.CONTACTED &&
    !isAvailabilitySubmitted(application?.availability)
  )
}

/**
 * Backend: edit allowed when already submitted, application not terminal,
 * and no live PROPOSED interview schedule.
 */
function canEditAvailability(application) {
  if (!isAvailabilitySubmitted(application?.availability)) {
    return false
  }
  if (APPLICATION_TERMINAL_STATUSES.includes(application?.status)) {
    return false
  }
  const hasProposed = (application?.interviewSchedules ?? []).some(
    (schedule) => schedule.status === INTERVIEW_SCHEDULE_STATUS.PROPOSED,
  )
  return !hasProposed
}

function resolveDefaultTimezone() {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (detected === 'Asia/Saigon') {
    return 'Asia/Ho_Chi_Minh'
  }
  return detected || 'Asia/Ho_Chi_Minh'
}

function isActiveCandidateCv(cv) {
  return cv?.status === CANDIDATE_CV_STATUS.ACTIVE
}

function formatJobMeta(job) {
  if (!job) {
    return []
  }
  return [
    EMPLOYMENT_TYPE_LABEL[job.employmentType] ?? job.employmentType,
    formatWorkModes(job.workModes),
    formatSalary(job.salary),
  ].filter(Boolean)
}

function fileNameFromContentDisposition(disposition, fallback) {
  const matched = disposition?.match(/filename="?([^"]+)"?/i)
  return matched?.[1] || fallback
}

function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName || 'cv.pdf'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function sortInterviewSchedules(schedules = []) {
  return [...schedules].sort((left, right) => {
    const leftKey = `${left.date ?? ''}:${left.dayPart ?? ''}:${left.createdAt ?? ''}`
    const rightKey = `${right.date ?? ''}:${right.dayPart ?? ''}:${right.createdAt ?? ''}`
    return rightKey.localeCompare(leftKey)
  })
}

const APPLICATION_LIST_STATUS_TABS = Object.freeze([
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
])

function countApplicationsByStatus(applications, statuses) {
  const statusSet = new Set(statuses)
  return applications.filter((application) => statusSet.has(application.status)).length
}

function computeApplicationListStats(applications = []) {
  return {
    total: applications.length,
    reviewing: countApplicationsByStatus(applications, [
      APPLICATION_STATUS.SCREENING,
      APPLICATION_STATUS.CONTACTED,
    ]),
    interviewing: countApplicationsByStatus(applications, [
      APPLICATION_STATUS.INTERVIEW_SCHEDULED,
      APPLICATION_STATUS.INTERVIEW_COMPLETED,
    ]),
    hired: countApplicationsByStatus(applications, [APPLICATION_STATUS.HIRED]),
  }
}

function getActiveInterviewSchedules(application) {
  return sortInterviewSchedules(application?.interviewSchedules).filter(
    (schedule) =>
      schedule.status === INTERVIEW_SCHEDULE_STATUS.PROPOSED ||
      schedule.status === INTERVIEW_SCHEDULE_STATUS.CONFIRMED,
  )
}

function matchesApplicationSearch(application, query) {
  const normalized = query?.trim().toLowerCase()
  if (!normalized) {
    return true
  }
  const jobTitle = application.job?.title?.toLowerCase() ?? ''
  const companyName = application.company?.name?.toLowerCase() ?? ''
  return jobTitle.includes(normalized) || companyName.includes(normalized)
}

// Replace/withdraw APIs return a thin application payload without hydrated job/company.
function mergeApplicationDetailUpdate(current, next) {
  if (!next) {
    return current
  }
  if (!current) {
    return next
  }

  return {
    ...current,
    ...next,
    id: next.id ?? current.id,
    jobId: next.jobId ?? current.jobId,
    job: next.job ?? current.job,
    company: next.company ?? current.company,
    assignedRecruiter: next.assignedRecruiter ?? current.assignedRecruiter,
    availability: next.availability ?? current.availability,
    interviewSchedules: next.interviewSchedules ?? current.interviewSchedules,
    isUnassigned:
      next.isUnassigned != null ? next.isUnassigned : current.isUnassigned,
  }
}

export {
  APPLICATION_LIST_STATUS_TABS,
  APPLICATION_SOURCE_LABEL,
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  CV_SOURCE_LABEL,
  DAY_PART_LABEL,
  INTERVIEW_SCHEDULE_STATUS_LABEL,
  INTERVIEW_SCHEDULE_STATUS_TONE,
  canEditAvailability,
  canReplaceSubmittedCv,
  canRespondToInterviewProposal,
  canSubmitAvailabilityFirstTime,
  canWithdrawApplication,
  computeApplicationListStats,
  countApplicationsByStatus,
  fileNameFromContentDisposition,
  formatBytes,
  formatDate,
  formatDateTime,
  formatJobMeta,
  getActiveInterviewSchedules,
  isActiveCandidateCv,
  isAvailabilitySubmitted,
  matchesApplicationSearch,
  mergeApplicationDetailUpdate,
  resolveDefaultTimezone,
  sortInterviewSchedules,
  triggerBlobDownload,
}
