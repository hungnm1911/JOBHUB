import { API_ERROR_MESSAGE } from '@/utils/constant'

const FIELD_REVIEW_LABEL = Object.freeze({
  skills: 'Kỹ năng',
  category: 'Lĩnh vực',
  experience: 'Kinh nghiệm',
  employmentType: 'Hình thức làm việc',
  workMode: 'Hình thức công việc',
})

const CV_SECTION_LABEL = Object.freeze({
  professionalSummary: 'Tóm tắt nghề nghiệp',
  workExperiences: 'Kinh nghiệm làm việc',
  projects: 'Dự án',
  education: 'Học vấn',
  certifications: 'Chứng chỉ',
  skills: 'Kỹ năng',
})

function formatMatchScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return '—'
  }
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function scoreTone(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return 'muted'
  }
  if (score >= 75) {
    return 'high'
  }
  if (score >= 50) {
    return 'mid'
  }
  return 'low'
}

function fieldReviewLabel(criterion) {
  return FIELD_REVIEW_LABEL[criterion] ?? criterion
}

function cvSectionLabel(section) {
  return CV_SECTION_LABEL[section] ?? section
}

function normalizeEvaluationResult(payload) {
  if (!payload) {
    return null
  }

  return {
    jobId: payload.jobId ? String(payload.jobId) : null,
    candidateCvId: payload.candidateCvId ? String(payload.candidateCvId) : null,
    matchScore: typeof payload.matchScore === 'number' ? payload.matchScore : null,
    overallSummary: payload.overallSummary ?? '',
    fieldReviews: Array.isArray(payload.fieldReviews) ? payload.fieldReviews : [],
    cvImprovements: Array.isArray(payload.cvImprovements) ? payload.cvImprovements : [],
  }
}

function toCvEvaluationErrorMessage(error) {
  if (
    error?.details?.reason === 'INVALID_CV_EVALUATION' ||
    error?.status === 502 ||
    error?.message === 'Internal server error' ||
    /CV evaluation is temporarily unavailable/i.test(error?.message ?? '')
  ) {
    return API_ERROR_MESSAGE.CV_EVALUATION_UNAVAILABLE
  }

  return error?.message || API_ERROR_MESSAGE.CV_EVALUATION_UNAVAILABLE
}

export {
  cvSectionLabel,
  fieldReviewLabel,
  formatMatchScore,
  normalizeEvaluationResult,
  scoreTone,
  toCvEvaluationErrorMessage,
}
