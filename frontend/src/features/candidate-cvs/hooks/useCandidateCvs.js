import { useEffect, useState } from 'react'

import { listOwnCandidateCvsApi } from '@/apis/candidate-cv.api'

import { sortCvsForDisplay } from '../utils'

function useCandidateCvs() {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({ key: null, cvs: [], error: null })

  useEffect(() => {
    let active = true
    const key = String(loadAttempt)

    listOwnCandidateCvsApi().then(
      (response) => {
        if (active) {
          setView({
            key,
            cvs: sortCvsForDisplay(response.cvs ?? []),
            error: null,
          })
        }
      },
      (error) => {
        if (active) {
          setView({ key, cvs: [], error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [loadAttempt])

  const reload = () => setLoadAttempt((current) => current + 1)

  const upsertCv = (cv) => {
    setView((current) => {
      const without = current.cvs.filter((item) => item.id !== cv.id)
      return {
        ...current,
        cvs: sortCvsForDisplay([...without, cv]),
      }
    })
  }

  const removeCv = (cvId) => {
    setView((current) => ({
      ...current,
      cvs: current.cvs.filter((item) => item.id !== cvId),
    }))
  }

  return {
    loading: view.key !== String(loadAttempt),
    cvs: view.cvs,
    error: view.error,
    reload,
    upsertCv,
    removeCv,
  }
}

export default useCandidateCvs
