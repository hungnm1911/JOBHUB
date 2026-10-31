import { useEffect, useState } from 'react'

import { getDiscoveryCompanyApi } from '@/apis/job-discovery.api'

function useDiscoveryCompany(companyId) {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const requestKey = `${companyId}:${loadAttempt}`
  const [view, setView] = useState({ key: null, company: null, error: null })

  useEffect(() => {
    let active = true

    getDiscoveryCompanyApi(companyId)
      .then(({ company }) => {
        if (active) {
          setView({ key: requestKey, company, error: null })
        }
      })
      .catch((error) => {
        if (active) {
          setView({ key: requestKey, company: null, error })
        }
      })

    return () => {
      active = false
    }
  }, [companyId, requestKey])

  return {
    loading: view.key !== requestKey,
    company: view.company,
    error: view.error,
    reload: () => setLoadAttempt((current) => current + 1),
  }
}

export default useDiscoveryCompany
