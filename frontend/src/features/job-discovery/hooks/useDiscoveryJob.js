import { useEffect, useState } from 'react'

import { getDiscoveryJobApi } from '@/apis/job-discovery.api'
import { listDistrictLevelUnitsApi } from '@/apis/location.api'
import useSessionViewer from '@/features/authentication/hooks/useSessionViewer'

function useDiscoveryJob(jobId) {
  const viewer = useSessionViewer()
  const [loadAttempt, setLoadAttempt] = useState(0)
  // Session key refreshes Candidate-only enrichment such as isSaved after login/logout.
  const requestKey = `${jobId}:${viewer.resolved ? viewer.userId ?? 'guest' : 'pending'}:${loadAttempt}`
  const [view, setView] = useState({ key: null, job: null, districtName: null, error: null })

  useEffect(() => {
    let active = true

    getDiscoveryJobApi(jobId)
      .then(async ({ job }) => {
        const { provinceCode, districtCode } = job.location ?? {}
        let districtName = null

        if (provinceCode && districtCode) {
          districtName = await listDistrictLevelUnitsApi(provinceCode).then(
            ({ districtLevelUnits }) =>
              districtLevelUnits.find((unit) => unit.code === districtCode)?.name ?? null,
            () => null,
          )
        }

        if (active) {
          setView({ key: requestKey, job, districtName, error: null })
        }
      })
      .catch((error) => {
        if (active) {
          setView({ key: requestKey, job: null, districtName: null, error })
        }
      })

    return () => {
      active = false
    }
  }, [jobId, requestKey])

  return {
    loading: view.key !== requestKey,
    job: view.job,
    districtName: view.districtName,
    error: view.error,
    reload: () => setLoadAttempt((current) => current + 1),
  }
}

export default useDiscoveryJob
