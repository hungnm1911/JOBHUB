import { useAppSelector } from '@/store/hooks'
import {
  COMPANY_MEMBER_ROLE,
  COMPANY_MEMBER_STATUS,
  USER_ROLE,
  USER_STATUS,
} from '@/utils/constant'

import {
  ACCOUNT_CONTEXT_STATUS,
  AUTHENTICATION_STATUS,
  selectAccountContextStatus,
  selectAuthenticatedUser,
  selectAuthenticationStatus,
  selectMembership,
} from '../slice'

// Public read model for pages that adapt content to who is browsing;
// `role` is null for guests and `resolved` stays false while a session is restoring.
function useSessionViewer() {
  const status = useAppSelector(selectAuthenticationStatus)
  const user = useAppSelector(selectAuthenticatedUser)

  const membership = useAppSelector(selectMembership)
  const accountContextStatus = useAppSelector(selectAccountContextStatus)

  const authenticated = status === AUTHENTICATION_STATUS.AUTHENTICATED
  const activeCompanyStaff =
    authenticated &&
    user?.role === USER_ROLE.COMPANY_STAFF &&
    user.status === USER_STATUS.ACTIVE &&
    !user.mustChangePassword &&
    accountContextStatus === ACCOUNT_CONTEXT_STATUS.RESOLVED &&
    membership?.status === COMPANY_MEMBER_STATUS.ACTIVE

  return {
    isRecruiter:
      activeCompanyStaff && membership.role === COMPANY_MEMBER_ROLE.RECRUITER,
    isCompanyManager:
      activeCompanyStaff &&
      membership.role === COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
    resolved: authenticated || status === AUTHENTICATION_STATUS.UNAUTHENTICATED,
    role: authenticated ? user?.role ?? null : null,
    // Used by discovery surfaces so Candidate-only fields like isSaved refetch after login/logout.
    userId: authenticated ? user?.id ?? null : null,
  }
}

export default useSessionViewer
