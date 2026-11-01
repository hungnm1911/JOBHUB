const RUNTIME_ENV = Object.freeze({
  IS_DEVELOPMENT: import.meta.env.DEV,
})

// Must stay aligned with backend/src/constants/http-header.js.
const HTTP_HEADER = Object.freeze({
  REQUEST_ID: 'X-Request-Id',
})

const API_CONFIG = Object.freeze({
  BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',
  TIMEOUT_MS: 15_000,
  // Requests whose backend handler sends email synchronously before responding.
  EMAIL_DELIVERY_TIMEOUT_MS: 60_000,
  // Cloudinary image uploads for company logo/banner.
  FILE_UPLOAD_TIMEOUT_MS: 60_000,
})

const FLASH_MESSAGE_TYPE = Object.freeze({
  SUCCESS: 'success',
  INFO: 'info',
  ERROR: 'error',
})

const FLASH_MESSAGE_CONFIG = Object.freeze({
  DURATION_MS: 8_000,
})

const API_ERROR_MESSAGE = Object.freeze({
  UNEXPECTED: 'Đã xảy ra lỗi không mong muốn.',
  CONNECTION_FAILED: 'Không thể kết nối đến máy chủ.',
  EMAIL_ALREADY_REGISTERED: 'Email này đã được đăng ký.',
  VERIFICATION_EMAIL_UNAVAILABLE:
    'Không thể gửi email xác thực. Vui lòng thử lại sau.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  EMAIL_NOT_VERIFIED:
    'Email chưa được xác thực. Vui lòng mở liên kết trong email xác thực trước khi đăng nhập.',
  ACCOUNT_ACCESS_DENIED: 'Tài khoản hiện không được phép đăng nhập.',
  PASSWORD_RESET_EMAIL_UNAVAILABLE:
    'Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.',
  BUSINESS_REGISTRATION_NUMBER_TAKEN:
    'Mã số doanh nghiệp này đã được một doanh nghiệp khác sử dụng.',
  APPROVAL_CONFIRMATION_STILL_VALID:
    'Email kích hoạt đã gửi trước đó vẫn còn hiệu lực. Vui lòng kiểm tra hộp thư của bạn.',
  APPROVAL_CONFIRMATION_NOT_AVAILABLE:
    'Hồ sơ doanh nghiệp chưa được chấp thuận hoặc không còn ở trạng thái chờ kích hoạt.',
  APPROVAL_CONFIRMATION_EMAIL_UNAVAILABLE:
    'Không thể gửi email kích hoạt. Vui lòng thử lại sau.',
  COMPANY_REGISTRATION_NOT_FOUND: 'Không tìm thấy hồ sơ doanh nghiệp này.',
  COMPANY_REGISTRATION_STATE_CHANGED:
    'Hồ sơ không còn ở trạng thái chờ duyệt hoặc tài khoản Company Manager không còn hợp lệ. Dữ liệu đã được tải lại.',
  COMPANY_APPROVAL_EMAIL_FAILED:
    'Hồ sơ đã được phê duyệt nhưng chưa gửi được email kích hoạt. Company Manager có thể tự yêu cầu gửi lại email.',
  JOB_NOT_FOUND: 'Không tìm thấy việc làm hoặc việc làm không còn được công khai.',
  COMPANY_NOT_FOUND: 'Không tìm thấy công ty hoặc công ty không còn hoạt động công khai.',
  JOB_DISCOVERY_NOT_AVAILABLE: 'Tài khoản hiện tại không sử dụng được chức năng tìm việc làm.',
  APPLICATION_ALREADY_EXISTS: 'Bạn đã ứng tuyển việc làm này.',
  JOB_NOT_ACCEPTING_APPLICATIONS: 'Việc làm này không còn nhận hồ sơ.',
})

// Must stay aligned with backend/src/constants/job-status.js.
const JOB_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  PUBLISHED: 'PUBLISHED',
  CLOSED: 'CLOSED',
  EXPIRED: 'EXPIRED',
})

// Must stay aligned with backend/src/constants/work-mode.js.
const WORK_MODE = Object.freeze({
  ONSITE: 'ONSITE',
  HYBRID: 'HYBRID',
  REMOTE: 'REMOTE',
})

// Must stay aligned with backend/src/constants/employment-type.js.
const EMPLOYMENT_TYPE = Object.freeze({
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  INTERNSHIP: 'INTERNSHIP',
  CONTRACT: 'CONTRACT',
  TEMPORARY: 'TEMPORARY',
  FREELANCE: 'FREELANCE',
  SEASONAL: 'SEASONAL',
  APPRENTICESHIP: 'APPRENTICESHIP',
})

// Must stay aligned with backend/src/constants/experience-level.js.
const EXPERIENCE_LEVEL = Object.freeze({
  NO_EXPERIENCE: 'NO_EXPERIENCE',
  UNDER_1_YEAR: 'UNDER_1_YEAR',
  ONE_TO_THREE_YEARS: 'ONE_TO_THREE_YEARS',
  THREE_TO_FIVE_YEARS: 'THREE_TO_FIVE_YEARS',
  FIVE_TO_TEN_YEARS: 'FIVE_TO_TEN_YEARS',
  OVER_TEN_YEARS: 'OVER_TEN_YEARS',
})

// Must stay aligned with backend/src/constants/salary-type.js and salary-period.js.
// V4.2 Salary amounts are always VND.
const SALARY_TYPE = Object.freeze({
  FIXED: 'FIXED',
  RANGE: 'RANGE',
  FROM: 'FROM',
  UP_TO: 'UP_TO',
  NEGOTIABLE: 'NEGOTIABLE',
})

const SALARY_PERIOD = Object.freeze({
  HOUR: 'HOUR',
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
  SHIFT: 'SHIFT',
  ETC: 'ETC',
})

