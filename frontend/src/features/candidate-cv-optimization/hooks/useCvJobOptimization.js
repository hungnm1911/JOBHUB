import { useCallback, useState } from 'react'

import { createOptimizedCandidateCvDraftForJobApi } from '@/apis/candidate-cv-optimization.api'

import { toOptimizeEvaluationPayload } from '../utils'

function useCvJobOptimization() {
  const [view, setView] = useState({
    status: 'idle',
    draftCv: null,
    error: null,
  })

  const optimize = useCallback(async ({ jobId, candidateCvId, evaluationResult }) => {
    if (!jobId || !candidateCvId || !evaluationResult) {
      return null
    }

    setView({ status: 'loading', draftCv: null, error: null })

    try {
      const payload = toOptimizeEvaluationPayload(evaluationResult)
      const response = await createOptimizedCandidateCvDraftForJobApi({
        jobId,
        candidateCvId,
        evaluationResult: payload,
      })
      const draftCv = response.cv ?? null
      setView({ status: 'success', draftCv, error: null })
      return draftCv
    } catch (error) {
      setView({ status: 'error', draftCv: null, error })
      throw error
    }
  }, [])

  const reset = useCallback(() => {
    setView({ status: 'idle', draftCv: null, error: null })
  }, [])

  return {
    status: view.status,
    draftCv: view.draftCv,
    error: view.error,
    optimizing: view.status === 'loading',
    optimize,
    reset,
  }
}

export default useCvJobOptimization
