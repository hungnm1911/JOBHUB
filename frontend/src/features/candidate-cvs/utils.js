import {
  CANDIDATE_CV_SOURCE_TYPE,
  CANDIDATE_CV_STATUS,
  CANDIDATE_CV_UPLOADED_PDF,
  CANDIDATE_CV_VISIBILITY,
} from '@/utils/constant'

const CV_SOURCE_LABEL = Object.freeze({
  [CANDIDATE_CV_SOURCE_TYPE.GENERATED]: 'Tạo trên JOBHUB',
  [CANDIDATE_CV_SOURCE_TYPE.UPLOADED]: 'Tải lên PDF',
})

const CV_STATUS_LABEL = Object.freeze({
  [CANDIDATE_CV_STATUS.DRAFT]: 'Bản nháp',
  [CANDIDATE_CV_STATUS.ACTIVE]: 'Đang dùng',
})

const CV_VISIBILITY_LABEL = Object.freeze({
  [CANDIDATE_CV_VISIBILITY.PRIVATE]: 'Riêng tư',
  [CANDIDATE_CV_VISIBILITY.PUBLIC]: 'Công khai',
})

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatCvDateTime(value) {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : dateTimeFormatter.format(date)
}

function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return null
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function canDownloadCv(cv) {
  if (!cv) {
    return false
  }
  if (cv.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
    return true
  }
  return (
    cv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED &&
    cv.status === CANDIDATE_CV_STATUS.ACTIVE
  )
}

function canSetDefaultCv(cv) {
  return cv?.status === CANDIDATE_CV_STATUS.ACTIVE && !cv.isDefault
}

function canActivateCv(cv) {
  return (
    cv?.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED &&
    cv?.status === CANDIDATE_CV_STATUS.DRAFT
  )
}

function canReplaceUploadedFile(cv) {
  return cv?.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED
}

function validateUploadedPdfFile(file) {
  if (!file) {
    return 'Vui lòng chọn file PDF.'
  }
  const isPdf =
    file.type === CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE ||
    file.name?.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    return 'Chỉ chấp nhận file PDF.'
  }
  if (file.size <= 0) {
    return 'File PDF trống hoặc không đọc được.'
  }
  if (file.size > CANDIDATE_CV_UPLOADED_PDF.MAX_SIZE_BYTES) {
    return `File PDF không được vượt quá ${CANDIDATE_CV_UPLOADED_PDF.MAX_SIZE_MB} MB.`
  }
  return null
}

const PDF_SIGNATURE = Object.freeze([0x25, 0x50, 0x44, 0x46]) // %PDF
const PDF_HEADER_SCAN_LIMIT = 1024

function findPdfSignatureOffset(bytes) {
  const limit = Math.min(bytes.length, PDF_HEADER_SCAN_LIMIT) - PDF_SIGNATURE.length
  for (let index = 0; index <= limit; index += 1) {
    if (
      bytes[index] === PDF_SIGNATURE[0] &&
      bytes[index + 1] === PDF_SIGNATURE[1] &&
      bytes[index + 2] === PDF_SIGNATURE[2] &&
      bytes[index + 3] === PDF_SIGNATURE[3]
    ) {
      return index
    }
  }
  return -1
}

/**
 * Normalize uploaded PDF bytes for Backend inspection.
 * Many real PDFs start with BOM/whitespace before `%PDF`; Backend file-type
 * detection expects a usable PDF buffer, so we strip a short leading prefix.
 */
async function prepareUploadedPdfFile(file) {
  const basicError = validateUploadedPdfFile(file)
  if (basicError) {
    return { error: basicError, file: null }
  }

  try {
    const fileName = file.name?.toLowerCase().endsWith('.pdf')
      ? file.name
      : `${file.name || 'candidate-cv'}.pdf`
    const fullBytes = new Uint8Array(await file.arrayBuffer())
    const offset = findPdfSignatureOffset(fullBytes)

    if (offset < 0) {
      // Do not hard-block on client magic check alone; Backend is authoritative.
      // Still send a typed PDF File so multer/file-type can decide.
      return {
        error: null,
        file: new File([fullBytes], fileName, {
          type: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
          lastModified: file.lastModified,
        }),
      }
    }

    const pdfBytes = offset === 0 ? fullBytes : fullBytes.subarray(offset)
    return {
      error: null,
      file: new File([pdfBytes], fileName, {
        type: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        lastModified: file.lastModified,
      }),
    }
  } catch {
    return { error: 'Không đọc được nội dung file PDF.', file: null }
  }
}

