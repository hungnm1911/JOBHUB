import RootLayout from '@/layouts/RootLayout'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import RegisterAccountTypePage from '@/pages/RegisterAccountTypePage'
import RegisterCandidatePage from '@/pages/RegisterCandidatePage'
import RegisterCompanyManagerPage from '@/pages/RegisterCompanyManagerPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import VerifyEmailPage from '@/pages/VerifyEmailPage'

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
    ],
  },
]

export default publicRoutes
