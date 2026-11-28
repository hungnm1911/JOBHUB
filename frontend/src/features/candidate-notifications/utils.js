import {
  BriefcaseBusiness,
  CalendarClock,
  CircleCheck,
  CircleX,
  Mail,
  MessageSquare,
  UserRound,
} from 'lucide-react'

// Must stay aligned with backend/src/constants/notification-type.js
import { NOTIFICATION_TYPE } from '@/utils/constant'

const NOTIFICATION_LIST_FILTER = Object.freeze({
  ALL: 'ALL',
  UNREAD: 'UNREAD',
  READ: 'READ',
  APPLICATION: 'APPLICATION',
  INVITATION: 'INVITATION',
  INTERVIEW: 'INTERVIEW',
  MESSAGE: 'MESSAGE',
})

const NOTIFICATION_LIST_FILTER_LABEL = Object.freeze({
  [NOTIFICATION_LIST_FILTER.ALL]: 'Tất cả',
  [NOTIFICATION_LIST_FILTER.UNREAD]: 'Chưa đọc',
  [NOTIFICATION_LIST_FILTER.READ]: 'Đã đọc',
  [NOTIFICATION_LIST_FILTER.APPLICATION]: 'Đơn',
  [NOTIFICATION_LIST_FILTER.INVITATION]: 'Lời mời',
  [NOTIFICATION_LIST_FILTER.INTERVIEW]: 'Phỏng vấn',
  [NOTIFICATION_LIST_FILTER.MESSAGE]: 'Tin nhắn',
})

const APPLICATION_TYPES = new Set([
  NOTIFICATION_TYPE.DIRECT_APPLICATION_CREATED,
  NOTIFICATION_TYPE.APPLICATION_ASSIGNED,
  NOTIFICATION_TYPE.APPLICATION_REASSIGNED,
  NOTIFICATION_TYPE.APPLICATION_UNASSIGNED,
  NOTIFICATION_TYPE.APPLICATION_STATUS_CHANGED,
  NOTIFICATION_TYPE.APPLICATION_HIRED,
  NOTIFICATION_TYPE.APPLICATION_REJECTED,
  NOTIFICATION_TYPE.APPLICATION_WITHDRAWN,
  NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED,
])

const INVITATION_TYPES = new Set([
  NOTIFICATION_TYPE.JOB_INVITATION_RECEIVED,
  NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED,
  NOTIFICATION_TYPE.JOB_INVITATION_REJECTED,
  NOTIFICATION_TYPE.JOB_INVITATION_REVOKED,
  NOTIFICATION_TYPE.JOB_INVITATION_INVALIDATED,
])

const INTERVIEW_TYPES = new Set([
  NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED,
  NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_SUBMITTED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CREATED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CHANGED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CONFIRMED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_DECLINED,
])

