import {
  NOTIFICATION_TYPE,
  getNotificationTypeMeta,
} from '@/features/candidate-notifications/utils'

const NOTIFICATION_PAGE_SIZE = 20
const NOTIFICATION_SEARCH_MAX_LENGTH = 200

const READ_STATE = Object.freeze({
  UNREAD: 'UNREAD',
  READ: 'READ',
})

const READ_STATE_OPTIONS = Object.freeze([
  { value: '', label: 'Tất cả' },
  { value: READ_STATE.UNREAD, label: 'Chưa đọc' },
  { value: READ_STATE.READ, label: 'Đã đọc' },
])

const NOTIFICATION_SORT = Object.freeze({
  NEWEST: '-createdAt',
  OLDEST: 'createdAt',
})

const NOTIFICATION_SORT_OPTIONS = Object.freeze([
  { value: NOTIFICATION_SORT.NEWEST, label: 'Mới nhất' },
  { value: NOTIFICATION_SORT.OLDEST, label: 'Cũ nhất' },
])

// V13 F02–F07 and V15: the types whose recipient can be a Recruiter.
const RECRUITER_NOTIFICATION_TYPES = Object.freeze([
  NOTIFICATION_TYPE.DIRECT_APPLICATION_CREATED,
  NOTIFICATION_TYPE.APPLICATION_ASSIGNED,
  NOTIFICATION_TYPE.APPLICATION_REASSIGNED,
  NOTIFICATION_TYPE.APPLICATION_UNASSIGNED,
  NOTIFICATION_TYPE.APPLICATION_WITHDRAWN,
  NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED,
  NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_SUBMITTED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CREATED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CHANGED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CONFIRMED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_DECLINED,
  NOTIFICATION_TYPE.CHAT_MESSAGE_CREATED,
  NOTIFICATION_TYPE.JOB_INVITATION_ACCEPTED,
  NOTIFICATION_TYPE.JOB_INVITATION_REJECTED,
  NOTIFICATION_TYPE.JOB_INVITATION_INVALIDATED,
  NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED,
])

const TYPE_OPTIONS = Object.freeze([
  { value: '', label: 'Mọi loại thông báo' },
  ...RECRUITER_NOTIFICATION_TYPES.map((type) => ({
    value: type,
    label: getNotificationTypeMeta(type).label,
  })),
])

function readNotificationSearch(searchParams) {
  const pageParam = searchParams.get('page') ?? ''
  const readState = searchParams.get('read')
  const type = searchParams.get('type')
  const sort = searchParams.get('sort')

  return {
    keyword: (searchParams.get('q') ?? '').slice(0, NOTIFICATION_SEARCH_MAX_LENGTH),
    readState: Object.values(READ_STATE).includes(readState) ? readState : '',
    type: RECRUITER_NOTIFICATION_TYPES.includes(type) ? type : '',
    sort: Object.values(NOTIFICATION_SORT).includes(sort) ? sort : NOTIFICATION_SORT.NEWEST,
    page: /^[1-9]\d{0,5}$/.test(pageParam) ? Number(pageParam) : 1,
  }
}

function toNotificationSearchParams(search) {
  const params = new URLSearchParams()
  if (search.keyword) {
    params.set('q', search.keyword)
  }
  if (search.readState) {
    params.set('read', search.readState)
  }
  if (search.type) {
    params.set('type', search.type)
  }
  if (search.sort !== NOTIFICATION_SORT.NEWEST) {
    params.set('sort', search.sort)
  }
  if (search.page > 1) {
    params.set('page', String(search.page))
  }
  return params
}

// Types that open the Assignee view of an Application. Other types either target a
// Job-scoped screen (the payload has no jobId) or an Application the actor no longer holds.
const ASSIGNEE_APPLICATION_TYPES = new Set([
  NOTIFICATION_TYPE.APPLICATION_ASSIGNED,
  NOTIFICATION_TYPE.APPLICATION_REASSIGNED,
  NOTIFICATION_TYPE.APPLICATION_WITHDRAWN,
  NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED,
  NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_SUBMITTED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CREATED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CHANGED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_CONFIRMED,
  NOTIFICATION_TYPE.INTERVIEW_SCHEDULE_DECLINED,
  NOTIFICATION_TYPE.INVITED_APPLICATION_CREATED,
])

function getRecruiterNotificationDestination(notification) {
  if (!notification?.applicationId) return null
  const id = encodeURIComponent(notification.applicationId)
  if (notification.type === NOTIFICATION_TYPE.CHAT_MESSAGE_CREATED) {
    return `/recruiter/messages?application=${id}`
  }
  return ASSIGNEE_APPLICATION_TYPES.has(notification.type)
    ? `/recruiter/my-applications/${id}`
    : null
}

export {
  getRecruiterNotificationDestination,
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_SEARCH_MAX_LENGTH,
  NOTIFICATION_SORT_OPTIONS,
  READ_STATE_OPTIONS,
  TYPE_OPTIONS,
  readNotificationSearch,
  toNotificationSearchParams,
}
