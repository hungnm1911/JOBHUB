import { DAY_PART_LABEL, formatDateTime } from '@/features/candidate-applications/utils'
import {
  APPLICATION_SOURCE,
  APPLICATION_STATUS,
  JOB_INVITATION_STATUS,
  JOB_STATUS,
  SALARY_PERIOD,
  SALARY_TYPE,
} from '@/utils/constant'

// Must stay aligned with backend/src/constants/job-list-scope.js.
const JOB_LIST_SCOPE = Object.freeze({
  MY_TEAM: 'MY_TEAM',
  MY_PRIMARY: 'MY_PRIMARY',
  MY_SUPPORTING: 'MY_SUPPORTING',
  COMPANY_PUBLISHED: 'COMPANY_PUBLISHED',
})

const JOB_STATUS_LABEL = Object.freeze({
  [JOB_STATUS.DRAFT]: 'Bản nháp',
  [JOB_STATUS.PENDING_APPROVAL]: 'Chờ duyệt',
  [JOB_STATUS.PUBLISHED]: 'Đang tuyển',
  [JOB_STATUS.CLOSED]: 'Đã đóng',
  [JOB_STATUS.EXPIRED]: 'Hết hạn',
})

const JOB_ROLE = Object.freeze({
  PRIMARY: 'PRIMARY',
  SUPPORTING: 'SUPPORTING',
  NONE: 'NONE',
})

const JOB_ROLE_LABEL = Object.freeze({
  [JOB_ROLE.PRIMARY]: 'Phụ trách chính',
  [JOB_ROLE.SUPPORTING]: 'Hỗ trợ',
})

const SALARY_TYPE_OPTIONS = Object.freeze([
  { value: SALARY_TYPE.NEGOTIABLE, label: 'Thỏa thuận' },
  { value: SALARY_TYPE.RANGE, label: 'Khoảng lương' },
  { value: SALARY_TYPE.FIXED, label: 'Cố định' },
  { value: SALARY_TYPE.FROM, label: 'Từ mức' },
  { value: SALARY_TYPE.UP_TO, label: 'Đến mức' },
])

const SALARY_PERIOD_OPTIONS = Object.freeze([
  { value: SALARY_PERIOD.MONTH, label: 'Tháng' },
  { value: SALARY_PERIOD.WEEK, label: 'Tuần' },
  { value: SALARY_PERIOD.DAY, label: 'Ngày' },
  { value: SALARY_PERIOD.SHIFT, label: 'Ca' },
  { value: SALARY_PERIOD.HOUR, label: 'Giờ' },
  { value: SALARY_PERIOD.ETC, label: 'Khác' },
])

const PIPELINE_STATUSES = Object.freeze(Object.values(APPLICATION_STATUS))

const TERMINAL_STATUSES = Object.freeze([
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
])

// V10 F05: one step forward only. CONTACTED advances through an interview proposal.
const NEXT_STATUS = Object.freeze({
  [APPLICATION_STATUS.APPLIED]: APPLICATION_STATUS.SCREENING,
  [APPLICATION_STATUS.SCREENING]: APPLICATION_STATUS.CONTACTED,
  [APPLICATION_STATUS.INTERVIEW_SCHEDULED]: APPLICATION_STATUS.INTERVIEW_COMPLETED,
  [APPLICATION_STATUS.INTERVIEW_COMPLETED]: APPLICATION_STATUS.HIRED,
})

const SOURCE_OPTIONS = Object.freeze([
  { value: '', label: 'Mọi nguồn' },
  { value: APPLICATION_SOURCE.DIRECT_APPLICATION, label: 'Nộp trực tiếp' },
  { value: APPLICATION_SOURCE.RECRUITER_INVITATION, label: 'Lời mời' },
])

