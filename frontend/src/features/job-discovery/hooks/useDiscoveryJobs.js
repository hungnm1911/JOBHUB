import { useEffect, useState } from 'react'

import { listDiscoveryJobsApi } from '@/apis/job-discovery.api'
import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'

const EMPTY_PAGINATION = Object.freeze({ page: 1, limit: 0, total: 0, totalPages: 0 })

function useDiscoveryJobs(query) {
  const viewer = useSessionViewer()
  const [loadAttempt, setLoadAttempt] = useState(0)
  // Session key refreshes Candidate-only enrichment such as isSaved after login/logout.
  const requestKey = JSON.stringify({
    ...query,
    loadAttempt,
    sessionUserId: viewer.resolved ? viewer.userId : undefined,
  })
  const [view, setView] = useState({
    key: null,
    jobs: [],
    pagination: EMPTY_PAGINATION,
    sort: null,
    error: null,
  })

  useEffect(() => {
    let active = true
    const params = JSON.parse(requestKey)
    delete params.loadAttempt
    delete params.sessionUserId

    listDiscoveryJobsApi(params).then(
      ({ jobs, pagination, sort }) => {
        if (active) {
          setView({ key: requestKey, jobs, pagination, sort, error: null })
        }
      },
      (error) => {
        if (active) {
          setView({ key: requestKey, jobs: [], pagination: EMPTY_PAGINATION, sort: null, error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [requestKey])

  return {
    loading: view.key !== requestKey,
    jobs: view.jobs,
    pagination: view.pagination,
    sort: view.sort,
    error: view.error,
    reload: () => setLoadAttempt((current) => current + 1),
  }
}

export default useDiscoveryJobs
