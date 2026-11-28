import AdminAccountsPage from '@/pages/AdminAccountsPage'
import AdminAccountDetailPage from '@/pages/AdminAccountDetailPage'
import AdminCompaniesPage from '@/pages/AdminCompaniesPage'
import AdminCompanyDetailPage from '@/pages/AdminCompanyDetailPage'
import AdminCategoriesPage from '@/pages/AdminCategoriesPage'
import AdminAnnouncementsPage from '@/pages/AdminAnnouncementsPage'
import AdminNotificationsPage from '@/pages/AdminNotificationsPage'
import AdminSupportPage from '@/pages/AdminSupportPage'
import AdminStatisticsPage from '@/pages/AdminStatisticsPage'
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
              { path: 'accounts', element: <AdminAccountsPage /> },
              { path: 'accounts/:userId', element: <AdminAccountDetailPage /> },
              { path: 'companies', element: <AdminCompaniesPage /> },
              {
                path: 'companies/:companyId',
                element: <AdminCompanyDetailPage />,
              },
              { path: 'categories', element: <AdminCategoriesPage /> },
              { path: 'announcements', element: <AdminAnnouncementsPage /> },
              { path: 'notifications', element: <AdminNotificationsPage /> },
              { path: 'support', element: <AdminSupportPage /> },
              { path: 'support/:companyId', element: <AdminSupportPage /> },
              { path: 'statistics', element: <AdminStatisticsPage /> },

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
