import axios from 'axios'

export class ApiError extends Error {
  constructor(message, { status = null, code = null, details = null, cause } = {}) {
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function normalizeApiError(error) {
  if (error instanceof ApiError) {
    return error
  }

  if (!axios.isAxiosError(error)) {
    return new ApiError('Đã xảy ra lỗi không mong muốn.', { cause: error })
  }

  const responseBody = error.response?.data
  const message =
    responseBody?.message || error.message || 'Không thể kết nối đến máy chủ.'

  return new ApiError(message, {
    status: error.response?.status ?? null,
    code: responseBody?.code ?? error.code ?? null,
    details: responseBody?.details ?? responseBody?.errors ?? null,
    cause: error,
  })
}
