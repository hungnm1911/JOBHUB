import { useEffect, useState } from 'react'

import { listFieldCategoriesApi } from '@/apis/category.api'
import { listExperienceLevelsApi } from '@/apis/experience-level.api'

function useCvCatalogOptions() {
  const [view, setView] = useState({
    loaded: false,
    fields: [],
    experienceLevels: [],
    error: null,
  })

  useEffect(() => {
    let active = true

    Promise.all([listFieldCategoriesApi(), listExperienceLevelsApi()]).then(
      ([{ fields }, { experienceLevels }]) => {
        if (active) {
          setView({
            loaded: true,
            fields: fields ?? [],
            experienceLevels: experienceLevels ?? [],
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
    error: view.error,
  }
}

export default useCvCatalogOptions
