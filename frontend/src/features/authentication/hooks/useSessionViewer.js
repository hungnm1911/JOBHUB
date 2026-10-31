import { useAppSelector } from '@/store/hooks'

import { AUTHENTICATION_STATUS, selectAuthenticatedUser, selectAuthenticationStatus } from '../slice'

// Public read model for pages that adapt content to who is browsing;
// `role` is null for guests and `resolved` stays false while a session is restoring.
function useSessionViewer() {
  const status = useAppSelector(selectAuthenticationStatus)
  const user = useAppSelector(selectAuthenticatedUser)

  const authenticated = status === AUTHENTICATION_STATUS.AUTHENTICATED

  return {
    resolved:
      authenticated || status === AUTHENTICATION_STATUS.UNAUTHENTICATED,
    role: authenticated ? (user?.role ?? null) : null,
    // Used by discovery surfaces so Candidate-only fields like isSaved refetch after login/logout.
    userId: authenticated ? (user?.id ?? null) : null,
  }
}

export default useSessionViewer
