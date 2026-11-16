import { useEffect, useState } from 'react'

import { listOwnApplicationsApi } from '@/apis/application.api'
import { listOwnCandidateCvsApi } from '@/apis/candidate-cv.api'
import { getOwnCandidateProfileApi } from '@/apis/candidate-profile.api'
import { listOwnJobInvitationsApi } from '@/apis/job-invitation.api'
import { listDiscoveryJobsApi } from '@/apis/job-discovery.api'
import { listOwnNotificationsApi } from '@/apis/notification.api'
import { listSavedJobsApi } from '@/apis/saved-job.api'
import { syncAuthenticatedUserProfile } from '@/features/authentication/services/authentication.service'
import { JOB_DISCOVERY_SORT } from '@/features/job-discovery/search-params'

import { computeProfileCompletion, normalizeNotification } from '../utils'

const EMPTY_RESULT = Object.freeze({
  profile: null,
  cvs: [],
  applications: [],
  invitations: [],
  savedJobs: [],
  notifications: [],
  unreadCount: 0,
  discoveryJobs: [],
  completion: computeProfileCompletion({ profile: null, cvs: [] }),
})

function useCandidateDashboardData() {
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [view, setView] = useState({
    key: null,
    data: EMPTY_RESULT,
    error: null,
  })

  useEffect(() => {
    let active = true
    const requestKey = String(loadAttempt)

    Promise.allSettled([
      getOwnCandidateProfileApi(),
      listOwnCandidateCvsApi(),
      listOwnApplicationsApi(),
      listOwnJobInvitationsApi(),
      listSavedJobsApi(),
      listOwnNotificationsApi(),
      listDiscoveryJobsApi({ sort: JOB_DISCOVERY_SORT.NEWEST, page: 1, limit: 4 }),
    ]).then((results) => {
      if (!active) {
        return
      }

      const [profileResult, cvsResult, applicationsResult, invitationsResult, savedResult, notificationsResult, jobsResult] =
        results

      const hardFailures = [profileResult, cvsResult, applicationsResult].filter(
        (result) => result.status === 'rejected',
      )

      if (hardFailures.length === 3) {
        setView({
          key: requestKey,
          data: EMPTY_RESULT,
          error: hardFailures[0].reason,
        })
        return
      }

      const profile = profileResult.status === 'fulfilled' ? (profileResult.value.profile ?? null) : null
      if (profile) {
        syncAuthenticatedUserProfile(profile)
      }
      const cvs = cvsResult.status === 'fulfilled' ? (cvsResult.value.cvs ?? []) : []
      const applications =
        applicationsResult.status === 'fulfilled' ? (applicationsResult.value.applications ?? []) : []
      const invitations =
        invitationsResult.status === 'fulfilled' ? (invitationsResult.value.invitations ?? []) : []
      const savedJobs = savedResult.status === 'fulfilled' ? (savedResult.value.savedJobs ?? []) : []
      const notificationsPayload =
        notificationsResult.status === 'fulfilled' ? notificationsResult.value : null
      const discoveryJobs = jobsResult.status === 'fulfilled' ? (jobsResult.value.jobs ?? []) : []

      setView({
        key: requestKey,
        data: {
          profile,
          cvs,
          applications,
          invitations,
          savedJobs,
          notifications: (notificationsPayload?.notifications ?? [])
            .map(normalizeNotification)
            .filter(Boolean),
          unreadCount: notificationsPayload?.unreadCount ?? 0,
          discoveryJobs,
          completion: computeProfileCompletion({ profile, cvs }),
          partialErrors: {
            profile: profileResult.status === 'rejected' ? profileResult.reason : null,
            cvs: cvsResult.status === 'rejected' ? cvsResult.reason : null,
            applications: applicationsResult.status === 'rejected' ? applicationsResult.reason : null,
            invitations: invitationsResult.status === 'rejected' ? invitationsResult.reason : null,
            savedJobs: savedResult.status === 'rejected' ? savedResult.reason : null,
            notifications:
              notificationsResult.status === 'rejected' ? notificationsResult.reason : null,
            discoveryJobs: jobsResult.status === 'rejected' ? jobsResult.reason : null,
          },
        },
        error: null,
      })
    })

    return () => {
      active = false
    }
  }, [loadAttempt])

  return {
    loading: view.key !== String(loadAttempt),
    data: view.data,
    error: view.error,
    reload: () => setLoadAttempt((current) => current + 1),
  }
}

export default useCandidateDashboardData
