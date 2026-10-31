import { useEffect, useState } from 'react'

import { listDistrictLevelUnitsApi } from '@/apis/location.api'

// Browsing provinces in the location picker would otherwise refetch the same
// catalog branch repeatedly; failed loads are evicted so they can be retried.
const unitsByProvinceCode = new Map()

function loadDistrictLevelUnits(provinceCode) {
  if (!unitsByProvinceCode.has(provinceCode)) {
    const request = listDistrictLevelUnitsApi(provinceCode).then(
      ({ districtLevelUnits }) => districtLevelUnits,
    )
    request.catch(() => unitsByProvinceCode.delete(provinceCode))
    unitsByProvinceCode.set(provinceCode, request)
  }

  return unitsByProvinceCode.get(provinceCode)
}

function useDistrictLevelUnits(provinceCode) {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const requestKey = provinceCode ? `${provinceCode}:${loadAttempt}` : null
  const [view, setView] = useState({ key: null, units: [], error: null })

  useEffect(() => {
    if (!requestKey) {
      return undefined
    }

    let active = true

    loadDistrictLevelUnits(provinceCode).then(
      (units) => {
        if (active) {
          setView({ key: requestKey, units, error: null })
        }
      },
      (error) => {
        if (active) {
          setView({ key: requestKey, units: [], error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [provinceCode, requestKey])

  const current = view.key === requestKey

  return {
    loading: Boolean(requestKey) && !current,
    units: current ? view.units : [],
    error: current ? view.error : null,
    reload: () => setLoadAttempt((attempt) => attempt + 1),
  }
}

export default useDistrictLevelUnits