function toUploadedCvErrorMessage(error) {
  const message = error?.message || ''
  const normalized = message.toLowerCase()

  if (normalized.includes('valid pdf')) {
    return 'Backend không nhận file này là PDF hợp lệ. Hãy dùng PDF chuẩn, không mã hóa, không đổi đuôi từ Word/ảnh.'
  }
  if (normalized.includes('password-protected') || normalized.includes('password')) {
    return 'PDF đang được bảo vệ bằng mật khẩu. Hãy bỏ mật khẩu rồi tải lên lại.'
  }
  if (normalized.includes('10 mb') || normalized.includes('exceed')) {
    if (normalized.includes('page')) {
      return `PDF không được vượt quá ${CANDIDATE_CV_UPLOADED_PDF.MAX_PAGE_COUNT} trang.`
    }
    return `PDF không được vượt quá ${CANDIDATE_CV_UPLOADED_PDF.MAX_SIZE_MB} MB.`
  }
  if (normalized.includes('required')) {
    return 'Vui lòng chọn file PDF để tải lên.'
  }

  return message || 'Không tải lên được CV.'
}

function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName || 'candidate-cv.pdf'
  anchor.click()
  URL.revokeObjectURL(url)
}

function fileNameFromContentDisposition(disposition, fallback) {
  const matched = disposition?.match(/filename="?([^"]+)"?/i)
  return matched?.[1] || fallback
}

function sortCvsForDisplay(cvs) {
  return [...cvs].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1
    }
    const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0
    const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0
    return rightTime - leftTime
  })
}

const CV_LIST_FILTER = Object.freeze({
  ALL: 'all',
  ACTIVE: 'active',
  DRAFT: 'draft',
  UPLOADED: 'uploaded',
  GENERATED: 'generated',
})

const CV_LIST_FILTER_LABEL = Object.freeze({
  [CV_LIST_FILTER.ALL]: 'Tất cả',
  [CV_LIST_FILTER.ACTIVE]: 'Đang dùng',
  [CV_LIST_FILTER.DRAFT]: 'Bản nháp',
  [CV_LIST_FILTER.UPLOADED]: 'PDF tải lên',
  [CV_LIST_FILTER.GENERATED]: 'Tạo trên JOBHUB',
})

function matchesCvFilter(cv, filter) {
  if (filter === CV_LIST_FILTER.ACTIVE) {
    return cv?.status === CANDIDATE_CV_STATUS.ACTIVE
  }
  if (filter === CV_LIST_FILTER.DRAFT) {
    return cv?.status === CANDIDATE_CV_STATUS.DRAFT
  }
  if (filter === CV_LIST_FILTER.UPLOADED) {
    return cv?.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED
  }
  if (filter === CV_LIST_FILTER.GENERATED) {
    return cv?.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED
  }
  return true
}

function matchesCvSearch(cv, query) {
  const normalized = query?.trim().toLowerCase()
  if (!normalized) {
    return true
  }
  return (cv?.name ?? '').toLowerCase().includes(normalized)
}

function computeCvLibraryStats(cvs = []) {
  return {
    total: cvs.length,
    active: cvs.filter((cv) => cv.status === CANDIDATE_CV_STATUS.ACTIVE).length,
    draft: cvs.filter((cv) => cv.status === CANDIDATE_CV_STATUS.DRAFT).length,
    defaultCv: cvs.find((cv) => cv.isDefault) ?? null,
  }
}

export {
  CV_LIST_FILTER,
  CV_LIST_FILTER_LABEL,
  CV_SOURCE_LABEL,
  CV_STATUS_LABEL,
  CV_VISIBILITY_LABEL,
  canActivateCv,
  canDownloadCv,
  canReplaceUploadedFile,
  canSetDefaultCv,
  computeCvLibraryStats,
  fileNameFromContentDisposition,
  formatCvDateTime,
  formatFileSize,
  matchesCvFilter,
  matchesCvSearch,
  prepareUploadedPdfFile,
  sortCvsForDisplay,
  toUploadedCvErrorMessage,
  triggerBlobDownload,
  validateUploadedPdfFile,
}
