import LoginPage from '@/pages/LoginPage'
import RegisterAccountTypePage from '@/pages/RegisterAccountTypePage'
import RegisterCandidatePage from '@/pages/RegisterCandidatePage'
import RegisterCompanyManagerPage from '@/pages/RegisterCompanyManagerPage'

import GuestRoute from './components/GuestRoute'

const guestRoutes = {
  element: <GuestRoute />,
  children: [
    {
      path: 'login',
      element: <LoginPage />,
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
}

export default guestRoutes
