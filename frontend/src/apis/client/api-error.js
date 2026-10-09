import axios from 'axios'

import { API_ERROR_MESSAGE, HTTP_HEADER } from '@/utils/constant'

export class ApiError extends Error {
  constructor(
    message,
    { status = null, code = null, details = null, requestId = null, cause } = {},
  ) {
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }
}

export function normalizeApiError(error) {
  if (error instanceof ApiError) {
    return error
  }

  if (!axios.isAxiosError(error)) {
    return new ApiError(API_ERROR_MESSAGE.UNEXPECTED, { cause: error })
  }

  const responseBody = error.response?.data
  const errorBody = responseBody?.error ?? responseBody
  const message =
    errorBody?.message || error.message || API_ERROR_MESSAGE.CONNECTION_FAILED

  return new ApiError(message, {
    status: error.response?.status ?? null,
    code: errorBody?.code ?? error.code ?? null,
    details: errorBody?.details ?? errorBody?.errors ?? null,
    requestId: error.response?.headers?.get?.(HTTP_HEADER.REQUEST_ID) ?? null,
    cause: error,
  })
}
