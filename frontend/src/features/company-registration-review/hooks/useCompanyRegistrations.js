import { useEffect, useState } from 'react'

import { listCompanyRegistrationsApi } from '@/apis/platform-admin.api'

import { toRegistrationStage } from '../utils'

function toListItems(companyRegistrations) {
  return companyRegistrations
    .map((registration) => ({ ...registration, stage: toRegistrationStage(registration) }))
    .sort((left, right) => new Date(right.submittedAt) - new Date(left.submittedAt))
}

function useCompanyRegistrations() {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({ attempt: -1, items: [], error: null, loadedAt: null })

  useEffect(() => {
    let active = true

    listCompanyRegistrationsApi().then(
      ({ companyRegistrations }) => {
        if (active) {
          setView({
            attempt: loadAttempt,
            items: toListItems(companyRegistrations),
            error: null,
            loadedAt: Date.now(),
          })
        }
      },
      (error) => {
        if (active) {
          setView({ attempt: loadAttempt, items: [], error, loadedAt: null })
        }
      },
    )

    return () => {
      active = false
    }
  }, [loadAttempt])

  return {
    loading: view.attempt !== loadAttempt,
    items: view.items,
    error: view.error,
    loadedAt: view.loadedAt,
    reload: () => setLoadAttempt((current) => current + 1),
  }
}

export default useCompanyRegistrations
