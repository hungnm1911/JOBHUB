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

export { toOptimizeEvaluationPayload }
