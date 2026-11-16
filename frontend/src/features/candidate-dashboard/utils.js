import { APPLICATION_STATUS } from '@/utils/constant'

const APPLICATION_STATUS_LABEL = Object.freeze({
  [APPLICATION_STATUS.APPLIED]: 'Đã nộp',
  [APPLICATION_STATUS.SCREENING]: 'Đang xét duyệt',
  [APPLICATION_STATUS.CONTACTED]: 'Đã liên hệ',
  [APPLICATION_STATUS.INTERVIEW_SCHEDULED]: 'Đã lên lịch phỏng vấn',
  [APPLICATION_STATUS.INTERVIEW_COMPLETED]: 'Đã phỏng vấn',
  [APPLICATION_STATUS.HIRED]: 'Được nhận',
  [APPLICATION_STATUS.REJECTED]: 'Từ chối',
  [APPLICATION_STATUS.WITHDRAWN]: 'Đã rút đơn',
})

const APPLICATION_STATUS_TONE = Object.freeze({
  [APPLICATION_STATUS.APPLIED]: 'bg-secondary text-secondary-foreground',
  [APPLICATION_STATUS.SCREENING]: 'bg-primary/10 text-primary',
  [APPLICATION_STATUS.CONTACTED]: 'bg-primary/10 text-primary',
  [APPLICATION_STATUS.INTERVIEW_SCHEDULED]: 'bg-warning/15 text-warning-foreground',
  [APPLICATION_STATUS.INTERVIEW_COMPLETED]: 'bg-warning/15 text-warning-foreground',
  [APPLICATION_STATUS.HIRED]: 'bg-success text-success-foreground',
  [APPLICATION_STATUS.REJECTED]: 'bg-destructive/10 text-destructive',
  [APPLICATION_STATUS.WITHDRAWN]: 'bg-muted text-muted-foreground',
})

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' })
const relativeTimeFormatter = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' })

function formatDate(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date)
}

function formatRelativeTime(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const absolute = Math.abs(deltaSeconds)

  if (absolute < 60) {
    return relativeTimeFormatter.format(deltaSeconds, 'second')
  }
  if (absolute < 3600) {
    return relativeTimeFormatter.format(Math.round(deltaSeconds / 60), 'minute')
  }
  if (absolute < 86_400) {
    return relativeTimeFormatter.format(Math.round(deltaSeconds / 3600), 'hour')
  }
  if (absolute < 2_592_000) {
    return relativeTimeFormatter.format(Math.round(deltaSeconds / 86_400), 'day')
  }

  return formatDate(value)
}

function normalizeNotification(notification) {
  if (!notification) {
    return null
  }

  return {
    id: String(notification.id ?? notification._id),
    type: notification.type,
    content: notification.content,
    readAt: notification.readAt ?? null,
    createdAt: notification.createdAt,
    applicationId: notification.applicationId ? String(notification.applicationId) : null,
    jobInvitationId: notification.jobInvitationId
      ? String(notification.jobInvitationId)
      : null,
  }
}

function computeProfileCompletion({ profile, cvs }) {
  const checks = [
    {
      key: 'fullName',
      label: 'Họ và tên',
      done: Boolean(profile?.fullName?.trim()),
      weight: 15,
    },
    {
      key: 'avatarUrl',
      label: 'Ảnh đại diện',
      done: Boolean(profile?.avatarUrl),
      weight: 15,
    },
    {
      key: 'phoneNumber',
      label: 'Số điện thoại',
      done: Boolean(profile?.phoneNumber?.trim()),
      weight: 20,
    },
    {
      key: 'dateOfBirth',
      label: 'Ngày sinh',
      done: Boolean(profile?.dateOfBirth),
      weight: 15,
    },
    {
      key: 'cv',
      label: 'Ít nhất một CV',
      done: (cvs?.length ?? 0) > 0,
      weight: 20,
    },
    {
      key: 'defaultCv',
      label: 'CV mặc định',
      done: Boolean(cvs?.some((cv) => cv.isDefault)),
      weight: 15,
    },
  ]

  const completedWeight = checks.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0)
  const missing = checks.filter((item) => !item.done)

  return {
    percent: completedWeight,
    missing,
    nextSuggestion: missing[0] ?? null,
  }
}

function countApplicationsByStatus(applications, statuses) {
  const statusSet = new Set(statuses)
  return applications.filter((application) => statusSet.has(application.status)).length
}

export {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  computeProfileCompletion,
  countApplicationsByStatus,
  formatDate,
  formatRelativeTime,
  normalizeNotification,
}