// Must stay aligned with backend/src/constants/user-role.js.
const USER_ROLE = Object.freeze({
  CANDIDATE: 'CANDIDATE',
  COMPANY_STAFF: 'COMPANY_STAFF',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
})

// Must stay aligned with backend/src/constants/company-member-role.js and
// backend/src/constants/company-member-status.js.
const COMPANY_MEMBER_ROLE = Object.freeze({
  COMPANY_MANAGER: 'COMPANY_MANAGER',
  RECRUITER: 'RECRUITER',
})

const COMPANY_MEMBER_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  TERMINATED: 'TERMINATED',
})

// Must stay aligned with backend/src/constants/company-approval-status.js and
// company-operational-status.js.
const COMPANY_APPROVAL_STATUS = Object.freeze({
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
})

const COMPANY_OPERATIONAL_STATUS = Object.freeze({
  INACTIVE: 'INACTIVE',
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
})

// Must stay aligned with backend/src/middlewares/validate-company-draft-update.js.
const COMPANY_PROFILE_LIMIT = Object.freeze({
  NAME_MAX_LENGTH: 200,
  BUSINESS_REGISTRATION_NUMBER_MAX_LENGTH: 100,
  URL_MAX_LENGTH: 500,
  ADDRESS_MAX_LENGTH: 500,
  CONTACT_INFO_MAX_LENGTH: 500,
  DESCRIPTION_MAX_LENGTH: 5000,
})

// Must stay aligned with backend/src/constants/company-image-kind.js and FILE_TYPE.IMAGE.
const COMPANY_IMAGE_KIND = Object.freeze({
  LOGO: 'logo',
  BANNER: 'banner',
})

const COMPANY_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

// Must stay aligned with backend/src/constants/user-status.js.
// Must stay aligned with backend/src/constants/candidate-cv-status.js.
const CANDIDATE_CV_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
})

// Must stay aligned with backend/src/constants/candidate-cv-source-type.js.
const CANDIDATE_CV_SOURCE_TYPE = Object.freeze({
  GENERATED: 'GENERATED',
  UPLOADED: 'UPLOADED',
})

const USER_STATUS = Object.freeze({
  PENDING_ACTIVATION: 'PENDING_ACTIVATION',
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  TERMINATED: 'TERMINATED',
})

// Must stay aligned with the V1 password policy and
// backend/src/middlewares/validate-candidate-registration.js.
const ACCOUNT_FIELD_LIMIT = Object.freeze({
  FULL_NAME_MAX_LENGTH: 100,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 64,
})

const AUTH_STORAGE_KEY = 'jobhub.authentication'

const SOCKET_CONFIG = Object.freeze({
  URL: import.meta.env.VITE_SOCKET_URL || window.location.origin,
})

// Must stay aligned with backend/src/constants/realtime-event.js.
const REALTIME_EVENT = Object.freeze({
  NOTIFICATION: 'notification',
  MESSAGE: 'message',
  CONVERSATION_STATE: 'conversationState',
})

const VALIDATION_MESSAGE = Object.freeze({
  REQUIRED: 'Trường này là bắt buộc.',
  INVALID_EMAIL: 'Email không hợp lệ.',
  FULL_NAME_TOO_LONG: `Họ và tên không được vượt quá ${ACCOUNT_FIELD_LIMIT.FULL_NAME_MAX_LENGTH} ký tự.`,
  PASSWORD_LENGTH: `Mật khẩu phải từ ${ACCOUNT_FIELD_LIMIT.PASSWORD_MIN_LENGTH} đến ${ACCOUNT_FIELD_LIMIT.PASSWORD_MAX_LENGTH} ký tự.`,
  PASSWORD_MISMATCH: 'Mật khẩu xác nhận không khớp.',
  MAX_LENGTH: (maxLength) => `Không được vượt quá ${maxLength} ký tự.`,
})

const TOASTER_CONFIG = Object.freeze({
  position: 'top-right',
  theme: 'light',
  richColors: true,
  closeButton: true,
  duration: 4_000,
  visibleToasts: 3,
  offset: 24,
  mobileOffset: 16,
  containerAriaLabel: 'Phản hồi thao tác',
  toastOptions: Object.freeze({
    closeButtonAriaLabel: 'Đóng',
  }),
  style: Object.freeze({
    fontFamily: 'inherit',
    '--normal-bg': 'var(--popover)',
    '--normal-text': 'var(--popover-foreground)',
    '--normal-border': 'var(--border)',
    '--border-radius': 'var(--radius)',
  }),
})

export {
  ACCOUNT_FIELD_LIMIT,
  CANDIDATE_CV_SOURCE_TYPE,
  CANDIDATE_CV_STATUS,
  API_CONFIG,
  API_ERROR_MESSAGE,
  AUTH_STORAGE_KEY,
  COMPANY_APPROVAL_STATUS,
  COMPANY_IMAGE_ACCEPT,
  COMPANY_IMAGE_KIND,
  COMPANY_OPERATIONAL_STATUS,
  COMPANY_MEMBER_ROLE,
  COMPANY_MEMBER_STATUS,
  COMPANY_PROFILE_LIMIT,
  EMPLOYMENT_TYPE,
  EXPERIENCE_LEVEL,
  FLASH_MESSAGE_CONFIG,
  FLASH_MESSAGE_TYPE,
  HTTP_HEADER,
  JOB_STATUS,
  REALTIME_EVENT,
  RUNTIME_ENV,
  SALARY_PERIOD,
  SALARY_TYPE,
  SOCKET_CONFIG,
  TOASTER_CONFIG,
  USER_ROLE,
  USER_STATUS,
  VALIDATION_MESSAGE,
  WORK_MODE,
}
