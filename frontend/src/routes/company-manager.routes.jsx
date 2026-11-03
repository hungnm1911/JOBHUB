import CompanyOnboardingPage from '@/pages/CompanyOnboardingPage'
import { USER_ROLE, USER_STATUS } from '@/utils/constant'

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
  ],
}

export default companyManagerRoutes
