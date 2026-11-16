import { useCallback, useEffect, useState } from 'react'

import { getOwnApplicationApi } from '@/apis/application.api'

function useCandidateApplicationDetail(applicationId) {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({
    key: null,
    application: null,
    error: null,
  })

  useEffect(() => {
    if (!applicationId) {
      setView({
        key: String(loadAttempt),
        application: null,
        error: new Error('Thiếu mã đơn ứng tuyển.'),
      })
      return undefined
    }

    let active = true
    const key = String(loadAttempt)

    getOwnApplicationApi(applicationId).then(
      (response) => {
        if (active) {
          setView({
            key,
            application: response.application ?? null,
            error: null,
          })
        }
      },
      (error) => {
        if (active) {
          setView({ key, application: null, error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [applicationId, loadAttempt])

  const reload = useCallback(() => {
    setLoadAttempt((current) => current + 1)
  }, [])

  const setApplication = useCallback((nextApplication) => {
    setView((current) => ({
      ...current,
      application:
        typeof nextApplication === 'function'
          ? nextApplication(current.application)
          : nextApplication,
    }))
  }, [])

  return {
    loading: view.key !== String(loadAttempt),
    application: view.application,
    error: view.error,
    reload,
    setApplication,
  }
}

export default useCandidateApplicationDetail
