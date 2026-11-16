import { useState } from 'react'

import { recommendOwnDefaultCvJobsApi } from '@/apis/candidate-job-recommendation.api'

function useCandidateRecommendations() {
  const [view, setView] = useState({
    status: 'idle',
    recommendations: [],
    error: null,
  })

  const load = async () => {
    setView({ status: 'loading', recommendations: [], error: null })

    try {
      const response = await recommendOwnDefaultCvJobsApi()
      setView({
        status: 'success',
        recommendations: response.recommendations ?? [],
        error: null,
      })
    } catch (error) {
      setView({
        status: 'error',
        recommendations: [],
        error,
      })
    }
  }

  return {
    status: view.status,
    recommendations: view.recommendations,
    error: view.error,
    load,
  }
}

export default useCandidateRecommendations
