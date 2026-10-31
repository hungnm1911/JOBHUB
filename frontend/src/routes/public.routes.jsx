import RootLayout from '@/layouts/RootLayout'
import CompanyDetailPage from '@/pages/CompanyDetailPage'
import ConfirmCompanyApprovalPage from '@/pages/ConfirmCompanyApprovalPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import HomePage from '@/pages/HomePage'
import JobDetailPage from '@/pages/JobDetailPage'
import JobSearchPage from '@/pages/JobSearchPage'
import LoginPage from '@/pages/LoginPage'
import RegisterAccountTypePage from '@/pages/RegisterAccountTypePage'
import RegisterCandidatePage from '@/pages/RegisterCandidatePage'
import RegisterCompanyManagerPage from '@/pages/RegisterCompanyManagerPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import VerifyEmailPage from '@/pages/VerifyEmailPage'

import companyOnboardingRoutes from './company-onboarding.routes'
const publicRoutes = [
  {
    path: '/',
    element: <RootLayout />,
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
      {
        path: 'login',
        element: <LoginPage />,
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
      {
        path: 'register',
        element: <RegisterAccountTypePage />,
      },
      {
        path: 'register/candidate',
        element: <RegisterCandidatePage />,
      },
      {
        path: 'register/company',
        element: <RegisterCompanyManagerPage />,
      },
      companyOnboardingRoutes,
    ],
  },
]

export default publicRoutes
