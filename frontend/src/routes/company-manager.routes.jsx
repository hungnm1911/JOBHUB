import CompanyManagerLayout from '@/components/layouts/CompanyManagerLayout'
import CompanyOnboardingPage from '@/pages/CompanyOnboardingPage'
import CompanyJobsPage from '@/pages/CompanyJobsPage'
import CompanyJobDetailPage from '@/pages/CompanyJobDetailPage'
import CompanyProfilePage from '@/pages/CompanyProfilePage'
import CompanyRecruiterCreatePage from '@/pages/CompanyRecruiterCreatePage'
import CompanyRecruiterDetailPage from '@/pages/CompanyRecruiterDetailPage'
import CompanyRecruiterHandoverPage from '@/pages/CompanyRecruiterHandoverPage'
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
          path: 'company',
          element: <CompanyManagerLayout />,
          children: [
            { path: 'jobs', element: <CompanyJobsPage /> },
            { path: 'jobs/:jobId', element: <CompanyJobDetailPage /> },
            { path: 'recruiters', element: <CompanyRecruitersPage /> },
            { path: 'recruiters/new', element: <CompanyRecruiterCreatePage /> },
            {
              path: 'recruiters/:recruiterId',
              element: <CompanyRecruiterDetailPage />,
            },
            {
              path: 'recruiters/:recruiterId/handover',
              element: <CompanyRecruiterHandoverPage />,
            },
            { path: 'profile', element: <CompanyProfilePage /> },
          ],
        },
      ],
    },
  ],
}

export default companyManagerRoutes
