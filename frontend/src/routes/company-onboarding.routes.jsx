import CompanyOnboardingPage from '@/pages/CompanyOnboardingPage'
import { USER_ROLE } from '@/utils/constant'

import ProtectedRoute from './ProtectedRoute'
import RoleRoute from './RoleRoute'

const companyOnboardingRoutes = {
  element: <ProtectedRoute redirectTo="/login" />,
  children: [
    {
      element: <RoleRoute allowedRoles={[USER_ROLE.COMPANY_STAFF]} redirectTo="/" />,
      children: [
        {
          path: 'onboarding/company',
          element: <CompanyOnboardingPage />,
        },
      ],
    },
  ],
}

export default companyOnboardingRoutes