const NOTIFICATION_TYPE_META = Object.freeze({
  [NOTIFICATION_TYPE.PLATFORM_ANNOUNCEMENT]: {
    label: 'Thông báo hệ thống',
    icon: Mail,
    tone: 'bg-primary/10 text-primary',
  },
  [NOTIFICATION_TYPE.DIRECT_APPLICATION_CREATED]: {
    label: 'Đơn ứng tuyển',
    icon: BriefcaseBusiness,
    tone: 'bg-primary/10 text-primary',
  },
  [NOTIFICATION_TYPE.APPLICATION_ASSIGNED]: {
    label: 'Phụ trách đơn',
    icon: UserRound,
    tone: 'bg-primary/10 text-primary',
  },
  [NOTIFICATION_TYPE.APPLICATION_REASSIGNED]: {
    label: 'Đổi phụ trách',
    icon: UserRound,
    tone: 'bg-secondary text-secondary-foreground',
  },
  [NOTIFICATION_TYPE.APPLICATION_UNASSIGNED]: {
    label: 'Bỏ phụ trách',
    icon: UserRound,
    tone: 'bg-secondary text-secondary-foreground',
  },
  [NOTIFICATION_TYPE.APPLICATION_STATUS_CHANGED]: {
    label: 'Cập nhật đơn',
    icon: BriefcaseBusiness,
    tone: 'bg-primary/10 text-primary',
  },
  [NOTIFICATION_TYPE.APPLICATION_HIRED]: {
    label: 'Được tuyển',
    icon: CircleCheck,
    tone: 'bg-emerald-500/10 text-emerald-700',
  },
  [NOTIFICATION_TYPE.APPLICATION_REJECTED]: {
    label: 'Từ chối',
    icon: CircleX,
    tone: 'bg-destructive/10 text-destructive',
  },
  [NOTIFICATION_TYPE.APPLICATION_WITHDRAWN]: {
    label: 'Rút đơn',
    icon: CircleX,
    tone: 'bg-secondary text-secondary-foreground',
  },
  [NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED]: {
    label: 'Lịch trống',
    icon: CalendarClock,
    tone: 'bg-amber-500/10 text-amber-700',
  },
  [NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_SUBMITTED]: {
    label: 'Đã gửi lịch',
    icon: CalendarClock,
    tone: 'bg-amber-500/10 text-amber-700',
  },
  [NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CREATED]: {
    label: 'Lịch PV',
    icon: CalendarClock,
    tone: 'bg-amber-500/10 text-amber-700',
  },
  [NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CHANGED]: {
    label: 'Đổi lịch PV',
    icon: CalendarClock,
    tone: 'bg-amber-500/10 text-amber-700',
  },
  [NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CONFIRMED]: {
    label: 'Xác nhận PV',
    icon: CircleCheck,
    tone: 'bg-emerald-500/10 text-emerald-700',
  },
  [NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_DECLINED]: {
    label: 'Từ chối PV',
    icon: CircleX,
    tone: 'bg-destructive/10 text-destructive',
  },
  [NOTIFICATION_TYPE.CHAT_MESSAGE_CREATED]: {
    label: 'Tin nhắn',
    icon: MessageSquare,
    tone: 'bg-sky-500/10 text-sky-700',
  },
  [NOTIFICATION_TYPE.JOB_INVITATION_RECEIVED]: {
    label: 'Lời mời',
    icon: Mail,
    tone: 'bg-violet-500/10 text-violet-700',
  },
  [NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED]: {
    label: 'Nhận lời mời',
    icon: CircleCheck,
    tone: 'bg-emerald-500/10 text-emerald-700',
  },
  [NOTIFICATION_TYPE.JOB_INVITATION_REJECTED]: {
    label: 'Từ chối lời mời',
    icon: CircleX,
    tone: 'bg-secondary text-secondary-foreground',
  },
  [NOTIFICATION_TYPE.JOB_INVITATION_REVOKED]: {
    label: 'Thu hồi lời mời',
    icon: CircleX,
    tone: 'bg-secondary text-secondary-foreground',
  },
  [NOTIFICATION_TYPE.JOB_INVITATION_INVALIDATED]: {
    label: 'Lời mời hết hạn',
    icon: CircleX,
    tone: 'bg-secondary text-secondary-foreground',
  },
  [NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED]: {
    label: 'Đơn từ lời mời',
    icon: BriefcaseBusiness,
    tone: 'bg-primary/10 text-primary',
  },
})

const DEFAULT_TYPE_META = Object.freeze({
  label: 'Thông báo',
  icon: Mail,
  tone: 'bg-secondary text-muted-foreground',
})

const relativeTimeFormatter = new Intl.RelativeTimeFormat('vi', {
  numeric: 'auto',
})

