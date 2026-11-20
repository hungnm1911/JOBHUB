import { useEffect, useState } from 'react'

import { listFieldCategoriesApi } from '@/apis/category.api'
import { listExperienceLevelsApi } from '@/apis/experience-level.api'
import { listProvincesApi } from '@/apis/location.api'

function useCvCatalogOptions() {
  const [view, setView] = useState({
    loaded: false,
    fields: [],
    experienceLevels: [],
    provinces: [],
    error: null,
  })

  useEffect(() => {
    let active = true

    Promise.all([
      listFieldCategoriesApi(),
      listExperienceLevelsApi(),
      listProvincesApi(),
    ]).then(
      ([{ fields }, { experienceLevels }, { provinces }]) => {
        if (active) {
          setView({
            loaded: true,
            fields: fields ?? [],
            experienceLevels: experienceLevels ?? [],
            provinces: provinces ?? [],
            error: null,
          })
        }
      },
      (error) => {
        if (active) {
          setView({
            loaded: true,
            fields: [],
            experienceLevels: [],
            provinces: [],
            error,
          })
        }
      },
    )

    return () => {
      active = false
    }
  }, [])

  return {
    loading: !view.loaded,
    fields: view.fields,
    experienceLevels: view.experienceLevels,
    provinces: view.provinces,
    error: view.error,
  }
}

export default useCvCatalogOptions
