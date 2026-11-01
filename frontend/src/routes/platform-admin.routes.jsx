import PlatformAdminLayout from '@/components/layouts/PlatformAdminLayout'
import AdminCompanyRegistrationReviewPage from '@/pages/AdminCompanyRegistrationReviewPage'
import AdminCompanyRegistrationsPage from '@/pages/AdminCompanyRegistrationsPage'
import AdminDashboardPage from '@/pages/AdminDashboardPage'
import { USER_ROLE } from '@/utils/constant'

import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'

const platformAdminRoutes = [
  {
    path: '/admin',
    element: <ProtectedRoute redirectTo="/login" />,
    children: [
      {
        element: <RoleRoute allowedRoles={[USER_ROLE.PLATFORM_ADMIN]} />,
        children: [
          {
            element: <PlatformAdminLayout />,
            children: [
              {
                index: true,
                element: <AdminDashboardPage />,
              },
              {
                path: 'company-registrations',
                element: <AdminCompanyRegistrationsPage />,
              },
              {
                path: 'company-registrations/:companyId',
                element: <AdminCompanyRegistrationReviewPage />,
              },
            ],
          },
        ],
      },
    ],
  },
]

export default platformAdminRoutes
