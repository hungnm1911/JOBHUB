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

async function readAxiosErrorBody(data) {
  if (data == null) {
    return null
  }

  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return { message: data }
    }
  }

  // blob/arraybuffer responseType keeps JSON error payloads as binary until parsed.
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      return JSON.parse(await data.text())
    } catch {
      return null
    }
  }

  if (data instanceof ArrayBuffer) {
    try {
      return JSON.parse(new TextDecoder().decode(data))
    } catch {
      return null
    }
  }

  if (typeof data === 'object') {
    return data
  }

  return null
}

function buildApiErrorFromBody(error, responseBody) {
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

export function normalizeApiError(error) {
  if (error instanceof ApiError) {
    return error
  }

  if (!axios.isAxiosError(error)) {
    return new ApiError(API_ERROR_MESSAGE.UNEXPECTED, { cause: error })
  }

  const responseBody = error.response?.data
  const isBinaryBody =
    (typeof Blob !== 'undefined' && responseBody instanceof Blob) ||
    responseBody instanceof ArrayBuffer

  if (isBinaryBody) {
    return new ApiError(
      error.response?.status
        ? `Request failed with status code ${error.response.status}`
        : error.message || API_ERROR_MESSAGE.CONNECTION_FAILED,
      {
        status: error.response?.status ?? null,
        code: error.code ?? null,
        details: null,
        requestId: error.response?.headers?.get?.(HTTP_HEADER.REQUEST_ID) ?? null,
        cause: error,
      },
    )
  }

  return buildApiErrorFromBody(error, responseBody)
}

export async function normalizeApiErrorAsync(error) {
  if (error instanceof ApiError) {
    return error
  }

  if (!axios.isAxiosError(error)) {
    return new ApiError(API_ERROR_MESSAGE.UNEXPECTED, { cause: error })
  }

  const responseBody = await readAxiosErrorBody(error.response?.data)
  return buildApiErrorFromBody(error, responseBody)
}
