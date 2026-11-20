import { useEffect, useState } from 'react'

import { getOwnCandidateProfileApi } from '@/apis/candidate-profile.api'
import { syncAuthenticatedUserProfile } from '@/features/authentication/services/authentication.service'

function useCandidateProfile() {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({
    key: null,
    profile: null,
    error: null,
  })

  useEffect(() => {
    let active = true
    const key = String(loadAttempt)

    ;(async () => {
      try {
        const profileResponse = await getOwnCandidateProfileApi()
        if (active) {
          const profile = profileResponse.profile ?? null
          if (profile) {
            syncAuthenticatedUserProfile(profile)
          }
          setView({
            key,
            profile,
            error: null,
          })
        }
      } catch (error) {
        if (active) {
          setView({
            key,
            profile: null,
            error,
          })
        }
      }
    })()

    return () => {
      active = false
    }
  }, [loadAttempt])

  return {
    loading: view.key !== String(loadAttempt),
    profile: view.profile,
    error: view.error,
    reload: () => setLoadAttempt((current) => current + 1),
    setLocalProfile: (profile) => {
      if (profile) {
        syncAuthenticatedUserProfile(profile)
      }
      setView((current) => ({
        ...current,
        profile,
      }))
    },
  }
}

export default useCandidateProfile
