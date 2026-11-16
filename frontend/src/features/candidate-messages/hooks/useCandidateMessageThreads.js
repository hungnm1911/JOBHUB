import { useCallback, useEffect, useState } from 'react'

import {
  getOwnApplicationConversationApi,
  listOwnApplicationsApi,
} from '@/apis/application.api'

import { buildThreadFromApplication, sortThreadsByActivity } from '../utils'

async function loadConversationForApplication(application) {
  try {
    const response = await getOwnApplicationConversationApi(application.id)
    return buildThreadFromApplication(application, response, null)
  } catch (error) {
    return buildThreadFromApplication(application, null, error)
  }
}

function useCandidateMessageThreads() {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({
    key: null,
    threads: [],
    error: null,
  })

  useEffect(() => {
    let active = true
    const key = String(loadAttempt)

    ;(async () => {
      try {
        const listResponse = await listOwnApplicationsApi()
        const applications = listResponse.applications ?? []

        if (!active) {
          return
        }

        if (applications.length === 0) {
          setView({ key, threads: [], error: null })
          return
        }

        const threads = await Promise.all(
          applications.map((application) => loadConversationForApplication(application)),
        )

        if (!active) {
          return
        }

        setView({
          key,
          threads: sortThreadsByActivity(threads),
          error: null,
        })
      } catch (error) {
        if (active) {
          setView({ key, threads: [], error })
        }
      }
    })()

    return () => {
      active = false
    }
  }, [loadAttempt])

  const reload = useCallback(() => {
    setLoadAttempt((current) => current + 1)
  }, [])

  const patchThread = useCallback((applicationId, patch) => {
    setView((current) => ({
      ...current,
      threads: sortThreadsByActivity(
        current.threads.map((thread) => {
          if (thread.applicationId !== applicationId) {
            return thread
          }
          const next = typeof patch === 'function' ? patch(thread) : { ...thread, ...patch }
          return next
        }),
      ),
    }))
  }, [])

  return {
    loading: view.key !== String(loadAttempt),
    threads: view.threads,
    error: view.error,
    reload,
    patchThread,
  }
}

export default useCandidateMessageThreads
