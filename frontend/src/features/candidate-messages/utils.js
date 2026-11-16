import { APPLICATION_STATUS_LABEL, formatDate } from '@/features/candidate-dashboard/utils'
import { formatDateTime } from '@/features/candidate-applications/utils'

const CONVERSATION_MODE = Object.freeze({
  ACTIVE: 'ACTIVE',
  PAUSED_UNASSIGNED: 'PAUSED_UNASSIGNED',
  FROZEN_COMPANY: 'FROZEN_COMPANY',
  ELIGIBILITY_LOSS_WINDOW: 'ELIGIBILITY_LOSS_WINDOW',
  READ_ONLY: 'READ_ONLY',
  NOT_CREATED: 'NOT_CREATED',
})

const CONVERSATION_MODE_LABEL = Object.freeze({
  [CONVERSATION_MODE.ACTIVE]: 'Có thể nhắn tin',
  [CONVERSATION_MODE.PAUSED_UNASSIGNED]: 'Đang chờ gán recruiter',
  [CONVERSATION_MODE.FROZEN_COMPANY]: 'Tạm khóa do doanh nghiệp',
  [CONVERSATION_MODE.ELIGIBILITY_LOSS_WINDOW]: 'Tạm khóa trao đổi',
  [CONVERSATION_MODE.READ_ONLY]: 'Chỉ xem',
  [CONVERSATION_MODE.NOT_CREATED]: 'Chưa mở hội thoại',
})

const MESSAGE_LIST_FILTER = Object.freeze({
  ALL: 'all',
  OPEN: 'open',
  READ_ONLY: 'read_only',
})

const MESSAGE_LIST_FILTER_LABEL = Object.freeze({
  [MESSAGE_LIST_FILTER.ALL]: 'Tất cả',
  [MESSAGE_LIST_FILTER.OPEN]: 'Có hội thoại',
  [MESSAGE_LIST_FILTER.READ_ONLY]: 'Chỉ xem / tạm khóa',
})

const relativeListTimeFormatter = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' })
const shortTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
})
const shortDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: 'numeric',
  month: 'short',
})

function getTimestamp(value) {
  if (!value) {
    return null
  }
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

function formatConversationListTime(value, now = Date.now()) {
  const time = getTimestamp(value)
  if (time == null) {
    return null
  }

  const diffMs = time - now
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
  if (Math.abs(diffDays) < 1) {
    return shortTimeFormatter.format(new Date(time))
  }
  if (Math.abs(diffDays) < 7) {
    return relativeListTimeFormatter.format(diffDays, 'day')
  }
  return shortDateFormatter.format(new Date(time))
}

function resolveMessageSide(message, currentUserId) {
  if (message?.type === 'SYSTEM') {
    return 'system'
  }
  if (message?.senderUserId && currentUserId && message.senderUserId === currentUserId) {
    return 'own'
  }
  return 'other'
}

function isConversationMissingError(error) {
  return (
    error?.status === 404 &&
    typeof error?.message === 'string' &&
    /conversation not found/i.test(error.message)
  )
}

function appendUniqueMessage(messages, nextMessage) {
  if (!nextMessage?.id) {
    return messages
  }
  if (messages.some((item) => item.id === nextMessage.id)) {
    return messages
  }
  return [...messages, nextMessage]
}

function getLastNormalOrAnyMessage(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null
  }
  return messages[messages.length - 1] ?? null
}

function buildThreadFromApplication(application, conversationPayload = null, error = null) {
  const messages = conversationPayload?.messages ?? []
  const lastMessage = getLastNormalOrAnyMessage(messages)
  const authority = conversationPayload?.authority ?? null
  const conversation = conversationPayload?.conversation ?? null
  const missing = Boolean(error && isConversationMissingError(error))
  const mode = conversation?.mode ?? (missing ? CONVERSATION_MODE.NOT_CREATED : null)

  return {
    applicationId: application.id,
    application,
    conversation,
    messages,
    authority,
    mode,
    missing,
    loadError: missing ? null : error,
    lastMessage,
    lastActivityAt:
      lastMessage?.createdAt ??
      conversation?.createdAt ??
      application.appliedAt ??
      application.updatedAt ??
      null,
    canSend: authority?.canSendNormal === true,
    canRead: authority?.canRead === true || Boolean(conversation),
    hasConversation: Boolean(conversation) && !missing,
  }
}

function matchesThreadSearch(thread, query) {
  const normalized = query?.trim().toLowerCase()
  if (!normalized) {
    return true
  }
  const application = thread.application
  const haystack = [
    application?.job?.title,
    application?.company?.name,
    application?.assignedRecruiter?.fullName,
    application?.assignedRecruiter?.jobTitle,
    thread.lastMessage?.content,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(normalized)
}

function matchesThreadFilter(thread, filter) {
  if (filter === MESSAGE_LIST_FILTER.OPEN) {
    return thread.hasConversation
  }
  if (filter === MESSAGE_LIST_FILTER.READ_ONLY) {
    return (
      thread.hasConversation &&
      thread.authority?.canSendNormal !== true &&
      thread.mode !== CONVERSATION_MODE.NOT_CREATED
    )
  }
  return true
}

function sortThreadsByActivity(threads = []) {
  return [...threads].sort((left, right) => {
    const leftTime = getTimestamp(left.lastActivityAt) ?? 0
    const rightTime = getTimestamp(right.lastActivityAt) ?? 0
    if (leftTime !== rightTime) {
      return rightTime - leftTime
    }
    return String(right.applicationId).localeCompare(String(left.applicationId))
  })
}

function startOfDay(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function formatMessageDayLabel(value, now = Date.now()) {
  const day = startOfDay(value)
  if (day == null) {
    return null
  }
  const today = startOfDay(now)
  const yesterday = today - 24 * 60 * 60 * 1000
  if (day === today) {
    return 'Hôm nay'
  }
  if (day === yesterday) {
    return 'Hôm qua'
  }
  return formatDate(value)
}

function buildMessageTimeline(messages = [], currentUserId) {
  const items = []
  let previousSide = null
  let previousDay = null

  for (const message of messages) {
    const day = startOfDay(message.createdAt)
    if (day != null && day !== previousDay) {
      items.push({
        kind: 'separator',
        id: `day-${day}`,
        label: formatMessageDayLabel(message.createdAt),
      })
      previousDay = day
      previousSide = null
    }

    const side = resolveMessageSide(message, currentUserId)
    const groupedWithPrevious = previousSide != null && previousSide === side && side !== 'system'
    items.push({
      kind: 'message',
      id: message.id,
      message,
      side,
      showSenderMeta: side === 'other' && !groupedWithPrevious,
      showAvatar: side === 'other' && !groupedWithPrevious,
      tightTop: groupedWithPrevious,
    })
    previousSide = side
  }

  return items
}

export {
  CONVERSATION_MODE,
  CONVERSATION_MODE_LABEL,
  MESSAGE_LIST_FILTER,
  MESSAGE_LIST_FILTER_LABEL,
  APPLICATION_STATUS_LABEL,
  appendUniqueMessage,
  buildMessageTimeline,
  buildThreadFromApplication,
  formatConversationListTime,
  formatDate,
  formatDateTime,
  formatMessageDayLabel,
  isConversationMissingError,
  matchesThreadFilter,
  matchesThreadSearch,
  resolveMessageSide,
  sortThreadsByActivity,
}
