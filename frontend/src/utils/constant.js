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
})

// Must stay aligned with backend/src/constants/user-status.js.
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
  API_CONFIG,
  API_ERROR_MESSAGE,
  AUTH_STORAGE_KEY,
  FLASH_MESSAGE_CONFIG,
  FLASH_MESSAGE_TYPE,
  HTTP_HEADER,
  REALTIME_EVENT,
  RUNTIME_ENV,
  SOCKET_CONFIG,
  TOASTER_CONFIG,
  USER_STATUS,
  VALIDATION_MESSAGE,
}
