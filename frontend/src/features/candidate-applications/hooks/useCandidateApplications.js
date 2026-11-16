import { useCallback, useEffect, useState } from 'react'

import { listOwnApplicationsApi } from '@/apis/application.api'

function useCandidateApplications({ status = null, q = '' } = {}) {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({
    key: null,
    applications: [],
    allApplications: [],
    error: null,
  })

  useEffect(() => {
    let active = true
    const key = String(loadAttempt)
    const normalizedQuery = q.trim() || undefined
    const statusParam = status || undefined

    const listRequest = listOwnApplicationsApi({
      status: statusParam,
      q: normalizedQuery,
    })

    const statsRequest =
      statusParam || normalizedQuery
        ? listOwnApplicationsApi()
        : listRequest

    Promise.all([listRequest, statsRequest]).then(
      ([listResponse, statsResponse]) => {
        if (!active) {
          return
        }
        setView({
          key,
          applications: listResponse.applications ?? [],
          allApplications: statsResponse.applications ?? [],
          error: null,
        })
      },
      (error) => {
        if (active) {
          setView({
            key,
            applications: [],
            allApplications: [],
            error,
          })
        }
      },
    )

    return () => {
      active = false
    }
  }, [loadAttempt, status, q])

  const reload = useCallback(() => {
    setLoadAttempt((current) => current + 1)
  }, [])

  const replaceApplication = useCallback((nextApplication) => {
    setView((current) => ({
      ...current,
      applications: current.applications.map((item) =>
        item.id === nextApplication.id ? nextApplication : item,
      ),
      allApplications: current.allApplications.map((item) =>
        item.id === nextApplication.id ? nextApplication : item,
      ),
    }))
  }, [])

  return {
    loading: view.key !== String(loadAttempt),
    applications: view.applications,
    allApplications: view.allApplications,
    error: view.error,
    reload,
    replaceApplication,
  }
}

export default useCandidateApplications
