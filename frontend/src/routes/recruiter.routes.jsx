import { Navigate } from 'react-router-dom'

import RecruiterLayout from '@/components/layouts/RecruiterLayout'
import RecruiterCandidateCvPage from '@/pages/RecruiterCandidateCvPage'
import RecruiterCandidateSearchPage from '@/pages/RecruiterCandidateSearchPage'
import RecruiterChangePasswordPage from '@/pages/RecruiterChangePasswordPage'
import RecruiterJobApplicationPage from '@/pages/RecruiterJobApplicationPage'
import RecruiterJobDetailPage from '@/pages/RecruiterJobDetailPage'
import RecruiterJobEditorPage from '@/pages/RecruiterJobEditorPage'
import RecruiterJobsPage from '@/pages/RecruiterJobsPage'
import RecruiterMessagesPage from '@/pages/RecruiterMessagesPage'
import RecruiterMyApplicationPage from '@/pages/RecruiterMyApplicationPage'
import RecruiterMyApplicationsPage from '@/pages/RecruiterMyApplicationsPage'
import RecruiterNotificationsPage from '@/pages/RecruiterNotificationsPage'
import RecruiterParticipatingJobsPage from '@/pages/RecruiterParticipatingJobsPage'
import {
  COMPANY_MEMBER_ROLE,
  COMPANY_MEMBER_STATUS,
  USER_ROLE,
  USER_STATUS,
} from '@/utils/constant'

import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'

// V3 BR-02: Recruiter is a COMPANY_STAFF account whose Company role is RECRUITER.
const recruiterRoutes = [
  {
    path: '/recruiter',
    element: <ProtectedRoute redirectTo="/login" />,
    children: [
      {
        element: (
          <RoleRoute
            allowedMembershipRoles={[COMPANY_MEMBER_ROLE.RECRUITER]}
            allowedMembershipStatuses={[COMPANY_MEMBER_STATUS.ACTIVE]}
            allowedRoles={[USER_ROLE.COMPANY_STAFF]}
            allowedStatuses={[USER_STATUS.ACTIVE]}
            requirePasswordSetup
          />
        ),
        children: [
          {
            element: <RecruiterLayout />,
            children: [
              { index: true, element: <Navigate replace to="/recruiter/jobs" /> },
              { path: 'jobs', element: <RecruiterJobsPage /> },
              { path: 'jobs/new', element: <RecruiterJobEditorPage /> },
              { path: 'jobs/:jobId', element: <RecruiterJobDetailPage /> },
              { path: 'jobs/:jobId/edit', element: <RecruiterJobEditorPage /> },
              { path: 'jobs/:jobId/applications/:applicationId', element: <RecruiterJobApplicationPage /> },
              { path: 'participating', element: <RecruiterParticipatingJobsPage /> },
              { path: 'my-applications', element: <RecruiterMyApplicationsPage /> },
              { path: 'my-applications/:applicationId', element: <RecruiterMyApplicationPage /> },
              { path: 'messages', element: <RecruiterMessagesPage /> },
              { path: 'candidates', element: <RecruiterCandidateSearchPage /> },
              { path: 'candidates/:cvId', element: <RecruiterCandidateCvPage /> },
              { path: 'notifications', element: <RecruiterNotificationsPage /> },
              { path: 'change-password', element: <RecruiterChangePasswordPage /> },
            ],
          },
        ],
      },
    ],
  },
]

export default recruiterRoutes
