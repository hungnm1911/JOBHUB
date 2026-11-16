import { formatDate } from '@/features/candidate-dashboard/utils'
import {
  EMPLOYMENT_TYPE_LABEL,
  formatSalary,
  formatWorkModes,
} from '@/features/job-discovery/utils'
import { JOB_INVITATION_STATUS } from '@/utils/constant'

const JOB_INVITATION_STATUS_LABEL = Object.freeze({
  [JOB_INVITATION_STATUS.PENDING]: 'Chờ phản hồi',
  [JOB_INVITATION_STATUS.ACCEPTED]: 'Đã chấp nhận',
  [JOB_INVITATION_STATUS.REJECTED]: 'Đã từ chối',
  [JOB_INVITATION_STATUS.REVOKED]: 'Đã thu hồi',
  [JOB_INVITATION_STATUS.EXPIRED]: 'Đã hết hạn',
  [JOB_INVITATION_STATUS.INVALIDATED]: 'Không còn hiệu lực',
})

const JOB_INVITATION_STATUS_TONE = Object.freeze({
  [JOB_INVITATION_STATUS.PENDING]: 'bg-warning/15 text-warning-foreground',
  [JOB_INVITATION_STATUS.ACCEPTED]: 'bg-success text-success-foreground',
  [JOB_INVITATION_STATUS.REJECTED]: 'bg-destructive/10 text-destructive',
  [JOB_INVITATION_STATUS.REVOKED]: 'bg-muted text-muted-foreground',
  [JOB_INVITATION_STATUS.EXPIRED]: 'bg-muted text-muted-foreground',
  [JOB_INVITATION_STATUS.INVALIDATED]: 'bg-muted text-muted-foreground',
})

const INVITATION_FILTER_TABS = Object.freeze([
  JOB_INVITATION_STATUS.PENDING,
  JOB_INVITATION_STATUS.ACCEPTED,
  JOB_INVITATION_STATUS.REJECTED,
  JOB_INVITATION_STATUS.EXPIRED,
  JOB_INVITATION_STATUS.REVOKED,
  JOB_INVITATION_STATUS.INVALIDATED,
])

const INVITATION_SORT = Object.freeze({
  NEWEST: 'newest',
  OLDEST: 'oldest',
  DEADLINE: 'deadline',
})

const INVITATION_SORT_LABEL = Object.freeze({
  [INVITATION_SORT.NEWEST]: 'Mới nhất',
  [INVITATION_SORT.OLDEST]: 'Cũ nhất',
  [INVITATION_SORT.DEADLINE]: 'Hạn phản hồi gần nhất',
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

function getTimestamp(value) {
  if (!value) {
    return null
  }
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

function canAcceptInvitation(invitation) {
  return invitation?.canAccept === true
}

function canRejectInvitation(invitation) {
  return invitation?.canReject === true
}

function formatInvitationJobMeta(job) {
  if (!job) {
    return []
  }
  return [
    EMPLOYMENT_TYPE_LABEL[job.employmentType] ?? job.employmentType,
    formatWorkModes(job.workModes),
    formatSalary(job.salary),
  ].filter(Boolean)
}

function computeInvitationStats(invitations = []) {
  const counts = {
    total: invitations.length,
    pending: 0,
    accepted: 0,
    rejected: 0,
  }

  for (const invitation of invitations) {
    if (invitation.status === JOB_INVITATION_STATUS.PENDING) {
      counts.pending += 1
    } else if (invitation.status === JOB_INVITATION_STATUS.ACCEPTED) {
      counts.accepted += 1
    } else if (invitation.status === JOB_INVITATION_STATUS.REJECTED) {
      counts.rejected += 1
    }
  }

  return counts
}

function matchesInvitationSearch(invitation, query) {
  const normalized = query?.trim().toLowerCase()
  if (!normalized) {
    return true
  }

  const jobTitle = invitation.job?.title?.toLowerCase() ?? ''
  const companyName = invitation.company?.name?.toLowerCase() ?? ''
  const senderName = invitation.sender?.fullName?.toLowerCase() ?? ''
  return (
    jobTitle.includes(normalized) ||
    companyName.includes(normalized) ||
    senderName.includes(normalized)
  )
}

function sortInvitations(invitations = [], sort = INVITATION_SORT.NEWEST) {
  return [...invitations].sort((left, right) => {
    if (sort === INVITATION_SORT.DEADLINE) {
      const leftExpiry = getTimestamp(left.expiresAt) ?? Number.POSITIVE_INFINITY
      const rightExpiry = getTimestamp(right.expiresAt) ?? Number.POSITIVE_INFINITY
      if (leftExpiry !== rightExpiry) {
        return leftExpiry - rightExpiry
      }
    }

    const leftSent = getTimestamp(left.sentAt) ?? getTimestamp(left.createdAt) ?? 0
    const rightSent = getTimestamp(right.sentAt) ?? getTimestamp(right.createdAt) ?? 0
    if (leftSent !== rightSent) {
      return sort === INVITATION_SORT.OLDEST ? leftSent - rightSent : rightSent - leftSent
    }

    return String(right.id).localeCompare(String(left.id))
  })
}

function formatExpiryCountdown(expiresAt, now = Date.now()) {
  const expiry = getTimestamp(expiresAt)
  if (expiry == null) {
    return null
  }
  const diffMs = expiry - now
  if (diffMs <= 0) {
    return 'Đã đến hạn phản hồi'
  }

  const totalHours = Math.ceil(diffMs / (60 * 60 * 1000))
  if (totalHours < 24) {
    return `Còn ${totalHours} giờ`
  }

  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
  return `Còn ${days} ngày`
}

export {
  INVITATION_FILTER_TABS,
  INVITATION_SORT,
  INVITATION_SORT_LABEL,
  JOB_INVITATION_STATUS_LABEL,
  JOB_INVITATION_STATUS_TONE,
  canAcceptInvitation,
  canRejectInvitation,
  computeInvitationStats,
  formatDate,
  formatDateTime,
  formatExpiryCountdown,
  formatInvitationJobMeta,
  matchesInvitationSearch,
  sortInvitations,
}
