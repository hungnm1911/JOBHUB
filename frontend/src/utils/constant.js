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
})

const API_ERROR_MESSAGE = Object.freeze({
  UNEXPECTED: 'Đã xảy ra lỗi không mong muốn.',
  CONNECTION_FAILED: 'Không thể kết nối đến máy chủ.',
})

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
  API_CONFIG,
  API_ERROR_MESSAGE,
  HTTP_HEADER,
  REALTIME_EVENT,
  RUNTIME_ENV,
  SOCKET_CONFIG,
  TOASTER_CONFIG,
  VALIDATION_MESSAGE,
}
