import { useEffect, useState } from 'react'

import { getPublicCompanyProfileApi } from '@/apis/job-discovery.api'

// Recruiters cannot read the Company self-service profile; the public profile carries
// the name and logo shown in the workspace header. A failed read just hides them.
function useOwnCompanyProfile(companyId) {
  const [profile, setProfile] = useState({ companyId: null, company: null })

  useEffect(() => {
    if (!companyId) {
      return undefined
    }

    let active = true
    getPublicCompanyProfileApi(companyId).then(
      (data) => active && setProfile({ companyId, company: data.company ?? null }),
      () => active && setProfile({ companyId, company: null }),
    )

    return () => {
      active = false
    }
  }, [companyId])

  return profile.companyId === companyId ? profile.company : null
}

export default useOwnCompanyProfile
