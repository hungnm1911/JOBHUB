import { useEffect, useState } from 'react'

import { listPositionCategoriesApi } from '@/apis/category.api'

function usePositionsByField(fieldIds) {
  const [positionsByField, setPositionsByField] = useState({})
  const missing = fieldIds.filter((fieldId) => !(fieldId in positionsByField))
  const missingKey = missing.join(',')

  useEffect(() => {
    if (!missingKey) {
      return undefined
    }

    let active = true
    Promise.all(
      missingKey.split(',').map(async (fieldId) => {
        try {
          const { positions } = await listPositionCategoriesApi(fieldId)
          return [fieldId, positions ?? []]
        } catch {
          return [fieldId, []]
        }
      }),
    ).then((entries) => {
      if (active) {
        setPositionsByField((current) => ({ ...current, ...Object.fromEntries(entries) }))
      }
    })

    return () => {
      active = false
    }
  }, [missingKey])

  return { positionsByField, loading: missing.length > 0 }
}

export default usePositionsByField
