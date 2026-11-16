import { useCallback, useEffect, useState } from 'react'

import { listOwnJobInvitationsApi } from '@/apis/job-invitation.api'

function useCandidateInvitations() {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({
    key: null,
    invitations: [],
    error: null,
  })

  useEffect(() => {
    let active = true
    const key = String(loadAttempt)

    listOwnJobInvitationsApi().then(
      (response) => {
        if (!active) {
          return
        }
        setView({
          key,
          invitations: response.invitations ?? [],
          error: null,
        })
      },
      (error) => {
        if (active) {
          setView({
            key,
            invitations: [],
            error,
          })
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

  const replaceInvitation = useCallback((nextInvitation) => {
    setView((current) => ({
      ...current,
      invitations: current.invitations.map((item) =>
        item.id === nextInvitation.id ? nextInvitation : item,
      ),
    }))
  }, [])

  return {
    loading: view.key !== String(loadAttempt),
    invitations: view.invitations,
    error: view.error,
    reload,
    replaceInvitation,
  }
}

export default useCandidateInvitations
