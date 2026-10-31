import { useEffect, useState } from 'react'

import { listPositionCategoriesApi } from '@/apis/category.api'

// Hovering through the Field list would otherwise refetch the same catalog
// branch repeatedly; failed loads are evicted so they can be retried.
const positionsByFieldId = new Map()

function loadPositions(fieldId) {
  if (!positionsByFieldId.has(fieldId)) {
    const request = listPositionCategoriesApi(fieldId).then(({ positions }) => positions)
    request.catch(() => positionsByFieldId.delete(fieldId))
    positionsByFieldId.set(fieldId, request)
  }

  return positionsByFieldId.get(fieldId)
}

function useFieldPositions(fieldId) {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const requestKey = fieldId ? `${fieldId}:${loadAttempt}` : null
  const [view, setView] = useState({ key: null, positions: [], error: null })

  useEffect(() => {
    if (!requestKey) {
      return undefined
    }

    let active = true

    loadPositions(fieldId).then(
      (positions) => {
        if (active) {
          setView({ key: requestKey, positions, error: null })
        }
      },
      (error) => {
        if (active) {
          setView({ key: requestKey, positions: [], error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [fieldId, requestKey])

  const current = view.key === requestKey

  return {
    loading: Boolean(requestKey) && !current,
    positions: current ? view.positions : [],
    error: current ? view.error : null,
    reload: () => setLoadAttempt((attempt) => attempt + 1),
  }
}

export default useFieldPositions