function formatRelativeTime(value) {
  if (!value) {
    return ''
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const deltaSeconds = (date.getTime() - Date.now()) / 1000
  const absolute = Math.abs(deltaSeconds)

  if (absolute < 60) {
    return relativeTimeFormatter.format(Math.round(deltaSeconds), 'second')
  }
  if (absolute < 3600) {
    return relativeTimeFormatter.format(Math.round(deltaSeconds / 60), 'minute')
  }
  if (absolute < 86_400) {
    return relativeTimeFormatter.format(Math.round(deltaSeconds / 3600), 'hour')
  }
  if (absolute < 86_400 * 30) {
    return relativeTimeFormatter.format(
      Math.round(deltaSeconds / 86_400),
      'day',
    )
  }

  return new Intl.DateTimeFormat('vi', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function normalizeNotification(notification) {
  if (!notification) {
    return null
  }

  return {
    id: String(notification.id ?? notification._id),
    type: notification.type ?? null,
    content: notification.content ?? '',
    readAt: notification.readAt ?? null,
    createdAt: notification.createdAt ?? null,
    applicationId: notification.applicationId
      ? String(notification.applicationId)
      : null,
    jobInvitationId: notification.jobInvitationId
      ? String(notification.jobInvitationId)
      : null,
    messageId: notification.messageId ? String(notification.messageId) : null,
    interviewScheduleId: notification.interviewScheduleId
      ? String(notification.interviewScheduleId)
      : null,
  }
}

function getNotificationTypeMeta(type) {
  return NOTIFICATION_TYPE_META[type] ?? DEFAULT_TYPE_META
}

function getNotificationCategory(type) {
  if (type === NOTIFICATION_TYPE.CHAT_MESSAGE_CREATED) {
    return NOTIFICATION_LIST_FILTER.MESSAGE
  }
  if (INTERVIEW_TYPES.has(type)) {
    return NOTIFICATION_LIST_FILTER.INTERVIEW
  }
  if (INVITATION_TYPES.has(type)) {
    return NOTIFICATION_LIST_FILTER.INVITATION
  }
  if (APPLICATION_TYPES.has(type)) {
    return NOTIFICATION_LIST_FILTER.APPLICATION
  }
  return null
}

function matchesNotificationFilter(notification, filter) {
  if (filter === NOTIFICATION_LIST_FILTER.ALL) {
    return true
  }
  if (filter === NOTIFICATION_LIST_FILTER.UNREAD) {
    return !notification.readAt
  }
  if (filter === NOTIFICATION_LIST_FILTER.READ) {
    return Boolean(notification.readAt)
  }
  return getNotificationCategory(notification.type) === filter
}

function matchesNotificationSearch(notification, searchInput) {
  const query = searchInput.trim().toLowerCase()
  if (!query) {
    return true
  }
  const meta = getNotificationTypeMeta(notification.type)
  return [notification.content, meta.label, notification.type]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query))
}

function computeNotificationStats(notifications = []) {
  let unread = 0
  let application = 0
  let invitation = 0
  let interview = 0
  let message = 0

  for (const notification of notifications) {
    if (!notification.readAt) {
      unread += 1
    }
    const category = getNotificationCategory(notification.type)
    if (category === NOTIFICATION_LIST_FILTER.APPLICATION) {
      application += 1
    } else if (category === NOTIFICATION_LIST_FILTER.INVITATION) {
      invitation += 1
    } else if (category === NOTIFICATION_LIST_FILTER.INTERVIEW) {
      interview += 1
    } else if (category === NOTIFICATION_LIST_FILTER.MESSAGE) {
      message += 1
    }
  }

  return {
    total: notifications.length,
    unread,
    read: notifications.length - unread,
    application,
    invitation,
    interview,
    message,
  }
}

function getNotificationDestination(notification) {
  if (!notification) {
    return null
  }

  if (
    notification.type === NOTIFICATION_TYPE.CHAT_MESSAGE_CREATED &&
    notification.applicationId
  ) {
    return `/candidate/messages?applicationId=${encodeURIComponent(notification.applicationId)}`
  }

  if (
    INVITATION_TYPES.has(notification.type) ||
    (notification.jobInvitationId && !notification.applicationId)
  ) {
    return '/candidate/invitations'
  }

  if (notification.applicationId) {
    return `/candidate/applications/${encodeURIComponent(notification.applicationId)}`
  }

  if (notification.jobInvitationId) {
    return '/candidate/invitations'
  }

  return null
}

function upsertNotification(list, nextNotification) {
  const normalized = normalizeNotification(nextNotification)
  if (!normalized) {
    return list
  }
  const withoutCurrent = list.filter((item) => item.id !== normalized.id)
  return [normalized, ...withoutCurrent].sort((left, right) => {
    const leftTime = new Date(left.createdAt || 0).getTime()
    const rightTime = new Date(right.createdAt || 0).getTime()
    return rightTime - leftTime
  })
}

export {
  NOTIFICATION_LIST_FILTER,
  NOTIFICATION_LIST_FILTER_LABEL,
  NOTIFICATION_TYPE,
  computeNotificationStats,
  formatRelativeTime,
  getNotificationDestination,
  getNotificationTypeMeta,
  matchesNotificationFilter,
  matchesNotificationSearch,
  normalizeNotification,
  upsertNotification,
}
