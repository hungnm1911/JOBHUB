const FIELD_CRITERIA = Object.freeze([
  'skills',
  'category',
  'experience',
  'employmentType',
  'workMode',
])

function toOptimizeEvaluationPayload(evaluationResult) {
  if (!evaluationResult) {
    throw new Error('Thiếu kết quả đánh giá CV để tối ưu.')
  }

  const jobId = String(evaluationResult.jobId ?? '')
  const candidateCvId = String(evaluationResult.candidateCvId ?? '')
  const fieldReviews = Array.isArray(evaluationResult.fieldReviews)
    ? evaluationResult.fieldReviews
    : []
  const byCriterion = new Map(
    fieldReviews.map((item) => [item.criterion, item]),
  )

  if (FIELD_CRITERIA.some((criterion) => !byCriterion.has(criterion))) {
    throw new Error(
      'Kết quả đánh giá chưa đủ 5 tiêu chí. Hãy chạy lại đánh giá trước khi tối ưu.',
    )
  }

  return {
    jobId,
    candidateCvId,
    matchScore: Number(evaluationResult.matchScore),
    overallSummary:
      typeof evaluationResult.overallSummary === 'string'
        ? evaluationResult.overallSummary
        : '',
    fieldReviews: FIELD_CRITERIA.map((criterion) => {
      const item = byCriterion.get(criterion)
      return {
        criterion,
        score: Number(item.score),
        review: typeof item.review === 'string' ? item.review : '',
      }
    }),
    cvImprovements: (Array.isArray(evaluationResult.cvImprovements)
      ? evaluationResult.cvImprovements
      : []
    ).map((item) => ({
      section: item.section,
      sourceReference: item.sourceReference ?? null,
      comment: typeof item.comment === 'string' ? item.comment : '',
      suggestion: item.suggestion ?? null,
      rewrite: item.rewrite ?? null,
    })),
  }
}

// Backend rejects an unusable Proposal with these statuses (malformed/signature/
// expired 400, identity 403, Source missing 404, Source changed 409); retrying the
// same Proposal cannot succeed. Anything else (5xx, timeout, network) leaves the
// save outcome unknown.
const PROPOSAL_REJECTED_STATUSES = Object.freeze([400, 403, 404, 409])

function isProposalRejectedStatus(status) {
  return PROPOSAL_REJECTED_STATUSES.includes(status)
}

const COMMIT_REJECTION_MESSAGE = Object.freeze({
  400: 'Bản đề xuất không hợp lệ hoặc đã hết hạn. Hãy tạo lại bản tối ưu.',
  403: 'Bản đề xuất không thuộc về bạn, việc làm hoặc CV này. Hãy tạo lại bản tối ưu.',
  404: 'Không tìm thấy việc làm hoặc CV nguồn. Hãy kiểm tra lại rồi tạo lại bản tối ưu.',
  409: 'CV nguồn đã thay đổi kể từ khi tạo bản tối ưu. Hãy tạo lại bản tối ưu.',
})

const COMMIT_UNKNOWN_MESSAGE =
  'Chưa xác định được bản nháp đã được lưu hay chưa. Hãy kiểm tra Quản lý CV trước khi thử lại để tránh tạo trùng.'

function toOptimizationCommitErrorMessage(error) {
  return COMMIT_REJECTION_MESSAGE[error?.status] ?? COMMIT_UNKNOWN_MESSAGE
}

function toOptimizationPreviewErrorMessage(error) {
  return error?.message || 'Không tạo được bản tối ưu để xem trước.'
}

export {
  isProposalRejectedStatus,
  toOptimizationCommitErrorMessage,
  toOptimizationPreviewErrorMessage,
  toOptimizeEvaluationPayload,
}
