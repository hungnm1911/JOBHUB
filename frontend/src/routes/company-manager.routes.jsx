import CompanyOnboardingPage from '@/pages/CompanyOnboardingPage'
import CompanyRecruitersPage from '@/pages/CompanyRecruitersPage'
import {
  COMPANY_MEMBER_ROLE,
  COMPANY_MEMBER_STATUS,
  USER_ROLE,
  USER_STATUS,
} from '@/utils/constant'

import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'

const companyManagerRoutes = {
  element: <ProtectedRoute redirectTo="/login" />,
  children: [
    {
      element: (
        <RoleRoute
          allowedRoles={[USER_ROLE.COMPANY_STAFF]}
          allowedStatuses={[USER_STATUS.PENDING_ACTIVATION]}
        />
      ),
      children: [
        {
          path: 'onboarding/company',
          element: <CompanyOnboardingPage />,
        },
      ],
    },
    {
      element: (
        <RoleRoute
          allowedMembershipRoles={[COMPANY_MEMBER_ROLE.COMPANY_MANAGER]}
          allowedMembershipStatuses={[COMPANY_MEMBER_STATUS.ACTIVE]}
          allowedRoles={[USER_ROLE.COMPANY_STAFF]}
          allowedStatuses={[USER_STATUS.ACTIVE]}
        />
      ),
      children: [
        {
          path: 'company/recruiters',
          element: <CompanyRecruitersPage />,
        },
      ],
    },
  ],
}

export default companyManagerRoutes
