import CandidateLayout from '@/components/layouts/CandidateLayout'
import CandidateAiCenterPage from '@/pages/CandidateAiCenterPage'
import CandidateCvEvaluatePage from '@/pages/CandidateCvEvaluatePage'
import CandidateCvOptimizePage from '@/pages/CandidateCvOptimizePage'
import CandidateApplicationDetailPage from '@/pages/CandidateApplicationDetailPage'
import CandidateApplicationsPage from '@/pages/CandidateApplicationsPage'
import CandidateCvCreatePage from '@/pages/CandidateCvCreatePage'
import CandidateCvsPage from '@/pages/CandidateCvsPage'
import CandidateDashboardPage from '@/pages/CandidateDashboardPage'
import CandidateInvitationsPage from '@/pages/CandidateInvitationsPage'
import CandidateMessagesPage from '@/pages/CandidateMessagesPage'
import CandidateNotificationsPage from '@/pages/CandidateNotificationsPage'
import CandidateProfilePage from '@/pages/CandidateProfilePage'
import CandidateSavedJobsPage from '@/pages/CandidateSavedJobsPage'
import { USER_ROLE, USER_STATUS } from '@/utils/constant'
import { Navigate } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'

const candidateRoutes = [
  {
    path: '/candidate',
    element: <ProtectedRoute redirectTo="/login" />,
    children: [
      {
        element: (
          <RoleRoute
            allowedRoles={[USER_ROLE.CANDIDATE]}
            allowedStatuses={[USER_STATUS.ACTIVE]}
          />
        ),
        children: [
          {
            element: <CandidateLayout />,
            children: [
              { index: true, element: <CandidateDashboardPage /> },
              { path: 'profile', element: <CandidateProfilePage /> },
              { path: 'cvs', element: <CandidateCvsPage /> },
              { path: 'cvs/create', element: <CandidateCvCreatePage /> },
              { path: 'applications', element: <CandidateApplicationsPage /> },
              {
                path: 'applications/:applicationId',
                element: <CandidateApplicationDetailPage />,
              },
              { path: 'invitations', element: <CandidateInvitationsPage /> },
              { path: 'saved-jobs', element: <CandidateSavedJobsPage /> },
              { path: 'messages', element: <CandidateMessagesPage /> },
              { path: 'notifications', element: <CandidateNotificationsPage /> },
              {
                path: 'ai-jobs',
                element: <Navigate replace to="/candidate/ai-center" />,
              },
              { path: 'ai-center', element: <CandidateAiCenterPage /> },
              {
                path: 'ai-center/evaluate',
                element: <CandidateCvEvaluatePage />,
              },
              {
                path: 'ai-center/optimize',
                element: <CandidateCvOptimizePage />,
              },
            ],
          },
        ],
      },
    ],
  },
]

export default candidateRoutes
