import { useEffect, useState } from 'react'

import { listExperienceLevelsApi } from '@/apis/experience-level.api'

function useExperienceLevels() {
  const [view, setView] = useState({ loaded: false, experienceLevels: [], error: null })

  useEffect(() => {
    let active = true

    listExperienceLevelsApi().then(
      ({ experienceLevels }) => {
        if (active) {
          setView({ loaded: true, experienceLevels, error: null })
        }
      },
      (error) => {
        if (active) {
          setView({ loaded: true, experienceLevels: [], error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [])

  return {
    experienceLevels: view.experienceLevels,
    loading: !view.loaded,
    error: view.error,
  }
}

export default useExperienceLevels
