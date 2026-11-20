import CandidateAiCenterPage from '@/pages/CandidateAiCenterPage'
import CandidateApplicationDetailPage from '@/pages/CandidateApplicationDetailPage'
import CandidateApplicationsPage from '@/pages/CandidateApplicationsPage'
import CandidateCvCreatePage from '@/pages/CandidateCvCreatePage'
import CandidateCvsPage from '@/pages/CandidateCvsPage'
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
    path: 'candidate',
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
          { index: true, element: <Navigate replace to="/" /> },
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
          { path: 'ai-jobs', element: <CandidateAiCenterPage /> },
          {
            path: 'ai-center',
            element: <Navigate replace to="/candidate/ai-jobs" />,
          },
          {
            path: 'ai-center/evaluate',
            element: <Navigate replace to="/jobs" />,
          },
          {
            path: 'ai-center/optimize',
            element: <Navigate replace to="/jobs" />,
          },
        ],
      },
    ],
  },
]

export default candidateRoutes
