import CompanyDetailPage from '@/pages/CompanyDetailPage'
import ConfirmCompanyApprovalPage from '@/pages/ConfirmCompanyApprovalPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import HomePage from '@/pages/HomePage'
import JobDetailPage from '@/pages/JobDetailPage'
import JobSearchPage from '@/pages/JobSearchPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import VerifyEmailPage from '@/pages/VerifyEmailPage'
import { DEVELOPMENT_ENV, RUNTIME_ENV } from '@/utils/constant'

import JobDiscoveryRoute from './components/JobDiscoveryRoute'

const publicRoutes = [
  {
    element: <JobDiscoveryRoute />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'jobs',
        element: <JobSearchPage />,
      },
      {
        path: 'jobs/:jobId',
        element: <JobDetailPage />,
      },
      {
        path: 'companies/:companyId',
        element: <CompanyDetailPage />,
      },
    ],
  },
  {
    path: 'forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: 'reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: 'verify-email',
    element: <VerifyEmailPage />,
  },
  {
    path: 'confirm-company-approval',
    element: <ConfirmCompanyApprovalPage />,
  },
]

if (RUNTIME_ENV === DEVELOPMENT_ENV) {
  publicRoutes.push({
    path: 'rich-text-preview',
    lazy: async () => ({ Component: (await import('@/pages/RichTextPreviewPage')).default }),
  })
}

export default publicRoutes
