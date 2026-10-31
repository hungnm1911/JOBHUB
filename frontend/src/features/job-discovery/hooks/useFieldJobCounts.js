import { useEffect, useState } from 'react'

import { listDiscoveryJobsApi } from '@/apis/job-discovery.api'

// Counts come from the discovery list total, so they follow the same public
// visibility rules as the job list itself.
function useFieldJobCounts(fieldIds) {
  const requestKey = fieldIds.join(',')
  const [view, setView] = useState({ key: null, counts: new Map() })

  useEffect(() => {
    if (requestKey === '') {
      return undefined
    }

    let active = true
    const ids = requestKey.split(',')

    Promise.all(
      ids.map((fieldId) =>
        listDiscoveryJobsApi({ categories: fieldId, limit: 1 }).then(
          ({ pagination }) => [fieldId, pagination.total],
          () => [fieldId, null],
        ),
      ),
    ).then((entries) => {
      if (active) {
        setView({ key: requestKey, counts: new Map(entries) })
      }
    })

    return () => {
      active = false
    }
  }, [requestKey])

  return {
    loading: requestKey !== '' && view.key !== requestKey,
    counts: view.key === requestKey ? view.counts : new Map(),
  }
}

export default useFieldJobCounts