const INVITATION_INVALIDATION_LABEL = Object.freeze({
  CANDIDATE_NOT_ACTIVE: 'Tài khoản ứng viên không còn hoạt động',
  CANDIDATE_EMAIL_UNVERIFIED: 'Email ứng viên chưa xác thực',
  INVITED_CV_ARCHIVED: 'CV được mời đã bị lưu trữ',
  COMPANY_NOT_OPERATIONAL: 'Công ty không còn hoạt động',
  SENDER_NOT_ACTIVE: 'Người gửi không còn hoạt động',
  SENDER_COMPANY_MEMBERSHIP_INVALID: 'Người gửi không còn thuộc công ty hợp lệ',
  SENDER_REMOVED_FROM_JOB_TEAM: 'Người gửi đã bị gỡ khỏi đội tuyển dụng',
})

const INVITATION_STATUS_OPTIONS = Object.freeze(Object.values(JOB_INVITATION_STATUS))

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function formatDay(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date)
}

// Availability and schedule dates are calendar strings (YYYY-MM-DD), not instants.
function formatCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

function slotLabel(slot) {
  return `${formatCalendarDate(slot.date)} · ${DAY_PART_LABEL[slot.dayPart] ?? slot.dayPart}`
}

// V5 F10: a PUBLISHED Job whose deadline has passed is effectively EXPIRED.
function getEffectiveJobStatus(job, now = Date.now()) {
  if (
    job?.status === JOB_STATUS.PUBLISHED &&
    job.applicationDeadline &&
    new Date(job.applicationDeadline).getTime() <= now
  ) {
    return JOB_STATUS.EXPIRED
  }
  return job?.status ?? null
}

const SUBMIT_FIELD_LABEL = Object.freeze({
  title: 'tiêu đề vị trí',
  jobDescription: 'mô tả công việc',
  salary: 'mức lương',
  requiredSkills: 'kỹ năng yêu cầu',
  fieldCategoryIds: 'lĩnh vực',
  positionCategoryIds: 'vị trí chuyên môn',
  location: 'địa điểm làm việc',
  employmentType: 'loại hình công việc',
  workModes: 'hình thức làm việc',
  experienceLevelId: 'cấp bậc kinh nghiệm',
  applicationDeadline: 'hạn nhận hồ sơ',
})

// Backend messages are English; map the business outcomes a recruiter can act on.
function toRecruiterErrorMessage(error, fallback = 'Không thực hiện được thao tác. Vui lòng thử lại.') {
  const message = String(error?.message ?? '')
  const field = error?.details?.field

  if (/required before submit/i.test(message) && SUBMIT_FIELD_LABEL[field]) {
    return `Cần bổ sung ${SUBMIT_FIELD_LABEL[field]} trước khi gửi duyệt.`
  }
  if (field === 'applicationDeadline') {
    return 'Hạn nhận hồ sơ không hợp lệ hoặc đã qua. Vui lòng chọn ngày trong tương lai.'
  }
  if (error?.status === 404) return 'Không tìm thấy dữ liệu. Có thể đã bị xóa.'
  if (error?.status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (error?.status === 409) return 'Dữ liệu đã thay đổi hoặc thao tác không còn hợp lệ. Đã tải lại.'
  // Without an HTTP status the client already produced a Vietnamese connection message.
  return error?.status ? fallback : message || fallback
}

export {
  INVITATION_INVALIDATION_LABEL,
  INVITATION_STATUS_OPTIONS,
  JOB_LIST_SCOPE,
  JOB_ROLE,
  JOB_ROLE_LABEL,
  JOB_STATUS_LABEL,
  NEXT_STATUS,
  PIPELINE_STATUSES,
  SALARY_PERIOD_OPTIONS,
  SALARY_TYPE_OPTIONS,
  SOURCE_OPTIONS,
  TERMINAL_STATUSES,
  formatCalendarDate,
  formatDay,
  formatDateTime as formatMoment,
  getEffectiveJobStatus,
  slotLabel,
  toRecruiterErrorMessage,
}
