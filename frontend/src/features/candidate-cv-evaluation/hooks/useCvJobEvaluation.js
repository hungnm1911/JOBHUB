import { useCallback, useState } from 'react'

import { evaluateOwnCandidateCvForJobApi } from '@/apis/candidate-cv-evaluation.api'

import { normalizeEvaluationResult } from '../utils'

function useCvJobEvaluation() {
  const [view, setView] = useState({
    status: 'idle',
    result: null,
    rawResult: null,
    error: null,
    evaluatedJobId: null,
    evaluatedCvId: null,
  })

  const evaluate = useCallback(async ({ jobId, candidateCvId }) => {
    if (!jobId || !candidateCvId) {
      return null
    }

    setView({
      status: 'loading',
      result: null,
      rawResult: null,
      error: null,
      evaluatedJobId: jobId,
      evaluatedCvId: candidateCvId,
    })

    try {
      const response = await evaluateOwnCandidateCvForJobApi({ jobId, candidateCvId })
      const rawResult = response.evaluationResult ?? null
      const result = normalizeEvaluationResult(rawResult)
      setView({
        status: 'success',
        result,
        rawResult,
        error: null,
        evaluatedJobId: jobId,
        evaluatedCvId: candidateCvId,
      })
      return result
    } catch (error) {
      setView({
        status: 'error',
        result: null,
        rawResult: null,
        error,
        evaluatedJobId: jobId,
        evaluatedCvId: candidateCvId,
      })
      throw error
    }
  }, [])

  const reset = useCallback(() => {
    setView({
      status: 'idle',
      result: null,
      rawResult: null,
      error: null,
      evaluatedJobId: null,
      evaluatedCvId: null,
    })
  }, [])

  return {
    status: view.status,
    result: view.result,
    rawResult: view.rawResult,
    error: view.error,
    evaluatedJobId: view.evaluatedJobId,
    evaluatedCvId: view.evaluatedCvId,
    evaluating: view.status === 'loading',
    evaluate,
    reset,
  }
}

export default useCvJobEvaluation
