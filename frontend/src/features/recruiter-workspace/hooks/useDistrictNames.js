import { useEffect, useState } from 'react'

import { listDistrictLevelUnitsApi } from '@/apis/location.api'

// Loads district-level names once per Province that the visible Jobs use.
function useDistrictNames(provinceCodes) {
  const [namesByProvince, setNamesByProvince] = useState({})
  const missingKey = [...new Set(provinceCodes)]
    .filter((code) => code && !(code in namesByProvince))
    .sort()
    .join(',')

  useEffect(() => {
    if (!missingKey) {
      return undefined
    }

    let active = true
    Promise.all(
      missingKey.split(',').map(async (provinceCode) => {
        try {
          const { districtLevelUnits } = await listDistrictLevelUnitsApi(provinceCode)
          return [
            provinceCode,
            Object.fromEntries((districtLevelUnits ?? []).map((unit) => [unit.code, unit.name])),
          ]
        } catch {
          return [provinceCode, {}]
        }
      }),
    ).then((entries) => {
      if (active) {
        setNamesByProvince((current) => ({ ...current, ...Object.fromEntries(entries) }))
      }
    })

    return () => {
      active = false
    }
  }, [missingKey])

  return namesByProvince
}

export default useDistrictNames
