import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { listSavedJobsApi, unsaveJobApi } from '@/apis/saved-job.api'

function useSavedJobs() {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({
    key: null,
    savedJobs: [],
    error: null,
  })

  useEffect(() => {
    let active = true
    const key = String(loadAttempt)

    listSavedJobsApi().then(
      (response) => {
        if (active) {
          setView({
            key,
            savedJobs: response.savedJobs ?? [],
            error: null,
          })
        }
      },
      (error) => {
        if (active) {
          setView({ key, savedJobs: [], error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [loadAttempt])

  const reload = useCallback(() => {
    setLoadAttempt((current) => current + 1)
  }, [])

  const removeSavedJob = useCallback(async (jobId) => {
    await unsaveJobApi(jobId)
    setView((current) => ({
      ...current,
      savedJobs: current.savedJobs.filter((entry) => entry.job?.id !== jobId),
    }))
    toast.success('Đã bỏ lưu việc làm')
  }, [])

  return {
    loading: view.key !== String(loadAttempt),
    savedJobs: view.savedJobs,
    error: view.error,
    reload,
    removeSavedJob,
  }
}

export default useSavedJobs
